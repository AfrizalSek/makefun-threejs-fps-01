// The DOM HUD: crosshair, hit marker, ammo, score and the one overlay panel. It never touches
// the simulation; main.js pushes numbers in and reads the play callback out.
const COPY = {
  start: {
    title: 'DUSTLINE',
    copy: '5v5 round-based tactical FPS. Plant the bomb at A or B, or clear the enemy team. First to 5 rounds.',
    action: 'Click to play',
  },
  paused: {
    title: 'DUSTLINE',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  end: {
    title: 'Match over',
    copy: 'The match is decided.',
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
  const healthEl = document.getElementById('health');
  const healthValue = document.getElementById('health-value');
  const healthFill = document.getElementById('health-fill');
  const armorEl = document.getElementById('armor');
  const timerPhase = document.getElementById('timer-phase');
  const timerValue = document.getElementById('timer-value');
  const timerScore = document.getElementById('timer-score');
  const areaEl = document.getElementById('area');
  const killfeed = document.getElementById('killfeed');
  const crosshair = document.getElementById('crosshair');
  const scoreboard = document.getElementById('scoreboard');
  const scoreboardTitle = document.getElementById('scoreboard-title');
  const scoreboardTeams = document.getElementById('scoreboard-teams');
  const scoreboardBody = document.getElementById('scoreboard-body');
  const playAgain = document.getElementById('play-again');
  const volumeEl = document.getElementById('volume');
  let hitTimer = 0;
  let bannerTimer = 0;
  let flashTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastScore = -1;
  let lastMoney = -1;
  let lastHealth = -1;
  let lastArmor = -1;
  let lastTimer = '';
  let lastArea = '';

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
    setHealth(hp, armor) {
      const hpR = Math.max(0, Math.round(hp));
      if (hpR === lastHealth && armor === lastArmor) return;
      lastHealth = hpR;
      lastArmor = armor;
      if (healthValue) healthValue.textContent = String(hpR);
      if (healthFill) healthFill.style.width = `${hpR}%`;
      if (healthEl) healthEl.classList.toggle('low', hpR <= 30);
      if (armorEl) armorEl.textContent = armor > 0 ? `+${Math.round(armor)} armor` : '';
    },
    setTimer(phase, secondsLeft, scoreAtk, scoreDef) {
      const seconds = Math.max(0, Math.ceil(secondsLeft));
      const text = `${phase}|${seconds}|${scoreAtk}-${scoreDef}`;
      if (text === lastTimer) return;
      lastTimer = text;
      if (timerPhase) timerPhase.textContent = phase === 'roundEnd' ? 'Round over' : phase === 'end' ? 'Match over' : phase;
      if (timerValue) {
        timerValue.textContent = phase === 'end' ? '—' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      }
      if (timerScore) timerScore.textContent = `${scoreAtk} – ${scoreDef}`;
    },
    setArea(name) {
      if (name === lastArea) return;
      lastArea = name;
      if (areaEl) areaEl.textContent = name;
    },
    addKill(killer, victim, headshot = false) {
      if (!killfeed) return;
      const row = document.createElement('div');
      row.innerHTML = '';
      row.append(document.createTextNode(killer), document.createTextNode(headshot ? ' ⌖ ' : ' → '), document.createTextNode(victim));
      if (headshot) row.classList.add('headshot');
      killfeed.prepend(row);
      while (killfeed.children.length > 5) killfeed.lastChild.remove();
      setTimeout(() => row.classList.add('fading'), 3500);
      setTimeout(() => row.remove(), 4100);
    },
    setCrosshairAds(on) {
      if (crosshair) crosshair.classList.toggle('ads', on);
    },
    showScoreboard(stats, scoreAtk, scoreDef, mvp, playerMoney) {
      if (!scoreboard) return;
      scoreboardTitle.textContent = mvp ? `MVP: ${mvp.name} ★` : 'Scoreboard';
      scoreboardTeams.textContent = `DUST ${scoreAtk} – ${scoreDef} VIPER`;
      scoreboardBody.innerHTML = '';
      const rows = [...stats.values()];
      const order = (team) => rows
        .filter((s) => (team === 'atk' ? s.name === 'YOU' || s.name.startsWith('DUST') : s.name.startsWith('VIPER')))
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      for (const [team, label] of [['atk', 'DUST — Attackers'], ['def', 'VIPER — Defenders']]) {
        const head = document.createElement('tr');
        head.className = 'team-head';
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = label;
        head.append(cell);
        scoreboardBody.append(head);
        for (const s of order(team)) {
          const tr = document.createElement('tr');
          if (mvp && s.name === mvp.name) tr.className = 'mvp';
          const money = s.name === 'YOU' ? `$${playerMoney}` : '—';
          tr.innerHTML = '';
          for (const [value, first] of [[s.name, true], [s.kills], [s.deaths], [s.assists], [money]]) {
            const td = document.createElement('td');
            td.textContent = String(value);
            if (first) td.style.textAlign = 'left';
            tr.append(td);
          }
          scoreboardBody.append(tr);
        }
      }
      scoreboard.hidden = false;
    },
    hideScoreboard() {
      if (scoreboard) scoreboard.hidden = true;
    },
    isScoreboardOpen() {
      return !!scoreboard && !scoreboard.hidden;
    },
    onVolume(handler) {
      if (volumeEl) volumeEl.addEventListener('input', () => handler(Number(volumeEl.value)));
    },
    onPlayAgain(handler) {
      if (playAgain) playAgain.addEventListener('click', handler);
    },
    setPlayAgainVisible(on) {
      if (playAgain) playAgain.hidden = !on;
    },
  };
}
