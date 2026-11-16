// DUSTLINE map: a 40x40 m desert-dusk compound. Two bomb sites (A west, B east),
// three lanes (A long, mid with a door, roofed B tunnels), a balcony over site A.
// Every box is a collider and a bullet stop. Waypoints + LOS blockers are exported
// for the bot AI. Procedural CanvasTextures only, no external files.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function speckle(ctx, size, base, dots, colors) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < dots; i += 1) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.12 + (i % 5) * 0.05;
    ctx.fillRect((i * 37) % size, (i * 91) % size, 2 + (i % 3), 2 + (i % 2));
  }
  ctx.globalAlpha = 1;
}

function signTexture(letter, bg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 128, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#7a5a7a');
  gradient.addColorStop(0.45, '#dfa26e');
  gradient.addColorStop(0.75, '#e8b98a');
  gradient.addColorStop(1, '#c9a06b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const SITES = [
  { name: 'A', x: -14, z: -14 },
  { name: 'B', x: 14, z: -14 },
];

export const WAYPOINTS = [
  { x: 0, z: 17, y: 0, area: 'SPAWN' },
  { x: -16, z: 15, y: 0, area: 'A LONG' },
  { x: 16, z: 15, y: 0, area: 'B TUNNELS' },
  { x: 0, z: 11, y: 0, area: 'MID' },
  { x: -16, z: 5, y: 0, area: 'A LONG' },
  { x: 16, z: 5, y: 0, area: 'B TUNNELS' },
  { x: 0, z: 5, y: 0, area: 'MID' },
  { x: 0, z: 0, y: 0, area: 'MID' },
  { x: -16, z: -5, y: 0, area: 'A LONG' },
  { x: 16, z: -5, y: 0, area: 'B TUNNELS' },
  { x: -14, z: -14, y: 0, area: 'SITE A' },
  { x: 14, z: -14, y: 0, area: 'SITE B' },
  { x: -12, z: -15, y: 0, area: 'SITE A' },
  { x: 12, z: -15, y: 0, area: 'SITE B' },
  { x: -14, z: -15, y: 1.2, area: 'BALCONY' },
  { x: -14, z: -10, y: 0, area: 'A LONG' },
  { x: -9, z: -16, y: 0, area: 'SITE A' },
  { x: 9, z: -16, y: 0, area: 'SITE B' },
  { x: 0, z: -9, y: 0, area: 'MID' },
  { x: 0, z: -17, y: 0, area: 'SPAWN' },
  { x: -16, z: -17, y: 0, area: 'A LONG' },
  { x: 16, z: -17, y: 0, area: 'B TUNNELS' },
  { x: 0, z: -14, y: 0, area: 'MID' },
  { x: -16, z: 11, y: 0, area: 'A LONG' },
  { x: 16, z: 11, y: 0, area: 'B TUNNELS' },
  { x: -14, z: -8, y: 0, area: 'SITE A' },
  { x: 14, z: -8, y: 0, area: 'SITE B' },
];

const EDGES = [
  [0, 1], [0, 2], [0, 3], [1, 23], [2, 24], [23, 3], [24, 3], [23, 4], [24, 5],
  [4, 8], [5, 9], [3, 6], [6, 7], [7, 18], [18, 22], [22, 19], [19, 16], [19, 17],
  [16, 10], [17, 11], [10, 12], [11, 13], [10, 14], [14, 15], [15, 8], [8, 25],
  [25, 10], [9, 26], [26, 11], [20, 8], [20, 19], [21, 9], [21, 19], [22, 16],
  [22, 17], [12, 16], [13, 17], [10, 20], [11, 21], [3, 23], [3, 24],
];

export function areaAt(x, z) {
  if (x >= -17 && x <= -11 && z >= -17 && z <= -12) return 'BALCONY';
  if (x >= -18 && x <= -10 && z >= -18 && z <= -10) return 'SITE A';
  if (x >= 10 && x <= 18 && z >= -18 && z <= -10) return 'SITE B';
  if (x < -12) return 'A LONG';
  if (x > 12) return 'B TUNNELS';
  if (z > 14) return 'SPAWN';
  return 'MID';
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const sand = canvasTexture(256, (ctx, s) => speckle(ctx, s, '#8a6b45', 900, ['#a07a4e', '#6e5233', '#c9a06b']));
  sand.repeat.set(10, 10);
  const plaster = canvasTexture(256, (ctx, s) => {
    speckle(ctx, s, '#b98d5f', 500, ['#a87a4e', '#c9a06b']);
    ctx.strokeStyle = 'rgba(90,60,30,0.25)';
    for (let y = 0; y < s; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
    }
  });
  plaster.repeat.set(4, 1);
  const wood = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#7a5a33';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(40,25,10,0.5)';
    for (let x = 0; x < s; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s);
      ctx.stroke();
    }
  });

  const materials = {
    floor: new THREE.MeshStandardMaterial({ map: sand, roughness: 0.95, metalness: 0.02 }),
    wall: new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.9, metalness: 0.02 }),
    wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85, metalness: 0.02 }),
    teal: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.7, metalness: 0.05 }),
    danger: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.danger), roughness: 0.7, metalness: 0.05 }),
    dark: new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a4632'), roughness: 0.95, metalness: 0.02 }),
  };

  const colliders = [];
  const shootables = [];
  const losBlockers = [];

  function box(w, h, d, x, y, z, material, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (!opts.noCollide) colliders.push(bounds);
    if (!opts.noShoot) shootables.push(mesh);
    if (h >= 2 && !opts.noLos) losBlockers.push(bounds);
    return mesh;
  }

  function barrel(x, z) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.0, 12),
      materials.dark,
    );
    mesh.position.set(x, 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
  }

  // Floor + perimeter, 40x40, walls 4.6 m.
  box(40.4, 0.4, 40.4, 0, -0.2, 0, 'floor');
  box(0.4, 4.6, 40.4, -20.2, 2.3, 0, 'wall');
  box(0.4, 4.6, 40.4, 20.2, 2.3, 0, 'wall');
  box(40.4, 4.6, 0.4, 0, 2.3, -20.2, 'wall');
  box(40.4, 4.6, 0.4, 0, 2.3, 20.2, 'wall');

  // Lane dividers: west x=-12 and east x=+12, from the north wall to z=10.
  // The south strip (z>10) stays open as the attackers' staging ground.
  box(0.4, 4.6, 30, -12, 2.3, -5, 'wall');
  box(0.4, 4.6, 30, 12, 2.3, -5, 'wall');

  // Mid wall at z=-2 with a door gap x in [-1.5, 1.5].
  box(6.5, 4.6, 0.4, -4.75, 2.3, -2, 'wall');
  box(6.5, 4.6, 0.4, 4.75, 2.3, -2, 'wall');
  box(3, 1.2, 0.4, 0, 4.0, -2, 'wall', { noLos: true });

  // B tunnels roof slab over the east lane, y=2.6.
  box(8.4, 0.3, 30.4, 16, 2.75, -5, 'dark', { noLos: true });

  // Site markers: plant-zone floor pads + big signs on the north wall.
  box(4, 0.06, 4, -14, 0.03, -14, 'teal', { noCollide: true, noShoot: true, noLos: true });
  box(4, 0.06, 4, 14, 0.03, -14, 'teal', { noCollide: true, noShoot: true, noLos: true });
  for (const site of SITES) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.6),
      new THREE.MeshStandardMaterial({ map: signTexture(site.name, PALETTE.accent), roughness: 0.8 }),
    );
    sign.position.set(site.x, 3.4, -19.9);
    group.add(sign);
  }

  // Balcony over site A: platform top y=1.2, reached by two 0.6 m steps.
  box(5, 0.3, 4, -14, 1.05, -15, 'wood');
  box(1.4, 0.6, 1.2, -14, 0.3, -11.6, 'wood');
  box(1.4, 1.2, 1.2, -14, 0.6, -12.8, 'wood');

  // Cover: crates (1.1 m crouch cover), half walls, barrels, lane pillars.
  const crates = [
    [-16, 0], [-8, 8], [8, 8], [-4, -6], [4, -6],
    [-16, -10], [16, -10], [0, 14], [-6, -14], [6, -14],
  ];
  for (const [x, z] of crates) box(1.1, 1.1, 1.1, x, 0.55, z, 'wood');
  box(3.6, 1.2, 0.5, -4, 0.6, 6, 'wall');
  box(3.6, 1.2, 0.5, 4, 0.6, 6, 'wall');
  box(2.4, 1.2, 0.5, -16, 0.6, -1, 'wall');
  box(2.4, 1.2, 0.5, 16, 0.6, -1, 'wall');
  box(1.2, 3.2, 1.2, 0, 1.6, -6, 'wall');
  box(1.2, 3.2, 1.2, -8, 1.6, 12, 'wall');
  box(1.2, 3.2, 1.2, 8, 1.6, 12, 'wall');
  barrel(-18, 8);
  barrel(18, 8);
  barrel(-10, -4);
  barrel(10, -4);
  barrel(-18, -12);
  barrel(18, -12);

  // Sky: gradient backdrop cylinder + warm dusk light. Sun low from the west.
  const sky = new THREE.Mesh(
    new THREE.CylinderGeometry(70, 70, 44, 24, 1, true),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  sky.position.y = 10;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(new THREE.Color('#e8b98a'), new THREE.Color('#8a6b45'), 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffd9a0'), 2.4);
  sun.position.set(-28, 13, 9);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#8a7d68'), 0.45);
  fill.position.set(20, 10, 12);
  scene.add(fill);

  // 2D segment vs LOS-blocker test, for bot vision (cheap, deterministic).
  function segmentHits(minX, minZ, maxX, maxZ, x1, z1, x2, z2) {
    let tmin = 0;
    let tmax = 1;
    const dx = x2 - x1;
    const dz = z2 - z1;
    for (const [origin, delta, lo, hi] of [[x1, dx, minX, maxX], [z1, dz, minZ, maxZ]]) {
      if (Math.abs(delta) < 1e-9) {
        if (origin < lo || origin > hi) return false;
      } else {
        let t0 = (lo - origin) / delta;
        let t1 = (hi - origin) / delta;
        if (t0 > t1) [t0, t1] = [t1, t0];
        tmin = Math.max(tmin, t0);
        tmax = Math.min(tmax, t1);
        if (tmin > tmax) return false;
      }
    }
    return true;
  }

  function losBlocked(x1, z1, x2, z2) {
    for (const b of losBlockers) {
      if (segmentHits(b.min.x, b.min.z, b.max.x, b.max.z, x1, z1, x2, z2)) return true;
    }
    return false;
  }

  return { colliders, shootables, group, waypoints: WAYPOINTS, edges: EDGES, sites: SITES, losBlocked, areaAt };
}
