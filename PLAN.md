# DUSTLINE — Rencana Implementasi Bertahap

Kompetisi Make.fun `threejs-fps-01` — "Make the best three.js tactical FPS".
Game: tactical FPS 5v5, bom 2-site, ekonomi + buy menu, bot AI, satu map senja gurun.
Rencana ini ditulis Minggu 15 Nov 2026 ~11:30 WIB (pra-buka). Status: **SETUP + RENCANA SELESAI,
BUILD SUBSTANTIF DIMULAI 17 NOV 00:00 WIB** (lihat §1).

## 1. Aturan jendela transkrip — BACA DULU (mengikat)

Kompetisi buka **Senin 17 Nov 2026 00:00 WIB**, deadline **Senin 24 Nov 2026 00:00 WIB**.
Gerbang transkrip Make.fun mensyaratkan sesi build dimulai SETELAH kompetisi dibuka
(`thinking_in_window`); repo GitHub publik dibuat SETELAH dibuka. Karena itu:

- **Pra-buka (15–16 Nov, sesi ini): BOLEH** — review riset + starter kit, rencana ini,
  setup direktori lokal (`~/workspace/threejs-fps-build/` berisi salinan starter),
  spesifikasi modul (§5–§11), dan test harness (`tools/`, bukan kode game).
- **Pra-buka: DILARANG** — menulis kode game DUSTLINE apa pun ke dalam `game/`,
  membuat repo GitHub, submission, atau publikasi apa pun.
- **Dalam jendela (17–24 Nov):** semua sesi build substantif + pembuatan repo +
  submission. Jangan pernah mengklaim pekerjaan pra-buka sebagai pekerjaan dalam jendela.
- Checklist gerbang transkrip untuk sesi 17 Nov: repo dibuat setelah buka; `main.ts`
  ditulis/diedit oleh ≥2 pesan assistant; cakupan authored ≥30%; ≥5 turn assistant;
  baris muse-usage dilampirkan; LICENSE baris pertama `SPDX-License-Identifier: MIT`;
  bundle dibuat di turn BERIKUTNYA setelah pekerjaan repo (quirk timing muse-usage).

## 2. Tujuan dan non-tujuan

**Tujuan:** game yang benar-benar PLAYABLE dan STABIL, lengkap menurut 5 kriteria judge
(game lengkap > gunplay > taktik > map & look > kode), masuk 12 besar Swiss, lalu Top 5
(finalist review: tim memainkan game langsung — game harus sungguh bisa dimainkan).
**Non-tujuan:** grafis fotorealistik, map kedua, mode kedua, multiplayer, fitur dekoratif
yang mengorbankan stabilitas. Disiplin scope: yang ada di §5–§11 saja.

## 3. Arsitektur (pertahankan dari starter)

- Fixed-step 60 Hz terpisah dari render; tanpa alokasi per-frame di hot loop
  (vektor dipakai ulang); satu modul satu tugas; state pertandingan di satu tempat
  (`rounds.js` memegang fase/ronde/skor/uang/bom; modul lain membaca lewat API eksplisit).
- Player: gerak starter dipakai ulang (akselerasi, friksi, gravitasi, lompat, crouch,
  collision AABB per sumbu). Bot memakai helper gerak yang sama (`createMover` dari
  `player.js`) agar collision konsisten.
- Senjata hitscan (raycaster) seperti starter; damage: torso 34, head 100 (×3 pada bot),
  armor menyerap 50% sampai habis.
- Semua warna lewat `palette.js` (6 nama). Tekstur prosedural via CanvasTexture
  (tanpa file eksternal). Audio prosedural via WebAudio (tanpa file audio).
- Tanpa network, tanpa referensi eksternal; semua path relatif; import map `"three"`
  tidak berubah; `vendor/makefun-threejs.ts` dan `main.ts` TIDAK BOLEH diubah
  (kecuali `main.ts` hanya bila perlu — sejauh ini tidak perlu).
- `game/src/main.js` mengimpor modul dengan urutan PRIORITAS (menentukan urutan teks
  dossier, DFS dari index.html): `bots.js` → `rounds.js` → `economy.js` →
  `weapons.js` → `world.js` → `hud.js` → `audio.js` → `player.js` → `input.js` →
  `palette.js`. (palette akan terbaca saat pertama kali ditemui — kecil, tidak masalah.)

## 4. Layout file (target)

```
threejs-fps-build/
  PLAN.md            (file ini)
  docs/              (spesifikasi & catatan build; TIDAK masuk dossier)
  tools/             (harness Playwright: shots.mjs, check-dossier.mjs, playtest.mjs)
  main.ts            (starter, tidak diubah)
  serve.ts           (starter, tidak diubah)
  vendor/makefun-threejs.ts (starter, tidak diubah)
  shots.json         (diperluas: start, play, buy, plant, end)
  screenshots/       (4 hasil render asli; pertama = cover)
  game/
    index.html       (DUSTLINE: HUD lengkap + overlay buy/scoreboard)
    src/main.js      (orkestrasi: loop, tembak, state, shots)
    src/palette.js   (palet senja gurun)
    src/world.js     (map DUSTLINE 40×40 + props + tekstur + cahaya)
    src/player.js    (starter + createMover untuk bot + ADS)
    src/input.js     (starter + klik kanan ADS + B buy + Tab scoreboard + E plant/defuse)
    src/weapons.js   (4 senjata + granat + tracer + recoil/bloom)
    src/bots.js      (9 bot: state machine + waypoint + LOS/hearing + tembak)
    src/rounds.js    (fase ronde, bom, skor, uang, MVP, statistik)
    src/economy.js   (harga, buy menu, hadiah)
    src/hud.js       (HUD + kill feed + banner + scoreboard)
    src/audio.js     (WebAudio prosedural)
    vendor/three/    (three.js 0.187.0 byte-for-byte, tidak disentuh)
```

**Budget ukuran (cap dossier 160 KiB = 163.840 byte):** target total sumber ~70–95 KiB.
Starter 30.703 byte. Perkiraan modul baru: bots ~14 KiB, rounds ~8 KiB, economy ~6 KiB,
weapons ~8 KiB, world ~10 KiB, hud/scoreboard ~8 KiB, audio ~4 KiB, main ~8 KiB,
lainnya ~4 KiB. Cek dengan `tools/check-dossier.mjs` tiap fase; bila mendekati
120 KiB, pangkas komentar dan rapikan sebelum lanjut.

## 5. Spesifikasi map — `world.js` + `palette.js`

Palet senja gurun: pasir hangat `#c9a06b`, dinding plaster `#b98d5f`, lantai
`#8a6b45`, aksen site teal `#2fa08c`, aksen bahaya/ musuh `#d95d39`, ink `#f2ead8`,
muted `#8a7d68`. Matahari rendah dari barat (directional, bayangan panjang),
hemisphere hangat, fog hangat (jarak 25–60). Langit gradien via CanvasTexture
pada backdrop besar (bukan `scene.background` polos).

Map ±40×40 m, koordinat x ∈ [-20, 20], z ∈ [-20, 20]:
- Spawn penyerang (pemain + 4 bot sekutu) selatan z ≈ +17; spawn bertahan
  (5 bot musuh) utara z ≈ -17.
- Site A barat laut (x ≈ -14, z ≈ -14), site B timur laut (x ≈ +14, z ≈ -14).
  Tanda site: rambu besar "A" / "B" (CanvasTexture) + zona plant (kotak di lantai).
- 3 lane: A long (koridor barat x ≈ -16), mid (x ≈ 0, pintu + peti tengah),
  B tunnels (timur x ≈ +16, lorong beratap rendah).
- Balcony A: platform y = 1,2 m menghadap site A, dijangkau 2 anak tangga
  (tiap 0,6 m — bisa dilompati; bot melompat bila waypoint berikutnya lebih
  tinggi dan geraknya terhalang).
- Penutup di tiap sudut: peti 1,1 m (crouch cover), tong silinder, dinding
  setengah (1,2 m), dinding penuh pembentuk lane. Semua box = collider + shootable.
- Nama area tampil di HUD dari posisi pemain (SPAWN / A LONG / MID / B TUNNELS /
  SITE A / SITE B / BALCONY).
- Waypoint graph (~25 node): ekspor dari `world.js` sebagai daftar node
  `{x, z, y, area}` + edge antar node yang jalurnya lurus dan bebas halangan.
  Node di: kedua spawn, tiap ujung lane, pintu mid, masuk site A/B, plant spot
  A/B, balcony, dan 2 titik hold bertahan.
- Tekstur prosedural (CanvasTexture, di-generate sekali di load): pasir lantai
  (noise speckle), plaster dinding (garis halus), kayu peti, rambu site.
- Dinding perimeter 4,6 m; langit terbuka; tidak ada langit-langit kecuali
  atap B tunnels (slab y = 2,6 m).

## 6. Spesifikasi bot — `bots.js` (9 bot: 4 sekutu + 5 musuh)

- Satu AI untuk kedua tim. Tiap bot: posisi/yaw/pitch, health 100, armor 0/50,
  senjata (rifle default; sekutu kadang SMG), tim, state, waypoint tujuan,
  target terlihat, waktu reaksi, akurasi.
- State machine: `patrol` (bergerak antar waypoint) → `hold` (jaga sudut,
  menghadap lane) → `engage` (musuh terlihat: berhenti/strafe, tembak burst) →
  `retreat` (health < 35 dan musuh dekat: mundur ke waypoint aman) →
  `plant`/`defuse` (pembawa bom / bertahan saat bom ter-plant).
- Persepsi: vision cone ~100°, jarak pandang 40 m; LOS via segmen 2D vs AABB
  dinding + cek ketinggian (tanpa raycaster per bot — murah dan deterministik).
  Hearing: tembakan terdengar radius 25 m → bot menoleh/bergerak ke arah suara.
  Smoke memblokir LOS (lihat §8).
- Menembak: hitscan, burst 3–5 peluru, jeda antar burst 0,5–0,9 dtk, waktu reaksi
  250–450 ms setelah musuh terlihat. Akurasi menurun dengan jarak dan kecepatan
  target; damage ke pemain: torso 34, head 100; armor serap 50%.
  Akurasi disetel agar ronde BISA menang dan BISA kalah (bot tidak sempurna).
- Gerak: kecepatan jalan 4,6 (sedikit di bawah pemain 5,2); pakai `createMover`
  (collision sama dengan pemain); melompat bila waypoint berikutnya lebih tinggi.
- Karakter visual: kapsul + torso + kepala (bola), warna tim (sekutu teal,
  musuh oranye-merah), senjata kotak di tangan, animasi jalan sederhana
  (goyang ±0,06 rad). Mati → jatuh (rotasi x) → hilang setelah ronde berakhir.
- Perilaku ronde: penyerang (bot sekutu + musuh bertahan) — penyerang bergerak
  berkelompok 2–3 menuju satu site (pilih acak A/B per ronde, kadang split);
  bertahan menyebar: 2 jaga A, 2 jaga B, 1 mid. Pembawa bom: satu bot sekutu
  acak (atau pemain bila pemain mengambilnya — bom di-spawn di spawn penyerang).
- Kesulitan: satu level saja, disetel lewat konstanta di atas file
  (`BOT_ACCURACY`, `BOT_REACT_MS`, dsb.) agar mudah di-tune dari hasil play-test.

## 7. Spesifikasi ronde + bom — `rounds.js`

- Fase: `buy` (15 dtk, buy menu terbuka, pemain/bot di spawn) → `live`
  (100 dtk) → `roundEnd` (4 dtk, banner) → `buy` lagi… Match berakhir saat
  satu tim mencapai 5 kemenangan ronde (maks 9 ronde). Tanpa ganti sisi.
- Menang ronde: eliminasi tim lawan; ATAU bom meledak (penyerang menang);
  ATAU bom di-defuse (bertahan menang); ATAU waktu habis tanpa plant
  (bertahan menang).
- Bom: dibawa satu penyerang (pemain atau bot). Plant: tahan E 3 dtk di dalam
  zona site. Setelah plant: timer 35 dtk, bunyi beep makin cepat. Defuse:
  tahan E 5 dtk di dekat bom (bertahan saja). Ledakan: radius 12 m, damage
  jatuh dengan jarak, efek cahaya + suara.
- Skor tim tampil di HUD (DUSTLINE x — y OPP). Banner tiap akhir ronde
  ("ROUND WON — Site A cleared" / "BOMB DETONATED" / dst.).
- Statistik per agen: kill, death, assist (damage ke korban ≤5 dtk sebelum
  kill oleh rekan tim). MVP = kill terbanyak (seri → death paling sedikit),
  diumumkan di scoreboard akhir match.
- Match end: overlay skor akhir + MVP + tombol "Play again" (restart match).

## 8. Spesifikasi senjata, ekonomi, granat — `weapons.js` + `economy.js`

Senjata (hitscan; `weapons.js` memiliki tabel, `main.js` memiliki ray-nya):

| Senjata | Harga | Mag | Cadangan | Fire gap | Damage torso | Catatan |
|---|---|---|---|---|---|---|
| Pistol P9 (awal) | — | 12 | 36 | 0,18 dtk | 26 | semi-otomatis |
| SMG Vex-9 | $1.500 | 28 | 84 | 0,075 dtk | 24 | spread besar |
| Rifle AR-77 | $2.700 | 30 | 90 | 0,096 dtk | 34 | starter, seimbang |
| Sniper LW-50 | $4.750 | 5 | 15 | 1,1 dtk | 95 | scope (zoom FOV), head = kill |

- ADS: klik kanan — spread ×0,45, gerak ×0,6, FOV menyempit (sniper: zoom besar).
- Recoil + bloom: spread naik tiap tembakan beruntun, pulih saat berhenti;
  crouch mengurangi spread; bergerak/lompat menambah.
- Armor $650 (menyerap 50% damage sampai 50 poin habis). Granat: smoke $300
  (awan 12 dtk, blokir LOS bot + mengaburkan pandangan), flash $200 (layar
  putih bila granat terlihat di view cone saat meledak), frag $300 (ledakan
  1,5 dtk setelah lempar, radius 6 m, damage maks 90 jatuh dengan jarak).
  Pemain melempar dengan tombol 4/5/6 (pilih) + klik kiri. Bot: hanya frag,
  sesekali (peluang kecil saat engage).
- Ekonomi (`economy.js`): uang awal $800; menang ronde +$300, kalah +$150,
  kill +$300, plant +$300. Buy menu tombol B — hanya saat fase `buy`.
  Menu menampilkan: 4 senjata + armor + 3 granat + harga + uang saat ini;
  beli dengan klik/angka 1–7. Tracer peluru (garis tipis cepat pudar) +
  muzzle flash seperti starter.

## 9. Spesifikasi HUD, scoreboard, audio — `hud.js` + `audio.js`

HUD (DOM, seperti starter — tidak menyentuh simulasi):
- Bawah kanan: ammo besar + cadangan; bawah kiri: health bar + armor + uang;
  atas tengah: timer ronde + skor tim; atas kiri: nama area + fase ronde;
  tengah: crosshair (mengecil saat ADS) + hitmarker; kill feed kanan atas
  (5 baris terakhir, pudar 4 dtk); banner tengah saat peristiwa ronde.
- Buy menu (overlay, fase buy): grid item + harga + uang; tutup dengan B/Esc.
- Scoreboard (tahan Tab, dan overlay akhir match): tabel kedua tim —
  nama (YOU / BOT-1…), K / D / A, uang; skor tim besar; MVP ditandai ★.
  Nama bot: sekutu "DUST-1..4", musuh "VIPER-1..5" (orisinal, bukan dari game lain).
- Kill feed + banner + scoreboard memakai data dari `rounds.js`.
- Audio (`audio.js`, WebAudio prosedural, mulai setelah interaksi pertama):
  tembakan (noise burst + lowpass, beda tiap senjata), reload (klik),
  hit (tick), kill (nada ganda), plant beep, defuse beep, ledakan (noise +
  sine rendah), langkah kaki (tick lembut), menang ronde (3 nada sine),
  suara sekitar angin gurun (noise sangat pelan, loop). Volume master satu
  slider di overlay awal (default 0,7). Tanpa file audio eksternal.

## 10. Spesifikasi main.js + shots deterministik

- `main.js` mengimpor modul sesuai urutan §3, membangun dunia, 9 bot,
  pemain, senjata, ronde, ekonomi, HUD, audio; loop fixed-step 60 Hz;
  tembakan pemain via raycaster (seperti starter) + damage ke bot
  (head ×3 → 100, torso 34; armor bot 50% bila ada).
- Bot menembak via `bots.js` (hitscan sederhana: hitung arah + spread,
  cek LOS, terapkan damage; tanpa raycaster per tembakan bot).
- `?shot=` diperluas (deterministik, seed=1, render 2× lalu freeze +
  `window.__shotReady`): `start` (menu awal + cover map), `play` (baku tembak
  site A: pemain + bot, HUD lengkap, muzzle flash, tracer), `buy` (buy menu
  terbuka awal ronde), `plant` (momen plant bom di site A + smoke),
  `end` (scoreboard akhir match). `shots.json` diperbarui ke 4 file:
  `1-cover.jpg` (?shot=play), `2-buy.jpg` (?shot=buy), `3-plant.jpg`
  (?shot=plant), `4-end.jpg` (?shot=end). (Urutan nama = urutan tampil;
  pertama = cover.)
- Komentar blok singkat di atas `main.js` merangkum sistem game
  (diperbolehkan dan dibaca judge sebagai bagian entry).
- `main.ts` TIDAK diubah; dossier dibangun dengan perintah di §12.

## 11. Fase implementasi (dalam jendela, 17–24 Nov)

| Fase | Kapan | Isi | Kriteria selesai |
|---|---|---|---|
| 0 — Setup | 15–16 Nov (sesi ini) | Direktori + starter tersalin + rencana ini + harness siap + spek modul | Starter render di Playwright; dossier starter lolos gate; harness jalan |
| 1 — Map + bot + ronde | 17 Nov 00:00–12:00 | `world.js` map DUSTLINE, `bots.js` gerak+visi+tembak, `rounds.js` kerangka (buy/live/end, skor), pemain bisa jalan + bot melawan | Play-test: ronde berjalan penuh, bot bergerak & menembak balik, tidak ada error console |
| 2 — Senjata + ekonomi + bom | 17 Nov 12:00 – 18 Nov | `weapons.js` 4 senjata + ADS + recoil, `economy.js` + buy menu, granat, plant/defuse + ledakan | Play-test: beli senjata, plant & defuse berfungsi, granat berfungsi |
| 3 — HUD + audio + visual | 18–19 Nov | `hud.js` lengkap + scoreboard + MVP, `audio.js`, tekstur + cahaya + props final, `?shot=` 5 mode | Screenshot 4 mode render benar; HUD lengkap di screenshot |
| 4 — Dossier + dev #1 | 20 Nov | Screenshot final, `check-dossier` lolos semua gate, submission dev #1 (provisional), baca skor + alasan judge | Dossier valid; skor provisional + alasan tercatat |
| 5 — Iterasi judge | 21–22 Nov | Perbaiki dari alasan judge (1–2 submission dev tambahan; maks 5/hari, 10 total) | Tiap iterasi: play-test ulang + dossier valid |
| 6 — Final | 23 Nov | Play-test penuh (beberapa match lengkap), perbaikan stabilitas, submission FINAL (entry terakhir sebelum deadline = final) | Game stabil tanpa error; dossier final valid; submit sebelum 24 Nov 00:00 WIB |

Catatan submission: dev heat bersifat provisional (tidak dihitung di final) —
submit awal itu ALAT UKUR, bukan final. Entry terakhir sebelum deadline adalah
final. JANGAN submit sebelum ada persetujuan Owner per submission (SOP mengikat).

## 12. Perintah yang dipakai berulang

```bash
# Serve game (dev)
cd ~/workspace/threejs-fps-build && node serve.ts --port 8091
# Harness (dari tools/)
node tools/shots.mjs && node tools/check-dossier.mjs
# Build dossier (cek saja; /output asli dipakai saat submit)
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# Ukuran sumber (pantau cap 160 KiB)
wc -c game/src/*.js game/index.html | tail -1
du -sb game
```

## 13. Risiko + keputusan yang dibutuhkan Owner

- **Risiko 1 — Bot terasa bodoh/pintar berlebihan:** mitigasi dengan konstanta
  kesulitan di atas file + play-test tiap fase; tune dari hasil, bukan tebakan.
- **Risiko 2 — Ukuran dossier:** bila sumber >120 KiB, pangkas komentar/panjang
  nama sebelum lanjut (cek tiap fase).
- **Risiko 3 — Finalist review:** game harus sungguh playable; play-test penuh
  Fase 6 wajib, jangan dilewati.
- **Risiko 4 — Judge varian:** menang dengan margin besar (game lengkap +
  visual jelas), bukan tipis.
- **Keputusan Owner (nanti, bukan sekarang):** (a) pembuatan repo GitHub publik
  pada 17 Nov 00:00 WIB (nama repo — usulan `makefun-threejs-fps-01`, akun
  AfrizalSek); (b) tiap submission (dev #1, iterasi, final) — persetujuan
  terpisah per submission sesuai SOP; (c) bila build butuh biaya/layanan
  eksternal/infrastruktur — STOP dan tanya dulu (saat ini: tidak ada).
- **Larangan tetap:** tidak ada submission/publikasi/transaksi/tindakan eksternal
  tanpa persetujuan terpisah; jangan sentuh 5 submission Make.fun aktif,
  arsip bug bounty, XE, Plether, keypair, atau Virtual Office Live.
