const fs = require("fs");
const path = require("path");

module.exports = (req, res) => {
    const dbPath = path.join(__dirname, "..", "db.json");
    const db = JSON.parse(fs.readFileSync(dbPath));

    const key = req.query.key;
    const executor = req.query.executor || "unknown";
    const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    const found = db.keys.find(k => k.key === key);

    if (!found) {
        return res.json({ success: false, message: "invalid_key" });
    }

    if (Date.now() > found.expires) {
        return res.json({ success: false, message: "expired_key" });
    }

    if (!found.used) {
        found.used = true;
        found.ip = userIp;
        found.executor = executor;
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    res.json({
        success: true,
        message: "validated",
        key: key,
        registered_ip: found.ip,
        executor: found.executor
    });
};
