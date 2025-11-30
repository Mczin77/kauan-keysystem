export default function handler(req, res) {
  // Pega o token enviado pelo painel
  const token = req.headers["x-panel-token"];

  if (!token) {
    return res.status(401).json({ ok: false });
  }

  try {
    // Tenta decodificar o token (que está em Base64)
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    // O formato do token é "usuario:timestamp"
    const [user, time] = decoded.split(":");

    // Pega o usuário correto das configurações (ou usa admin como padrão)
    const correctUser = process.env.PANEL_USER || "admin";

    // Se o usuário do token bater com o usuário real, autoriza
    if (user === correctUser) {
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    // Se der erro ao decodificar, o token é falso
  }

  // Se chegou aqui, é inválido
  return res.status(401).json({ ok: false });
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method" });
  }

  const { user, pass } = req.body || {};
  const okUser = process.env.PANEL_USER || "admin";
  const okPass = process.env.PANEL_PASS || "1234";

  if (user === okUser && pass === okPass) {
    const token = Buffer.from(`${user}:${Date.now()}`).toString("base64");
    return res.status(200).json({ ok: true, token });
  }

  return res.status(401).json({ ok: false });
}
