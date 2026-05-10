// /api/storage.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Разрешаем запросы с любых устройств (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Получаем ключ из query-параметра (?key=kanban-tasks)
    const key = req.query.key;
    if (!key) {
        return res.status(400).json({ error: 'Missing key parameter' });
    }

    try {
        if (req.method === 'GET') {
            const data = await kv.get(key);
            return res.status(200).json(data);
        }

        if (req.method === 'POST') {
            await kv.set(key, JSON.stringify(req.body));
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Storage API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}