// /api/generate.js
import kv from "./kv";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const auth = req.headers["x-panel-token"];
  if (!auth) return res.status(401).json({ error: "unauth" });

  // simple token acceptance (panel must pass the token from /api/login)
  // you can tighten by storing valid tokens in KV.
  const body = req.body || {};
  const type = body.type || "normal"; // normal | vip
  const days = Number(body.days || 0);
  const hours = Number(body.hours || 0);
  const minutes = Number(body.minutes || 0);

  if (!days && !hours && !minutes) {
    // default 1 day
  }

  const ttlMillis =
    (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);

  const key = (type === "vip" ? "VIP-" : "") + uuidv4().replace(/-/g, "").slice(0, 18).toUpperCase();
  const createdAt = Date.now();
  const expiresAt = ttlMillis > 0 ? createdAt + ttlMillis : 0;

  const data = {
    key,
    type,
    createdAt,
    expiresAt,
    status: "active",
    usedByIP: null,
    executor: null,
    uses: 0
  };

  // store as hash
  await kv.hset(`key:${key}`, data);

  // also add to an index set for listing
  await kv.sadd("keys:set", key);

  // set TTL if expiresAt > 0 (set expire in seconds)
  if (expiresAt > 0) {
    const ttlSec = Math.ceil((expiresAt - createdAt) / 1000);
    await kv.expire(`key:${key}`, ttlSec);
  }

  return res.status(200).json({ ok: true, data });
}
