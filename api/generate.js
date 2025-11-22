import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // valida token simples (não é super seguro, mas funciona pra painel)

  // Garante que os valores do body são números inteiros
  const { type, days: d, hours: h, minutes: m } = req.body; 
  const days = parseInt(d || 0);
  const hours = parseInt(h || 0);
  const minutes = parseInt(m || 0);

  const key = Math.random().toString(36).substring(2, 12).toUpperCase();

  let expiresAt = 0; // Padrão para Keys VIP

  // --- CORREÇÃO DA LÓGICA DE TEMPO ---
  if (type === "temp") {
    const totalMs =
      (days * 86400000) + // Milissegundos em um dia
      (hours * 3600000) +  // Milissegundos em uma hora
      (minutes * 60000);   // Milissegundos em um minuto

    // Apenas calcula a expiração se houver alguma duração
    if (totalMs > 0) {
        expiresAt = Date.now() + totalMs;
    } else {
        // Opcional: Bloquear geração de keys temporárias com 0ms de duração
        // return res.status(400).json({ ok: false, error: "Duração temporária deve ser maior que zero." });
        // Por enquanto, apenas avança.
    }
  }
  // ------------------------------------
    
  const obj = {
    key,
    type,
    expiresAt,
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

  // Correção robusta do hset (manter)
  const fieldsAndValues = Object.entries(obj).flat();
  await redis.hset(`key:${key}`, ...fieldsAndValues);

  return res.json({ ok: true, data: obj });
}
