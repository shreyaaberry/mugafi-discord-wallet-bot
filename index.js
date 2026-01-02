const { Client, GatewayIntentBits, Events } = require("discord.js");

// Node 18+ has fetch built-in (Railway does).
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;
const SHEETS_TOKEN = process.env.SHEETS_TOKEN;

const ALLOWED_COMMANDS = new Set(["linkwallet", "addwallet", "wallets", "removewallet"]);

function hasIPRole(interaction) {
  const roleId = process.env.IP_ROLE_ID;
  if (!roleId) return false;
  return interaction.member?.roles?.cache?.has(roleId);
}

function isValidEvmAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function mustUseChannel(interaction) {
  const allowedChannelId = process.env.WALLET_CHANNEL_ID;
  if (!allowedChannelId) return false; // no channel lock
  return interaction.channelId !== allowedChannelId;
}

async function postToSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) throw new Error("Missing SHEETS_WEBHOOK_URL");
  if (!SHEETS_TOKEN) throw new Error("Missing SHEETS_TOKEN");

  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: SHEETS_TOKEN,
      ...payload,
    }),
  });

  // Apps Script often returns 200 even for app-level errors, so parse JSON.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Sheets HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  if (!data || data.ok !== true) {
    throw new Error(`Sheets error: ${JSON.stringify(data)}`);
  }

  return data;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.commandName;
    if (!ALLOWED_COMMANDS.has(name)) return;

    // Respond within 3 seconds, always.
    await interaction.deferReply({ ephemeral: true });

    // Optional channel lock.
    if (mustUseChannel(interaction)) {
      return interaction.editReply("Use this in the wallet-link channel.");
    }

    // Mandatory IP gating.
    if (!hasIPRole(interaction)) {
      return interaction.editReply("Verify first via Collab.Land to unlock IP access.");
    }

    // Command routing
    if (name === "wallets") {
      // If you want /wallets to read from Google Sheets later, we can add it.
      return interaction.editReply("You are verified. Wallet listing will be added next.");
    }

    if (name === "removewallet") {
      // Removal needs a lookup store, or you can append a removal row in Sheets.
      return interaction.editReply("Wallet removal will be added next.");
    }

    if (name === "linkwallet" || name === "addwallet") {
      const wallet = interaction.options.getString("wallet_address", true).trim();

      if (!isValidEvmAddress(wallet)) {
        return interaction.editReply("Invalid wallet address. Please paste a valid EVM address (0x...).");
      }

      // Write to Sheets
      await postToSheets({
        wallet_address: wallet,
        discord_user_id: interaction.user.id,
        discord_username: interaction.user.tag,
        role: "IP Lord",
        source: "discord-bot",
        chain_id: "1",
      });

      return interaction.editReply("✅ Wallet received. You are now whitelisted for launchpad access.");
    }

    // Fallback
    return interaction.editReply("Command received.");
  } catch (err) {
    console.error("Interaction error:", err);

    // Try to reply gracefully.
    try {
      if (interaction.deferred) {
        await interaction.editReply("Something broke on our side. Try again in a minute.");
      } else {
        await interaction.reply({
          content: "Something broke on our side. Try again in a minute.",
          ephemeral: true,
        });
      }
    } catch (_) {}
  }
});

client.login(process.env.DISCORD_TOKEN);
