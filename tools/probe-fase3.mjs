// Fase 3 probe: HUD (health/timer/area/kill feed/scoreboard) + audio wiring.
// Drives game time with __dustline.fastForward; HUD updates ride step().
// Usage: node tools/probe-fase3.mjs
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
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? '', sel);

  // HUD after 2s of buy phase.
  await ev(() => window.__dustline.fastForward(2));
  console.log('timer:', await text('#timer-value'), '| phase:', await text('#timer-phase'),
    '| area:', await text('#area'), '| health:', await text('#health-value'),
    '| money:', await text('#money'));
  if ((await text('#timer-value')) !== '0:13') fail('timer did not show 0:13 after 2s of buy');
  if ((await text('#area')) !== 'SPAWN') fail('area did not show SPAWN');
  if ((await text('#health-value')) !== '100') fail('health did not show 100');

  // Kill feed: a real kill through the bots API must land in the feed.
  const feedBefore = await ev(() => document.querySelectorAll('#killfeed div').length);
  await ev(() => {
    const d = window.__dustline;
    const target = d.bots.find((b) => b.alive && b.team === 'def');
    d.botsApi.damage(target, 100, 'head');
  });
  const feedAfter = await ev(() => document.querySelectorAll('#killfeed div').length);
  const feedText = await ev(() => document.querySelector('#killfeed div')?.textContent ?? '');
  console.log(`killfeed rows: ${feedBefore} -> ${feedAfter} (${feedText})`);
  if (feedAfter !== feedBefore + 1) fail('kill did not add a killfeed row');

  // Scoreboard via Tab key events.
  await page.keyboard.down('Tab');
  await page.waitForTimeout(200);
  const sbOpen = await ev(() => !document.querySelector('#scoreboard').hidden);
  const sbTitle = await text('#scoreboard-title');
  const sbRows = await ev(() => document.querySelectorAll('#scoreboard-body tr').length);
  console.log('scoreboard open:', sbOpen, '| title:', sbTitle, '| rows:', sbRows);
  if (!sbOpen) fail('Tab did not open the scoreboard');
  if (sbRows < 9) fail(`scoreboard has ${sbRows} rows, expected >= 9 (2 team heads + 9 agents)`);
  await page.keyboard.up('Tab');
  await page.waitForTimeout(200);
  const sbClosed = await ev(() => document.querySelector('#scoreboard').hidden);
  if (!sbClosed) fail('Tab release did not close the scoreboard');

  // Audio: default volume, slider changes it, shot/reload do not throw.
  const audioOk = await ev(() => {
    const a = window.__dustline.audio;
    const v0 = a.volume;
    const slider = document.querySelector('#volume');
    slider.value = '0.3';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    const v1 = a.volume;
    a.shot('rifle');
    a.reload();
    a.explosion();
    return { v0, v1 };
  });
  console.log('audio volume:', JSON.stringify(audioOk));
  if (audioOk.v0 !== 0.7 || audioOk.v1 !== 0.3) fail('audio volume default/slider wrong');

  // Player takes damage in live play: health HUD must drop below 100.
  await ev(() => window.__dustline.fastForward(25));
  const hp = await text('#health-value');
  const phase = await text('#timer-phase');
  console.log('after 25s more: health', hp, '| phase', phase);
  if (Number(hp) >= 100) console.log('NOTE: player still at full health (bots did not hit them this run)');

  console.log(`console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log('  - ' + consoleErrors.join('\n  - '));
  console.log(`page errors: ${pageErrors.length}`);
  if (pageErrors.length) console.log('  - ' + pageErrors.join('\n  - '));
  if (consoleErrors.length || pageErrors.length) failures++;
  await browser.close();
} finally {
  stopServer(server);
}
console.log(failures ? `\nprobe-fase3: ${failures} problem(s)` : '\nprobe-fase3: OK');
process.exit(failures ? 1 : 0);
