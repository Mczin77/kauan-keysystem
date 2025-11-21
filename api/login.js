export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { user, pass } = req.body;

  if (!user || !pass) {
    return res.status(400).json({ error: "Faltando dados" });
  }

  if (user === process.env.PANEL_USER && pass === process.env.PANEL_PASS) {
    return res.json({ success: true });
  }

  return res.status(401).json({ success: false, error: "Credenciais inválidas" });
}
