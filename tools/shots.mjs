// shots.mjs — deterministic screenshot capture for the DUSTLINE harness.
// Serves game/ on port 8091, opens each ?shot= mode from shots.json (seed=1),
// waits for window.__shotReady, and saves an unedited render to tools/out/
// (or --out <dir>). Reports file size, dimensions and any console/page errors.
//
// Usage: node tools/shots.mjs [--out tools/out-baseline] [--port 8091]
import fs from 'node:fs';
import path from 'node:path';
import {
  PROJECT, TOOLS, PORT, BASE_URL, chromium,
  startServer, stopServer, ensureServer, attachErrorCollectors, imageSize, fmtBytes,
} from './lib.mjs';

const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const portFlag = args.indexOf('--port');
const outDir = outFlag === -1
  ? path.join(TOOLS, 'out')
  : path.resolve(PROJECT, args[outFlag + 1]);
const port = portFlag === -1 ? PORT : Number(args[portFlag + 1]);
const base = `http://127.0.0.1:${port}`;

const shots = JSON.parse(fs.readFileSync(path.join(PROJECT, 'shots.json'), 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

let server;
let failures = 0;
try {
  server = await startServer(port);
  console.log(`server up on ${port}`);
  const browser = await chromium.launch();
  console.log('chromium version:', browser.version());

  // WebGL2 sanity check (SwiftShader) before capturing.
  const probe = await browser.newPage();
  await probe.goto('data:text/html,<canvas id=c></canvas><script>const gl=document.getElementById("c").getContext("webgl2");document.title=gl?("WEBGL2 OK "+gl.getParameter(gl.RENDERER)):"WEBGL2 MISSING";</' + 'script>');
  console.log('webgl2:', await probe.title());
  await probe.close();

  for (const shot of shots) {
    server = await ensureServer(server, port);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);
    const url = `${base}/${shot.query.startsWith('?') ? shot.query : '?' + shot.query}`;
    const dest = path.join(outDir, shot.name);
    let ready = false;
    let error = null;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      try {
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
        ready = true;
      } catch {
        ready = false;
      }
      // Unedited render of exactly what the page shows. JPEG q85 matches the
      // starter screenshots' format; PNG when the name says so.
      if (shot.name.toLowerCase().endsWith('.png')) {
        await page.screenshot({ path: dest });
      } else {
        await page.screenshot({ path: dest, type: 'jpeg', quality: 85 });
      }
    } catch (e) {
      error = e.message;
    }
    const buf = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
    let dims = null;
    try { if (buf) dims = imageSize(buf); } catch (e) { error = (error ? error + ' | ' : '') + 'dims: ' + e.message; }
    const ok = ready && !error && consoleErrors.length === 0 && pageErrors.length === 0;
    if (!ok) failures++;
    console.log(`\n[${ok ? 'OK' : 'PROBLEM'}] ${shot.name}  (${shot.query})`);
    console.log(`  url: ${url}`);
    console.log(`  __shotReady: ${ready}`);
    console.log(`  file: ${dest}  ${buf ? fmtBytes(buf.length) + ` (${buf.length} B)` : 'MISSING'}`);
    if (dims) console.log(`  dims: ${dims.width}x${dims.height} (${dims.format})`);
    if (consoleErrors.length) console.log(`  console errors (${consoleErrors.length}):\n    - ${consoleErrors.join('\n    - ')}`);
    if (pageErrors.length) console.log(`  page errors (${pageErrors.length}):\n    - ${pageErrors.join('\n    - ')}`);
    if (error) console.log(`  error: ${error}`);
    await page.close();
  }
  await browser.close();
} finally {
  stopServer(server);
}

console.log(`\nshots: ${shots.length - failures}/${shots.length} clean — output in ${outDir}`);
process.exit(failures ? 1 : 0);
