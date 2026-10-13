require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN dan CLIENT_ID wajib diisi di .env');
  process.exit(1);
}

(async () => {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log(`✅ Slash command terdaftar ${GUILD_ID ? `di server ${GUILD_ID}` : 'secara global (bisa butuh waktu hingga 1 jam)'}.`);
  } catch (err) {
    console.error('Gagal mendaftarkan command:', err);
    process.exit(1);
  }
})();
