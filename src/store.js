// Penyimpanan JSON sederhana (tanpa native module, aman untuk Node 20).
// Tulis atomik: tulis ke file .tmp lalu rename, supaya data tidak korup saat crash.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'store.json');

let data = { users: {}, reminders: [], panels: {} };
let saveTimer = null;

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      data.users = parsed.users || {};
      data.reminders = Array.isArray(parsed.reminders) ? parsed.reminders : [];
      data.panels = parsed.panels || {};
    }
  } catch (err) {
    console.error('[store] Gagal membaca store.json, mulai dari kosong:', err.message);
    try { fs.copyFileSync(FILE, FILE + '.broken-' + Date.now()); } catch {}
  }
  return data;
}

function saveNow() {
  try {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[store] Gagal menyimpan:', err.message);
  }
}

// Debounce supaya hunt/battle yang sering tidak menulis disk tiap pesan
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 1000);
}

function getUser(userId) {
  return data.users[userId] || null;
}

function setUser(userId, settings) {
  data.users[userId] = settings;
  save();
}

function upsertReminder(rem) {
  data.reminders = data.reminders.filter((r) => !(r.userId === rem.userId && r.cmd === rem.cmd));
  data.reminders.push(rem);
  save();
}

function removeReminder(userId, cmd) {
  data.reminders = data.reminders.filter((r) => !(r.userId === userId && r.cmd === cmd));
  save();
}

function removeAllReminders(userId) {
  data.reminders = data.reminders.filter((r) => r.userId !== userId);
  save();
}

function getReminders(userId) {
  return data.reminders.filter((r) => r.userId === userId);
}

function allReminders() {
  return [...data.reminders];
}

// Panel sticky: channelId -> messageId panel terakhir
function getPanels() {
  return { ...data.panels };
}

function setPanel(channelId, messageId) {
  data.panels[channelId] = messageId;
  save();
}

function removePanel(channelId) {
  delete data.panels[channelId];
  save();
}

module.exports = {
  load, save, saveNow, getUser, setUser,
  upsertReminder, removeReminder, removeAllReminders, getReminders, allReminders,
  getPanels, setPanel, removePanel,
};
