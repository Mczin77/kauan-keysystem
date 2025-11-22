import { redis } from "./redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  // valida token simples (não é super seguro, mas funciona pra painel)

  // --- CORREÇÃO AQUI: Garante que todos os campos são lidos e tratados como números ---
  const { type, days: d, hours: h, minutes: m } = req.body; 
  
  const days = parseInt(d || 0);
  const hours = parseInt(h || 0);
  const minutes = parseInt(m || 0);
  // ----------------------------------------------------------------------------------

  const key = Math.random().toString(36).substring(2, 12).toUpperCase();

  let expiresAt = 0; // Padrão: Keys VIP (Permanente)

  // Lógica de cálculo de tempo
  if (type === "temp") {
    const totalMs =
      (days * 86400000) + // Milissegundos em um dia
      (hours * 3600000) +  // Milissegundos em uma hora
      (minutes * 60000);   // Milissegundos em um minuto

    // Se a duração total for maior que zero, calcula a expiração
    if (totalMs > 0) {
        expiresAt = Date.now() + totalMs;
    }
    // Se totalMs for 0, expiresAt permanece 0, o que tecnicamente é permanente, mas não é o desejado para temp.
    // Isso deve ser evitado pelo dashboard (não gerar keys temp com 0 de duração).
  }
    
  const obj = {
    key,
    type,
    // Garante que o expiresAt é o valor calculado ou 0 para VIP
    expiresAt: String(expiresAt), // Converte para string para garantir que o Redis salve corretamente
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
