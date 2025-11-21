import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "method" });

  const { key } = req.body || {};

  if (!key)
    return res.status(400).json({ error: "missing key" });

  await redis.del(key);

  return res.status(200).json({ ok: true });
}
