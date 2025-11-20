import fs from "fs";
import path from "path";

export default function handler(req, res) {
    const { user, pass, hours } = req.query;

    const dbPath = path.join(process.cwd(), "db.json");
    const db = JSON.parse(fs.readFileSync(dbPath));

    // Login
    if (db.logins[user] !== pass) {
        return res.status(403).json({ status: "LOGIN_FAILED" });
    }

    // Gerar key
    function makeKey() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
        let s = "";
        for (let i = 0; i < 20; i++) {
            s += chars[Math.floor(Math.random() * chars.length)];
        }
        return "KEY-" + s;
    }

    const key = makeKey();

    // Expiração (em horas)
    const expiresAt = hours ? Date.now() + hours * 60 * 60 * 1000 : 0;

    db.keys.push({
        key,
        createdAt: Date.now(),
        expiresAt,
        lastUse: 0,
        usedBy: "None",
        executor: "None",
        ip: "None"
    });

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

    return res.status(200).json({
        status: "GENERATED",
        key
    });
}
