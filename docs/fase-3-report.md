# Fase 3 — HUD + audio + visual (17 Nov 2026, dalam jendela)

Selesai: `hud.js` lengkap (health bar + armor, timer ronde + skor tim,
nama area, kill feed 5 baris, crosshair mengecil saat ADS, scoreboard
Tab + akhir match dengan K/D/A, uang, MVP ★, tombol Play again),
`audio.js` (WebAudio prosedural: tembakan per senjata, reload, hit, kill,
beep plant/defuse, ledakan, langkah, menang ronde, angin gurun loop;
slider volume di overlay awal, default 0,7; tanpa file audio),
tracer tembakan pemain, feed kill untuk semua kill, suara beep bom.

Shots baru (`shots.json`): 1-cover (?shot=play), 2-buy, 3-plant, 4-end —
4/4 clean, dossier gate 14/14 PASS.

Perbaikan yang ditemukan saat testing shot:
- Scoreboard hanya menampilkan agen yang sudah kill/mati — `rounds.js`
  kini punya roster (`setRoster`) sehingga 10 agen selalu tampil.
- Shot plant selalu ke site A padahal site ronde acak — kini memakai
  `rounds.state.site`; kamera harus di barat divider x=±12 (site tidak
  terlihat dari mid); shot memakai godMode test-only supaya planter
  tidak mati di tengah plant.
- Shot end membunuh defender saat fase buy — ronde tidak berakhir;
  kini maju dulu ke live, skor 5–0, scoreboard tampil (MVP: YOU ★).
- HUD kini di-update dari `step()` (bukan `frame()`), jadi tetap benar
  saat render loop di-throttle.

Verifikasi: probe-fase1 OK, probe-fase2 OK, probe-fase3 OK
(timer 0:13 buy, kill feed, scoreboard 12 baris, volume 0,7→0,3),
0 console/page error di semua probe dan shot.

Belum dikerjakan: edit ke-2 `main.ts` (gerbang transkrip, sebelum
submission — 1 edit komentar kecil di pesan assistant terpisah),
Fase 4 dossier + dev submission #1 (20 Nov, butuh persetujuan terpisah),
Fase 5 tuning (pintu mid terlalu panas, 5 bot mati ~10 dtk live).
