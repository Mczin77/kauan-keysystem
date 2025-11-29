import { redis } from "./redis.js";

export default async function handler(req, res) {
  // Permite CORS para evitar bloqueios
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // --- CORREÇÃO 1: REMOVIDA a verificação de (:) para aceitar qualquer senha ---
  // if (!token.includes(":")) ... (LINHA REMOVIDA)

  // Leitura segura dos dados
  const { type } = req.body;
  const days = Number(req.body.days) || 0;
  const hours = Number(req.body.hours) || 0;
  
  const key = Math.random().toString(36).substring(2, 12).toUpperCase();
  let expiresAt = 0;

  // Cálculo do tempo
  if (type === "temp") {
    const totalMs = (days * 86400000) + (hours * 3600000);
    if (totalMs > 0) {
        expiresAt = Date.now() + totalMs;
    }
  }
    
  // Objeto de dados
  const obj = {
    key: key,
    type: type || "vip",
    expiresAt: String(expiresAt), // Converte para string
    uses: "0",
    executor: "-",
    usedByIP: "-",
    hwid: "-",
    revoked: "false",
    lastUsedAt: "0",
    sessionExpiresAt: "0", 
    currentSessionHWID: "-", 
    ownerId: "",
    ownerName: "",
    ownerAvatar: ""
  };

  // --- CORREÇÃO 2: SALVAMENTO NO REDIS ---
  // Voltamos ao método padrão que é compatível com a maioria dos clientes Vercel/Upstash
  await redis.hset(`key:${key}`, obj);

  return res.json({ ok: true, data: obj });
}
