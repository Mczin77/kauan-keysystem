import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  const token = req.headers["x-panel-token"];
  if (!token) {
    return res.status(401).json({ ok: false, error: "Token ausente" });
  }

  // Token fixo só para o painel
  if (token !== process.env.PANEL_TOKEN) {
    return res.status(403).json({ ok: false, error: "Token inválido" });
  }

  const { type, days, hours, minutes } = req.body;

  // Gera key aleatória
  const key = Math.random().toString(36).substring(2, 12).toUpperCase();

  let expiresAt = 0;

  // VIP = lifetime
  if (type !== "vip") {
    const now = Date.now();
    const totalMs =
      (Number(days) * 24 * 60 * 60 * 1000) +
      (Number(hours) * 60 * 60 * 1000) +
      (Number(minutes) * 60 * 1000);

    expiresAt = now + totalMs;
  }

  // Objeto do Redis
  const data = {
    key,
    type,
    uses: 0,
    executor: "",
    usedByIP: "",
    expiresAt
  };

  // Salvar no Redis
  await redis.hset(`key:${key}`, data);

  return res.json({
    ok: true,
    data
  });
}
