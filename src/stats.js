// Statistik penggunaan OwO, streak daily, dan leaderboard.
// Hanya mencatat member yang sudah mengaktifkan pengingat (opt-in).
const config = require('./config');
const store = require('./store');
const time = require('./time');

const today = () => time.dateKey(config.localTimezone);
const thisWeek = () => time.isoWeekKey(today());
const owoToday = () => time.dateKey(config.dailyResetTimezone);

function emptyStats() {
  return {
    total: {},
    day: { key: today(), counts: {} },
    week: { key: thisWeek(), counts: {} },
    streak: { current: 0, best: 0, lastDaily: null },
  };
}

// Ambil statistik user, sekaligus reset hitungan hari/minggu yang sudah lewat
function read(user) {
  const s = user.stats ? JSON.parse(JSON.stringify(user.stats)) : emptyStats();
  s.total ||= {};
  s.streak ||= { current: 0, best: 0, lastDaily: null };
  if (s.day?.key !== today()) s.day = { key: today(), counts: {} };
  if (s.week?.key !== thisWeek()) s.week = { key: thisWeek(), counts: {} };
  // Streak putus kalau daily terakhir lebih lama dari kemarin (hari OwO)
  const last = s.streak.lastDaily;
  if (last && last !== owoToday() && last !== time.addDays(owoToday(), -1)) s.streak.current = 0;
  return s;
}

const sum = (counts) => config.statCommands.reduce((n, c) => n + (counts[c] || 0), 0);

// Dipanggil setiap member mengetik perintah OwO yang dikenali.
// Hasil: { streakChanged, streak } supaya bot bisa merayakan streak.
function track(userId, cmd, channelId) {
  const user = store.getUser(userId);
  if (!user) return null;
  const s = read(user);
  let streakChanged = false;

  if (cmd === 'daily') {
    const d = owoToday();
    if (s.streak.lastDaily !== d) {
      s.streak.current = s.streak.lastDaily === time.addDays(d, -1) ? s.streak.current + 1 : 1;
      s.streak.best = Math.max(s.streak.best, s.streak.current);
      s.streak.lastDaily = d;
      streakChanged = true;
    }
  }

  // Daily hanya dihitung sekali per hari OwO (OwO juga menolak daily kedua)
  const countIt = config.statCommands.includes(cmd) && (cmd !== 'daily' || streakChanged);
  if (countIt) {
    s.total[cmd] = (s.total[cmd] || 0) + 1;
    s.day.counts[cmd] = (s.day.counts[cmd] || 0) + 1;
    s.week.counts[cmd] = (s.week.counts[cmd] || 0) + 1;
  }

  store.setUser(userId, { ...user, stats: s, lastChannelId: channelId });
  return { streakChanged, streak: s.streak.current };
}

function profile(userId) {
  const user = store.getUser(userId);
  if (!user) return null;
  const s = read(user);
  return {
    today: s.day.counts,
    week: s.week.counts,
    total: s.total,
    todayPoints: sum(s.day.counts),
    weekPoints: sum(s.week.counts),
    totalPoints: sum(s.total),
    streak: s.streak,
    claimedToday: s.streak.lastDaily === owoToday(),
    weekRank: rankOf(userId, 'week'),
  };
}

// type: 'week' | 'all' | 'streak'
function leaderboard(type) {
  const rows = [];
  for (const [userId, user] of Object.entries(store.allUsers())) {
    if (!user.stats) continue;
    const s = read(user);
    let score;
    if (type === 'week') score = sum(s.week.counts);
    else if (type === 'all') score = sum(s.total);
    else score = s.streak.current;
    if (score > 0) rows.push({ userId, score, best: s.streak.best });
  }
  rows.sort((a, b) => b.score - a.score || b.best - a.best);
  return rows;
}

function rankOf(userId, type) {
  const idx = leaderboard(type).findIndex((r) => r.userId === userId);
  return idx === -1 ? null : idx + 1;
}

module.exports = { track, profile, leaderboard, rankOf, read, owoToday };
