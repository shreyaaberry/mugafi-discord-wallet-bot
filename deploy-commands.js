require("dotenv").config();
const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

const commands = [
  {
    name: "linkwallet",
    description: "Link your wallet to be whitelisted for launchpad",
    options: [
      { name: "address", description: "Wallet address (0x...)", type: 3, required: true }
    ]
  },
  {
    name: "addwallet",
    description: "Add another wallet to be whitelisted for launchpad",
    options: [
      { name: "address", description: "Wallet address (0x...)", type: 3, required: true }
    ]
  },
  {
    name: "waitlist",
    description: "Link your wallet for future whitelist consideration",
    options: [
      { name: "address", description: "Wallet address (0x...)", type: 3, required: true }
    ]
  },
  {
    name: "wallets",
    description: "List wallets linked to your Discord user"
  },
  {
    name: "removewallet",
    description: "Remove a linked wallet",
    options: [
      { name: "address", description: "Wallet address (0x...)", type: 3, required: true }
    ]
  }
];

(async () => {
  try {
    const appId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!appId || !guildId) {
      throw new Error("Missing DISCORD_CLIENT_ID or GUILD_ID in environment.");
    }

    // 1) Wipe all guild commands (clean slate)
    console.log("Wiping existing guild commands...");
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });

    // 2) Register the new set
    console.log("Registering guild commands...");
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });

    console.log("Done. Commands should appear immediately in that server.");
  } catch (e) {
    console.error("Register failed:", e?.rawError || e);
    process.exit(1);
  }
})();
