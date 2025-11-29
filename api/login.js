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
