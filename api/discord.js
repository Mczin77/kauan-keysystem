export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID faltando" });

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return res.status(500).json({ error: "Bot token não configurado na Vercel" });

  try {
    // Chama a API oficial do Discord
    const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: { Authorization: `Bot ${botToken}` }
    });

    if (!response.ok) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const user = await response.json();

    // Monta a URL do avatar
    const avatarUrl = user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
      : `https://cdn.discordapp.com/embed/avatars/0.png`; // Avatar padrão se não tiver foto

    return res.json({
      ok: true,
      username: user.username,
      global_name: user.global_name,
      id: user.id,
      avatar: avatarUrl
    });

  } catch (e) {
    return res.status(500).json({ error: "Erro ao conectar ao Discord" });
  }
}
