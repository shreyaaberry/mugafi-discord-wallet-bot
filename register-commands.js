const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("linkwallet").setDescription("Link a wallet (IP lord only)"),
  new SlashCommandBuilder().setName("addwallet").setDescription("Add another wallet"),
  new SlashCommandBuilder().setName("wallets").setDescription("List linked wallets"),
  new SlashCommandBuilder().setName("removewallet").setDescription("Remove a wallet")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (err) {
    console.error(err);
  }
})();
