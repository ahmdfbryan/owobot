const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');

const cmdChoices = Object.entries(config.commands).map(([value, c]) => ({ name: c.label, value }));

// Admin: pasang panel tombol di channel
const owopanel = new SlashCommandBuilder()
  .setName('owopanel')
  .setDescription('Kelola panel OwO Reminder')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) => s.setName('pasang').setDescription('Pasang panel sticky (selalu di paling bawah) di channel ini'))
  .addSubcommand((s) => s.setName('hapus').setDescription('Hapus panel sticky dari channel ini'));

// Member: pintasan kalau tidak mau lewat panel
const oworeminder = new SlashCommandBuilder()
  .setName('oworeminder')
  .setDescription('Pengingat cooldown OwO')
  .addSubcommand((s) => s.setName('menu').setDescription('Buka menu pengaturan pengingat (tombol)'))
  .addSubcommand((s) => s.setName('profil').setDescription('Lihat profil, statistik, dan streak OwO kamu'))
  .addSubcommand((s) => s.setName('leaderboard').setDescription('Lihat member paling rajin main OwO'))
  .addSubcommand((s) => s.setName('on').setDescription('Aktifkan pengingat OwO untuk kamu'))
  .addSubcommand((s) => s.setName('off').setDescription('Matikan semua pengingat OwO untuk kamu'))
  .addSubcommand((s) => s.setName('status').setDescription('Lihat pengaturan dan timer yang sedang berjalan'))
  .addSubcommand((s) => s
    .setName('atur')
    .setDescription('Nyalakan/matikan pengingat untuk perintah tertentu')
    .addStringOption((o) => o.setName('perintah').setDescription('Perintah OwO').setRequired(true).addChoices(...cmdChoices))
    .addBooleanOption((o) => o.setName('aktif').setDescription('Aktif?').setRequired(true)))
  .addSubcommand((s) => s
    .setName('dm')
    .setDescription('Kirim pengingat lewat DM, bukan di channel')
    .addBooleanOption((o) => o.setName('aktif').setDescription('Pakai DM?').setRequired(true)))
  .addSubcommand((s) => s.setName('sudahvote').setDescription('Tandai kamu sudah vote OwO di top.gg (ingatkan 12 jam lagi)'));

module.exports = [owopanel.toJSON(), oworeminder.toJSON()];
