# BASELINE — Test Harness DUSTLINE vs Starter Kit

Tanggal: 2026-11-15 ~11:20 WIB. Harness di `tools/` dijalankan terhadap starter
apa adanya (belum ada game hasil build). Semua file di `game/`, `main.ts`,
`vendor/`, `screenshots/` tidak disentuh (mtime tetap 04:19, 0 file berubah).

## Screenshot baseline — `tools/out-baseline/`

Diambil via `node tools/shots.mjs --out tools/out-baseline` (port 8091,
viewport 1280×720, JPEG q85, render asli tanpa edit). Ketiganya
`window.__shotReady === true`, tanpa console error dan tanpa page error.
Verifikasi visual 2-play.jpg: render asli game (ruangan abu-abu, rifle,
target, HUD "Score 130", ammo "26 / 90").

| File | Mode | Ukuran | Dimensi |
|---|---|---|---|
| 1-start.jpg | `?shot=start&seed=1` | 25.973 B (25,4 KiB) | 1280×720 JPEG |
| 2-play.jpg | `?shot=play&seed=1` | 30.501 B (29,8 KiB) | 1280×720 JPEG |
| 3-end.jpg | `?shot=end&seed=1` | 25.944 B (25,3 KiB) | 1280×720 JPEG |

## Gate dossier starter — `node tools/check-dossier.mjs`

Build ke direktori sementara di /tmp (dihapus setelah cek). **12/12 PASS.**

| Gate | Hasil |
|---|---|
| dossier.json ≤ 1,5 MiB | 134.384 B (131,2 KiB) — PASS |
| teks sumber ≤ 163.840 B | 31.646 B — PASS |
| game/ entries ≤ 993 | 15 entries (12 file) — PASS |
| game/ bytes ≤ 48 MiB | 2.165.491 B (2,07 MiB) — PASS |
| game/index.html ≤ 1 MiB | 5.522 B (5,4 KiB) — PASS |
| screenshots 3–4 buah | 3 (1-start, 2-play, 3-end) — PASS |
| tiap screenshot ≤ 256 KiB | 24.204 / 28.039 / 23.652 B — PASS |
| tiap screenshot 1280 sisi panjang, ≥480 sisi pendek | 1280×720 semua — PASS |

## Error console

Nihil — 0 console error dan 0 page error di ketiga mode `?shot=` maupun
selama playtest interaktif.

## Playtest (kerangka) — `node tools/playtest.mjs --seconds 8`

Jalan bersih terhadap starter: canvas ada, halaman tetap responsif
(`document.readyState === "complete"`, latensi evaluate 408 ms), 11 langkah
input (siklus WASD + gerak/klik mouse), 0 console/page error.

Perkiraan FPS: **~2,6 FPS (57 frame / 22,3 dtk)** — angka ini HANYA indikatif:
render headless memakai SwiftShader (software GL), bukan GPU. Jangan
dibandingkan dengan target FPS di hardware nyata. Catatan: rangkaian input
8 detik memakan ~22 detik wall-clock — dispatch input CDP mengantre di
belakang renderer software yang sibuk; ini perilaku harness di SwiftShader,
bukan cacat game.

## Status harness: SIAP dipakai untuk game hasil build

- `tools/shots.mjs` — tangkap ulang screenshot dari `shots.json` kapan saja.
- `tools/check-dossier.mjs` — cek semua gate; tambah `--keep` untuk
  memeriksa hasil build di /tmp.
- `tools/playtest.mjs` — kerangka smoke test interaktif; belum menegaskan
  gerakan pemain / target kena tembak (pengembangan lanjutan saat game
  DUSTLINE sudah ada — mis. baca posisi pemain/HUD dari `window`).
- `tools/lib.mjs` — helper bersama (server, Playwright, dimensi gambar).

## Masalah yang ditemukan & ditangani

1. **Server `serve.ts` sempat mati di tengah run pertama** (shot ke-3 gagal
   `ERR_CONNECTION_REFUSED`). Penyebab diduga: respons yang dibatalkan
   browser saat page ditutup membuat stream tanpa error handler di
   `serve.ts` melempar dan mematikan proses. `serve.ts` TIDAK diubah
   (di luar lingkup tools/); harness kini mendeteksi server mati dan
   me-restart otomatis sebelum tiap shot (`ensureServer` di `lib.mjs`),
   plus mencatat exit server ke stderr. Run ulang: 3/3 bersih.
2. **FPS headless sangat rendah (2,6 FPS)** — ekspektasi SwiftShader, bukan
   temuan game. Playtest tidak memakai angka ini sebagai gate.
