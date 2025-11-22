import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // A sua verificação de token permanece
  // --- CORREÇÃO: Leitura e conversão segura para Number ---
  const { type } = req.body;
  
  // Usa Number() em vez de parseInt() para maior robustez e garante 0 se for nulo
  const days = Number(req.body.days) || 0;
  const hours = Number(req.body.hours) || 0;
  // O campo 'minutes' é ignorado aqui, pois é hardcoded como 0 no frontend

  const key = Math.random().toString(36).substring(2, 12).toUpperCase();

  let expiresAt = 0; // Padrão: Keys VIP (Permanente)

  // Lógica de cálculo de tempo
  if (type === "temp") {
    const totalMs =
      (days * 86400000) + // Milissegundos em um dia
      (hours * 3600000);  // Milissegundos em uma hora

    if (totalMs > 0) {
        expiresAt = Date.now() + totalMs;
    }
  }
    
  const obj = {
    key,
    type,
    // Converte para string para garantir que o Redis salve corretamente
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
    ownerAvatar: ""
  };

  // Correção robusta do hset
  const fieldsAndValues = Object.entries(obj).flat();
  await redis.hset(`key:${key}`, ...fieldsAndValues);

  return res.json({ ok: true, data: obj });
}
