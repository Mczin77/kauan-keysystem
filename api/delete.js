import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email obrigatório" });

  await redis.del(`user:${email}`);

  return res.json({ success: true });
}
