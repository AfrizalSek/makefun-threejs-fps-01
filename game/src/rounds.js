// Round + match state: buy (15s) -> live (100s) -> roundEnd (4s). First to 5 round
// wins, max 9 rounds, no side switch. A round is won by elimination, by the bomb
// (Fase 2), or by timeout (defenders win). Tracks K/D/A per agent and the MVP.
// The bomb carrier is assigned here; plant/defuse land in Fase 2.

const BUY_SECONDS = 15;
const LIVE_SECONDS = 100;
const END_SECONDS = 4;
const WIN_ROUNDS = 5;
const MAX_ROUNDS = 9;

export function createRounds(options = {}) {
  const random = options.random ?? Math.random;
  const onPhase = options.onPhase ?? (() => {});
  const onRoundEnd = options.onRoundEnd ?? (() => {});
  const onMatchEnd = options.onMatchEnd ?? (() => {});

  const stats = new Map();
  const state = {
    phase: 'buy',
    phaseLeft: BUY_SECONDS,
    round: 1,
    scoreAtk: 0,
    scoreDef: 0,
    site: 'A',
    matchOver: false,
    mvp: null,
    lastResult: '',
    bomb: {
      status: 'carried',
      carrier: null,
      x: 0,
      z: 0,
      site: null,
      plantProgress: 0,
      defuseProgress: 0,
      timer: 0,
    },
  };

  function stat(name) {
    if (!stats.has(name)) stats.set(name, { name, kills: 0, deaths: 0, assists: 0 });
    return stats.get(name);
  }

  function mvp() {
    let best = null;
    for (const s of stats.values()) {
      if (!best || s.kills > best.kills || (s.kills === best.kills && s.deaths < best.deaths)) best = s;
    }
    return best;
  }

  function setPhase(phase, seconds) {
    state.phase = phase;
    state.phaseLeft = seconds;
    onPhase(phase, state);
  }

  function startRound() {
    state.site = random() < 0.5 ? 'A' : 'B';
    state.bomb = {
      status: 'carried', carrier: null, x: 0, z: 0, site: null,
      plantProgress: 0, defuseProgress: 0, timer: 0,
    };
    setPhase('buy', BUY_SECONDS);
  }

  function endRound(winner, reason) {
    if (winner === 'atk') state.scoreAtk += 1;
    else state.scoreDef += 1;
    state.lastResult = reason;
    state.bomb.status = 'gone';
    onRoundEnd(winner, reason, state);
    if (state.scoreAtk >= WIN_ROUNDS || state.scoreDef >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      state.matchOver = true;
      state.mvp = mvp();
      setPhase('end', Infinity);
      onMatchEnd(state);
    } else {
      state.round += 1;
      setPhase('roundEnd', END_SECONDS);
    }
  }

  const onPlant = options.onPlant ?? (() => {});

  return {
    state,
    stats,
    setCarrier(carrier) {
      state.bomb.carrier = carrier;
      state.bomb.status = 'carried';
    },
    dropBomb(x, z) {
      if (state.bomb.status !== 'carried') return;
      state.bomb.status = 'dropped';
      state.bomb.carrier = null;
      state.bomb.x = x;
      state.bomb.z = z;
      state.bomb.plantProgress = 0;
    },
    plantTick(dt, inZone, holding) {
      const bomb = state.bomb;
      if (bomb.status !== 'carried' || state.phase !== 'live') return;
      if (inZone && holding) {
        bomb.plantProgress += dt / 3;
        if (bomb.plantProgress >= 1) {
          bomb.status = 'planted';
          bomb.site = state.site;
          bomb.timer = 35;
          bomb.plantProgress = 0;
          onPlant(bomb.carrier);
        }
      } else {
        bomb.plantProgress = Math.max(0, bomb.plantProgress - dt / 3);
      }
    },
    defuseTick(dt, nearBomb, holding) {
      const bomb = state.bomb;
      if (bomb.status !== 'planted' || state.phase !== 'live') return;
      if (nearBomb && holding) {
        bomb.defuseProgress += dt / 5;
        if (bomb.defuseProgress >= 1) endRound('def', 'Bomb defused');
      } else {
        bomb.defuseProgress = Math.max(0, bomb.defuseProgress - dt / 5);
      }
    },
    start() {
      stats.clear();
      state.round = 1;
      state.scoreAtk = 0;
      state.scoreDef = 0;
      state.matchOver = false;
      state.mvp = null;
      startRound();
    },
    recordKill(killer, victim, time) {
      const killerName = killer ? killer.name ?? killer : 'YOU';
      const victimName = victim ? victim.name ?? victim : 'YOU';
      stat(killerName).kills += 1;
      stat(victimName).deaths += 1;
      const assister = victim && victim.lastDamager && victim.lastDamager !== killer
        ? victim.lastDamager : null;
      if (assister && time - (victim.lastDamageAt ?? -99) <= 5) {
        stat(assister.name ?? assister).assists += 1;
      }
    },
    notePlayerKill(victimBot, time) {
      stat('YOU').kills += 1;
      stat(victimBot.name).deaths += 1;
    },
    notePlayerDeath(killerBot) {
      stat('YOU').deaths += 1;
      if (killerBot) stat(killerBot.name).kills += 1;
    },
    step(dt, ctx) {
      if (state.phase === 'end') return;
      state.phaseLeft -= dt;
      if (state.bomb.status === 'planted' && state.phase === 'live') {
        state.bomb.timer -= dt;
        if (state.bomb.timer <= 0) endRound('atk', 'Bomb detonated');
      }
      if (state.phase === 'buy' && state.phaseLeft <= 0) {
        setPhase('live', LIVE_SECONDS);
      } else if (state.phase === 'live') {
        if (ctx.aliveDef === 0) endRound('atk', 'Elimination — enemy team cleared');
        else if (ctx.aliveAtk === 0) endRound('def', 'Elimination — attack team cleared');
        else if (state.phaseLeft <= 0) endRound('def', 'Time expired — defenders hold');
      } else if (state.phase === 'roundEnd' && state.phaseLeft <= 0) {
        startRound();
      }
    },
  };
}
