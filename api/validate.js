import { redis } from "./redis.js";

// Tempo que uma sessão é considerada ativa após a última validação (em milissegundos)
const SESSION_DURATION_MS = 300000; // 5 minutos

export default async function handler(req, res) {
  const { key, executor, hwid } = req.query; 
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!key) return res.json({ ok: false, error: "No key" });
  
  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) return res.json({ ok: false, error: "Invalid key" });

  // 1. Revogação manual (Admin)
  if (data.revoked === "true") {
    return res.json({ ok: false, error: "Key has been revoked by admin." });
  }

  // 2. Expiração
  if (data.expiresAt != 0 && Date.now() > Number(data.expiresAt)) {
    return res.json({ ok: false, error: "Expired" });
  }

  // --- 3. Lógica de BLOQUEIO/RENOVAÇÃO por HWID & Sessão ---
  const currentHWID = hwid || "-";
  const sessionExpirationTime = Number(data.sessionExpiresAt || 0);
  const isSessionActive = Date.now() < sessionExpirationTime;

  // A. Key já está vinculada a um HWID e o HWID atual é diferente
  if (data.hwid && data.hwid !== "-" && currentHWID !== "-" && data.hwid !== currentHWID) {
    return res.json({ ok: false, error: "Key is permanently locked to another HWID." });
  }
  
  // B. Sessão está ATIVA por OUTRO HWID (Bloqueio Simutâneo)
  if (isSessionActive && currentHWID !== data.currentSessionHWID) {
    return res.json({ ok: false, error: "Key is already in use by another person." });
  }

  // C. Vincula HWID permanentemente se for a primeira vez
  if (data.hwid === "-" && currentHWID !== "-") {
    data.hwid = currentHWID; 
  }
  
  // ------------------------------------

  // Dados a serem atualizados (Incrementa 'uses' e RENOVA a sessão)
  const updateData = {
    uses: Number(data.uses || 0) + 1,
    usedByIP: ip,
    executor: executor || data.executor || "-",
    hwid: data.hwid || currentHWID,
    lastUsedAt: Date.now(),
    // NOVO: Renovação da Sessão
    currentSessionHWID: currentHWID, 
    sessionExpiresAt: Date.now() + SESSION_DURATION_MS // Nova expiração (5 min)
  };

  await redis.hset(`key:${key}`, updateData);

  // Retorna o tempo restante da key para o cliente (exploits)
  const timeRemaining = Number(data.expiresAt) > 0 ? Number(data.expiresAt) - Date.now() : -1;
  return res.json({ ok: true, expiresAt: timeRemaining });
}
