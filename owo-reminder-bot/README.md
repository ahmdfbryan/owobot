# OwO Reminder Bot

Bot Discord yang **mengingatkan** kamu saat cooldown OwO selesai. Bot ini tidak mengirim perintah OwO atas nama kamu, jadi kamu tetap mengetik `owo hunt` dan lainnya sendiri. Aman dari ToS Discord dan aturan anti-macro OwO.

## Cara kerja
1. User mengetik `/oworeminder on` (opt-in, user lain tidak akan di-ping).
2. Saat user mengetik perintah OwO (misal `owo pray`, `owoh`), bot memberi reaksi ⏱️ dan memulai timer.
3. Saat cooldown selesai, bot mem-ping user di channel itu (atau lewat DM). Pesan pengingat terhapus otomatis setelah 60 detik.

| Perintah | Cooldown | Default |
|---|---|---|
| hunt / battle | 15 detik | mati (bisa spam) |
| pray / curse | 5 menit | aktif |
| daily | sampai reset (00.00 waktu Pasifik ≈ 14.00/15.00 WIB) | aktif |
| vote top.gg | 12 jam, dimulai dari `/oworeminder sudahvote` | aktif |

Angka cooldown ada di `src/config.js`. Kalau OwO mengubahnya, cukup edit di sana.

## Slash command
- `/oworeminder on` / `off`
- `/oworeminder status` — pengaturan + pengingat yang berjalan
- `/oworeminder atur perintah:<...> aktif:<true/false>`
- `/oworeminder dm aktif:<true/false>`
- `/oworeminder sudahvote`

## Setup
1. Developer Portal → Bot → aktifkan **Message Content Intent**.
2. Invite bot dengan scope `bot` + `applications.commands`, izin: View Channels, Send Messages, Add Reactions, Read Message History.
3. Di VPS:
   ```bash
   cp .env.example .env   # isi DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OWO_PREFIXES
   npm install
   npm run deploy         # daftarkan slash command
   pm2 start src/index.js --name owo-reminder
   pm2 save
   ```

Data tersimpan di `data/store.json` (JSON biasa, tanpa native module, jadi jalan di Node 20). Pengingat panjang (daily, vote) tetap jalan setelah bot restart.
