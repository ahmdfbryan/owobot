require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, MessageFlags, Events } = require('discord.js');
const config = require('./config');
const store = require('./store');
const scheduler = require('./scheduler');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN belum diisi di .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // wajib diaktifkan juga di Developer Portal
  ],
});

// alias -> nama perintah, contoh: 'h' -> 'hunt'
const aliasMap = new Map();
for (const [name, c] of Object.entries(config.commands)) {
  for (const a of c.aliases) aliasMap.set(a.toLowerCase(), name);
}
// Prefix terpanjang dicek dulu (supaya 'owo' tidak kalah dengan 'o' kalau dipakai bersamaan)
const prefixes = [...config.prefixes].sort((a, b) => b.length - a.length);

// Kenali perintah OwO dari pesan user. Mendukung "owo hunt", "owoh", "owo h", "wh" (jika prefix w).
function detectOwoCommand(content) {
  const text = content.trim().toLowerCase();
  for (const p of prefixes) {
    if (!text.startsWith(p)) continue;
    const rest = text.slice(p.length).trim();
    const word = rest.split(/\s+/)[0];
    if (word && aliasMap.has(word)) return aliasMap.get(word);
  }
  return null;
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Login sebagai ${c.user.tag} | prefix OwO: ${config.prefixes.join(', ')}`);
  scheduler.restore();
});

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot || !message.guild) return;
  const user = store.getUser(message.author.id);
  if (!user || !user.enabled) return; // hanya user yang opt-in

  const cmd = detectOwoCommand(message.content);
  if (!cmd || !user.commands.includes(cmd)) return;

  scheduler.schedule(message.author.id, cmd, message.channelId);
  message.react('⏱️').catch(() => {}); // tanda kecil bahwa timer dimulai (abaikan jika tidak ada izin)
});

function defaultSettings() {
  return { enabled: true, dm: false, commands: [...config.defaultEnabled] };
}

function statusEmbed(userId, user) {
  const lines = Object.entries(config.commands).map(([name, c]) => {
    const on = user.commands.includes(name);
    return `${on ? '🟢' : '⚫'} **${c.label}**`;
  });
  const active = store.getReminders(userId)
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((r) => `• ${config.commands[r.cmd]?.label || r.cmd} — <t:${Math.floor(r.dueAt / 1000)}:R>`);

  return new EmbedBuilder()
    .setColor(user.enabled ? 0x57f287 : 0x99aab5)
    .setTitle('⏰ Pengingat OwO')
    .setDescription(user.enabled ? 'Status: **Aktif**' : 'Status: **Mati**')
    .addFields(
      { name: 'Perintah', value: lines.join('\n') },
      { name: 'Kirim lewat', value: user.dm ? 'DM' : 'Channel tempat kamu mengetik', inline: true },
      { name: 'Pengingat berjalan', value: active.length ? active.join('\n') : 'Tidak ada' },
    )
    .setFooter({ text: 'Bot ini hanya mengingatkan — kamu tetap mengetik perintah OwO sendiri.' });
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'oworeminder') return;
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const reply = (content) => interaction.reply({ ...content, flags: MessageFlags.Ephemeral });

  try {
    let user = store.getUser(userId);

    if (sub === 'on') {
      user = user ? { ...user, enabled: true } : defaultSettings();
      store.setUser(userId, user);
      return reply({ content: '✅ Pengingat OwO **aktif**. Ketik perintah OwO seperti biasa, nanti saya ingatkan saat cooldown selesai.', embeds: [statusEmbed(userId, user)] });
    }

    if (!user) {
      return reply({ content: 'Kamu belum mengaktifkan pengingat. Pakai `/oworeminder on` dulu ya.' });
    }

    if (sub === 'off') {
      store.setUser(userId, { ...user, enabled: false });
      scheduler.cancelAll(userId);
      return reply({ content: '🔕 Semua pengingat OwO kamu dimatikan.' });
    }

    if (sub === 'status') {
      return reply({ embeds: [statusEmbed(userId, user)] });
    }

    if (sub === 'atur') {
      const cmd = interaction.options.getString('perintah', true);
      const aktif = interaction.options.getBoolean('aktif', true);
      const set = new Set(user.commands);
      aktif ? set.add(cmd) : set.delete(cmd);
      user = { ...user, commands: [...set] };
      store.setUser(userId, user);
      if (!aktif) scheduler.cancel(userId, cmd);
      return reply({ content: `${aktif ? '🟢' : '⚫'} Pengingat **${config.commands[cmd].label}** ${aktif ? 'dinyalakan' : 'dimatikan'}.` });
    }

    if (sub === 'dm') {
      const aktif = interaction.options.getBoolean('aktif', true);
      store.setUser(userId, { ...user, dm: aktif });
      return reply({ content: aktif ? '📩 Pengingat akan dikirim lewat DM (kalau DM tertutup, dikirim di channel).' : '💬 Pengingat akan dikirim di channel.' });
    }

    if (sub === 'sudahvote') {
      if (!user.enabled) return reply({ content: 'Pengingat kamu sedang mati. Pakai `/oworeminder on` dulu.' });
      if (!user.commands.includes('vote')) {
        user = { ...user, commands: [...user.commands, 'vote'] };
        store.setUser(userId, user);
      }
      const rem = scheduler.schedule(userId, 'vote', interaction.channelId);
      return reply({ content: `🗳️ Dicatat! Saya ingatkan untuk vote lagi <t:${Math.floor(rem.dueAt / 1000)}:R>.` });
    }
  } catch (err) {
    console.error('[interaction]', err);
    if (!interaction.replied && !interaction.deferred) {
      reply({ content: '❌ Terjadi kesalahan, coba lagi.' }).catch(() => {});
    }
  }
});

// Simpan data sebelum proses berhenti (pm2 restart/stop)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { store.saveNow(); process.exit(0); });
}
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

store.load();
scheduler.init(client);
client.login(process.env.DISCORD_TOKEN);
