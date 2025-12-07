import { redis } from "./redis.js";

// Tempo de sessão (5 minutos)
const SESSION_DURATION_MS = 300000; 

export default async function handler(req, res) {
  const { key, executor, hwid } = req.query; 
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!key) return res.json({ ok: false, error: "No key" });
  
  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) return res.json({ ok: false, error: "Invalid key" });

  if (data.revoked === "true") {
    return res.json({ ok: false, error: "Key revogada pelo admin." });
  }

  if (data.expiresAt != 0 && Date.now() > Number(data.expiresAt)) {
    return res.json({ ok: false, error: "Key Expirada." });
  }

  // Lógica HWID
  let currentHWID = hwid || "-";
  const sessionExpirationTime = Number(data.sessionExpiresAt || 0);
  const isSessionActive = Date.now() < sessionExpirationTime;

  if (data.hwid && data.hwid !== "-" && currentHWID !== "-" && data.hwid !== currentHWID) {
    return res.json({ ok: false, error: "Key presa em outro HWID." });
  }
  
  if (isSessionActive && currentHWID !== data.currentSessionHWID) {
    return res.json({ ok: false, error: "Key em uso por outra pessoa." });
  }

  if (data.hwid === "-" && currentHWID !== "-") {
    data.hwid = currentHWID; 
  }

  const updateData = {
    uses: Number(data.uses || 0) + 1,
    usedByIP: ip,
    executor: executor || data.executor || "-",
    hwid: data.hwid || currentHWID,
    lastUsedAt: Date.now(),
    currentSessionHWID: currentHWID, 
    sessionExpiresAt: Date.now() + SESSION_DURATION_MS
  };

  await redis.hset(`key:${key}`, updateData);

  const timeRemaining = Number(data.expiresAt) > 0 ? Number(data.expiresAt) - Date.now() : -1;
  
  // Retorna sucesso E a mensagem global (se houver)
  return res.json({ 
      ok: true, 
      expiresAt: timeRemaining,
      announcement: globalMessage 
  });
}
 
