import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  const keys = await redis.keys("key:*");
  const out = [];

  // Valores padrão para evitar que o painel quebre se a Key for antiga
  const defaults = {
    hwid: "-",
    revoked: "false",
    lastUsedAt: 0,
    sessionExpiresAt: 0, 
    currentSessionHWID: "-",
    ownerId: "",
    ownerName: "",
    ownerAvatar: ""
  };

  for (let k of keys) {
    let data = await redis.hgetall(k);
    
    // Mescla os dados existentes com os valores padrão para garantir que todos os campos existam
    data = { ...defaults, ...data };
    out.push(data);
  }

  return res.json({ ok: true, keys: out });
}
