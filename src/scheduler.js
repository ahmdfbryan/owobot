const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const time = require('./time');

const timers = new Map(); // key `${userId}:${cmd}` -> Timeout
let client = null;

function init(discordClient) {
  client = discordClient;
}

// Berapa ms lagi jam senyap user selesai (0 = tidak sedang senyap)
function quietDelay(user, date = new Date()) {
  const opt = config.quietOptions.find((o) => o.value === user.quiet);
  if (!opt || opt.start === undefined) return 0;
  const { h } = time.clock(config.localTimezone, date);
  const inQuiet = opt.start > opt.end
    ? (h >= opt.start || h < opt.end)
    : (h >= opt.start && h < opt.end);
  return inQuiet ? time.msUntilHour(config.localTimezone, opt.end, date) : 0;
}

function computeDueAt(cmd) {
  const c = config.commands[cmd];
  // +5 detik buffer supaya pasti sudah lewat reset
  if (c.cooldown === 'daily-reset') return Date.now() + time.msUntilNextMidnight(config.dailyResetTimezone) + 5000;
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

// Kirim pesan ke user: lewat DM kalau dipilih (fallback ke channel), atau ke channel
async function deliver(user, userId, channelId, payload) {
  if (user.dm) {
    try {
      const u = await client.users.fetch(userId);
      await u.send(payload);
      return true;
    } catch {
      // DM tertutup -> lanjut kirim ke channel
    }
  }
  if (!channelId) return false;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return false;
    const msg = await channel.send(payload);
    if (config.deleteChannelReminderAfter > 0) {
      setTimeout(() => msg.delete().catch(() => {}), config.deleteChannelReminderAfter * 1000);
    }
    return true;
  } catch (err) {
    console.warn(`[deliver] Tidak bisa kirim ke channel ${channelId}: ${err.message}`);
    return false;
  }
}

async function fire(rem) {
  timers.delete(key(rem.userId, rem.cmd));
  store.removeReminder(rem.userId, rem.cmd);

  const user = store.getUser(rem.userId);
  if (!user || !user.enabled || !user.commands.includes(rem.cmd)) return;

  // Jam senyap: tahan pengingat sampai jam senyap selesai
  const hold = quietDelay(user);
  if (hold > 0) {
    const held = { ...rem, dueAt: Date.now() + hold + 1000, held: true };
    store.upsertReminder(held);
    arm(held);
    return;
  }

  store.setUser(rem.userId, { ...user, sent: (user.sent || 0) + 1 });
  await deliver(user, rem.userId, rem.channelId, ui.reminderMessage(rem));
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

module.exports = { init, schedule, cancel, cancelAll, restore, deliver, quietDelay };
