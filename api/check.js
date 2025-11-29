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
