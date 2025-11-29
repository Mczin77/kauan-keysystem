import { redis } from "./redis.js";

export default async function handler(req, res) {
  // Configuração de Permissões (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verifica o Token de Segurança do Painel
  const token = req.headers["x-panel-token"];
  if (!token) return res.status(401).json({ error: "Sem token de acesso" });

  // O parâmetro 'action' diz qual função executar (listar, gerar, deletar, etc)
  const { action } = req.query; 
  const botToken = process.env.DISCORD_BOT_TOKEN; // Token do seu Bot do Discord

  try {
      // 1. CHECAR LOGIN
      if (action === 'check') {
          return res.json({ ok: true });
      }

      // 2. LISTAR KEYS
      if (action === 'list') {
          const keys = await redis.keys("key:*");
          const out = [];
          // Valores padrão para não quebrar o painel
          const defaults = { hwid: "-", revoked: "false", lastUsedAt: 0, sessionExpiresAt: 0, currentSessionHWID: "-", ownerId: "", ownerName: "", ownerAvatar: "" };
          
          for (let k of keys) {
              let data = await redis.hgetall(k);
              data = { ...defaults, ...data };
              out.push(data);
          }
          return res.json({ ok: true, keys: out });
      }

      // 3. GERAR KEY
      if (action === 'generate' && req.method === 'POST') {
         const { type, days: d, hours: h } = req.body;
         const days = Number(d) || 0;
         const hours = Number(h) || 0;
         const key = Math.random().toString(36).substring(2, 12).toUpperCase();
         
         let expiresAt = 0;
         if (type === "temp") {
             const totalMs = (days * 86400000) + (hours * 3600000);
             if (totalMs > 0) expiresAt = Date.now() + totalMs;
         }
         
         const obj = {
             key, type: type || "vip", expiresAt: String(expiresAt), uses: "0",
             executor: "-", usedByIP: "-", hwid: "-", revoked: "false",
             lastUsedAt: "0", sessionExpiresAt: "0", currentSessionHWID: "-",
             ownerId: "", ownerName: "", ownerAvatar: ""
         };
         
         const fields = Object.entries(obj).flat();
         await redis.hset(`key:${key}`, ...fields);
         return res.json({ ok: true, data: obj });
      }

      // 4. DELETAR KEY
      if (action === 'delete' && req.method === 'POST') {
          const { key } = req.body;
          if (!key) return res.json({error: "Key faltando"});
          await redis.del(`key:${key}`);
          return res.json({ ok: true });
      }

      // 5. REVOGAR / BLOQUEAR
      if (action === 'revoke' && req.method === 'POST') {
          const { key, state } = req.body;
          const exists = await redis.exists(`key:${key}`);
          if (!exists) return res.status(404).json({ ok: false, error: "Key não encontrada" });
          const revokedStatus = (state === true || state === "true") ? "true" : "false";
          await redis.hset(`key:${key}`, { revoked: revokedStatus });
          return res.json({ ok: true });
      }

      // 6. RESETAR HWID
      if (action === 'reset_hwid' && req.method === 'POST') {
          const { key } = req.body;
          const exists = await redis.exists(`key:${key}`);
          if (!exists) return res.status(404).json({ ok: false, error: "Key não encontrada" });
          await redis.hset(`key:${key}`, { hwid: "-", currentSessionHWID: "-", sessionExpiresAt: 0 });
          return res.json({ ok: true });
      }

      // 7. SISTEMA GLOBAL (Manutenção/Shutdown)
      if (action === 'global') {
          if (req.method === 'GET') {
              const config = await redis.hgetall("system:global");
              return res.json({ ok: true, config });
          }
          if (req.method === 'POST') {
              const { maintenance, shutdown, message } = req.body;
              await redis.hset("system:global", {
                  maintenance: maintenance ? "true" : "false",
                  shutdown: shutdown ? "true" : "false",
                  message: message || ""
              });
              return res.json({ ok: true });
          }
      }

      // 8. DISCORD: BUSCAR USUÁRIO
      if (action === 'discord_search') {
          const { id } = req.query;
          if (!botToken) return res.status(500).json({ error: "Bot Token não configurado na Vercel" });
          
          const discordRes = await fetch(`https://discord.com/api/v10/users/${id}`, {
              headers: { "Authorization": `Bot ${botToken}` }
          });
          
          const user = await discordRes.json();
          if (user.id) {
               const avatar = user.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                  : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;
               return res.json({ ok: true, id: user.id, username: user.username, global_name: user.global_name, avatar });
          } else {
              return res.json({ ok: false, error: "Usuário não encontrado" });
          }
      }

      // 9. DISCORD: VINCULAR (ASSIGN)
      if (action === 'assign' && req.method === 'POST') {
          const { key, discordId, discordName, discordAvatar } = req.body;
          const exists = await redis.exists(`key:${key}`);
          if (!exists) return res.status(404).json({ ok: false, error: "Key não encontrada" });
          
          await redis.hset(`key:${key}`, {
              ownerId: discordId,
              ownerName: discordName,
              ownerAvatar: discordAvatar
          });
          return res.json({ ok: true });
      }

      // 10. DISCORD: NOTIFICAR (DM)
      if (action === 'notify' && req.method === 'POST') {
          const { key, messageType, customMessage } = req.body;
          if (!botToken) return res.status(500).json({ error: "Bot Token não configurado" });
          
          const data = await redis.hgetall(`key:${key}`);
          if (!data.ownerId) return res.status(400).json({ error: "Key sem dono vinculado" });

          let finalMessage = "";
          if (messageType === "time") {
             if (data.expiresAt == 0) finalMessage = `Olá **${data.ownerName}**! \n💎 Sua Key **${key}** é **PERMANENTE** (VIP).`;
             else {
                 const ms = Number(data.expiresAt) - Date.now();
                 if (ms <= 0) finalMessage = `Olá **${data.ownerName}**! \n❌ Sua Key **${key}** já **EXPIROU**.`;
                 else {
                     const d = Math.floor(ms/86400000);
                     const h = Math.floor((ms%86400000)/3600000);
                     finalMessage = `Olá **${data.ownerName}**! \n⏳ Tempo restante da key **${key}**: **${d} dias e ${h} horas**.`;
                 }
             }
          } else {
              finalMessage = `🔔 **Mensagem do Admin:**\n\n${customMessage}`;
          }

          // Cria DM
          const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
              method: "POST", headers: { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ recipient_id: data.ownerId })
          });
          const dmChannel = await dmRes.json();
          if (!dmChannel.id) return res.status(400).json({ error: "Não foi possível abrir DM" });

          // Envia
          const sendRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
              method: "POST", headers: { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ content: finalMessage })
          });

          if (sendRes.ok) return res.json({ ok: true });
          else return res.status(400).json({ ok: false, error: "Falha ao enviar mensagem" });
      }

      return res.status(400).json({ error: "Ação desconhecida" });

  } catch (e) {
      return res.status(500).json({ error: e.message });
  }
}
