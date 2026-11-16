// check-dossier.mjs — build the Make.fun dossier into a temp dir and check every
// submission gate against the starter's own caps (see main.ts):
//   game/          <= 993 entries, <= 48 MiB (50.331.648 B)
//   game/index.html <= 1 MiB
//   screenshots    3-4 files, each <= 256 KiB (262.144 B), long side <= 1280, short side >= 480
//   dossier.json   <= 1,5 MiB (1.572.864 B)
//   source text    <= 163.840 B (text_max_bytes passed to buildDossier)
// Nothing in the project is modified; the build goes to a mkdtemp dir under /tmp.
//
// Usage: node tools/check-dossier.mjs [--keep]   (--keep preserves the temp out dir)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROJECT, imageSize, fmtBytes, passFail, walkTree } from './lib.mjs';

const keep = process.argv.includes('--keep');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-check-'));
const outDir = path.join(tmp, 'out');
fs.mkdirSync(outDir, { recursive: true });

console.log(`building dossier into ${outDir} ...`);
const build = spawnSync('node', ['main.ts'], {
  cwd: PROJECT,
  env: { ...process.env, MAKEFUN_OUTPUT_DIR: outDir },
  encoding: 'utf8',
  timeout: 120000,
});
if (build.status !== 0) {
  console.log('dossier build FAILED (main.ts exit ' + build.status + ')');
  console.log((build.stderr || build.stdout || '').trim());
  console.log(`temp dir kept: ${tmp}`);
  process.exit(1);
}
console.log('build exit 0');

const results = [];
const gate = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`[${passFail(ok)}] ${name} — ${detail}`);
};

// --- dossier.json ---
const dossierPath = path.join(outDir, 'dossier.json');
const dossierStat = fs.statSync(dossierPath);
const dossier = JSON.parse(fs.readFileSync(dossierPath, 'utf8'));
const dossierBytes = dossierStat.size;
gate('dossier.json <= 1,5 MiB', dossierBytes <= 1572864, `${fmtBytes(dossierBytes)} (${dossierBytes} B)`);
const textBytes = Buffer.byteLength(typeof dossier.text === 'string' ? dossier.text : JSON.stringify(dossier.text ?? ''), 'utf8');
gate('source text <= 163.840 B', textBytes <= 163840, `${textBytes} B`);
console.log(`  dossier schema: ${dossier.schema ?? dossier.$schema ?? '(not shown)'}, images: ${(dossier.images ?? []).length}`);

// --- game/ ---
const gameDir = path.join(outDir, 'game');
const tree = walkTree(gameDir);
gate('game/ entries <= 993', tree.entries <= 993, `${tree.entries} entries (${tree.files} files)`);
gate('game/ bytes <= 48 MiB', tree.bytes <= 50331648, `${fmtBytes(tree.bytes)} (${tree.bytes} B)`);
const indexStat = fs.statSync(path.join(gameDir, 'index.html'));
gate('game/index.html <= 1 MiB', indexStat.size <= 1048576, `${fmtBytes(indexStat.size)} (${indexStat.size} B)`);

// --- screenshots/ (the ones the dossier would ship) ---
const shotsDir = path.join(outDir, 'screenshots');
const shotFiles = fs.readdirSync(shotsDir)
  .filter((f) => /\.(png|jpe?g)$/i.test(f) && !f.startsWith('.'))
  .sort();
gate('screenshots count 3-4', shotFiles.length >= 3 && shotFiles.length <= 4, `${shotFiles.length} file(s): ${shotFiles.join(', ') || '(none)'}`);
for (const f of shotFiles) {
  const p = path.join(shotsDir, f);
  const buf = fs.readFileSync(p);
  let dims = null;
  try { dims = imageSize(buf); } catch { /* reported below */ }
  const sizeOk = buf.length <= 262144;
  const dimsOk = dims && Math.max(dims.width, dims.height) <= 1280 && Math.min(dims.width, dims.height) >= 480;
  gate(`screenshot ${f} <= 256 KiB`, sizeOk, `${fmtBytes(buf.length)} (${buf.length} B)`);
  gate(`screenshot ${f} dims (long <=1280, short >=480)`, Boolean(dimsOk),
    dims ? `${dims.width}x${dims.height}` : 'unreadable dimensions');
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\ngates: ${results.length - failed}/${results.length} PASS — build output in ${outDir}`);
if (!keep) {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('(temp build dir removed; re-run with --keep to inspect it)');
} else {
  console.log(`temp build dir kept: ${tmp}`);
}
process.exit(failed ? 1 : 0);
