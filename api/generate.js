import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // valida token simples (não é super seguro, mas funciona pra painel)
  if (!token.includes(":")) return res.status(401).json({ error: "Token inválido" });

  const { type, days, hours, minutes } = req.body; 

  const key = Math.random().toString(36).substring(2, 12).toUpperCase();

  let expiresAt = 0;

  if (type !== "vip") {
    const totalMs =
      (days || 0) * 86400000 +
      (hours || 0) * 3600000 +
      (minutes || 0) * 60000;

    expiresAt = Date.now() + totalMs;
  }
    
  const obj = {
    key,
    type,
    expiresAt,
    uses: 0,
    executor: "-",
    usedByIP: "-",
    // CAMPOS NOVOS/NECESSÁRIOS (Mesmo que vazios)
    hwid: "-",
    revoked: "false",
    lastUsedAt: 0,
    sessionExpiresAt: 0, 
    currentSessionHWID: "-", 
    // Campos Discord (para o painel não quebrar)
    ownerId: "",
    ownerName: "",
    ownerAvatar: ""
  };

  // --- CORREÇÃO AQUI ---
  // Transforma o objeto em uma lista [campo, valor, campo, valor, ...]
  const fieldsAndValues = Object.entries(obj).flat();
  // Passa a lista espalhada para o hset para máxima compatibilidade
  await redis.hset(`key:${key}`, ...fieldsAndValues);
  // ---------------------

  return res.json({ ok: true, data: obj });
}
