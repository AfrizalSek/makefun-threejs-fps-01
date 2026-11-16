// Fase 2 probe: economy/buy, bomb plant -> defuse-or-detonate, grenades.
// Drives game time with __dustline.fastForward (headless rAF is throttled).
// Usage: node tools/probe-fase2.mjs
import { PORT, chromium, startServer, stopServer, attachErrorCollectors } from './lib.mjs';

let server;
let failures = 0;
const fail = (msg) => { console.log(`FAIL: ${msg}`); failures++; };
try {
  server = await startServer(PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const { consoleErrors, pageErrors } = attachErrorCollectors(page);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  const ev = (fn, ...args) => page.evaluate(fn, ...args);

  // A. Economy / buy (buy phase, money starts 800).
  const money0 = await ev(() => window.__dustline.economy.money);
  console.log('money at start:', money0);
  if (money0 !== 800) fail(`start money ${money0} !== 800`);
  const buyFlash = await ev(() => window.__dustline.economy.buy('flash', window.__dustline.weapon));
  const money1 = await ev(() => window.__dustline.economy.money);
  console.log('buy flash:', JSON.stringify(buyFlash), 'money:', money1);
  if (!buyFlash.ok || money1 !== 600) fail('flash buy did not cost $200');
  const buySmg = await ev(() => window.__dustline.economy.buy('smg', window.__dustline.weapon));
  console.log('buy smg with $600:', JSON.stringify(buySmg));
  if (buySmg.ok) fail('smg buy should fail with $600');
  await ev(() => window.__dustline.economy.add(2000));
  const buySmg2 = await ev(() => window.__dustline.economy.buy('smg', window.__dustline.weapon));
  const switched = await ev(() => window.__dustline.weapon.switchTo('smg'));
  const mag = await ev(() => window.__dustline.weapon.state.mag);
  console.log('buy smg with $2600:', JSON.stringify(buySmg2), 'switch:', switched, 'mag:', mag);
  if (!buySmg2.ok || !switched || mag !== 28) fail('smg buy/switch/mag wrong');

  // B. Plant via the bot carrier: advance to live, wait for the plant.
  await ev(() => window.__dustline.fastForward(16));
  const phase = await ev(() => window.__dustline.rounds.phase);
  console.log('phase after 16s:', phase);
  if (phase !== 'live') fail('phase did not reach live');
  let planted = false;
  for (let i = 0; i < 12; i += 1) {
    await ev(() => window.__dustline.fastForward(5));
    planted = await ev(() => window.__dustline.rounds.bomb.status === 'planted');
    if (planted) break;
  }
  const bombState = await ev(() => ({
    status: window.__dustline.rounds.bomb.status,
    site: window.__dustline.rounds.bomb.site,
    timer: Math.round(window.__dustline.rounds.bomb.timer),
  }));
  console.log('bomb after plant wait:', JSON.stringify(bombState));
  if (!planted) fail('bomb was never planted by the carrier bot');

  // C. Defuse or detonation ends the round.
  let ended = false;
  for (let i = 0; i < 9; i += 1) {
    await ev(() => window.__dustline.fastForward(5));
    ended = await ev(() => (window.__dustline.rounds.scoreAtk + window.__dustline.rounds.scoreDef) >= 1);
    if (ended) break;
  }
  const scores = await ev(() => ({
    atk: window.__dustline.rounds.scoreAtk,
    def: window.__dustline.rounds.scoreDef,
    reason: window.__dustline.rounds.lastResult,
    phase: window.__dustline.rounds.phase,
  }));
  console.log('round end:', JSON.stringify(scores));
  if (!ended) fail('round did not end after plant (no defuse, no detonation)');
  if (scores.atk + scores.def !== 1) fail('score total after one round is not 1');

  // D. Grenades, in the next buy phase so bots stand still: smoke cloud
  // appears, frag hurts a bot.
  for (let i = 0; i < 10; i += 1) {
    const phaseNow = await ev(() => window.__dustline.rounds.phase);
    if (phaseNow === 'buy') break;
    await ev(() => window.__dustline.fastForward(1));
  }
  const phaseD = await ev(() => window.__dustline.rounds.phase);
  console.log('phase for grenade test:', phaseD);
  if (phaseD !== 'buy') fail('did not reach buy phase for grenade test');
  const smokeBefore = await ev(() => window.__dustline.grenades.clouds.length);
  await ev(() => {
    const d = window.__dustline;
    const origin = d.playerPos.clone();
    origin.y += 1.5;
    d.grenades.throwFrom(origin, new (Object.getPrototypeOf(origin).constructor)(0, 0.4, -1), 'smoke', 'YOU');
    d.fastForward(2);
  });
  const smokeAfter = await ev(() => window.__dustline.grenades.clouds.length);
  console.log(`smoke clouds: ${smokeBefore} -> ${smokeAfter}`);
  if (smokeAfter !== smokeBefore + 1) fail('smoke cloud did not appear');
  const fragResult = await ev(() => {
    const d = window.__dustline;
    const target = d.bots.find((b) => b.alive);
    if (!target) return { skipped: true };
    const before = target.health;
    const origin = target.mover.state.position.clone();
    origin.y += 3;
    d.grenades.throwFrom(origin, new (Object.getPrototypeOf(origin).constructor)(0, -1, 0), 'frag', 'YOU');
    d.fastForward(2);
    return { before: Math.round(before), after: Math.round(target.health), alive: target.alive };
  });
  console.log('frag on a bot:', JSON.stringify(fragResult));
  if (!fragResult.skipped && fragResult.after >= fragResult.before && fragResult.alive) {
    fail('frag did not damage the bot');
  }

  console.log(`console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log('  - ' + consoleErrors.join('\n  - '));
  console.log(`page errors: ${pageErrors.length}`);
  if (pageErrors.length) console.log('  - ' + pageErrors.join('\n  - '));
  if (consoleErrors.length || pageErrors.length) failures++;
  await browser.close();
} finally {
  stopServer(server);
}
console.log(failures ? `\nprobe-fase2: ${failures} problem(s)` : '\nprobe-fase2: OK');
process.exit(failures ? 1 : 0);
