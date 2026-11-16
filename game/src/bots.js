// Bot AI: one brain for both teams. 9 bots (4 allies DUST, 5 enemies VIPER).
// State machine: patrol -> hold -> engage -> retreat. Vision cone + cheap 2D LOS,
// hearing, burst fire with reaction time and distance falloff. Movement reuses
// createMover, so bots collide exactly like the player. Tune via the constants.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createMover } from './player.js';

export const BOT_ACCURACY = 0.55;
export const BOT_REACT_MIN = 0.25;
export const BOT_REACT_MAX = 0.45;
export const BOT_SPEED = 4.6;
export const BOT_VIEW_DIST = 40;
export const BOT_HEAR_DIST = 25;

const ALLY_NAMES = ['DUST-1', 'DUST-2', 'DUST-3', 'DUST-4'];
const ENEMY_NAMES = ['VIPER-1', 'VIPER-2', 'VIPER-3', 'VIPER-4', 'VIPER-5'];
const ALLY_HOLD = [25, 10, 16, 18];
const ENEMY_HOLD = [16, 25, 17, 26, 18];
const ALLY_SPAWN = [[-3, 17], [-1, 18], [1, 18], [3, 17]];
const ENEMY_SPAWN = [[-4, -17], [-2, -18], [0, -18], [2, -18], [4, -17]];

function adjacency(edges, count) {
  const adj = Array.from({ length: count }, () => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

// True when the segment passes through any smoke cloud (2D distance from
// the segment to the cloud centre is less than the cloud radius).
function inSmoke(x1, z1, x2, z2, clouds) {
  for (const cloud of clouds) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz || 1;
    let t = ((cloud.x - x1) * dx + (cloud.z - z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + dx * t;
    const cz = z1 + dz * t;
    if (Math.hypot(cloud.x - cx, cloud.z - cz) < cloud.r) return true;
  }
  return false;
}

function bfsPath(adj, from, to) {
  if (from === to) return [to];
  const prev = new Array(adj.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const node = queue.shift();
    for (const next of adj[node]) {
      if (prev[next] !== -1) continue;
      prev[next] = node;
      if (next === to) {
        const path = [to];
        let cur = to;
        while (cur !== from) {
          cur = prev[cur];
          path.unshift(cur);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [to];
}

export function createBots(scene, world, options = {}) {
  const random = options.random ?? Math.random;
  const waypoints = world.waypoints;
  const adj = adjacency(world.edges, waypoints.length);
  const onKill = options.onKill ?? (() => {});
  const onDamagePlayer = options.onDamagePlayer ?? (() => {});

  function nearestWaypoint(x, z) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < waypoints.length; i += 1) {
      const d = (waypoints[i].x - x) ** 2 + (waypoints[i].z - z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function makeBot(name, team, spawn, color, holdNode) {
    const mover = createMover(world.colliders, { speed: BOT_SPEED });
    mover.state.position.set(spawn[0], 0, spawn[1]);
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6, metalness: 0.05 });
    const ink = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.3), mat);
    torso.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12), ink);
    head.position.y = 1.53;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.6), ink);
    gun.position.set(0.2, 1.05, -0.25);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), mat);
    legL.position.set(-0.14, 0.25, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    group.add(torso, head, gun, legL, legR);
    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    scene.add(group);
    const bot = {
      name, team, mover, group, torso, head, legL, legR,
      health: 100, armor: 0, alive: true, fall: 0,
      state: 'patrol', holdNode, path: [], pathIndex: 0,
      target: null, targetIsPlayer: false, reactLeft: 0,
      burstLeft: 0, burstGap: 0, shotsFired: 0,
      // Attackers spawn south and face north (yaw 0); defenders spawn north
      // and face south (yaw PI). Yaw 0 faces -z, PI faces +z.
      yaw: team === 'atk' ? 0 : Math.PI, walkPhase: random() * 6,
      lastDamager: null, lastDamageAt: -99,
    };
    torso.userData.bot = bot;
    torso.userData.part = 'torso';
    head.userData.bot = bot;
    head.userData.part = 'head';
    return bot;
  }

  const bots = [];
  ALLY_NAMES.forEach((name, i) => bots.push(makeBot(name, 'atk', ALLY_SPAWN[i], PALETTE.accent, ALLY_HOLD[i])));
  ENEMY_NAMES.forEach((name, i) => bots.push(makeBot(name, 'def', ENEMY_SPAWN[i], PALETTE.danger, ENEMY_HOLD[i])));
  const hitMeshes = [];
  for (const bot of bots) hitMeshes.push(bot.torso, bot.head);

  let site = 'A';
  let time = 0;

  function siteGoal() {
    return site === 'A' ? 12 : 13;
  }

  function setPath(bot, goal) {
    const from = nearestWaypoint(bot.mover.state.position.x, bot.mover.state.position.z);
    bot.path = bfsPath(adj, from, goal);
    bot.pathIndex = 0;
  }

  function visibleEnemy(bot, ctx) {
    const eye = bot.mover.state.position;
    const candidates = [];
    if (bot.team === 'def' && ctx.playerAlive) {
      candidates.push({ pos: ctx.playerPos, isPlayer: true, bot: null, moving: ctx.playerSpeed > 0.5 });
    }
    for (const other of bots) {
      if (!other.alive || other.team === bot.team) continue;
      candidates.push({ pos: other.mover.state.position, isPlayer: false, bot: other, moving: true });
    }
    let best = null;
    let bestDist = Infinity;
    for (const cand of candidates) {
      const dx = cand.pos.x - eye.x;
      const dz = cand.pos.z - eye.z;
      const dist = Math.hypot(dx, dz);
      if (dist > BOT_VIEW_DIST || dist >= bestDist) continue;
      const angle = Math.atan2(-dx, -dz);
      let diff = angle - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > (100 * Math.PI) / 360) continue;
      if (world.losBlocked(eye.x, eye.z, cand.pos.x, cand.pos.z)) continue;
      if (ctx.smokeClouds && inSmoke(eye.x, eye.z, cand.pos.x, cand.pos.z, ctx.smokeClouds)) continue;
      best = cand;
      bestDist = dist;
    }
    return best ? { ...best, dist: bestDist } : null;
  }

  function damageBot(victim, amount, killer) {
    if (!victim.alive) return false;
    let rest = amount;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, rest * 0.5);
      victim.armor -= absorbed;
      rest -= absorbed;
    }
    victim.health -= rest;
    victim.lastDamager = killer ?? null;
    victim.lastDamageAt = time;
    if (victim.health <= 0) {
      victim.alive = false;
      victim.fall = 0;
      victim.state = 'dead';
      onKill(killer ?? null, victim);
      return true;
    }
    return false;
  }

  function botShoot(bot, target, dist) {
    const falloff = Math.max(0.25, 1 - dist / 55);
    const movingPenalty = target.moving ? 0.8 : 1;
    const chance = BOT_ACCURACY * falloff * movingPenalty;
    if (random() > chance) return;
    const damage = 24 + random() * 10;
    if (target.isPlayer) {
      onDamagePlayer(damage, bot);
    } else if (target.bot) {
      damageBot(target.bot, damage, bot);
    }
  }

  function stepBot(bot, dt, ctx) {
    const mover = bot.mover;
    if (!bot.alive) {
      bot.fall = Math.min(1, bot.fall + dt / 0.4);
      bot.group.rotation.x = -bot.fall * 1.45;
      return;
    }
    const pos = mover.state.position;
    if (ctx.phase !== 'live') {
      mover.step(dt, 0, 0, false);
      bot.group.position.copy(pos);
      return;
    }

    const seen = visibleEnemy(bot, ctx);
    if (seen) {
      bot.target = seen;
      bot.targetIsPlayer = seen.isPlayer;
      if (bot.state !== 'engage') {
        bot.state = 'engage';
        bot.reactLeft = BOT_REACT_MIN + random() * (BOT_REACT_MAX - BOT_REACT_MIN);
        bot.burstLeft = 0;
      }
    } else if (bot.state === 'engage') {
      bot.state = 'patrol';
      bot.target = null;
    }

    if (bot.state === 'engage' && bot.target) {
      const t = bot.target;
      const dx = t.pos.x - pos.x;
      const dz = t.pos.z - pos.z;
      bot.yaw = Math.atan2(-dx, -dz);
      mover.step(dt, 0, 0, false);
      bot.reactLeft -= dt;
      if (ctx.throwFrag && random() < dt * 0.02) ctx.throwFrag(bot, t.pos);
      if (bot.reactLeft <= 0) {
        if (bot.burstLeft === 0) {
          bot.burstLeft = 3 + Math.floor(random() * 3);
          bot.burstGap = 0;
        }
        bot.burstGap -= dt;
        if (bot.burstGap <= 0 && bot.burstLeft > 0) {
          botShoot(bot, t, t.dist);
          bot.burstLeft -= 1;
          bot.burstGap = 0.11;
          if (bot.burstLeft === 0) bot.reactLeft = 0.5 + random() * 0.4;
        }
      }
    } else {
      if (bot.health < 35) {
        bot.state = 'retreat';
        const home = bot.team === 'atk' ? 0 : 19;
        if (!bot.path.length || bot.path[bot.path.length - 1] !== home) {
          setPath(bot, home);
        }
        // Heal at home: a retreated bot recovers and pushes again instead
        // of camping spawn at low health for the rest of the round.
        const homeNode = waypoints[home];
        if (Math.hypot(homeNode.x - pos.x, homeNode.z - pos.z) < 1.5) {
          bot.health = Math.min(100, bot.health + 20 * dt);
        }
      } else if (bot.team === 'atk') {
        bot.state = 'patrol';
        // A dropped bomb outranks the site: someone must pick it up.
        const goal = ctx.droppedBomb
          ? nearestWaypoint(ctx.droppedBomb.x, ctx.droppedBomb.z)
          : siteGoal();
        if (!bot.path.length || bot.path[bot.path.length - 1] !== goal) setPath(bot, goal);
      } else {
        bot.state = 'hold';
        // When the bomb is planted, defenders abandon their hold and converge
        // on it so the defuse can actually happen.
        const dest = ctx.plantedBomb
          ? nearestWaypoint(ctx.plantedBomb.x, ctx.plantedBomb.z)
          : bot.holdNode;
        if (!bot.path.length || bot.path[bot.path.length - 1] !== dest) setPath(bot, dest);
      }
      // Unstuck: if we have somewhere to go but barely moved in the last
      // second, sidestep perpendicular for a short burst instead of pushing
      // into the same obstacle forever.
      if (!bot.stuck) bot.stuck = { x: pos.x, z: pos.z, t: 0, side: 0, sideLeft: 0 };
      const st = bot.stuck;
      st.t += dt;
      if (st.t >= 1) {
        const moved = Math.hypot(pos.x - st.x, pos.z - st.z);
        if (bot.path.length && moved < 0.15) {
          st.side = random() < 0.5 ? -1 : 1;
          st.sideLeft = 0.7;
        }
        st.x = pos.x;
        st.z = pos.z;
        st.t = 0;
      }
      const node = waypoints[bot.path[Math.min(bot.pathIndex, bot.path.length - 1)]];
      if (node) {
        let dx = node.x - pos.x;
        let dz = node.z - pos.z;
        // Close to a dropped bomb: walk the last metres to the bomb itself —
        // the nearest waypoint can sit metres away from it, and the pickup
        // radius would never trigger from the waypoint.
        if (ctx.droppedBomb && bot.team === 'atk') {
          const bdx = ctx.droppedBomb.x - pos.x;
          const bdz = ctx.droppedBomb.z - pos.z;
          if (Math.hypot(bdx, bdz) < 4) {
            dx = bdx;
            dz = bdz;
          }
        }
        const dist = Math.hypot(dx, dz);
        if (dist < 0.6) {
          bot.pathIndex += 1;
        } else {
          const jump = node.y > pos.y + 0.3;
          if (st.sideLeft > 0) {
            st.sideLeft -= dt;
            mover.step(dt, (-dz / dist) * st.side, (dx / dist) * st.side, false);
          } else {
            mover.step(dt, dx / dist, dz / dist, jump);
          }
          bot.yaw = Math.atan2(-dx, -dz);
        }
      } else {
        mover.step(dt, 0, 0, false);
      }
      if (bot.state === 'hold' && (!bot.path.length || bot.pathIndex >= bot.path.length)) {
        bot.yaw += dt * 0.15 * Math.sin(time * 0.4 + bot.walkPhase);
      }
    }

    bot.walkPhase += dt * 9 * (Math.hypot(mover.state.velocity.x, mover.state.velocity.z) / BOT_SPEED);
    const sway = Math.sin(bot.walkPhase) * 0.06;
    bot.group.position.set(pos.x, pos.y, pos.z);
    bot.group.rotation.set(0, bot.yaw, sway);
    bot.legL.rotation.x = Math.sin(bot.walkPhase) * 0.5;
    bot.legR.rotation.x = -Math.sin(bot.walkPhase) * 0.5;
  }

  return {
    bots,
    hitMeshes,
    setSite(next) {
      site = next;
      for (const bot of bots) bot.path = [];
    },
    reset() {
      for (let i = 0; i < bots.length; i += 1) {
        const bot = bots[i];
        const spawn = bot.team === 'atk' ? ALLY_SPAWN[i] : ENEMY_SPAWN[i - 4];
        bot.mover.state.position.set(spawn[0], 0, spawn[1]);
        bot.mover.state.velocity.set(0, 0, 0);
        bot.health = 100;
        bot.armor = 0;
        bot.alive = true;
        bot.fall = 0;
        bot.state = 'patrol';
        bot.path = [];
        bot.target = null;
        bot.group.rotation.set(0, 0, 0);
        bot.group.position.set(spawn[0], 0, spawn[1]);
      }
    },
    damage(bot, amount, part) {
      return damageBot(bot, part === 'head' ? 100 : amount, null);
    },
    hearShot(x, z) {
      for (const bot of bots) {
        if (!bot.alive || bot.state === 'engage') continue;
        const dx = bot.mover.state.position.x - x;
        const dz = bot.mover.state.position.z - z;
        if (Math.hypot(dx, dz) < BOT_HEAR_DIST) {
          bot.yaw = Math.atan2(-(x - bot.mover.state.position.x), -(z - bot.mover.state.position.z));
        }
      }
    },
    aliveCount(team) {
      return bots.filter((b) => b.alive && b.team === team).length;
    },
    step(dt, ctx) {
      time = ctx.time;
      for (const bot of bots) stepBot(bot, dt, ctx);
    },
  };
}
