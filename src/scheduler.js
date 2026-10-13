const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const timers = new Map(); // key `${userId}:${cmd}` -> Timeout
let client = null;

function init(discordClient) {
  client = discordClient;
}

// Hitung ms sampai tengah malam berikutnya di zona waktu tertentu
function msUntilNextMidnight(timeZone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  const h = get('hour') % 24;
  const elapsed = (h * 3600 + get('minute') * 60 + get('second')) * 1000 + now.getMilliseconds();
  // +5 detik buffer supaya pasti sudah lewat reset
  return 24 * 3600 * 1000 - elapsed + 5000;
}

function computeDueAt(cmd) {
  const c = config.commands[cmd];
  if (c.cooldown === 'daily-reset') return Date.now() + msUntilNextMidnight(config.dailyResetTimezone);
  return Date.now() + c.cooldown * 1000;
}

function key(userId, cmd) { return `${userId}:${cmd}`; }

function clearTimer(userId, cmd) {
  const k = key(userId, cmd);
  if (timers.has(k)) { clearTimeout(timers.get(k)); timers.delete(k); }
}

function arm(rem) {
  clearTimer(rem.userId, rem.cmd);
  const delay = Math.max(0, rem.dueAt - Date.now());
  const t = setTimeout(() => fire(rem).catch((e) => console.error('[fire]', e.message)), delay);
  timers.set(key(rem.userId, rem.cmd), t);
}

function schedule(userId, cmd, channelId) {
  const rem = { userId, cmd, channelId, dueAt: computeDueAt(cmd) };
  store.upsertReminder(rem);
  arm(rem);
  return rem;
}

function cancel(userId, cmd) {
  clearTimer(userId, cmd);
  store.removeReminder(userId, cmd);
}

function cancelAll(userId) {
  for (const cmd of Object.keys(config.commands)) clearTimer(userId, cmd);
  store.removeAllReminders(userId);
}

async function fire(rem) {
  timers.delete(key(rem.userId, rem.cmd));
  store.removeReminder(rem.userId, rem.cmd);

  const user = store.getUser(rem.userId);
  if (!user || !user.enabled || !user.commands.includes(rem.cmd)) return;

  const payload = ui.reminderMessage(rem);
  store.setUser(rem.userId, { ...user, sent: (user.sent || 0) + 1 });

  if (user.dm) {
    try {
      const u = await client.users.fetch(rem.userId);
      await u.send(payload);
      return;
    } catch {
      // DM tertutup -> lanjut kirim ke channel
    }
  }

  try {
    const channel = await client.channels.fetch(rem.channelId);
    if (!channel?.isTextBased()) return;
    const msg = await channel.send(payload);
    if (config.deleteChannelReminderAfter > 0) {
      setTimeout(() => msg.delete().catch(() => {}), config.deleteChannelReminderAfter * 1000);
    }
  } catch (err) {
    console.warn(`[fire] Tidak bisa kirim ke channel ${rem.channelId}: ${err.message}`);
  }
}

// Dipanggil saat bot start: jadwalkan ulang reminder yang tersimpan
function restore() {
  const now = Date.now();
  let restored = 0, dropped = 0;
  for (const rem of store.allReminders()) {
    const c = config.commands[rem.cmd];
    if (!c) { store.removeReminder(rem.userId, rem.cmd); continue; }
    const isShort = typeof c.cooldown === 'number' && c.cooldown < 3600;
    if (isShort && now - rem.dueAt > config.staleShortReminderMs) {
      store.removeReminder(rem.userId, rem.cmd);
      dropped++;
      continue;
    }
    arm(rem);
    restored++;
  }
  console.log(`[scheduler] ${restored} reminder dipulihkan, ${dropped} kedaluwarsa dibuang.`);
}

module.exports = { init, schedule, cancel, cancelAll, restore };
