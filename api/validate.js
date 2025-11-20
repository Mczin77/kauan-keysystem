import kv from "./kv";

export default async function handler(req, res) {
    const key = req.query.key;
    const executor = req.headers["executor"] || "unknown";

    const ip =
        req.headers["x-real-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress;

    if (!key)
        return res.status(400).json({ error: "Nenhuma key enviada." });

    const data = await kv.hgetall(`key:${key}`);
    if (!data)
        return res.status(404).json({ error: "Key inexistente." });

    if (Date.now() > Number(data.expiresAt))
        return res.status(403).json({ error: "Key expirada." });

    await kv.hset(`key:${key}`, {
        usedByIP: ip,
        executor
    });

    return res.status(200).json({ valid: true });
}
