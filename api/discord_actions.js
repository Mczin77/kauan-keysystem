import { redis } from "./redis.js";

// --- Configuração Básica ---
// O Bot Token deve estar configurado nas Variáveis de Ambiente do Vercel
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_URL = "https://discord.com/api/v10";

// --- 1. FUNÇÃO: ATRIBUIR DONO À CHAVE (ASSIGN) ---
async function handleAssign(req, res) {
    const { key, discordId, discordName, discordAvatar } = req.body;
    
    if (!key || !discordId) {
        return res.status(400).json({ ok: false, message: "Faltando dados (key/discordId)." });
    }

    // 1. Verifica se a key existe
    const exists = await redis.exists(`key:${key}`);
    if (!exists) {
        return res.status(404).json({ ok: false, message: "Key não existe." });
    }

    // 2. Atualiza a key com os dados do dono
    await redis.hset(`key:${key}`, {
        ownerId: discordId,
        ownerName: discordName || "Usuário Discord", // Garante um nome
        ownerAvatar: discordAvatar || "N/A" // Garante um avatar
    });

    return res.json({ ok: true, message: "Key vinculada com sucesso." });
}

// --- 2. FUNÇÃO: BUSCAR DADOS DO USUÁRIO NO DISCORD (DISCORD USER FETCH) ---
async function handleFetchUser(req, res) {
    // Para esta função, o ID é enviado como 'id' no corpo (POST) em vez de 'query' (GET)
    const { id } = req.body; 
    
    if (!id) {
        return res.status(400).json({ ok: false, message: "ID do Discord faltando." });
    }
    if (!BOT_TOKEN) {
        return res.status(500).json({ ok: false, message: "Bot token não configurado na Vercel." });
    }

    try {
        const response = await fetch(`${API_URL}/users/${id}`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });

        if (!response.ok) {
            return res.status(404).json({ ok: false, message: "Usuário Discord não encontrado ou ID inválido." });
        }

        const user = await response.json();

        // Monta a URL do avatar
        const avatarUrl = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
            : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;

        return res.json({
            ok: true,
            username: user.username,
            global_name: user.global_name,
            id: user.id,
            avatar: avatarUrl
        });

    } catch (e) {
        console.error("Erro ao buscar dados do Discord:", e);
        return res.status(500).json({ ok: false, message: "Erro ao conectar ao Discord." });
    }
}

// --- 3. FUNÇÃO: ENVIAR NOTIFICAÇÃO VIA DM (NOTIFY) ---
async function handleNotify(req, res) {
    const { key, messageType, customMessage } = req.body; 

    if (!BOT_TOKEN) {
        return res.status(500).json({ ok: false, message: "Bot Token não configurado na Vercel." });
    }
    if (!key) {
        return res.status(400).json({ ok: false, message: "Key faltando." });
    }

    // 1. Busca dados da Key e do Dono
    const data = await redis.hgetall(`key:${key}`);
    if (!data.key) {
        return res.status(404).json({ ok: false, message: "Key não encontrada." });
    }
    if (!data.ownerId) {
        return res.status(400).json({ ok: false, message: "Key sem dono vinculado (ownerId faltando)." });
    }

    // 2. Define a mensagem
    let finalMessage = "";
    if (messageType === "time") {
        // Mensagem padrão para tempo
        finalMessage = `🕒 **Key quase expirando!**\n\nA sua key \`${key}\` expira em breve. Por favor, renove-a.`;
    } else if (messageType === "revoke") {
        // Mensagem padrão para revogação
        finalMessage = `🚫 **Key Revogada!**\n\nA sua key \`${key}\` foi desativada pelo administrador.`;
    } else if (messageType === "custom" && customMessage) {
        // Mensagem customizada
        finalMessage = `🔔 **Mensagem do Admin:**\n\n${customMessage}`;
    } else {
        return res.status(400).json({ ok: false, message: "Tipo de mensagem inválido ou mensagem customizada vazia." });
    }

    // 3. Tenta criar a DM no Discord
    try {
        // Passo A: Criar canal de DM com o usuário
        const createDmRes = await fetch(`${API_URL}/users/@me/channels`, {
            method: "POST",
            headers: {
                "Authorization": `Bot ${BOT_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ recipient_id: data.ownerId })
        });

        const dmChannel = await createDmRes.json();
        if (!dmChannel.id) {
            return res.status(400).json({ ok: false, message: "Não foi possível abrir DM (Usuário pode ter bloqueado o bot)." });
        }

        // Passo B: Enviar a mensagem no canal criado
        const sendRes = await fetch(`${API_URL}/channels/${dmChannel.id}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bot ${BOT_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content: finalMessage })
        });

        if (sendRes.ok) {
            return res.json({ ok: true, message: "Mensagem enviada com sucesso!" });
        } else {
            const errorBody = await sendRes.json();
            return res.status(400).json({ ok: false, message: `Falha ao enviar mensagem: ${errorBody.message || 'Erro desconhecido'}` });
        }

    } catch (e) {
        console.error("Erro no processo de notificação DM:", e);
        return res.status(500).json({ ok: false, message: "Erro interno do servidor ao tentar enviar DM." });
    }
}


// --- ROTEADOR PRINCIPAL DO HANDLER ---
export default async function handler(req, res) {
    // Configurações de CORS (necessárias para chamadas do painel)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Método não permitido. Use POST." });

    // 1. Autenticação do Painel (Token do Admin)
    const token = req.headers["x-panel-token"];
    if (!token || token !== process.env.PANEL_SECRET) {
        return res.status(401).json({ ok: false, message: "Token de painel inválido ou faltando." });
    }

    // 2. Roteamento por 'action'
    const { action } = req.body; 

    if (!action) {
        return res.status(400).json({ ok: false, message: "Ação faltando no corpo da requisição." });
    }

    switch (action) {
        case "assign":
            return handleAssign(req, res);
        case "notify":
            return handleNotify(req, res);
        case "fetch_user":
            return handleFetchUser(req, res); // Esta ação agora aceita POST com 'id' no corpo
        default:
            return res.status(400).json({ ok: false, message: "Ação desconhecida." });
    }
}
