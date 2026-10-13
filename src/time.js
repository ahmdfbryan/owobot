// Helper waktu berbasis zona waktu (tanpa library tambahan).

// 'YYYY-MM-DD' sesuai zona waktu
function dateKey(timeZone, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Minggu ISO, contoh '2026-W42' (Senin = awal minggu)
function isoWeekKey(key) {
  const d = new Date(`${key}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Jam & menit sekarang di zona waktu
function clock(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { h: get('hour') % 24, m: get('minute'), s: get('second'), ms: date.getMilliseconds() };
}

function msUntilNextMidnight(timeZone, date = new Date()) {
  const { h, m, s, ms } = clock(timeZone, date);
  return 24 * 3600 * 1000 - ((h * 3600 + m * 60 + s) * 1000 + ms);
}

// ms sampai jam tertentu (0–23) berikutnya di zona waktu
function msUntilHour(timeZone, hour, date = new Date()) {
  const { h, m, s, ms } = clock(timeZone, date);
  const nowMs = (h * 3600 + m * 60 + s) * 1000 + ms;
  let diff = hour * 3600 * 1000 - nowMs;
  if (diff <= 0) diff += 24 * 3600 * 1000;
  return diff;
}

module.exports = { dateKey, addDays, isoWeekKey, clock, msUntilNextMidnight, msUntilHour };
