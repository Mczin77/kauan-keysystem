import { redis } from "./redis.js";

export default async function handler(req, res) {
  const { key, executor, hwid } = req.query; // Captura o HWID da requisição
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!key) return res.json({ ok: false, error: "No key" });

  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) return res.json({ ok: false, error: "Invalid key" });

  // 1. Revogação manual (Manual Ban)
  if (data.revoked === "true") {
    return res.json({ ok: false, error: "Key has been revoked by admin." });
  }

  // 2. Expiração
  if (data.expiresAt != 0 && Date.now() > Number(data.expiresAt)) {
    return res.json({ ok: false, error: "Expired" });
  }

  // --- 3. Lógica de Bloqueio por HWID ---
  let currentHWID = hwid || data.hwid || "-";
  
  if (data.hwid && data.hwid !== "-" && currentHWID !== "-" && data.hwid !== currentHWID) {
    // Key já está ligada a outro HWID e o atual é diferente, bloqueia.
    return res.json({ ok: false, error: "Key is locked to another HWID." });
  }

  // Se for o primeiro uso, define o HWID.
  if (data.hwid === "-" && currentHWID !== "-") {
    data.hwid = currentHWID; 
  }
  // ------------------------------------

  // Dados a serem atualizados
  const updateData = {
    uses: Number(data.uses || 0) + 1,
    usedByIP: ip,
    executor: executor || data.executor || "-",
    hwid: data.hwid || currentHWID, // Garante que o HWID é salvo/atualizado
    lastUsedAt: Date.now()          // NOVO: Adiciona o timestamp de último uso
  };

  await redis.hset(`key:${key}`, updateData);

  return res.json({ ok: true });
}
