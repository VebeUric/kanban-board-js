// /api/storage.js
import { createClient } from 'redis';

let redisClient = null;

async function getRedisClient() {
    if (!redisClient) {
        try {
            redisClient = createClient({
                url: 'redis://default:PgAKgtn1CjI9ilcYkPGmDBHB6Drkc0nN@redis-15926.c239.us-east-1-2.ec2.cloud.redislabs.com:15926'
            });

            redisClient.on('error', (err) => {
                console.error('Redis Client Error:', err);
                redisClient = null;
            });

            redisClient.on('connect', () => {
                console.log('Connected to Redis');
            });

            await redisClient.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            redisClient = null;
        }
    }
    return redisClient;
}

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
        const client = await getRedisClient();
        if (!client) {
            throw new Error('Redis connection failed');
        }

        if (req.method === 'GET') {
            const data = await client.get(key);
            // Redis хранит строки, парсим JSON
            return res.status(200).json(data ? JSON.parse(data) : null);
        }

        if (req.method === 'POST') {
            // Сохраняем как JSON-строку
            await client.set(key, JSON.stringify(req.body));
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Storage API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
