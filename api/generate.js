import { redis } from "./redis.js";

export default async function handler(req, res) {
  // Configuração CORS básica para garantir que não seja bloqueado
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // Pega os valores brutos para debug
  const rawDays = req.body.days;
  const rawHours = req.body.hours;
  const rawType = req.body.type;

  // Força a conversão
  const days = Number(rawDays) || 0;
  const hours = Number(rawHours) || 0;
  const minutes = 0; // Hardcoded conforme seu dashboard

  const key = Math.random().toString(36).substring(2, 12).toUpperCase();
  let expiresAt = 0;

  // Cálculo explícito com logs
  const msDay = days * 86400000;
  const msHour = hours * 3600000;
  const totalMs = msDay + msHour;

  if (rawType === "temp") {
      if (totalMs > 0) {
        expiresAt = Date.now() + totalMs;
      } else {
        // FALLBACK DE SEGURANÇA:
        // Se for temp e der 0 (erro), força 1 dia para testar se o cálculo é o problema
        // expiresAt = Date.now() + 86400000; 
      }
  }

  const obj = {
    key,
    type: rawType || "unknown",
    expiresAt: String(expiresAt),
    uses: 0,
    executor: "-",
    usedByIP: "-",
    hwid: "-",
    revoked: "false",
    lastUsedAt: 0,
    sessionExpiresAt: 0, 
    currentSessionHWID: "-", 
    ownerId: "",
    ownerName: "",
    ownerAvatar: "",
    
    // --- CAMPOS DE DIAGNÓSTICO (DEBUG) ---
    // Isso vai mostrar na sua database o que o servidor recebeu
    debug_received_days: String(rawDays),
    debug_received_hours: String(rawHours),
    debug_calculated_ms: String(totalMs),
    debug_server_time: String(Date.now())
  };

  const fieldsAndValues = Object.entries(obj).flat();
  await redis.hset(`key:${key}`, ...fieldsAndValues);

  return res.json({ ok: true, data: obj });
}
