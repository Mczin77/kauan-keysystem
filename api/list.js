// /api/list.js
import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  try {
    const keys = await redis.keys("key:*");
    const out = [];

    for (let k of keys) {
      const data = await redis.hgetall(k);

      out.push({
        key: data.key,
        type: data.type || "normal",
        expiresAt: data.expiresAt || 0,
        uses: Number(data.uses || 0),
        executor: data.executor || "-",
        usedByIP: data.usedByIP || "-"
      });
    }

    return res.json({ ok: true, keys: out });

  } catch (err) {
    console.error("Erro no /api/list:", err);
    return res.status(500).json({ ok: false, error: "Erro interno" });
  }
}
