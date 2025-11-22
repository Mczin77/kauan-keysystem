import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // valida token simples (não é super seguro, mas funciona pra painel)
  if (!token.includes(":")) return res.status(401).json({ error: "Token inválido" });

  // NOVO: Adiciona maxUses na desestruturação
  const { type, days, hours, minutes, maxUses } = req.body;

  const key = Math.random().toString(36).substring(2, 12).toUpperCase();

  let expiresAt = 0;

  if (type !== "vip") {
    const totalMs =
      (days || 0) * 86400000 +
      (hours || 0) * 3600000 +
      (minutes || 0) * 60000;

    expiresAt = Date.now() + totalMs;
  }
    
  // Define 0 como infinito, caso contrário, usa o valor fornecido
  const maxUsesValue = Number(maxUses) >= 0 ? Number(maxUses) : 0;

  const obj = {
    key,
    type,
    expiresAt,
    uses: 0,
    executor: "-",
    usedByIP: "-",
    hwid: "-",
    revoked: "false",
    lastUsedAt: 0,
    maxUses: maxUsesValue // NOVO
  };

  await redis.hset(`key:${key}`, obj);

  return res.json({ ok: true, data: obj });
}
