import kv from "./kv";

export default async function handler(req, res) {
    const keys = await kv.keys("key:*");
    const all = [];

    for (const k of keys) {
        const data = await kv.hgetall(k);
        all.push(data);
    }

    return res.status(200).json(all);
}
