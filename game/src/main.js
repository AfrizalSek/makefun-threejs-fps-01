// DUSTLINE boot and the one loop: a fixed 60 Hz simulation feeding a render at
// the display's rate. 5v5 tactical FPS: the player + 4 ally bots attack two sites
// held by 5 enemy bots; rounds run buy -> live -> roundEnd, first to 5.
// ?shot=start|play|end with &seed=N sets up a deterministic frame for a capture,
// renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createEconomy, KILL_BONUS, PLANT_BONUS } from './economy.js';
import { createWeapon } from './weapons.js';
import { createGrenades } from './grenades.js';
import { createWorld } from './world.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { PALETTE } from './palette.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 25, 60);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const weapon = createWeapon(camera);
const hud = createHud();
const audio = createAudio();
const player = createPlayer(world.colliders);
const input = createInput(renderer.domElement, onLockChange);
const economy = createEconomy();
const raycaster = new THREE.Raycaster();
raycaster.far = 80;

const body = player.state;
body.position.set(0, 0, 17);
let playerHealth = 100;
let playerArmor = 0;
let playerAlive = true;
let score = 0;
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let buyOpen = false;

// Test-only: runShot('plant') sets this so defenders cannot kill the
// planter mid-plant and drop the bomb. Never set during real play.
let godMode = false;

function damagePlayer(amount, source) {
  if (godMode || !playerAlive) return;
  let rest = amount;
  if (playerArmor > 0) {
    const absorbed = Math.min(playerArmor, rest * 0.5);
    playerArmor -= absorbed;
    rest -= absorbed;
  }
  playerHealth -= rest;
  if (playerHealth <= 0) {
    playerHealth = 0;
    playerAlive = false;
    const killerName = source ? source.name ?? source : '???';
    hud.addKill(killerName, 'YOU');
    if (rounds.state.bomb.carrier === 'YOU') {
      rounds.dropBomb(body.position.x, body.position.z);
    }
  }
}

const bots = createBots(scene, world, {
  random,
  onKill(killer, victim) {
    rounds.recordKill(killer, victim, elapsed);
    hud.addKill(killer ? killer.name : 'FRAG', victim.name);
    if (rounds.state.bomb.carrier === victim) {
      rounds.dropBomb(victim.mover.state.position.x, victim.mover.state.position.z);
    }
  },
  onDamagePlayer(amount, bot) {
    damagePlayer(amount, bot);
  },
});

const grenades = createGrenades(scene, world, {
  bots: bots.bots,
  playerPos: body.position,
  playerAlive: () => playerAlive,
  playerForward: () => camera.getWorldDirection(new THREE.Vector3()),
  onDamageBot(bot, dmg, owner) {
    const killed = bots.damage(bot, dmg, 'body');
    if (killed) {
      hud.addKill(owner === 'YOU' ? 'YOU' : owner?.name ?? 'FRAG', bot.name);
      if (owner === 'YOU') {
        rounds.notePlayerKill(bot, elapsed);
        score += 100;
        economy.add(KILL_BONUS);
        hud.setScore(score);
        hud.setMoney(economy.money);
        audio.kill();
      }
    }
  },
  onDamagePlayer(dmg, owner) {
    damagePlayer(dmg, owner);
  },
  onFlash(strength) {
    hud.flashScreen(strength);
  },
});

const rounds = createRounds({
  random,
  onPhase(phase) {
    if (phase === 'buy') {
      bots.reset();
      bots.setSite(rounds.state.site);
      const carriers = bots.bots.filter((b) => b.team === 'atk');
      rounds.setCarrier(carriers[Math.floor(random() * carriers.length)]);
      body.position.set(0, 0, 17);
      body.velocity.set(0, 0, 0);
      body.yaw = 0;
      body.pitch = 0;
      playerHealth = 100;
      playerAlive = true;
      weapon.refill();
      hud.setAmmo(weapon.state.mag, weapon.state.reserve);
      hud.setMoney(economy.money);
    }
  },
  onRoundEnd(winner, reason) {
    economy.roundEnd(winner === 'atk');
    hud.setScore(score);
    hud.setMoney(economy.money);
    hud.showBanner(reason);
    if (reason === 'Bomb detonated') audio.explosion();
    else if (winner === 'atk') audio.roundWin();
  },
  onMatchEnd() {
    hud.showScoreboard(rounds.stats, rounds.state.scoreAtk, rounds.state.scoreDef, rounds.state.mvp, economy.money);
    hud.setPlayAgainVisible(true);
    if (document.pointerLockElement) document.exitPointerLock();
  },
  onPlant(carrier) {
    if (carrier === 'YOU') {
      economy.add(PLANT_BONUS);
      hud.setMoney(economy.money);
    }
    const site = rounds.state.site;
    hud.showBanner(`Bomb planted at ${site} — 35 seconds`, 4000);
  },
});

rounds.setRoster(['YOU', ...bots.bots.map((b) => b.name)]);

const shootables = world.shootables.concat(bots.hitMeshes);
const direction = new THREE.Vector3();
const markerHoldMs = shot ? 4000 : 90;
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#ffe9a8'), transparent: true, opacity: 0.9 });

function spawnTracer(end) {
  const start = camera.position.clone().addScaledVector(direction, 0.6);
  const geo = new THREE.BufferGeometry().setFromPoints([start, end.clone()]);
  const line = new THREE.Line(geo, tracerMat.clone());
  scene.add(line);
  tracers.push({ line, life: 0.06 });
}

function stepTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const tracer = tracers[i];
    tracer.life -= dt;
    tracer.line.material.opacity = Math.max(0, tracer.life / 0.06) * 0.9;
    if (tracer.life <= 0) {
      scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

// Bomb prop: a small box with a blinking light, positioned by bomb state.
const bombMesh = new THREE.Group();
const bombBox = new THREE.Mesh(
  new THREE.BoxGeometry(0.4, 0.18, 0.3),
  new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.danger), roughness: 0.6 }),
);
const bombLight = new THREE.Mesh(
  new THREE.SphereGeometry(0.05, 8, 6),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.danger) }),
);
bombLight.position.set(0, 0.14, 0);
bombMesh.add(bombBox, bombLight);
bombMesh.visible = false;
scene.add(bombMesh);

rounds.start();
hud.setAmmo(weapon.state.mag, weapon.state.reserve);
hud.setScore(0);
hud.setMoney(economy.money);
hud.onVolume((v) => audio.setVolume(v));
hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (rounds.state.matchOver) {
    rounds.start();
    hud.hideOverlay();
    hud.hideScoreboard();
  }
  input.requestLock();
});
hud.onPlayAgain(() => {
  if (shot) return;
  audio.unlock();
  rounds.start();
  hud.hideOverlay();
  hud.hideScoreboard();
  input.requestLock();
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else if (!rounds.state.matchOver && !buyOpen) {
    hud.showOverlay(started ? 'paused' : 'start', score);
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  if (!weapon.takeRound()) return false;
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const hit = raycaster.intersectObjects(shootables, false)[0];
  const end = hit ? hit.point : camera.position.clone().addScaledVector(direction, 80);
  spawnTracer(end);
  if (hit && hit.object.userData.bot) {
    const bot = hit.object.userData.bot;
    const part = hit.object.userData.part;
    const killed = bots.damage(bot, part === 'head' ? 100 : weapon.damage(), part);
    if (killed) {
      rounds.notePlayerKill(bot, elapsed);
      score += 100;
      economy.add(KILL_BONUS);
      hud.setMoney(economy.money);
      hud.addKill('YOU', bot.name, part === 'head');
      audio.kill();
    } else {
      score += 10;
      audio.hit();
    }
    hud.setScore(score);
    hud.hitMarker(killed, markerHoldMs);
  }
  bots.hearShot(body.position.x, body.position.z);
  weapon.pullTrigger();
  audio.shot(weapon.state.weapon);
  player.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  return true;
}

function throwPlayerGrenade() {
  const type = weapon.throwGrenade();
  if (!type) return;
  camera.getWorldDirection(direction);
  const origin = camera.position.clone().addScaledVector(direction, 0.5);
  origin.y -= 0.1;
  grenades.throwFrom(origin, direction.clone(), type, 'YOU');
}

function carrierPos() {
  const bomb = rounds.state.bomb;
  if (bomb.carrier === 'YOU') return body.position;
  if (bomb.carrier) return bomb.carrier.mover.state.position;
  return null;
}

function step(dt) {
  elapsed += dt;
  const phase = rounds.state.phase;
  if (playerAlive && (phase === 'live' || phase === 'buy')) {
    player.step(dt, input.state.keys, weapon.state.ads ? 0.6 : 1);
  }
  weapon.step(dt);
  grenades.step(dt, { time: elapsed });
  const bomb = rounds.state.bomb;
  bots.step(dt, {
    time: elapsed,
    phase,
    playerPos: body.position,
    playerAlive,
    playerSpeed: player.groundSpeed(),
    smokeClouds: grenades.clouds,
    plantedBomb: bomb.status === 'planted' ? { x: bomb.x, z: bomb.z } : null,
    droppedBomb: bomb.status === 'dropped' ? { x: bomb.x, z: bomb.z } : null,
    throwFrag(bot, targetPos) {
      const from = bot.mover.state.position.clone();
      from.y += 1.4;
      const dir = new THREE.Vector3(targetPos.x - from.x, 0, targetPos.z - from.z).normalize();
      grenades.throwFrom(from, dir, 'frag', bot);
    },
  });
  rounds.step(dt, {
    aliveAtk: bots.aliveCount('atk') + (playerAlive ? 1 : 0),
    aliveDef: bots.aliveCount('def'),
  });

  // Bomb: pickup, plant, defuse.
  if (bomb.status === 'dropped') {
    if (playerAlive && Math.hypot(body.position.x - bomb.x, body.position.z - bomb.z) < 1.2) {
      rounds.setCarrier('YOU');
      hud.showBanner('You picked up the bomb');
    } else {
      const taker = bots.bots.find(
        (b) => b.alive && b.team === 'atk' && Math.hypot(b.mover.state.position.x - bomb.x, b.mover.state.position.z - bomb.z) < 1.2,
      );
      if (taker) rounds.setCarrier(taker);
    }
  }
  if (bomb.status === 'carried' && phase === 'live') {
    const pos = carrierPos();
    if (pos) {
      const inZone = world.areaAt(pos.x, pos.z) === `SITE ${rounds.state.site}`;
      const holding = bomb.carrier === 'YOU' ? input.state.keys.has('KeyE') : inZone;
      rounds.plantTick(dt, inZone, holding);
    }
  }
  if (bomb.status === 'planted' && phase === 'live') {
    const near = bots.bots.some(
      (b) => b.alive && b.team === 'def' && Math.hypot(b.mover.state.position.x - bomb.x, b.mover.state.position.z - bomb.z) < 1.5,
    );
    rounds.defuseTick(dt, near, near);
    bombLight.visible = Math.floor(elapsed * 2) % 2 === 0;
    if (elapsed - lastBeepAt >= 1) {
      lastBeepAt = elapsed;
      if (near) audio.defuseBeep();
      else audio.plantBeep();
    }
  }

  // HUD + tracers ride the same fixed step as the simulation, so they stay
  // correct even when the render loop is throttled.
  stepTracers(dt);
  hud.setHealth(playerHealth, playerArmor);
  hud.setTimer(rounds.state.phase, rounds.state.phaseLeft, rounds.state.scoreAtk, rounds.state.scoreDef);
  hud.setArea(world.areaAt(body.position.x, body.position.z));

  // Bomb prop position.
  if (bomb.status === 'carried') {
    const pos = carrierPos();
    if (pos) {
      bombMesh.visible = true;
      bombMesh.position.set(pos.x, (pos.y ?? 0) + 0.5, pos.z);
    } else {
      bombMesh.visible = false;
    }
  } else if (bomb.status === 'dropped' || bomb.status === 'planted') {
    bombMesh.visible = true;
    bombMesh.position.set(bomb.x, 0.12, bomb.z);
  } else {
    bombMesh.visible = false;
  }
}

let stepSoundTimer = 0;
let lastBeepAt = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (playerAlive) player.look(look.x, look.y);
    weapon.setAds(input.state.ads && playerAlive);
    hud.setCrosshairAds(weapon.state.ads);
    const targetFov = weapon.adsFov();
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
      camera.updateProjectionMatrix();
    }
    const firingEdge = input.takeFiringEdge();
    if (playerAlive && rounds.state.phase === 'live') {
      if (weapon.state.selectedGrenade && firingEdge) {
        throwPlayerGrenade();
      } else if (weapon.ready() && (weapon.isSemi() ? firingEdge : input.state.firing)) {
        shoot(shot ? 0 : weapon.spread(player.groundSpeed(), body.crouching));
      }
    }
    if (input.state.keys.has('KeyR') && weapon.state.reloadLeft === 0
      && weapon.state.mag < weapon.current().mag && weapon.state.reserve > 0) {
      weapon.reload();
      audio.reload();
    }
    // Footsteps while moving on the ground.
    if (playerAlive && player.groundSpeed() > 1 && body.onGround) {
      stepSoundTimer += dt;
      if (stepSoundTimer > 0.38) {
        stepSoundTimer = 0;
        audio.step();
      }
    } else {
      stepSoundTimer = 0;
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function buyHandler(id) {
  const result = economy.buy(id, weapon);
  if (result.ok) {
    if (id === 'armor') playerArmor = economy.takeArmor();
    hud.setAmmo(weapon.state.mag, weapon.state.reserve);
    hud.setMoney(economy.money);
    openBuyMenu();
  }
}

function openBuyMenu() {
  if (rounds.state.phase !== 'buy') return;
  buyOpen = true;
  hud.showBuyMenu(economy.catalog(weapon), economy.money, buyHandler);
}

function closeBuyMenu() {
  buyOpen = false;
  hud.hideBuyMenu();
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Tab') {
    event.preventDefault();
    if (!shot && !hud.isScoreboardOpen()) {
      hud.showScoreboard(rounds.stats, rounds.state.scoreAtk, rounds.state.scoreDef, rounds.state.mvp, economy.money);
      hud.setPlayAgainVisible(rounds.state.matchOver);
    }
    return;
  }
  if (event.code === 'Escape' && buyOpen) {
    closeBuyMenu();
    return;
  }
  if (event.code === 'KeyB' && !shot) {
    if (buyOpen) closeBuyMenu();
    else openBuyMenu();
    return;
  }
  if (buyOpen) {
    const n = Number(event.code.replace('Digit', ''));
    if (n >= 1 && n <= 9) {
      const items = economy.catalog(weapon);
      const item = items[n - 1];
      if (item) {
        const result = economy.buy(item.id, weapon);
        if (result.ok) {
          if (item.id === 'armor') playerArmor = economy.takeArmor();
          hud.setAmmo(weapon.state.mag, weapon.state.reserve);
          hud.setMoney(economy.money);
          openBuyMenu();
        }
      }
    }
    return;
  }
  if (event.code === 'KeyQ' && !shot) {
    const owned = weapon.ownedList();
    const next = owned[(owned.indexOf(weapon.state.weapon) + 1) % owned.length];
    if (weapon.switchTo(next)) hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  }
  if (event.code === 'Digit4') weapon.selectGrenade('smoke');
  if (event.code === 'Digit5') weapon.selectGrenade('flash');
  if (event.code === 'Digit6') weapon.selectGrenade('frag');
  if (!shot && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
    const owned = weapon.ownedList();
    const name = owned[Number(event.code.replace('Digit', '')) - 1];
    if (name && weapon.switchTo(name)) hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Tab' && !rounds.state.matchOver) hud.hideScoreboard();
});

function runShot(name) {
  hud.hideOverlay();
  body.pitch = 0;
  body.yaw = 0;
  if (name === 'play') {
    body.position.set(0, 0, 8);
    settle(16 * 60);
    playerHealth = 100;
    playerAlive = true;
    const alive = bots.bots.filter((b) => b.alive && b.team === 'def');
    const targetBot = alive[0];
    if (targetBot) {
      const point = new THREE.Vector3(
        targetBot.mover.state.position.x,
        targetBot.mover.state.position.y + 1.0,
        targetBot.mover.state.position.z,
      );
      for (let round = 0; round < 3; round += 1) {
        aimAt(point);
        shoot(0);
        if (round < 2) settle(8);
      }
    }
    settle(12);
    hud.setHealth(playerHealth, playerArmor);
    hud.setTimer(rounds.state.phase, rounds.state.phaseLeft, rounds.state.scoreAtk, rounds.state.scoreDef);
    hud.setArea(world.areaAt(body.position.x, body.position.z));
  } else if (name === 'buy') {
    body.position.set(0, 0, 17);
    settle(5);
    aimAt(new THREE.Vector3(0, 1.5, -6));
    openBuyMenu();
    hud.setHealth(100, 0);
    hud.setTimer('buy', 15, 0, 0);
    hud.setArea('SPAWN');
  } else if (name === 'plant') {
    // Deterministic plant at the round's site: the player carries the bomb.
    // godMode keeps defenders from killing the planter mid-plant and
    // dropping it. The camera stands north of the pad, looking south down
    // the lane at the bomb, with the smoke behind it.
    const sx = rounds.state.site === 'A' ? -14 : 14;
    rounds.setCarrier('YOU');
    settle(16 * 60);
    rounds.setCarrier('YOU');
    playerHealth = 100;
    playerAlive = true;
    godMode = true;
    body.position.set(sx, 0, -14);
    input.state.keys.add('KeyE');
    settle(200);
    input.state.keys.delete('KeyE');
    godMode = false;
    weapon.addGrenade('smoke', 1);
    weapon.selectGrenade('smoke');
    aimAt(new THREE.Vector3(sx, 1.2, -6));
    throwPlayerGrenade();
    settle(90);
    body.position.set(sx, 0, -18);
    aimAt(new THREE.Vector3(sx, 0.5, -14));
    hud.setHealth(playerHealth, playerArmor);
    hud.setTimer('live', rounds.state.bomb.timer, rounds.state.scoreAtk, rounds.state.scoreDef);
    hud.setArea(`SITE ${rounds.state.site}`);
  } else if (name === 'end') {
    body.position.set(0, 0, 8);
    settle(16 * 60);
    playerHealth = 100;
    playerAlive = true;
    rounds.state.scoreAtk = 4;
    for (const bot of bots.bots) {
      if (bot.team === 'def' && bot.alive) bots.damage(bot, 100, 'head');
    }
    settle(40);
    hud.setHealth(playerHealth, playerArmor);
    hud.setTimer('end', 0, rounds.state.scoreAtk, rounds.state.scoreDef);
    hud.setArea(world.areaAt(body.position.x, body.position.z));
  } else {
    body.position.set(0.6, 0, 8.6);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, -6));
    hud.showOverlay('start', 0);
  }
  hud.setScore(score);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug handle for the Playwright harness only: read-only game state.
window.__dustline = {
  rounds: rounds.state,
  roundsApi: rounds,
  bots: bots.bots,
  botsApi: bots,
  economy,
  weapon,
  grenades,
  hud,
  audio,
  get playerPos() {
    return body.position;
  },
  get playerHealth() {
    return playerHealth;
  },
  get playerAlive() {
    return playerAlive;
  },
  get score() {
    return score;
  },
  // Advance the simulation directly (same fixed steps the frame loop runs).
  // Headless tabs throttle rAF, so the harness drives game time this way.
  fastForward(seconds) {
    const steps = Math.round(seconds / FIXED_STEP);
    for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
    syncCamera();
  },
};

syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
