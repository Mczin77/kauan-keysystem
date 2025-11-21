import { redis } from "./_redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(403).json({ ok: false, error: "token" });

  const { type, days, hours, minutes } = req.body;

  const expiresAt =
    type === "vip"
      ? 0
      : Date.now() + ((days * 24 + hours) * 60 + minutes) * 60000;

  const key = "KEY-" + Math.random().toString(36).slice(2, 12).toUpperCase();

  const data = {
    key,
    type,
    expiresAt,
    uses: 0,
    executor: "",
    usedByIP: ""
  };

  await redis.set(`key:${key}`, data);
  await redis.lpush("keys:list", key);

  return res.status(200).json({ ok: true, data });
}
