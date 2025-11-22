import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // { key: 'XXX', state: true/false }
  const { key, state } = req.body; 
  if (!key || state === undefined) 
    return res.status(400).json({ ok: false, error: "Campos faltando" });

  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) 
    return res.status(404).json({ ok: false, error: "Key não encontrada" });

  const revokedStatus = state ? "true" : "false";

  // Atualiza apenas o campo 'revoked'
  await redis.hset(`key:${key}`, { revoked: revokedStatus });

  return res.json({ ok: true });
}
