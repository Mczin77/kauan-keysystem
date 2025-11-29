import { redis } from "./redis.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // --- CORREÇÃO: REMOVIDA verificação de (:) ---

  const { key, state } = req.body; 

  if (!key || state === undefined) {
    return res.status(400).json({ ok: false, error: "Campos faltando" });
  }

  const exists = await redis.exists(`key:${key}`);
  if (!exists) return res.status(404).json({ ok: false, error: "Key não encontrada" });

  const revokedStatus = (state === true || state === "true") ? "true" : "false";

  // Atualiza apenas o status de revogação
  await redis.hset(`key:${key}`, { revoked: revokedStatus });

  return res.json({ ok: true });
}
