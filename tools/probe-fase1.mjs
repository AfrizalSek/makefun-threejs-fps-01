// Fase 1 probe: a round must run buy -> live, bots must leave spawn and move,
// no console/page errors. Usage: node tools/probe-fase1.mjs [--seconds 25]
import { PORT, chromium, startServer, stopServer, attachErrorCollectors } from './lib.mjs';

const args = process.argv.slice(2);
const secFlag = args.indexOf('--seconds');
const seconds = secFlag === -1 ? 25 : Number(args[secFlag + 1]);

let server;
let failures = 0;
try {
  server = await startServer(PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const { consoleErrors, pageErrors } = attachErrorCollectors(page);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);
  const snap = () => page.evaluate(() => {
    const d = window.__dustline;
    return {
      phase: d.rounds.phase,
      round: d.rounds.round,
      site: d.rounds.site,
      scoreAtk: d.rounds.scoreAtk,
      scoreDef: d.rounds.scoreDef,
      playerHealth: d.playerHealth,
      playerAlive: d.playerAlive,
      bots: d.bots.map((b) => ({
        name: b.name,
        team: b.team,
        alive: b.alive,
        health: Math.round(b.health),
        state: b.state,
        x: +b.mover.state.position.x.toFixed(1),
        z: +b.mover.state.position.z.toFixed(1),
      })),
    };
  });
  const before = await snap();
  console.log('t=0s phase:', before.phase, 'site:', before.site);
  console.log('bots at t=0s:', JSON.stringify(before.bots.map((b) => `${b.name}@${b.x},${b.z}`)));
  // Drive game time directly: headless tabs throttle rAF, so wall-clock waits
  // do not advance the fixed-step simulation.
  await page.evaluate((s) => window.__dustline.fastForward(s), seconds);
  const after = await snap();
  console.log(`t=${seconds + 1}s phase:`, after.phase, 'round:', after.round);
  const moved = after.bots.filter((b, i) => {
    const a = before.bots[i];
    return Math.hypot(b.x - a.x, b.z - a.z) > 1;
  }).length;
  const aliveAtk = after.bots.filter((b) => b.alive && b.team === 'atk').length;
  const aliveDef = after.bots.filter((b) => b.alive && b.team === 'def').length;
  console.log(`bots moved >1m: ${moved}/9, alive atk ${aliveAtk}/4 def ${aliveDef}/5, player hp ${after.playerHealth} alive=${after.playerAlive}`);
  console.log('bots at end:', JSON.stringify(after.bots.map((b) => `${b.name}@${b.x},${b.z}:${b.state}`)));
  if (before.phase !== 'buy') { console.log('FAIL: did not start in buy'); failures++; }
  if (after.phase !== 'live') { console.log('FAIL: phase did not reach live'); failures++; }
  if (moved < 5) { console.log('FAIL: too few bots moved'); failures++; }
  console.log(`console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log('  - ' + consoleErrors.join('\n  - '));
  console.log(`page errors: ${pageErrors.length}`);
  if (pageErrors.length) console.log('  - ' + pageErrors.join('\n  - '));
  if (consoleErrors.length || pageErrors.length) failures++;
  await browser.close();
} finally {
  stopServer(server);
}
console.log(failures ? `\nprobe-fase1: ${failures} problem(s)` : '\nprobe-fase1: OK');
process.exit(failures ? 1 : 0);
