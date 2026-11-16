# Fase 1 — Map + bot + ronde (17 Nov 2026, dalam jendela)

Selesai: `palette.js` (senja gurun), `world.js` (map 40x40, 2 site, 3 lane,
balcony A, 27 waypoint + edge, LOS 2D), `player.js` (+`createMover` bersama),
`bots.js` (9 bot, state machine, vision 100°/40m, hearing 25m, burst fire),
`rounds.js` (buy 15 dtk / live 100 dtk / roundEnd 4 dtk, first to 5, maks 9,
K/D/A + MVP), `main.js` (wiring 5v5, player health, `window.__dustline` +
`fastForward` untuk harness).

Verifikasi (probe-fase1, 25 dtk game time, 2 run):
- buy -> live, 9/9 bot bergerak (run 1), 5/9 (run 2, sisanya mati/hold).
- Bot saling tembak sampai ada yang mati; 0 console error, 0 page error.
- Shots harness 3/3 clean. Sumber game/src ~53 KiB (cap dossier 160 KiB).

Catatan untuk tuning (Fase 5, bukan blocker):
- Garis pandang spawn-ke-spawn lewat pintu mid (jarak ~35 m) cukup panas:
  bot penyerang/bertahan bisa saling tembak dari spawn. Pemain yang diam di
  spawn bisa mati. Kandidat perbaikan: geser pintu mid atau tambah penutup
  di garis itu. Jangan ubah sebelum play-test Fase 2/3.

Belum dikerjakan (Fase 2): senjata 4 + ADS + recoil, ekonomi + buy menu,
granat, plant/defuse + ledakan. HUD/audio/visual (Fase 3). Repo publik
`makefun-threejs-fps-01` belum dibuat — menunggu keputusan Owner.
