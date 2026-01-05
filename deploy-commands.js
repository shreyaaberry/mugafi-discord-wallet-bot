const { REST, Routes } = require("discord.js");

const commands = [
  {
    name: "linkwallet",
    description: "Link your wallet to be whitelisted for launchpad",
    options: [
      { name: "address", description: "Wallet address (0x...)", type: 3, required: true }
    ],
  },
  {
    name: "addwallet",
    description: "Add another wallet to be whitelisted for launchpad",
    options: [
      { name: "address", description: "Wallet address (0x...)", type: 3, required: true }
    ],
  },
  {
    name: "waitlist",
    description: "Link your wallet for future whitelist consideration",
    options: [
      { name: "address", description: "Wallet address (0x...)", type: 3, required: true }
    ],
  },
  {
    name: "wallets",
    description: "List wallets linked to your Discord user",
  },
  {
    name: "removewallet",
    description: "Remove a linked wallet",
    options: [
      { name: "address", description: "Wallet address to remove (0x...)", type: 3, required: true }
    ],
  },
];

(async () => {
  try {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!token || !clientId || !guildId) {
      throw new Error("Missing DISCORD_TOKEN / DISCORD_CLIENT_ID / GUILD_ID in environment variables.");
    }

    const rest = new REST({ version: "10" }).setToken(token);

    console.log("Wiping existing guild commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });

    console.log("Registering guild commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

    console.log("Done. Commands should appear immediately in that server.");
    process.exit(0);
  } catch (err) {
    console.error("Command registration failed:", err?.rawError || err);
    process.exit(1);
  }
})();
