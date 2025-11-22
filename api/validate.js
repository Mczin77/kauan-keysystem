import { redis } from "./redis.js";

export default async function handler(req, res) {
  const { key, executor, hwid } = req.query; // Captura HWID
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!key) return res.json({ ok: false, error: "No key" });
  
  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) return res.json({ ok: false, error: "Invalid key" });

  // 1. Revogação manual
  if (data.revoked === "true") {
    return res.json({ ok: false, error: "Key has been revoked by admin." });
  }

  // NOVO: 2. Verificação de Limite de Usos
  if (data.maxUses != 0 && Number(data.uses) >= Number(data.maxUses)) {
    return res.json({ ok: false, error: "Max uses reached" });
  }

  // 3. Expiração
  if (data.expiresAt != 0 && Date.now() > Number(data.expiresAt)) {
    return res.json({ ok: false, error: "Expired" });
  }

  // --- 4. Lógica de Bloqueio por HWID ---
  let currentHWID = hwid || data.hwid || "-";
  
  if (data.hwid && data.hwid !== "-" && currentHWID !== "-" && data.hwid !== currentHWID) {
    return res.json({ ok: false, error: "Key is locked to another HWID." });
  }

  if (data.hwid === "-" && currentHWID !== "-") {
    data.hwid = currentHWID; 
  }
  // ------------------------------------

  // Dados a serem atualizados (incrementa 'uses')
  const updateData = {
    uses: Number(data.uses || 0) + 1,
    usedByIP: ip,
    executor: executor || data.executor || "-",
    hwid: data.hwid || currentHWID,
    lastUsedAt: Date.now()
  };

  await redis.hset(`key:${key}`, updateData);

  return res.json({ ok: true });
}
