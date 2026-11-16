// Arsenal: 4 hitscan weapons + 3 grenades. The table owns the numbers;
// main.js owns the ray and the damage. ADS narrows spread and FOV and slows
// movement; bloom grows with sustained fire and recovers when you stop.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: { name: 'Pistol P9', price: 0, mag: 12, reserve: 36, gap: 0.18, damage: 26, semi: true, spread: 0.004, auto: false },
  smg: { name: 'SMG Vex-9', price: 1500, mag: 28, reserve: 84, gap: 0.075, damage: 24, semi: false, spread: 0.009, auto: true },
  rifle: { name: 'Rifle AR-77', price: 2700, mag: 30, reserve: 90, gap: 0.096, damage: 34, semi: false, spread: 0.0022, auto: true },
  sniper: { name: 'Sniper LW-50', price: 4750, mag: 5, reserve: 15, gap: 1.1, damage: 95, semi: true, spread: 0.0006, auto: false },
};

export const GRENADE_PRICE = { smoke: 300, flash: 200, frag: 300 };
export const ARMOR_PRICE = 650;

const SPREAD_MOVING = 0.028;
const MOVE_REFERENCE = 5.2;
const RELOAD_TIME = 1.9;
const MUZZLE_TIME = 0.06;

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });

  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  model.add(receiver, barrel, stock);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.ink), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.ink), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = {
    weapon: 'pistol',
    owned: new Set(['pistol']),
    mag: WEAPONS.pistol.mag,
    reserve: WEAPONS.pistol.reserve,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    bloom: 0,
    ads: false,
    grenades: { smoke: 0, flash: 0, frag: 0 },
    selectedGrenade: null,
  };

  function current() {
    return WEAPONS[state.weapon];
  }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.bloom = Math.max(0, state.bloom - dt * 1.5);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.42 + state.kick + (state.ads ? 0.1 : 0);
    model.position.x = 0.24 + (state.ads ? -0.24 : 0);
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (RELOAD_TIME - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = current().mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  return {
    state,
    step,
    current,
    damage() {
      return current().damage;
    },
    isSemi() {
      return current().semi;
    },
    adsFov() {
      if (!state.ads) return 74;
      return state.weapon === 'sniper' ? 30 : 58;
    },
    setAds(on) {
      state.ads = on;
    },
    switchTo(name) {
      if (!state.owned.has(name) || state.reloadLeft > 0) return false;
      state.weapon = name;
      state.mag = current().mag;
      state.reserve = current().reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.bloom = 0;
      state.ads = false;
      return true;
    },
    buyWeapon(name) {
      state.owned.add(name);
      this.switchTo(name);
    },
    ownedList() {
      return Object.keys(WEAPONS).filter((w) => state.owned.has(w));
    },
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = current().gap;
      state.flash = MUZZLE_TIME;
      state.kick = 0.055;
      state.bloom = Math.min(1, state.bloom + (state.weapon === 'sniper' ? 0.3 : 0.12));
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || state.mag === current().mag || state.reserve === 0) return;
      state.reloadLeft = RELOAD_TIME;
    },
    spread(speed, crouching = false) {
      const w = current();
      let s = w.spread + Math.min(1, speed / MOVE_REFERENCE) * SPREAD_MOVING + state.bloom * 0.05;
      if (crouching) s *= 0.8;
      if (state.ads) s *= 0.45;
      return s;
    },
    refill() {
      state.mag = current().mag;
      state.reserve = current().reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.bloom = 0;
    },
    addGrenade(type, count = 1) {
      state.grenades[type] = (state.grenades[type] ?? 0) + count;
    },
    selectGrenade(type) {
      if ((state.grenades[type] ?? 0) <= 0) return false;
      state.selectedGrenade = state.selectedGrenade === type ? null : type;
      return true;
    },
    throwGrenade() {
      const type = state.selectedGrenade;
      if (!type || (state.grenades[type] ?? 0) <= 0) return null;
      state.grenades[type] -= 1;
      state.selectedGrenade = null;
      return type;
    },
  };
}
