// Grenades: smoke (12 s cloud that blocks bot LOS + sight), flash (white-out
// when it pops in your view), frag (1.5 s fuse, 6 m radius, max 90 damage).
// Thrown with a short arc; the fuse, not the landing, decides the pop.
import * as THREE from 'three';

const FRAG_FUSE = 1.5;
const FRAG_RADIUS = 6;
const FRAG_MAX = 90;
const SMOKE_SECONDS = 12;
const SMOKE_RADIUS = 4;
const FLASH_FUSE = 1.2;

export function createGrenades(scene, world, options = {}) {
  const onDamageBot = options.onDamageBot ?? (() => {});
  const onDamagePlayer = options.onDamagePlayer ?? (() => {});
  const onFlash = options.onFlash ?? (() => {});
  const projectiles = [];
  const clouds = [];
  const effects = [];
  let time = 0;

  const ballGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const smokeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b8b0a4'), transparent: true, opacity: 0.55, roughness: 1,
  });
  const flashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff') });

  function spawnEffect(mesh, life) {
    scene.add(mesh);
    effects.push({ mesh, life, age: 0 });
  }

  function explode(pos, owner) {
    const boom = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb35c'), transparent: true, opacity: 0.8 }),
    );
    boom.position.copy(pos);
    spawnEffect(boom, 0.4);
    const light = new THREE.PointLight(new THREE.Color('#ffb35c'), 60, 18);
    light.position.copy(pos);
    scene.add(light);
    effects.push({ mesh: light, life: 0.25, age: 0 });
    for (const bot of options.bots ?? []) {
      if (!bot.alive) continue;
      const d = bot.mover.state.position.distanceTo(pos);
      if (d < FRAG_RADIUS) {
        onDamageBot(bot, FRAG_MAX * (1 - d / FRAG_RADIUS), owner);
      }
    }
    if (options.playerPos && options.playerAlive?.()) {
      const d = options.playerPos.distanceTo(pos);
      if (d < FRAG_RADIUS) onDamagePlayer(FRAG_MAX * (1 - d / FRAG_RADIUS), owner);
    }
  }

  function pop(proj) {
    if (proj.type === 'frag') {
      explode(proj.mesh.position, proj.owner);
    } else if (proj.type === 'smoke') {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(SMOKE_RADIUS, 16, 12), smokeMat.clone());
      cloud.position.copy(proj.mesh.position);
      cloud.position.y = Math.max(1.2, cloud.position.y);
      scene.add(cloud);
      clouds.push({ mesh: cloud, x: cloud.position.x, z: cloud.position.z, r: SMOKE_RADIUS, until: time + SMOKE_SECONDS });
    } else if (proj.type === 'flash') {
      const p = proj.mesh.position;
      spawnEffect(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), flashMat), 0.12);
      effects[effects.length - 1].mesh.position.copy(p);
      if (options.playerPos && options.playerAlive?.()) {
        const to = new THREE.Vector3().subVectors(p, options.playerPos).normalize();
        const forward = options.playerForward?.() ?? new THREE.Vector3(0, 0, -1);
        const facing = forward.dot(to);
        const dist = options.playerPos.distanceTo(p);
        if (facing > 0.3 && dist < 25) {
          onFlash(Math.min(1, facing * (1 - dist / 30) * 1.4));
        }
      }
    }
    scene.remove(proj.mesh);
  }

  return {
    clouds,
    throwFrom(origin, direction, type, owner) {
      const mesh = new THREE.Mesh(
        ballGeo,
        new THREE.MeshStandardMaterial({ color: new THREE.Color(type === 'smoke' ? '#b8b0a4' : '#3a3f45'), roughness: 0.6 }),
      );
      mesh.position.copy(origin);
      scene.add(mesh);
      projectiles.push({
        mesh,
        type,
        owner,
        velocity: direction.clone().multiplyScalar(14).add(new THREE.Vector3(0, 3.2, 0)),
        fuse: type === 'frag' ? FRAG_FUSE : type === 'flash' ? FLASH_FUSE : 1.2,
        age: 0,
      });
    },
    step(dt, ctx) {
      time = ctx.time;
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        const proj = projectiles[i];
        proj.age += dt;
        proj.velocity.y -= 12 * dt;
        proj.mesh.position.addScaledVector(proj.velocity, dt);
        const p = proj.mesh.position;
        if (p.y <= 0.12) {
          p.y = 0.12;
          if (proj.type === 'smoke') {
            pop(proj);
            projectiles.splice(i, 1);
            continue;
          }
          proj.velocity.y *= -0.35;
          proj.velocity.x *= 0.6;
          proj.velocity.z *= 0.6;
        }
        if (proj.age >= proj.fuse) {
          pop(proj);
          projectiles.splice(i, 1);
        }
      }
      for (let i = clouds.length - 1; i >= 0; i -= 1) {
        const cloud = clouds[i];
        if (time >= cloud.until) {
          scene.remove(cloud.mesh);
          clouds.splice(i, 1);
        } else {
          cloud.mesh.material.opacity = 0.55 * Math.min(1, (cloud.until - time) / 2);
        }
      }
      for (let i = effects.length - 1; i >= 0; i -= 1) {
        const effect = effects[i];
        effect.age += dt;
        const k = 1 - effect.age / effect.life;
        if (effect.mesh.isMesh) {
          effect.mesh.scale.setScalar(1 + (1 - k) * 5);
          effect.mesh.material.opacity = Math.max(0, 0.8 * k);
        } else if (effect.mesh.isLight) {
          effect.mesh.intensity = 60 * k;
        }
        if (effect.age >= effect.life) {
          scene.remove(effect.mesh);
          effects.splice(i, 1);
        }
      }
    },
  };
}
