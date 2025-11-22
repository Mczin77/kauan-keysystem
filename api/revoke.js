import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // valida token simples (não é super seguro, mas funciona pra painel)
  if (!token.includes(":")) return res.status(401).json({ error: "Token inválido" });
  
  // Recebe a key e o estado desejado (true para bloquear, false para desbloquear)
  const { key, state } = req.body; 

  if (!key || state === undefined) {
    return res.status(400).json({ ok: false, error: "Key and state are required." });
  }

  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) return res.json({ ok: false, error: "Invalid key" });

  // Converte o estado para string "true" ou "false" (o Redis salva tudo como string)
  const newState = state === true || state === "true" ? "true" : "false";

  await redis.hset(`key:${key}`, {
    revoked: newState
  });

  return res.json({ ok: true, message: `Key ${key} has been set to revoked: ${newState}` });
}
