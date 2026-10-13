// Semua embed, tombol, dan menu ada di sini supaya tampilan mudah diubah.
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');
const config = require('./config');
const store = require('./store');
const stats = require('./stats');

const ts = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;

function cooldownText(c) {
  if (c.cooldown === 'daily-reset') return 'reset harian';
  if (c.cooldown >= 3600) return `${c.cooldown / 3600} jam`;
  if (c.cooldown >= 60) return `${c.cooldown / 60} menit`;
  return `${c.cooldown} detik`;
}

function quietLabel(user) {
  const o = config.quietOptions.find((x) => x.value === user.quiet);
  return !o || o.value === 'off' ? '🔔 Mati' : `${o.emoji} ${o.label} ${config.localTzLabel}`;
}

// ───────────── Panel publik (dipasang admin di channel) ─────────────
function publicPanel() {
  const list = Object.values(config.commands)
    .map((c) => `${c.emoji} **${c.label}** · ${cooldownText(c)}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(`⏰ ${config.panelTitle}`)
    .setDescription(
      'Tidak perlu hafal cooldown lagi. Main OwO seperti biasa, nanti bot ini mengingatkan kamu saat perintahnya siap dipakai lagi.\n\n' +
      '**Cara pakai**\n' +
      '1. Tekan **Aktifkan** di bawah.\n' +
      '2. Pilih perintah yang ingin diingatkan di **Pengaturan**.\n' +
      '3. Ketik perintah OwO seperti biasa. Bot memberi reaksi ⏱️ tanda timer berjalan.',
    )
    .addFields(
      { name: 'Perintah yang didukung', value: list },
      {
        name: 'Fitur lainnya',
        value:
          '🔥 **Streak daily** tercatat otomatis, plus peringatan sebelum reset kalau kamu lupa klaim\n' +
          '🌙 **Mode senyap** supaya tidak di-ping saat tidur\n' +
          '👤 **Profil** statistik hunt, battle, pray kamu\n' +
          '🏆 **Leaderboard** member paling rajin minggu ini',
      },
    )
    .setFooter({ text: 'Semua pengaturan bersifat pribadi, hanya kamu yang bisa melihatnya.' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owo:on').setLabel('Aktifkan').setEmoji('🟢').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('owo:settings').setLabel('Pengaturan').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('owo:status').setLabel('Status Saya').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owo:profile').setLabel('Profil').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('owo:lb:week').setLabel('Leaderboard').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('owo:voted').setLabel('Sudah Vote').setEmoji('🗳️').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Vote OwO').setEmoji('🔗').setStyle(ButtonStyle.Link).setURL(config.voteUrl),
    new ButtonBuilder().setCustomId('owo:off').setLabel('Matikan').setEmoji('🔕').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row1, row2, row3] };
}

// ───────────── Panel pengaturan pribadi (ephemeral) ─────────────
function settingsView(userId, user, note) {
  const embed = new EmbedBuilder()
    .setColor(user.enabled ? 0x57f287 : 0x99aab5)
    .setAuthor({ name: 'Pengaturan Pengingat' })
    .setDescription(
      (note ? `${note}\n\n` : '') +
      `Status: ${user.enabled ? '🟢 **Aktif**' : '⚫ **Mati**'}\n` +
      `Dikirim lewat: ${user.dm ? '📩 **DM**' : '💬 **Channel**'}\n` +
      `Mode senyap: ${quietLabel(user)}\n` +
      `Penyelamat streak: ${user.streakGuard === false ? '⚫ Mati' : `🟢 Aktif (${config.streakGuardHoursBefore} jam sebelum reset)`}\n\n` +
      Object.entries(config.commands)
        .map(([k, c]) => `${user.commands.includes(k) ? '✅' : '▫️'} ${c.emoji} ${c.label} · ${cooldownText(c)}`)
        .join('\n'),
    )
    .setFooter({ text: 'Perubahan langsung tersimpan.' });

  const quietSelect = new StringSelectMenuBuilder()
    .setCustomId('owo:quiet')
    .setPlaceholder('🌙 Atur mode senyap (jam tidur)')
    .addOptions(config.quietOptions.map((o) => ({
      label: o.value === 'off' ? 'Mode senyap mati' : `${o.label} ${config.localTzLabel}`,
      value: o.value,
      emoji: o.emoji,
      description: o.value === 'off' ? 'Pengingat dikirim kapan saja' : 'Pengingat ditahan, dikirim setelah jam senyap',
      default: (user.quiet || 'off') === o.value,
    })));

  const select = new StringSelectMenuBuilder()
    .setCustomId('owo:cmds')
    .setPlaceholder('Pilih perintah yang ingin diingatkan')
    .setMinValues(0)
    .setMaxValues(Object.keys(config.commands).length)
    .addOptions(Object.entries(config.commands).map(([k, c]) => ({
      label: c.label,
      value: k,
      emoji: c.emoji,
      description: `Cooldown ${cooldownText(c)}`,
      default: user.commands.includes(k),
    })));

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('owo:toggle')
      .setLabel(user.enabled ? 'Matikan' : 'Aktifkan')
      .setEmoji(user.enabled ? '🔕' : '🟢')
      .setStyle(user.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('owo:dm')
      .setLabel(user.dm ? 'Kirim di Channel' : 'Kirim lewat DM')
      .setEmoji(user.dm ? '💬' : '📩')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('owo:guard')
      .setLabel(user.streakGuard === false ? 'Nyalakan Penyelamat Streak' : 'Matikan Penyelamat Streak')
      .setEmoji('🔥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('owo:status').setLabel('Status').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(quietSelect),
      buttons,
    ],
  };
}

// ───────────── Status pribadi (ephemeral) ─────────────
function statusView(userId, user, note) {
  const active = store.getReminders(userId).sort((a, b) => a.dueAt - b.dueAt);
  const activeText = active.length
    ? active.map((r) => {
      const c = config.commands[r.cmd];
      return `${c?.emoji || '⏰'} **${c?.label || r.cmd}** siap ${ts(r.dueAt)}`;
    }).join('\n')
    : '_Tidak ada timer berjalan. Ketik perintah OwO untuk memulai._';

  const embed = new EmbedBuilder()
    .setColor(user.enabled ? config.brandColor : 0x99aab5)
    .setAuthor({ name: 'Status Pengingat Kamu' })
    .setDescription(note || null)
    .addFields(
      { name: 'Status', value: user.enabled ? '🟢 Aktif' : '⚫ Mati', inline: true },
      { name: 'Dikirim lewat', value: user.dm ? '📩 DM' : '💬 Channel', inline: true },
      { name: 'Total diingatkan', value: `🔔 ${user.sent || 0}x`, inline: true },
      { name: `Timer berjalan (${active.length})`, value: activeText },
    )
    .setFooter({ text: 'Waktu ditampilkan sesuai zona waktu perangkat kamu.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owo:refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('owo:settings').setLabel('Pengaturan').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('owo:cancelall').setLabel('Batalkan Semua Timer').setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger).setDisabled(active.length === 0),
  );
  return { embeds: [embed], components: [row] };
}

// Tampilan untuk user yang belum pernah mengaktifkan
function notRegisteredView() {
  const embed = new EmbedBuilder()
    .setColor(0x99aab5)
    .setDescription('Kamu belum mengaktifkan pengingat OwO.\nTekan **Aktifkan** untuk mulai.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owo:on').setLabel('Aktifkan').setEmoji('🟢').setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row] };
}

// ───────────── Pesan pengingat ─────────────
function reminderMessage(rem) {
  const c = config.commands[rem.cmd];
  const isVote = rem.cmd === 'vote';

  const embed = new EmbedBuilder()
    .setColor(isVote ? 0xfee75c : 0x57f287)
    .setDescription(isVote
      ? `${c.emoji} Kamu sudah bisa **vote OwO** lagi!\nSetelah vote, tekan **Sudah Vote** supaya diingatkan 12 jam lagi.`
      : `${c.emoji} Cooldown **${c.label}** sudah selesai. Gas lagi!`);
  if (rem.held) embed.setFooter({ text: '🌙 Pengingat ini ditahan selama jam senyap kamu.' });

  const row = new ActionRowBuilder();
  if (isVote) {
    row.addComponents(
      new ButtonBuilder().setLabel('Vote Sekarang').setEmoji('🔗').setStyle(ButtonStyle.Link).setURL(config.voteUrl),
      new ButtonBuilder().setCustomId(`owo:voted:${rem.userId}`).setLabel('Sudah Vote').setEmoji('🗳️').setStyle(ButtonStyle.Success),
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`owo:mute:${rem.cmd}:${rem.userId}`)
        .setLabel(`Jangan ingatkan ${c.label} lagi`)
        .setEmoji('🔕')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return {
    content: `<@${rem.userId}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [rem.userId] },
  };
}

// ───────────── Profil (ephemeral) ─────────────
const MEDALS = ['🥇', '🥈', '🥉'];

function countLine(counts) {
  const parts = config.statCommands
    .filter((k) => counts[k])
    .map((k) => `${config.commands[k].emoji} ${counts[k]}`);
  return parts.length ? parts.join('  ·  ') : '_Belum ada_';
}

function profileView(userId, discordUser) {
  const p = stats.profile(userId);
  if (!p) return notRegisteredView();
  const st = p.streak;
  const flame = st.current >= 30 ? '🔥🔥🔥' : st.current >= 7 ? '🔥🔥' : st.current > 0 ? '🔥' : '🧊';

  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setAuthor({ name: `Profil OwO · ${discordUser.displayName || discordUser.username}`, iconURL: discordUser.displayAvatarURL() })
    .setThumbnail(discordUser.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: `${flame} Streak daily`, value: `**${st.current} hari**\nTerbaik: ${st.best} hari`, inline: true },
      { name: '🎁 Daily hari ini', value: p.claimedToday ? '✅ Sudah klaim' : '⏳ Belum klaim', inline: true },
      { name: '🏆 Rank minggu ini', value: p.weekRank ? `#${p.weekRank}` : '–', inline: true },
      { name: `📅 Hari ini · ${p.todayPoints} perintah`, value: countLine(p.today) },
      { name: `🗓️ Minggu ini · ${p.weekPoints} perintah`, value: countLine(p.week) },
      { name: `📈 Sepanjang masa · ${p.totalPoints} perintah`, value: countLine(p.total) },
    )
    .setFooter({ text: `Dihitung sejak kamu mengaktifkan pengingat · hari & minggu mengikuti ${config.localTzLabel}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owo:profile').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('owo:lb:week').setLabel('Leaderboard').setEmoji('🏆').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('owo:settings').setLabel('Pengaturan').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

// ───────────── Leaderboard (ephemeral) ─────────────
const LB_TYPES = {
  week: { title: 'Minggu Ini', emoji: '🗓️', unit: 'perintah' },
  all: { title: 'Sepanjang Masa', emoji: '📈', unit: 'perintah' },
  streak: { title: 'Streak Daily', emoji: '🔥', unit: 'hari' },
};

function leaderboardView(type, viewerId) {
  const t = LB_TYPES[type] || LB_TYPES.week;
  const rows = stats.leaderboard(type);
  const top = rows.slice(0, config.leaderboardSize);

  const lines = top.map((r, i) => {
    const rank = MEDALS[i] || `\`#${String(i + 1).padStart(2, ' ')}\``;
    const me = r.userId === viewerId ? ' ⬅️' : '';
    return `${rank} <@${r.userId}> · **${r.score}** ${t.unit}${me}`;
  });

  const myIdx = rows.findIndex((r) => r.userId === viewerId);
  let footer = 'Kamu belum masuk peringkat. Ayo main OwO!';
  if (myIdx !== -1) footer = `Peringkat kamu: #${myIdx + 1} dari ${rows.length} · ${rows[myIdx].score} ${t.unit}`;

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏆 Leaderboard · ${t.emoji} ${t.title}`)
    .setDescription(lines.length ? lines.join('\n') : '_Belum ada data. Leaderboard terisi setelah member yang aktif mulai main OwO._')
    .setFooter({ text: footer });
  if (type === 'week') embed.setTimestamp().setFooter({ text: `${footer} · reset tiap Senin ${config.localTzLabel}` });

  const row = new ActionRowBuilder().addComponents(
    ...Object.entries(LB_TYPES).map(([k, v]) => new ButtonBuilder()
      .setCustomId(`owo:lb:${k}`)
      .setLabel(v.title)
      .setEmoji(v.emoji)
      .setStyle(k === type ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(k === type)),
    new ButtonBuilder().setCustomId('owo:profile').setLabel('Profil Saya').setEmoji('👤').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

// ───────────── Penyelamat streak & perayaan ─────────────
function streakGuardMessage(userId, streak, resetAt) {
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('🔥 Streak kamu hampir putus!')
    .setDescription(
      `Kamu belum **owo daily** hari ini. Streak **${streak} hari** akan hilang ${ts(resetAt)}.\n` +
      'Ketik `owo daily` sekarang untuk menyelamatkannya.',
    )
    .setFooter({ text: 'Matikan peringatan ini di Pengaturan → Penyelamat Streak' });
  return { content: `<@${userId}>`, embeds: [embed], allowedMentions: { users: [userId] } };
}

const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

function streakMilestoneMessage(userId, streak) {
  if (!MILESTONES.includes(streak)) return null;
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setDescription(`🎉 <@${userId}> mencapai **streak daily ${streak} hari**! Pertahankan! 🔥`);
  return { embeds: [embed], allowedMentions: { parse: [] } };
}

module.exports = {
  publicPanel, settingsView, statusView, notRegisteredView, reminderMessage, cooldownText, ts,
  profileView, leaderboardView, streakGuardMessage, streakMilestoneMessage,
};
