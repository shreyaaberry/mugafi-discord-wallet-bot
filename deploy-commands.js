const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("linkwallet")
    .setDescription("Link a wallet address to your Discord (writes to whitelist sheet)")
    .addStringOption(opt =>
      opt.setName("address")
        .setDescription("Wallet address (0x...)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addwallet")
    .setDescription("Add another wallet address")
    .addStringOption(opt =>
      opt.setName("address")
        .setDescription("Wallet address (0x...)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("wallets")
    .setDescription("List your linked wallets"),

  new SlashCommandBuilder()
    .setName("removewallet")
    .setDescription("Remove a linked wallet address")
    .addStringOption(opt =>
      opt.setName("address")
        .setDescription("Wallet address (0x...)")
        .setRequired(true)
    ),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
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
    process.exit(1);
  }
})();
