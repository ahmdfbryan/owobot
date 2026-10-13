require('dotenv').config();
const { Client, GatewayIntentBits, MessageFlags, Events } = require('discord.js');
const config = require('./config');
const store = require('./store');
const scheduler = require('./scheduler');
const ui = require('./ui');

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

// ───────────── Deteksi perintah OwO ─────────────
const aliasMap = new Map();
for (const [name, c] of Object.entries(config.commands)) {
  for (const a of c.aliases) aliasMap.set(a.toLowerCase(), name);
}
const prefixes = [...config.prefixes].sort((a, b) => b.length - a.length);

// Mendukung "owo hunt", "owoh", "owo h", "wh" (jika prefix w).
function detectOwoCommand(content) {
  const text = content.trim().toLowerCase();
  for (const p of prefixes) {
    if (!text.startsWith(p)) continue;
    const word = text.slice(p.length).trim().split(/\s+/)[0];
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
  message.react('⏱️').catch(() => {});
});

// ───────────── Aksi pengaturan (dipakai tombol & slash command) ─────────────
function defaultSettings() {
  return { enabled: true, dm: false, commands: [...config.defaultEnabled], sent: 0 };
}

function updateUser(userId, patch) {
  const user = { ...(store.getUser(userId) || defaultSettings()), ...patch };
  store.setUser(userId, user);
  return user;
}

function turnOn(userId) {
  return updateUser(userId, { enabled: true });
}

function turnOff(userId) {
  scheduler.cancelAll(userId);
  return updateUser(userId, { enabled: false });
}

function setCommands(userId, cmds) {
  const before = store.getUser(userId)?.commands || [];
  for (const c of before) if (!cmds.includes(c)) scheduler.cancel(userId, c);
  return updateUser(userId, { commands: cmds });
}

function markVoted(userId, channelId) {
  const user = store.getUser(userId);
  if (!user?.enabled) return { ok: false, msg: 'Pengingat kamu sedang mati. Aktifkan dulu ya.' };
  if (!user.commands.includes('vote')) updateUser(userId, { commands: [...user.commands, 'vote'] });
  const rem = scheduler.schedule(userId, 'vote', channelId);
  return { ok: true, msg: `🗳️ Tercatat! Kamu akan diingatkan vote lagi ${ui.ts(rem.dueAt)} (${ui.ts(rem.dueAt, 't')}).` };
}

// ───────────── Interaksi ─────────────
const ephemeral = (payload) => ({ ...payload, flags: MessageFlags.Ephemeral });

// Kalau tombol ditekan dari pesan ephemeral (menu pribadi) → edit pesan itu.
// Kalau dari panel/pengingat publik → balas ephemeral baru.
async function respond(interaction, payload) {
  const fromEphemeral = interaction.message?.flags?.has(MessageFlags.Ephemeral);
  if (fromEphemeral) return interaction.update(payload);
  return interaction.reply(ephemeral(payload));
}

async function handleComponent(interaction) {
  const [, action, ...args] = interaction.customId.split(':');
  const userId = interaction.user.id;
  let user = store.getUser(userId);

  switch (action) {
    case 'on':
      user = turnOn(userId);
      return respond(interaction, ui.settingsView(userId, user, '✅ Pengingat **aktif**! Atur perintah yang ingin diingatkan di bawah.'));

    case 'off':
      if (!user) return respond(interaction, ui.notRegisteredView());
      user = turnOff(userId);
      return respond(interaction, ui.settingsView(userId, user, '🔕 Semua pengingat dimatikan dan timer dibatalkan.'));

    case 'toggle':
      if (!user) return respond(interaction, ui.notRegisteredView());
      user = user.enabled ? turnOff(userId) : turnOn(userId);
      return respond(interaction, ui.settingsView(userId, user, user.enabled ? '🟢 Pengingat diaktifkan.' : '🔕 Pengingat dimatikan.'));

    case 'settings':
      if (!user) return respond(interaction, ui.notRegisteredView());
      return respond(interaction, ui.settingsView(userId, user));

    case 'dm':
      if (!user) return respond(interaction, ui.notRegisteredView());
      user = updateUser(userId, { dm: !user.dm });
      return respond(interaction, ui.settingsView(userId, user, user.dm
        ? '📩 Pengingat dikirim lewat DM. Kalau DM kamu tertutup, dikirim di channel.'
        : '💬 Pengingat dikirim di channel.'));

    case 'cmds': {
      if (!user) return respond(interaction, ui.notRegisteredView());
      user = setCommands(userId, interaction.values);
      return respond(interaction, ui.settingsView(userId, user, `💾 Tersimpan. ${interaction.values.length} perintah aktif.`));
    }

    case 'status':
    case 'refresh':
      if (!user) return respond(interaction, ui.notRegisteredView());
      return respond(interaction, ui.statusView(userId, user));

    case 'cancelall':
      if (!user) return respond(interaction, ui.notRegisteredView());
      scheduler.cancelAll(userId);
      return respond(interaction, ui.statusView(userId, user, '🗑️ Semua timer dibatalkan.'));

    case 'voted': {
      const owner = args[0];
      if (owner && owner !== userId) {
        return interaction.reply(ephemeral({ content: 'Tombol ini milik orang lain. Pakai tombol **Sudah Vote** di panel ya.' }));
      }
      if (!user) return respond(interaction, ui.notRegisteredView());
      const res = markVoted(userId, interaction.channelId);
      return interaction.reply(ephemeral({ content: res.msg }));
    }

    case 'mute': {
      const [cmd, owner] = args;
      if (owner !== userId) {
        return interaction.reply(ephemeral({ content: 'Tombol ini milik orang lain.' }));
      }
      if (!user || !config.commands[cmd]) return respond(interaction, ui.notRegisteredView());
      setCommands(userId, user.commands.filter((c) => c !== cmd));
      return interaction.reply(ephemeral({
        content: `🔕 Pengingat **${config.commands[cmd].label}** dimatikan. Bisa dinyalakan lagi lewat **Pengaturan**.`,
      }));
    }

    default:
      return null;
  }
}

async function handleSlash(interaction) {
  const userId = interaction.user.id;

  if (interaction.commandName === 'owopanel') {
    try {
      await interaction.channel.send(ui.publicPanel());
      return interaction.reply(ephemeral({ content: '✅ Panel OwO Reminder terpasang di channel ini.' }));
    } catch {
      return interaction.reply(ephemeral({
        content: '❌ Gagal memasang panel. Pastikan bot punya izin **View Channel**, **Send Messages**, dan **Embed Links** di channel ini.',
      }));
    }
  }

  if (interaction.commandName !== 'oworeminder') return null;
  const sub = interaction.options.getSubcommand();
  let user = store.getUser(userId);

  if (sub === 'on') {
    user = turnOn(userId);
    return interaction.reply(ephemeral(ui.settingsView(userId, user, '✅ Pengingat **aktif**!')));
  }
  if (!user) return interaction.reply(ephemeral(ui.notRegisteredView()));

  switch (sub) {
    case 'menu':
      return interaction.reply(ephemeral(ui.settingsView(userId, user)));
    case 'off':
      user = turnOff(userId);
      return interaction.reply(ephemeral(ui.settingsView(userId, user, '🔕 Semua pengingat dimatikan.')));
    case 'status':
      return interaction.reply(ephemeral(ui.statusView(userId, user)));
    case 'atur': {
      const cmd = interaction.options.getString('perintah', true);
      const aktif = interaction.options.getBoolean('aktif', true);
      const set = new Set(user.commands);
      aktif ? set.add(cmd) : set.delete(cmd);
      user = setCommands(userId, [...set]);
      return interaction.reply(ephemeral(ui.settingsView(userId, user,
        `${aktif ? '🟢' : '⚫'} **${config.commands[cmd].label}** ${aktif ? 'dinyalakan' : 'dimatikan'}.`)));
    }
    case 'dm':
      user = updateUser(userId, { dm: interaction.options.getBoolean('aktif', true) });
      return interaction.reply(ephemeral(ui.settingsView(userId, user)));
    case 'sudahvote':
      return interaction.reply(ephemeral({ content: markVoted(userId, interaction.channelId).msg }));
    default:
      return null;
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) return await handleSlash(interaction);
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('owo:')) {
      return await handleComponent(interaction);
    }
  } catch (err) {
    console.error('[interaction]', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply(ephemeral({ content: '❌ Terjadi kesalahan, coba lagi.' })).catch(() => {});
    }
  }
  return null;
});

// ───────────── Start ─────────────
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { store.saveNow(); process.exit(0); });
}
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

store.load();
scheduler.init(client);
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  if (/disallowed intents/i.test(err.message)) {
    console.error('❌ Message Content Intent belum aktif. Buka Developer Portal → Bot → Privileged Gateway Intents → nyalakan Message Content Intent.');
  } else {
    console.error('❌ Gagal login:', err.message);
  }
  process.exit(1);
});
