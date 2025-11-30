import { redis } from "./redis.js";

export default async function handler(req, res) {
  // 1. Segurança Básica
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token" });

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return res.status(500).json({ error: "Bot Token não configurado na Vercel" });

  // 2. Recebe dados do painel
  const { key, messageType, customMessage } = req.body; 

  // 3. Busca dados da Key e do Dono
  const data = await redis.hgetall(`key:${key}`);
  if (!data.key) return res.status(404).json({ ok: false, error: "Key não encontrada" });
  if (!data.ownerId) return res.status(400).json({ ok: false, error: "Key sem dono vinculado" });

  // 4. Define a mensagem
  let finalMessage = "";

  if (messageType === "time") {
      // Lógica de cálculo de tempo
      if (data.expiresAt == 0 || data.expiresAt == "0") {
          finalMessage = `Olá **${data.ownerName}**! \n💎 Sua Key **${key}** é **PERMANENTE** (VIP). Aproveite!`;
      } else {
          const msRemaining = Number(data.expiresAt) - Date.now();
          if (msRemaining <= 0) {
              finalMessage = `Olá **${data.ownerName}**! \n❌ Sua Key **${key}** já **EXPIROU**. Entre em contato para renovar.`;
          } else {
            // Formatação simples de tempo
            const days = Math.floor(msRemaining / 86400000);
            const hours = Math.floor((msRemaining % 86400000) / 3600000);
            const minutes = Math.floor((msRemaining % 3600000) / 60000);
            finalMessage = `Olá **${data.ownerName}**! \n⏳ O tempo restante da sua Key **${key}** é: **${days}d ${hours}h ${minutes}m**.`;
          }
      }
  } else {
      // Mensagem customizada
      if (!customMessage) return res.status(400).json({error: "Mensagem vazia"});
      finalMessage = `🔔 **Mensagem do Admin:**\n\n${customMessage}`;
  }

  // 5. Tenta criar a DM no Discord
  try {
      // Passo A: Criar canal de DM com o usuário
      const createDmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
          method: "POST",
          headers: {
              "Authorization": `Bot ${botToken}`,
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ recipient_id: data.ownerId })
      });

      const dmChannel = await createDmRes.json();
      if (!dmChannel.id) {
          return res.status(400).json({ ok: false, error: "Não foi possível abrir DM (Usuário bloqueou o bot?)" });
      }

      // Passo B: Enviar a mensagem no canal criado
      const sendRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
          method: "POST",
          headers: {
              "Authorization": `Bot ${botToken}`,
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ content: finalMessage })
      });

      if (sendRes.ok) {
          return res.json({ ok: true, message: "Mensagem enviada!" });
      } else {
          return res.status(400).json({ ok: false, error: "Falha ao enviar mensagem final." });
      }

  } catch (e) {
      return res.status(500).json({ ok: false, error: "Erro interno de conexão com Discord." });
  }
}
