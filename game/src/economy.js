// Money: start $800, round win +$300, round loss +$150, kill +$300,
// plant +$300. Buys happen only in the buy phase; the menu asks this module.
import { WEAPONS, GRENADE_PRICE, ARMOR_PRICE } from './weapons.js';

export const START_MONEY = 800;
export const WIN_BONUS = 300;
export const LOSS_BONUS = 150;
export const KILL_BONUS = 300;
export const PLANT_BONUS = 300;

export function createEconomy() {
  let money = START_MONEY;
  let armor = 0;

  function catalog(weapon) {
    const items = [];
    for (const [id, w] of Object.entries(WEAPONS)) {
      items.push({
        id, kind: 'weapon', label: w.name, price: w.price,
        owned: weapon.state.owned.has(id), current: weapon.state.weapon === id,
      });
    }
    items.push({ id: 'armor', kind: 'armor', label: 'Armor (50)', price: ARMOR_PRICE, owned: armor > 0, current: false });
    for (const [id, price] of Object.entries(GRENADE_PRICE)) {
      const label = id === 'smoke' ? 'Smoke' : id === 'flash' ? 'Flash' : 'Frag';
      items.push({ id, kind: 'grenade', label: `${label} x1`, price, owned: false, current: false, count: weapon.state.grenades[id] ?? 0 });
    }
    return items;
  }

  return {
    get money() {
      return money;
    },
    get armor() {
      return armor;
    },
    reset() {
      money = START_MONEY;
      armor = 0;
    },
    add(amount) {
      money += amount;
    },
    roundEnd(won) {
      money += won ? WIN_BONUS : LOSS_BONUS;
    },
    catalog,
    buy(id, weapon) {
      const items = catalog(weapon);
      const item = items.find((i) => i.id === id);
      if (!item) return { ok: false, reason: 'unknown item' };
      if (item.kind === 'weapon' && item.owned) {
        weapon.switchTo(id);
        return { ok: true, reason: 'equipped' };
      }
      if (money < item.price) return { ok: false, reason: 'not enough money' };
      money -= item.price;
      if (item.kind === 'weapon') weapon.buyWeapon(id);
      else if (item.kind === 'armor') armor = 50;
      else weapon.addGrenade(id, 1);
      return { ok: true, reason: 'bought' };
    },
    takeArmor() {
      const value = armor;
      armor = 0;
      return value;
    },
  };
}
