const fetch = require('node-fetch');
const { SYSTEM_PROMPT, getConfig, getAuthHeader } = require('./_lib/config');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, stream = false } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages参数无效' });
        }

        const config = getConfig();
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        const requestBody = {
            model: config.httpApi.modelId,
            messages: fullMessages,
            stream: stream,
            temperature: 0.7,
            max_tokens: 2048
        };

        const response = await fetch(config.httpApi.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API请求失败:', response.status, errorText);
            return res.status(response.status).json({
                error: `API请求失败: ${response.status}`,
                detail: errorText
            });
        }

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            response.body.on('data', (chunk) => {
                res.write(chunk);
            });

            response.body.on('end', () => {
                res.end();
            });
        } else {
            const data = await response.json();
            res.json(data);
        }
    } catch (error) {
        console.error('Chat API错误:', error);
        res.status(500).json({ error: '服务器内部错误', detail: error.message });
    }
};
