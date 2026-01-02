const { Client, GatewayIntentBits, Events } = require("discord.js");

// Google Sheets (Apps Script Web App)
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL; // https://script.google.com/macros/s/.../exec
const SHEETS_TOKEN = process.env.SHEETS_TOKEN; // your SCRIPT_TOKEN
const IP_ROLE_NAME = process.env.IP_ROLE_NAME || "IP lord";

// Optional metadata
const CHAIN_ID = "43114"; // Avalanche C-Chain
const SOURCE = "discord-bot";

// Simple in-memory storage: discordUserId -> Set(wallets)
// Note: This resets if Railway redeploys/restarts. OK for MVP.
const userWallets = new Map();

function hasIPRole(interaction) {
  return interaction.member?.roles?.cache?.some((r) => r.name === IP_ROLE_NAME);
}

function isValidEvmAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

async function postToSheets({ interaction, wallet }) {
  if (!SHEETS_WEBHOOK_URL || !SHEETS_TOKEN) {
    throw new Error("Missing SHEETS_WEBHOOK_URL or SHEETS_TOKEN env var");
  }

  const payload = {
    token: SHEETS_TOKEN,
    timestamp_utc: new Date().toISOString(),
    discord_user_id: interaction.user.id,
    discord_username: interaction.user.tag,
    wallet_address: wallet,
    chain_id: CHAIN_ID,
    role: IP_ROLE_NAME,
    source: SOURCE,
  };

  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  // Apps Script often returns JSON; guard either way
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}

  if (!res.ok) {
    throw new Error(`Sheets webhook HTTP ${res.status}: ${text}`);
  }
  if (data && data.ok === false) {
    throw new Error(`Sheets webhook error: ${JSON.stringify(data)}`);
  }
  return data || { ok: true };
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Hard gate: IP lord only
  if (!hasIPRole(interaction)) {
    return interaction.reply({
      content: "Verify first via Collab.Land to unlock IP access.",
      ephemeral: true,
    });
  }

  const cmd = interaction.commandName;

  // /wallets
  if (cmd === "wallets") {
    const set = userWallets.get(interaction.user.id) || new Set();
    const list = [...set];
    return interaction.reply({
      content: list.length
        ? `Your linked wallets:\n${list.map((w) => `• ${w}`).join("\n")}`
        : "No wallets linked yet. Use /linkwallet wallet:0x...",
      ephemeral: true,
    });
  }

  // /linkwallet and /addwallet
  if (cmd === "linkwallet" || cmd === "addwallet") {
    const wallet = interaction.options.getString("wallet", true).trim();

    if (!isValidEvmAddress(wallet)) {
      return interaction.reply({
        content: "Invalid wallet address. Please enter a valid EVM address (0x + 40 hex chars).",
        ephemeral: true,
      });
    }

    // Deduplicate in memory
    const set = userWallets.get(interaction.user.id) || new Set();
    if (set.has(wallet)) {
      return interaction.reply({
        content: "That wallet is already linked to your Discord user.",
        ephemeral: true,
      });
    }

    // Post to Sheets first (so Sheets is the source of truth)
    try {
      await postToSheets({ interaction, wallet });
    } catch (err) {
      return interaction.reply({
        content: `Could not save to Google Sheet. Error: ${err.message}`,
        ephemeral: true,
      });
    }

    // Save locally after successful sheet write
    set.add(wallet);
    userWallets.set(interaction.user.id, set);

    return interaction.reply({
      content: `Saved. Linked wallet: ${wallet}`,
      ephemeral: true,
    });
  }

  // /removewallet
  if (cmd === "removewallet") {
    const wallet = interaction.options.getString("wallet", true).trim();

    const set = userWallets.get(interaction.user.id) || new Set();
    if (!set.has(wallet)) {
      return interaction.reply({
        content: "That wallet is not linked for your Discord user (in this bot session).",
        ephemeral: true,
      });
    }

    set.delete(wallet);
    userWallets.set(interaction.user.id, set);

    // Optional: you can also POST a “remove” action to Sheets if you want an audit trail
    return interaction.reply({
      content: `Removed wallet: ${wallet}`,
      ephemeral: true,
    });
  }

  // Fallback
  return interaction.reply({
    content: "Unknown command.",
    ephemeral: true,
  });
});

client.login(process.env.DISCORD_TOKEN);
