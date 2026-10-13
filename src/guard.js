// Penyelamat streak: mengingatkan member yang belum "owo daily" hari ini,
// N jam sebelum daily OwO reset, supaya streak tidak putus.
const config = require('./config');
const store = require('./store');
const stats = require('./stats');
const time = require('./time');
const scheduler = require('./scheduler');
const ui = require('./ui');

const CHECK_EVERY_MS = 60 * 1000;
let interval = null;

// Siapa saja yang perlu diingatkan sekarang?
function dueUsers(now = new Date()) {
  const windowMs = config.streakGuardHoursBefore * 3600 * 1000;
  if (time.msUntilNextMidnight(config.dailyResetTimezone, now) > windowMs) return [];

  const owoToday = time.dateKey(config.dailyResetTimezone, now);
  const result = [];
  for (const [userId, user] of Object.entries(store.allUsers())) {
    if (!user.enabled || user.streakGuard === false || !user.stats) continue;
    if (user.guardWarned === owoToday) continue;
    const s = stats.read(user);
    // Hanya kalau streak masih hidup (daily terakhir = kemarin) dan hari ini belum klaim
    if (s.streak.current > 0 && s.streak.lastDaily !== owoToday) {
      result.push({ userId, user, streak: s.streak.current, owoToday });
    }
  }
  return result;
}

async function check() {
  for (const { userId, user, streak, owoToday } of dueUsers()) {
    if (scheduler.quietDelay(user) > 0) continue; // jangan ganggu saat jam senyap
    store.setUser(userId, { ...user, guardWarned: owoToday });
    const resetAt = Date.now() + time.msUntilNextMidnight(config.dailyResetTimezone);
    await scheduler.deliver(user, userId, user.lastChannelId, ui.streakGuardMessage(userId, streak, resetAt));
  }
}

function start() {
  if (interval) clearInterval(interval);
  interval = setInterval(() => check().catch((e) => console.warn('[guard]', e.message)), CHECK_EVERY_MS);
  check().catch(() => {});
}

module.exports = { start, dueUsers };
