import { redis } from "./redis.js";

// Pegamos a senha do painel configurada nas variáveis de ambiente do Vercel
const ADMIN_PASS = process.env.PANEL_PASS; 

export default async function handler(req, res) {
    // Configuração de Permissões (CORS) - MUITO IMPORTANTE PARA O ROBLOX
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
    }

    // Parâmetros necessários do cliente (Lua/Roblox)
    const { key, hwid, executor } = req.body;

    if (!key || !hwid) {
        return res.json({ 
            ok: false, 
            message: "Parâmetros 'key' ou 'hwid' faltando.",
            code: 400 
        });
    }

    try {
        const redisKey = `key:${key}`;
        
        // 1. VERIFICA SE A CHAVE EXISTE
        const exists = await redis.exists(redisKey);
        if (!exists) {
            return res.json({ 
                ok: false, 
                message: "A Key fornecida não existe.",
                code: 404
            });
        }

        // 2. BUSCA TODOS OS DADOS DA CHAVE
        const data = await redis.hgetall(redisKey);

        // 3. VERIFICA SE ESTÁ REVOGADA (BLOQUEADA)
        if (data.revoked === "true") {
            // Atualiza o contador de uso mesmo se revogada (para fins de log)
            await redis.hincrby(redisKey, 'uses', 1);
            return res.json({ 
                ok: false, 
                message: "Sua Key foi revogada pelo administrador.",
                code: 403
            });
        }

        // 4. VERIFICA SE EXPIROU (Se expiresAt for '0', é permanente/VIP)
        const expiresAt = Number(data.expiresAt);
        if (expiresAt !== 0 && expiresAt < Date.now()) {
            // Atualiza o contador de uso mesmo se expirada
            await redis.hincrby(redisKey, 'uses', 1);
            return res.json({ 
                ok: false, 
                message: "Sua Key expirou.",
                code: 401
            });
        }
        
        // 5. VERIFICA O HWID (Hardware ID)
        const currentHwid = data.hwid;
        
        if (currentHwid !== "-" && currentHwid !== hwid) {
            // HWID já registrado, mas diferente do atual
            return res.json({ 
                ok: false, 
                message: "Key já registrada em outro dispositivo. Resete no Painel.",
                code: 409
            });
        }
        
        // 6. VERIFICA SESSÃO ATIVA (Se a sessão atual expirou ou é outro HWID)
        const sessionExpiresAt = Number(data.sessionExpiresAt);
        const currentSessionHWID = data.currentSessionHWID;

        // Se a sessão atual expirou ou o HWID da sessão mudou, inicia uma nova
        if (sessionExpiresAt < Date.now() || currentSessionHWID !== hwid) {
            
            // Define a duração da sessão (ex: 2 horas)
            const sessionDurationMs = 2 * 3600000; 
            const newSessionExpiresAt = Date.now() + sessionDurationMs;

            const updates = {
                // Registra o HWID se for o primeiro uso
                hwid: currentHwid === "-" ? hwid : currentHwid,
                // Inicia nova sessão
                currentSessionHWID: hwid,
                sessionExpiresAt: String(newSessionExpiresAt),
                // Log de uso
                lastUsedAt: String(Date.now()),
                executor: executor || data.executor || "Unknown" // Atualiza o executor
            };

            await redis.hset(redisKey, updates);
            await redis.hincrby(redisKey, 'uses', 1); // Incrementa o contador
            
            // Retorna os dados atualizados
            const updatedData = await redis.hgetall(redisKey);
            return res.json({ 
                ok: true, 
                message: "Login de Key bem-sucedido. Nova sessão iniciada.",
                keyData: updatedData
            });

        } else {
            // SESSÃO ATIVA: O HWID é o mesmo e o tempo de sessão não expirou.
            
            // Apenas atualiza o log de 'lastUsedAt' e o contador, sem redefinir a sessão.
            const updates = {
                lastUsedAt: String(Date.now()),
                executor: executor || data.executor || "Unknown" // Atualiza o executor
            };
            
            await redis.hset(redisKey, updates);
            await redis.hincrby(redisKey, 'uses', 1); // Incrementa o contador
            
            return res.json({ 
                ok: true, 
                message: "Key já estava logada. Sessão ativa.",
                keyData: data
            });
        }

    } catch (e) {
        // Loga qualquer erro de Redis ou servidor
        console.error("Erro no processamento da validação:", e);
        return res.status(500).json({ 
            ok: false,
            message: `Erro interno do servidor: ${e.message}`,
            code: 500 
        });
    }
}
