// Semua embed, tombol, dan menu ada di sini supaya tampilan mudah diubah.
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');
const config = require('./config');
const store = require('./store');

const ts = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;

function cooldownText(c) {
  if (c.cooldown === 'daily-reset') return 'reset harian';
  if (c.cooldown >= 3600) return `${c.cooldown / 3600} jam`;
  if (c.cooldown >= 60) return `${c.cooldown / 60} menit`;
  return `${c.cooldown} detik`;
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
    .addFields({ name: 'Perintah yang didukung', value: list })
    .setFooter({ text: 'Semua pengaturan bersifat pribadi, hanya kamu yang bisa melihatnya.' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owo:on').setLabel('Aktifkan').setEmoji('🟢').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('owo:settings').setLabel('Pengaturan').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('owo:status').setLabel('Status Saya').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owo:voted').setLabel('Sudah Vote').setEmoji('🗳️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel('Vote OwO').setEmoji('🔗').setStyle(ButtonStyle.Link).setURL(config.voteUrl),
    new ButtonBuilder().setCustomId('owo:off').setLabel('Matikan').setEmoji('🔕').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row1, row2] };
}

// ───────────── Panel pengaturan pribadi (ephemeral) ─────────────
function settingsView(userId, user, note) {
  const embed = new EmbedBuilder()
    .setColor(user.enabled ? 0x57f287 : 0x99aab5)
    .setAuthor({ name: 'Pengaturan Pengingat' })
    .setDescription(
      (note ? `${note}\n\n` : '') +
      `Status: ${user.enabled ? '🟢 **Aktif**' : '⚫ **Mati**'}\n` +
      `Dikirim lewat: ${user.dm ? '📩 **DM**' : '💬 **Channel**'}\n\n` +
      Object.entries(config.commands)
        .map(([k, c]) => `${user.commands.includes(k) ? '✅' : '▫️'} ${c.emoji} ${c.label} · ${cooldownText(c)}`)
        .join('\n'),
    )
    .setFooter({ text: 'Pilih perintah lewat menu di bawah. Perubahan langsung tersimpan.' });

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
    new ButtonBuilder().setCustomId('owo:status').setLabel('Lihat Status').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), buttons] };
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

module.exports = {
  publicPanel, settingsView, statusView, notRegisteredView, reminderMessage, cooldownText, ts,
};
