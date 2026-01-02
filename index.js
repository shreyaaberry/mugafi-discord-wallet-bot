const { Client, GatewayIntentBits, Events } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const requiredRole = process.env.IP_ROLE_NAME || "IP lord";
  const member = interaction.member;

  const hasRole = member?.roles?.cache?.some(r => r.name === requiredRole);

  if (!hasRole) {
    await interaction.reply({
      content: `You don’t have **${requiredRole}** yet. Verify via Collab.Land first.`,
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    content: "✅ IP role verified. Wallet linking coming next.",
    ephemeral: true
  });
});

client.login(process.env.DISCORD_TOKEN);
