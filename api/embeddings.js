const fetch = require('node-fetch');
const { getConfig, getAuthHeader } = require('./_lib/config');

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
        const { input } = req.body;

        if (!input) {
            return res.status(400).json({ error: 'input参数无效' });
        }

        const config = getConfig();
        const texts = Array.isArray(input) ? input : [input];

        const requestBody = {
            model: config.httpApi.modelId,
            input: texts
        };

        const response = await fetch(config.embeddingApi.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.json({
                success: false,
                error: 'Embedding API暂不支持当前模型，核心对话功能正常',
                statusCode: response.status,
                fallback: true
            });
        }

        res.json({ success: true, data: data });
    } catch (error) {
        console.error('Embedding API错误:', error);
        res.json({
            success: false,
            error: 'Embedding服务暂时不可用',
            fallback: true
        });
    }
};
