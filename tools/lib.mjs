// Shared helpers for the DUSTLINE test harness (tools/*.mjs).
// Playwright lives in ~/workspace/threejs-fps-tooling/node_modules, so it is
// loaded through that package.json instead of a local node_modules.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const require = createRequire('/home/hatch/workspace/threejs-fps-tooling/package.json');
export const { chromium } = require('playwright');

export const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TOOLS = path.dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.HARNESS_PORT ?? 8091);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Start `node serve.ts --port <PORT>` in the project dir; resolves with the child once it answers. */
export function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['serve.ts', '--port', String(port)], {
      cwd: PROJECT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('exit', (code, signal) => {
      console.error(`[harness] serve.ts exited (code=${code} signal=${signal}). stderr so far: ${stderr.trim() || '(empty)'}`);
    });
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`serve.ts did not come up on port ${port} within 15s. stderr: ${stderr}`));
    }, 15000);
    const tick = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL.replace(/:\d+$/, `:${port}`)}/`);
        if (res.ok) {
          clearTimeout(timer);
          clearInterval(tick);
          resolve(proc);
        }
      } catch { /* not up yet */ }
    }, 250);
    proc.on('error', (e) => { clearTimeout(timer); clearInterval(tick); reject(e); });
  });
}

/** Restart the server if it died (serve.ts has no stream error handler, so an
 *  aborted in-flight response can kill it); returns a live proc. */
export async function ensureServer(proc, port = PORT) {
  if (proc && proc.exitCode === null) return proc;
  console.log('[harness] server not running — (re)starting serve.ts ...');
  return startServer(port);
}

export function stopServer(proc) {
  if (proc && !proc.killed) proc.kill('SIGTERM');
}

/** Collect console errors and pageerrors from a page into { consoleErrors, pageErrors }. */
export function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));
  return { consoleErrors, pageErrors };
}

/** Width/height of a PNG or JPEG buffer (no image library needed). */
export function imageSize(buf) {
  // PNG: IHDR at offset 16 (width, height, big-endian uint32).
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: 'png' };
  }
  // JPEG: scan markers for a SOF0/SOF2 frame header.
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7), format: 'jpeg' };
      }
      off += 2 + len;
    }
  }
  throw new Error('unsupported image format (not PNG/JPEG) or truncated buffer');
}

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

export function passFail(ok) { return ok ? 'PASS' : 'FAIL'; }

/** Recursively count entries (files + dirs) and total file bytes under a directory. */
export function walkTree(dir) {
  let entries = 0;
  let files = 0;
  let bytes = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      entries++;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) { files++; bytes += fs.statSync(p).size; }
    }
  };
  walk(dir);
  return { entries, files, bytes };
}
