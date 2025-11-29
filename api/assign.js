import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  const { key, discordId, discordName, discordAvatar } = req.body;

  if (!key || !discordId) return res.status(400).json({ error: "Faltando dados" });

  // Verifica se a key existe
  const exists = await redis.exists(`key:${key}`);
  if (!exists) return res.status(404).json({ error: "Key não existe" });

  // Atualiza a key com os dados do dono
  await redis.hset(`key:${key}`, {
    ownerId: discordId,
    ownerName: discordName,
    ownerAvatar: discordAvatar
  });

  return res.json({ ok: true });
}
