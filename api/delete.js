import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  const { key } = req.body;
  if (!key) return res.json({ ok: false });

  await redis.del(`key:${key}`);

  return res.json({ ok: true });
}
