# Fase 2 — Senjata + ekonomi + bom (17 Nov 2026, dalam jendela)

Selesai: `weapons.js` (Pistol P9 / SMG Vex-9 / Rifle AR-77 / Sniper LW-50,
ADS, bloom/recoil, semi-otomatis), `economy.js` ($800 awal, menang +300 /
kalah +150, kill +300, plant +300, buy menu B + tombol 1-9), `grenades.js`
(smoke 12 dtk memblokir LOS bot, flash, frag 6 m / maks 90), bom di
`rounds.js` (carrier bot acak, drop/pickup, plant 3 dtk, defuse 5 dtk,
timer 35 dtk, ledakan), HUD buy menu + banner + flash overlay + uang.

Perbaikan bot yang ditemukan saat testing (bukan di rencana awal):
- Prop di garis lane (2 half wall + 4 crate) menjebak bot head-on — dipindah
  dari garis x = 0 / ±16; bot juga dapat sidestep saat macet >1 dtk.
- Bot retreat (HP <35) tidak pernah sembuh dan camping spawn — sekarang
  heal +20/dtk di spawn, lalu push lagi.
- Carrier mati -> bom drop dan tidak ada yang ambil — bot penyerang kini
  mencari bom drop; defender berkumpul ke bom yang sudah ter-plant.

Verifikasi (probe-fase2, 0 console/page error):
- Buy: flash $200 ok, SMG ditolak saat uang kurang, SMG dibeli + switch (mag 28).
- Plant bot carrier di site B, timer 32 dtk; defender defuse -> ronde
  berakhir "Bomb defused", skor def 1.
- Smoke cloud muncul; frag 100 -> 12 HP pada bot diam.
- probe-fase1 OK (ambang diubah: bot hidup yang bergerak >= 3, karena
  bot mati tidak bisa bergerak), shots 3/3, dossier gate 12/12 PASS
  (teks 82.998 B dari cap 163.840 B).

Catatan tuning (Fase 5): baku tembak awal sangat panas — garis pandang
spawn-ke-spawn lewat pintu mid (~35 m) membunuh 5 bot dalam ~10 dtk live.
Kandidat: geser pintu mid / tambah penutup di garis itu, atau turunkan
akurasi bot jarak jauh.

Belum dikerjakan (Fase 3): HUD lengkap (health/armor, kill feed, timer
ronde, scoreboard Tab + MVP), audio WebAudio, shot ke-4 (buy/plant).
