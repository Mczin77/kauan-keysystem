import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "method" });

  const { key, value } = req.body || {};

  if (!key || !value)
    return res.status(400).json({ error: "missing fields" });

  await redis.set(key, value);

  return res.status(200).json({ ok: true });
}
