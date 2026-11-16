// playtest.mjs — interactive smoke-test skeleton for the built game.
// Opens the game WITHOUT ?shot, simulates keyboard/mouse input for a few
// seconds, and reports: console/page errors, whether the page stays
// responsive, and an approximate FPS (rAF count). No assertions about game
// rules yet — this is a harness skeleton to grow as DUSTLINE takes shape.
//
// Usage: node tools/playtest.mjs [--seconds 8] [--port 8091]
import {
  PORT, chromium, startServer, stopServer, attachErrorCollectors,
} from './lib.mjs';

const args = process.argv.slice(2);
const secFlag = args.indexOf('--seconds');
const portFlag = args.indexOf('--port');
const seconds = secFlag === -1 ? 8 : Number(args[secFlag + 1]);
const port = portFlag === -1 ? PORT : Number(args[portFlag + 1]);

let server;
let failures = 0;
try {
  server = await startServer(port);
  console.log(`server up on ${port}`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const { consoleErrors, pageErrors } = attachErrorCollectors(page);

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
  console.log('canvas present:', hasCanvas);

  // Click to focus / dismiss any start overlay, then install an FPS counter.
  await page.mouse.click(640, 360);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__frames = 0;
    window.__fpsStart = performance.now();
    const tick = () => { window.__frames++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  // Simulated input script: move + look + shoot, spread over `seconds`.
  const stepMs = 700;
  const steps = Math.max(1, Math.floor((seconds * 1000) / stepMs));
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (let i = 0; i < steps; i++) {
    const key = keys[i % keys.length];
    await page.keyboard.down(key);
    await page.mouse.move(640 + (i % 5) * 20 - 40, 360 + (i % 3) * 10 - 10);
    if (i % 2 === 0) await page.mouse.down();
    await page.waitForTimeout(stepMs / 2);
    if (i % 2 === 0) await page.mouse.up();
    await page.waitForTimeout(stepMs / 2);
    await page.keyboard.up(key);
  }

  const fps = await page.evaluate(() => {
    const dt = (performance.now() - window.__fpsStart) / 1000;
    return { frames: window.__frames, seconds: dt, fps: window.__frames / dt };
  });
  console.log(`\ninput run: ${steps} steps over ~${seconds}s (WASD cycle + mouse move/click)`);
  console.log(`frames: ${fps.frames} in ${fps.seconds.toFixed(2)}s -> ~${fps.fps.toFixed(1)} FPS (headless SwiftShader; indicative only)`);

  // Responsiveness: a trivial evaluate must still answer promptly afterwards.
  const t0 = Date.now();
  const responsive = await page.evaluate(() => ({ title: document.title, ready: document.readyState }));
  const latencyMs = Date.now() - t0;
  console.log(`responsive: ${JSON.stringify(responsive)} (evaluate latency ${latencyMs} ms)`);
  if (latencyMs > 5000) { console.log('WARNING: page evaluate took >5s'); failures++; }

  console.log(`console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log('  - ' + consoleErrors.join('\n  - '));
  console.log(`page errors: ${pageErrors.length}`);
  if (pageErrors.length) console.log('  - ' + pageErrors.join('\n  - '));
  if (consoleErrors.length || pageErrors.length) failures++;
  if (!hasCanvas) { console.log('FAIL: no canvas found'); failures++; }

  await browser.close();
} finally {
  stopServer(server);
}
console.log(failures ? `\nplaytest: ${failures} problem(s)` : '\nplaytest: OK (skeleton ran clean)');
process.exit(failures ? 1 : 0);
