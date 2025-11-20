import fs from "fs";
import path from "path";

export default function handler(req, res) {
    const dbPath = path.join(process.cwd(), "db.json");
    const db = JSON.parse(fs.readFileSync(dbPath));

    const { key, executor, userid, username } = req.query;

    if (!key) return res.status(400).json({ status: "NO_KEY" });

    const found = db.keys.find(k => k.key === key);

    if (!found) return res.status(403).json({ status: "INVALID" });

    // Expiração automática
    const now = Date.now();
    if (found.expiresAt !== 0 && now > found.expiresAt) {
        return res.status(403).json({ status: "EXPIRED" });
    }

    // Registrar uso
    found.lastUse = now;
    found.usedBy = username || "Unknown";
    found.executor = executor || "Unknown";
    found.ip = req.headers["x-forwarded-for"] || "Unknown";

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

    return res.status(200).json({ status: "VALID" });
}
