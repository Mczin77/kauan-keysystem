import { redis } from "./redis.js";

export default async function handler(req, res) {
  const { key, executor } = req.query;
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!key) return res.json({ ok: false, error: "No key" });

  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) return res.json({ ok: false, error: "Invalid key" });

  // Expiração
  if (data.expiresAt != 0 && Date.now() > Number(data.expiresAt)) {
    return res.json({ ok: false, error: "Expired" });
  }

  // Atualizar usos, IP e executor
  await redis.hset(`key:${key}`, {
    uses: Number(data.uses || 0) + 1,
    usedByIP: ip,
    executor: executor || data.executor || "-"
  });

  return res.json({ ok: true });
}
