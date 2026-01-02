/**
 * Mugafi Wallet Bot (Discord -> Google Sheets)
 *
 * Required Railway Variables:
 * DISCORD_TOKEN=xxxxxxxx
 * DISCORD_CLIENT_ID=xxxxxxxx
 * GUILD_ID=xxxxxxxx
 * IP_ROLE_ID=1450940518090674176
 * SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXXX/exec
 * SHEETS_TOKEN=your_secret_token
 *
 * Notes:
 * - Slash command option name MUST be "address" (as seen in your Discord UI)
 * - Google Apps Script must support actions:
 *   - action=add_wallet
 *   - action=list_wallets
 *   - action=remove_wallet
 */

const { Client, GatewayIntentBits, Events } = require("discord.js");

// Node 18+ has fetch built-in (Railway does). If not, you'd need node-fetch.
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
    // If Apps Script returned HTML or text
    throw new Error(`Sheets non-JSON response: ${text.slice(0, 200)}`);
  }

  if (!res.ok || json?.ok === false) {
    throw new Error(
      `Sheets error: HTTP ${res.status} | ${JSON.stringify(json)}`
    );
  }

  return json;
}

client.once("ready", () => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Always defer so Discord doesn't show "application did not respond"
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (e) {
    // If already acknowledged, just ignore
  }

  // Role gating first (mandatory)
  if (!hasIPRole(interaction)) {
    return interaction.editReply(
      "Verify first via Collab.Land to unlock IP access."
    );
  }

  const cmd = interaction.commandName;

  // ---- /linkwallet and /addwallet (same behavior) ----
  if (cmd === "linkwallet" || cmd === "addwallet") {
    try {
      // IMPORTANT: option name is "address"
      const wallet = interaction.options.getString("address", true).trim();

      if (!isValidEvmAddress(wallet)) {
        return interaction.editReply("❌ Invalid EVM wallet address.");
      }

      const payload = {
        action: "add_wallet",
        timestamp_utc: new Date().toISOString(),
        discord_user_id: interaction.user.id,
        discord_username: interaction.user.tag,
        wallet_address: wallet,
        chain_id: "1",
        role: "IP Lord",
        source: "discord",
      };

      await sheetsPost(payload);

      return interaction.editReply(
        "✅ Wallet linked successfully. You are whitelisted for the launchpad."
      );
    } catch (err) {
      console.error("linkwallet/addwallet error:", err);
      return interaction.editReply(
        "Something broke on our side. Try again in a minute."
      );
    }
  }

  // ---- /wallets ----
  if (cmd === "wallets") {
    try {
      const payload = {
        action: "list_wallets",
        discord_user_id: interaction.user.id,
      };

      const result = await sheetsPost(payload);

      const wallets = Array.isArray(result.wallets) ? result.wallets : [];

      if (wallets.length === 0) {
        return interaction.editReply("No wallets linked yet.");
      }

      const lines = wallets.map((w, i) => `${i + 1}. ${w}`);
      return interaction.editReply(`Your linked wallets:\n${lines.join("\n")}`);
    } catch (err) {
      console.error("wallets list error:", err);
      return interaction.editReply(
        "Could not fetch wallets right now. Try again in a minute."
      );
    }
  }

  // ---- /removewallet ----
  if (cmd === "removewallet") {
    try {
      const wallet = interaction.options.getString("address", true).trim();

      if (!isValidEvmAddress(wallet)) {
        return interaction.editReply("❌ Invalid EVM wallet address.");
      }

      const payload = {
        action: "remove_wallet",
        discord_user_id: interaction.user.id,
        wallet_address: wallet,
      };

      const result = await sheetsPost(payload);

      if (result.removed) {
        return interaction.editReply("✅ Wallet removed.");
      }

      return interaction.editReply("That wallet was not found for your user.");
    } catch (err) {
      console.error("removewallet error:", err);
      return interaction.editReply(
        "Could not remove wallet right now. Try again in a minute."
      );
    }
  }

  // Fallback
  return interaction.editReply("Command not recognized.");
});

client.login(process.env.DISCORD_TOKEN);
