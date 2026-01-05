/**
 * Mugafi Wallet Bot (Discord -> Google Sheets)
 *
 * Required Railway Variables:
 * DISCORD_TOKEN=xxxxxxxx
 * IP_ROLE_ID=1450940518090674176
 * SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXXX/exec
 * SHEETS_TOKEN=your_secret_token
 *
 * Optional (recommended):
 * WALLET_CHANNEL_ID=123456789012345678   // lock commands to one channel
 *
 * Notes:
 * - Slash command option name MUST be "address" (as seen in your Discord UI)
 * - Apps Script supports:
 *   - action=add_wallet
 *   - action=list_wallets
 *   - action=remove_wallet
 *
 * Commands:
 * /linkwallet  (IP Lord only) -> status=whitelist
 * /addwallet   (IP Lord only) -> status=whitelist
 * /waitlist    (anyone)       -> status=waitlist
 * /wallets     (IP Lord only) -> lists active wallets for user
 * /removewallet(IP Lord only) -> marks wallet removed
 */

const { Client, GatewayIntentBits, Events } = require("discord.js");

// Node 18+ has fetch built-in (Railway does).
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;
const SHEETS_TOKEN = process.env.SHEETS_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function isValidEvmAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function hasIPRole(interaction) {
  const roleId = process.env.IP_ROLE_ID;
  if (!roleId) return false;
  return interaction.member?.roles?.cache?.has(roleId);
}

function isWrongChannel(interaction) {
  const allowedChannelId = process.env.WALLET_CHANNEL_ID;
  if (!allowedChannelId) return false; // no channel lock
  return interaction.channelId !== allowedChannelId;
}

async function sheetsPost(payload) {
  if (!SHEETS_WEBHOOK_URL) throw new Error("Missing SHEETS_WEBHOOK_URL");
  if (!SHEETS_TOKEN) throw new Error("Missing SHEETS_TOKEN");

  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: SHEETS_TOKEN, ...payload }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Sheets non-JSON response: ${text.slice(0, 200)}`);
  }

  if (!res.ok || json?.ok === false) {
    throw new Error(`Sheets error: HTTP ${res.status} | ${JSON.stringify(json)}`);
  }

  return json;
}

client.once("ready", () => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // Always defer so Discord doesn't show "The application did not respond"
    await interaction.deferReply({ ephemeral: true });

    const cmd = interaction.commandName;

    // Optional channel lock (same channel for all commands)
    if (isWrongChannel(interaction)) {
      return interaction.editReply("Use this in the designated wallet channel.");
    }

    // ---- /waitlist (ANYONE) ----
    if (cmd === "waitlist") {
      const wallet = interaction.options.getString("address", true).trim();

      if (!isValidEvmAddress(wallet)) {
        return interaction.editReply("❌ Invalid EVM wallet address.");
      }

      await sheetsPost({
        action: "add_wallet",
        timestamp_utc: new Date().toISOString(),
        discord_user_id: interaction.user.id,
        discord_username: interaction.user.tag,
        wallet_address: wallet,
        chain_id: "43114", // Avalanche C-Chain
        role: "none",
        status: "waitlist",
        source: "discord-waitlist",
      });

      return interaction.editReply(
        "✅ Added to waitlist. This does not guarantee whitelist access. Verify NFT to activate."
      );
    }

    // Everything below is IP Lord only
    if (!hasIPRole(interaction)) {
      return interaction.editReply("Verify first via Collab.Land to unlock IP access.");
    }

    // ---- /linkwallet and /addwallet (same behavior) ----
    if (cmd === "linkwallet" || cmd === "addwallet") {
      const wallet = interaction.options.getString("address", true).trim();

      if (!isValidEvmAddress(wallet)) {
        return interaction.editReply("❌ Invalid EVM wallet address.");
      }

      await sheetsPost({
        action: "add_wallet",
        timestamp_utc: new Date().toISOString(),
        discord_user_id: interaction.user.id,
        discord_username: interaction.user.tag,
        wallet_address: wallet,
        chain_id: "43114", // Avalanche C-Chain
        role: "IP Lord",
        status: "whitelist",
        source: "discord-whitelist",
      });

      return interaction.editReply("✅ Wallet linked. You are whitelisted for the launchpad.");
    }

    // ---- /wallets ----
    if (cmd === "wallets") {
      const result = await sheetsPost({
        action: "list_wallets",
        discord_user_id: interaction.user.id,
      });

      const wallets = Array.isArray(result.wallets) ? result.wallets : [];

      if (wallets.length === 0) {
        return interaction.editReply("No wallets linked yet.");
      }

      const lines = wallets.map((w, i) => `${i + 1}. ${w}`);
      return interaction.editReply(`Your linked wallets:\n${lines.join("\n")}`);
    }

    // ---- /removewallet ----
    if (cmd === "removewallet") {
      const wallet = interaction.options.getString("address", true).trim();

      if (!isValidEvmAddress(wallet)) {
        return interaction.editReply("❌ Invalid EVM wallet address.");
      }

      const result = await sheetsPost({
        action: "remove_wallet",
        discord_user_id: interaction.user.id,
        wallet_address: wallet,
      });

      if (result.removed) {
        return interaction.editReply("✅ Wallet removed.");
      }
      return interaction.editReply("That wallet was not found for your user.");
    }

    // Fallback
    return interaction.editReply("Command not recognized.");
  } catch (err) {
    console.error("Interaction error:", err);
    try {
      // If deferReply succeeded, editReply works
      return interaction.editReply("Something broke on our side. Try again in a minute.");
    } catch (_) {
      // If deferReply failed, attempt reply
      try {
        return interaction.reply({
          content: "Something broke on our side. Try again in a minute.",
          ephemeral: true,
        });
      } catch (_) {}
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
