import kv from "./kv";

export default async function handler(req, res) {
    if (req.method !== "POST")
        return res.status(405).json({ error: "Método inválido" });

    const { key, days } = req.body;
    if (!key || !days)
        return res.status(400).json({ error: "Envie a key e os dias" });

    const expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);

    const data = {
        key,
        createdAt: Date.now(),
        expiresAt,
        status: "active",
        usedByIP: "none",
        executor: "none"
    };

    await kv.hset(`key:${key}`, data);

    return res.status(200).json({
        success: true,
        message: "Key criada com sucesso!",
        data
    });
}
