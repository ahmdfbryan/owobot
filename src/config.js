// Semua pengaturan cooldown ada di sini. Kalau OwO mengubah cooldown,
// cukup ubah angka (dalam detik) tanpa menyentuh file lain.
module.exports = {
  prefixes: (process.env.OWO_PREFIXES || 'owo')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  commands: {
    hunt:   { label: 'owo hunt',   emoji: '🏹', aliases: ['hunt', 'h', 'catch'],  cooldown: 15 },
    battle: { label: 'owo battle', emoji: '⚔️', aliases: ['battle', 'b', 'fight'], cooldown: 15 },
    pray:   { label: 'owo pray',   emoji: '🙏', aliases: ['pray'],  cooldown: 300 },
    curse:  { label: 'owo curse',  emoji: '👻', aliases: ['curse'], cooldown: 300 },
    // 'daily-reset' = diingatkan saat daily OwO reset (tengah malam waktu Pasifik)
    daily:  { label: 'owo daily',  emoji: '🎁', aliases: ['daily'], cooldown: 'daily-reset' },
    // Vote di top.gg tidak bisa dideteksi dari chat, jadi dimulai lewat /oworeminder sudahvote
    vote:   { label: 'vote OwO di top.gg', emoji: '🗳️', aliases: [], cooldown: 12 * 3600 },
  },

  // Perintah yang aktif default saat user baru /oworeminder on.
  // hunt & battle dimatikan default karena cooldown 15 detik bisa spam.
  defaultEnabled: ['pray', 'curse', 'daily', 'vote'],

  // Tampilan panel
  brandColor: 0x5865f2,
  panelTitle: 'OwO Reminder',
  // Halaman vote OwO di top.gg (ID bot OwO). Ganti kalau link-nya berubah.
  voteUrl: 'https://top.gg/bot/408785106942164992/vote',

  // Panel sticky: panel dikirim ulang ke paling bawah setelah channel sepi selama N ms.
  // Jeda ini mencegah panel dihapus-kirim terus saat chat ramai (dan kena rate limit).
  stickyDelayMs: 4000,

  dailyResetTimezone: 'America/Los_Angeles',

  // Zona waktu komunitas: dipakai untuk statistik "hari ini/minggu ini" dan jam senyap
  localTimezone: 'Asia/Jakarta',
  localTzLabel: 'WIB',

  // Penyelamat streak: peringatan N jam sebelum daily reset kalau belum klaim
  streakGuardHoursBefore: 2,

  // Pilihan jam senyap (jam lokal). start > end berarti melewati tengah malam.
  quietOptions: [
    { value: 'off', label: 'Mati', emoji: '🔔' },
    { value: '22-6', label: '22.00 – 06.00', emoji: '🌙', start: 22, end: 6 },
    { value: '23-7', label: '23.00 – 07.00', emoji: '🌙', start: 23, end: 7 },
    { value: '0-8', label: '00.00 – 08.00', emoji: '😴', start: 0, end: 8 },
    { value: '7-15', label: '07.00 – 15.00 (jam sekolah/kerja)', emoji: '📚', start: 7, end: 15 },
  ],

  // Perintah yang dihitung untuk statistik & leaderboard
  statCommands: ['hunt', 'battle', 'pray', 'curse', 'daily'],
  leaderboardSize: 10,

  // Pengingat di channel dihapus otomatis setelah N detik (0 = tidak dihapus)
  deleteChannelReminderAfter: 60,

  // Pengingat cooldown pendek yang terlewat saat bot offline lebih dari ini akan dibuang
  staleShortReminderMs: 5 * 60 * 1000,
};
