// The DOM HUD: crosshair, hit marker, ammo, score and the one overlay panel. It never touches
// the simulation; main.js pushes numbers in and reads the play callback out.
const COPY = {
  start: {
    title: 'Greybox Range',
    copy: '5v5 round-based tactical FPS. Plant the bomb at A or B, or clear the enemy team. First to 5 rounds.',
    action: 'Click to play',
  },
  paused: {
    title: 'Greybox Range',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  end: {
    title: 'Range cleared',
    copy: 'Every target is down.',
    action: 'Play again',
  },
};

export function createHud() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const play = document.getElementById('play');
  const ammo = document.getElementById('ammo');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const scoreValue = document.getElementById('score-value');
  const hitmarker = document.getElementById('hitmarker');
  const buyMenu = document.getElementById('buy-menu');
  const buyList = document.getElementById('buy-list');
  const buyMoney = document.getElementById('buy-money');
  const banner = document.getElementById('banner');
  const flashEl = document.getElementById('flash');
  const moneyEl = document.getElementById('money');
  let hitTimer = 0;
  let bannerTimer = 0;
  let flashTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastScore = -1;
  let lastMoney = -1;

  return {
    setAmmo(mag, reserve) {
      if (mag === lastMag && reserve === lastReserve) return;
      lastMag = mag;
      lastReserve = reserve;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      ammo.classList.toggle('empty', mag === 0);
    },
    setScore(value) {
      if (value === lastScore) return;
      lastScore = value;
      scoreValue.textContent = String(value);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    showOverlay(mode, score) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = mode === 'end' ? `${text.copy} You scored ${score}.` : text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      if (moneyEl) moneyEl.textContent = `$${value}`;
      if (buyMoney) buyMoney.textContent = `$${value}`;
    },
    showBanner(text, holdMs = 2500) {
      if (!banner) return;
      banner.textContent = text;
      banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        banner.hidden = true;
      }, holdMs);
    },
    flashScreen(strength) {
      if (!flashEl) return;
      flashEl.style.opacity = String(Math.min(1, strength));
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashEl.style.opacity = '0';
      }, 350 + strength * 650);
    },
    showBuyMenu(items, money, onBuy) {
      if (!buyMenu) return;
      buyList.innerHTML = '';
      items.forEach((item, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'buy-row';
        const owned = item.kind === 'grenade' ? ` (x${item.count})` : item.owned ? ' — owned' : '';
        const current = item.current ? ' ★' : '';
        row.textContent = `${index + 1}. ${item.label}${owned}${current} — $${item.price}`;
        row.disabled = money < item.price && !item.owned;
        row.addEventListener('click', () => onBuy(item.id));
        buyList.appendChild(row);
      });
      this.setMoney(money);
      buyMenu.hidden = false;
    },
    hideBuyMenu() {
      if (buyMenu) buyMenu.hidden = true;
    },
    isBuyMenuOpen() {
      return !!buyMenu && !buyMenu.hidden;
    },
  };
}
