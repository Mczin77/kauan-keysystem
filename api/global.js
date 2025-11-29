import { redis } from "./redis.js";

export default async function handler(req, res) {
  // Configurações de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-panel-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Leitura da Configuração (GET)
  if (req.method === 'GET') {
      const config = await redis.hgetall("system:global");
      return res.json({ ok: true, config });
  }

  // Atualização da Configuração (POST)
  if (req.method === 'POST') {
      const token = req.headers["x-panel-token"];
      if (!token) return res.status(401).json({ error: "Sem token" });

      const { maintenance, message, shutdown } = req.body;

      // Atualiza o Redis
      await redis.hset("system:global", {
          maintenance: maintenance ? "true" : "false", // Se true, ninguém entra
          shutdown: shutdown ? "true" : "false",       // Se true, fecha o script de quem tá dentro
          message: message || ""                       // Mensagem para exibir
      });

      return res.json({ ok: true, message: "Configurações globais atualizadas" });
  }

  return res.status(405).json({ error: "Método não permitido" });
}
