require("dotenv").config();
const { REST, Routes } = require("discord.js");

const commands = [
  {
    name: "linkwallet",
    description: "Link your wallet to be whitelisted for launchpad",
    options: [
      {
        name: "address",
        description: "Your wallet address (0x...)",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "addwallet",
    description: "Add another wallet to be whitelisted for launchpad",
    options: [
      {
        name: "address",
        description: "Your wallet address (0x...)",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "waitlist",
    description: "Link your wallet for future whitelist consideration",
    options: [
      {
        name: "address",
        description: "Your wallet address (0x...)",
        type: 3,
        required: true,
      },
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
      {
        name: "address",
        description: "Wallet address to remove (0x...)",
        type: 3,
        required: true,
      },
    ],
  },
];

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
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
