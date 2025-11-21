import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { email, code } = req.body;

  if (!email || !code)
    return res.status(400).json({ error: "Dados insuficientes" });

  const data = await redis.hgetall(`user:${email}`);

  if (!data || data.code !== code) {
    return res.json({ valid: false });
  }

  return res.json({ valid: true });
}
