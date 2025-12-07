/**
 * MÓDULO API COMBINADO (Busca de Usuário + Notificação por DM)
 * * Este arquivo combina a funcionalidade dos endpoints 'discord.js' e 'notify.js' 
 * para ser usado em um ambiente de função serverless (como Vercel/Next.js API).
 *
 * NOTA: Para rodar este código, você precisa de um sistema de gerenciamento de estado 
 * como o Redis (importado abaixo) para a lógica de 'notify'.
 */

import { redis } from "./redis.js"; // Mantém a importação para a lógica de 'notify'

// --------------------------------------------------------------------------------
// LÓGICA DE BUSCA DE USUÁRIO (Originalmente de 'discord.js')
// Endpoint: /api/discord?id=USUARIO_ID
// --------------------------------------------------------------------------------

async function fetchDiscordUser(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "ID faltando" });

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "Bot token não configurado na Vercel" });

    try {
        // Chama a API oficial do Discord
        const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
            headers: { Authorization: `Bot ${botToken}` }
        });

        if (!response.ok) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const user = await response.json();

        // Monta a URL do avatar
        const avatarUrl = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
            : `https://cdn.discordapp.com/embed/avatars/0.png`; // Avatar padrão se não tiver foto

        return res.json({
            ok: true,
            username: user.username,
            global_name: user.global_name,
            id: user.id,
            avatar: avatarUrl
        });

    } catch (e) {
        return res.status(500).json({ error: "Erro ao conectar ao Discord" });
    }
}

// --------------------------------------------------------------------------------
// LÓGICA DE NOTIFICAÇÃO POR DM (Originalmente de 'notify.js')
// Endpoint: /api/notify (POST)
// --------------------------------------------------------------------------------

async function notifyDiscordUser(req, res) {
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
        finalMessage = `🔑 **AVISO DE EXPIRAÇÃO:**\n\nSua chave \`${key}\` está prestes a expirar. Renove o quanto antes para continuar usando o serviço!`;
    } else if (messageType === "expired") {
        finalMessage = `❌ **CHAVE EXPIRADA:**\n\nSua chave \`${key}\` expirou. Você não pode mais usar o serviço. Renove sua chave para reativar o acesso.`;
    } else if (messageType === "custom") {
        if (!customMessage) return res.status(400).json({error: "Mensagem vazia"});
        finalMessage = `🔔 **Mensagem do Admin:**\n\n${customMessage}`;
    } else {
        return res.status(400).json({ ok: false, error: "Tipo de mensagem inválido" });
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
            const errorBody = await sendRes.json();
            return res.status(400).json({ ok: false, error: `Falha ao enviar mensagem: ${errorBody.message || sendRes.statusText}` });
        }

    } catch (e) {
        return res.status(500).json({ ok: false, error: `Erro ao processar a notificação: ${e.message}` });
    }
}

// --------------------------------------------------------------------------------
// EXPORTAÇÃO PRINCIPAL (Simulando o 'export default' de um arquivo Vercel/Next.js)
// --------------------------------------------------------------------------------

/**
 * Esta função de roteamento é necessária porque um único arquivo Vercel/Next.js 
 * só pode ter um 'export default'. Você pode adaptar isso para o seu roteador.
 * * Neste exemplo, a rota '/api/discord' com 'GET' buscaria o usuário, 
 * e '/api/discord' com 'POST' enviaria a notificação.
 */
export default async function handler(req, res) {
    if (req.method === 'GET') {
        return fetchDiscordUser(req, res);
    }
    if (req.method === 'POST') {
        // Nota: O 'notify.js' original tratava 'OPTIONS' e 'POST'.
        // Se você precisa que o POST faça a notificação, use:
        return notifyDiscordUser(req, res);
    }
    // Caso seja outro método (PUT, DELETE, etc.)
    return res.status(405).json({ error: "Método não permitido nesta rota" });
}
