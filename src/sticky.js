// Panel sticky: panel selalu dikirim ulang ke posisi paling bawah channel.
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

let client = null;
const timers = new Map();   // channelId -> Timeout (debounce)
const busy = new Set();     // channelId yang sedang proses kirim ulang

function init(discordClient) {
  client = discordClient;
}

// Pesan ini panel milik bot sendiri? (dikenali dari tombol pertamanya)
function isOwnPanel(message) {
  if (message.author.id !== client.user.id) return false;
  const first = message.components?.[0]?.components?.[0];
  return first?.customId === 'owo:on';
}

async function repost(channelId) {
  if (busy.has(channelId)) return;
  busy.add(channelId);
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      store.removePanel(channelId);
      console.warn(`[sticky] Channel ${channelId} tidak ditemukan, panel dilepas.`);
      return;
    }

    const oldId = store.getPanels()[channelId];
    // Kirim yang baru dulu, baru hapus yang lama, supaya panel tidak pernah hilang
    const msg = await channel.send(ui.publicPanel());
    store.setPanel(channelId, msg.id);

    if (oldId && oldId !== msg.id) {
      await channel.messages.delete(oldId).catch(() => {});
    }
  } catch (err) {
    console.warn(`[sticky] Gagal kirim ulang panel di ${channelId}: ${err.message}`);
  } finally {
    busy.delete(channelId);
  }
}

function scheduleRepost(channelId, delay = config.stickyDelayMs) {
  if (timers.has(channelId)) clearTimeout(timers.get(channelId));
  timers.set(channelId, setTimeout(() => {
    timers.delete(channelId);
    repost(channelId);
  }, delay));
}

// Dipanggil untuk setiap pesan baru
function onMessage(message) {
  const panels = store.getPanels();
  if (!panels[message.channelId]) return;
  if (isOwnPanel(message)) return;
  scheduleRepost(message.channelId);
}

// Pasang panel baru di channel (dipakai /owopanel pasang)
async function install(channel) {
  const oldId = store.getPanels()[channel.id];
  const msg = await channel.send(ui.publicPanel());
  store.setPanel(channel.id, msg.id);
  if (oldId) await channel.messages.delete(oldId).catch(() => {});
}

// Lepas sticky dan hapus panel
async function uninstall(channel) {
  const oldId = store.getPanels()[channel.id];
  if (!oldId) return false;
  if (timers.has(channel.id)) { clearTimeout(timers.get(channel.id)); timers.delete(channel.id); }
  store.removePanel(channel.id);
  await channel.messages.delete(oldId).catch(() => {});
  return true;
}

// Saat bot start: kalau ada chat masuk selama bot offline, pindahkan panel ke bawah
async function restore() {
  const panels = store.getPanels();
  for (const [channelId, messageId] of Object.entries(panels)) {
    try {
      const channel = await client.channels.fetch(channelId);
      const last = (await channel.messages.fetch({ limit: 1 })).first();
      if (!last || last.id !== messageId) scheduleRepost(channelId, 1000);
    } catch {
      scheduleRepost(channelId, 1000);
    }
  }
  console.log(`[sticky] ${Object.keys(panels).length} panel sticky aktif.`);
}

module.exports = { init, onMessage, install, uninstall, restore };
