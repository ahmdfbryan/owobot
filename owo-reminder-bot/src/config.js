// Semua pengaturan cooldown ada di sini. Kalau OwO mengubah cooldown,
// cukup ubah angka (dalam detik) tanpa menyentuh file lain.
module.exports = {
  prefixes: (process.env.OWO_PREFIXES || 'owo')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  commands: {
    hunt:   { label: 'owo hunt',   aliases: ['hunt', 'h', 'catch'],  cooldown: 15 },
    battle: { label: 'owo battle', aliases: ['battle', 'b', 'fight'], cooldown: 15 },
    pray:   { label: 'owo pray',   aliases: ['pray'],  cooldown: 300 },
    curse:  { label: 'owo curse',  aliases: ['curse'], cooldown: 300 },
    // 'daily-reset' = diingatkan saat daily OwO reset (tengah malam waktu Pasifik)
    daily:  { label: 'owo daily',  aliases: ['daily'], cooldown: 'daily-reset' },
    // Vote di top.gg tidak bisa dideteksi dari chat, jadi dimulai lewat /oworeminder sudahvote
    vote:   { label: 'vote OwO di top.gg', aliases: [], cooldown: 12 * 3600 },
  },

  // Perintah yang aktif default saat user baru /oworeminder on.
  // hunt & battle dimatikan default karena cooldown 15 detik bisa spam.
  defaultEnabled: ['pray', 'curse', 'daily', 'vote'],

  dailyResetTimezone: 'America/Los_Angeles',

  // Pengingat di channel dihapus otomatis setelah N detik (0 = tidak dihapus)
  deleteChannelReminderAfter: 60,

  // Pengingat cooldown pendek yang terlewat saat bot offline lebih dari ini akan dibuang
  staleShortReminderMs: 5 * 60 * 1000,
};
