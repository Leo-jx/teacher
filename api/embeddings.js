const fetch = require('node-fetch');

function getConfig() {
    return {
        embeddingApi: {
            url: process.env.EMBEDDING_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2/embeddings',
            apiKey: process.env.API_KEY || 'a87ffea24723ba51b2817406aa6cdf30',
            apiSecret: process.env.API_SECRET || 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
        },
        modelId: process.env.MODEL_ID || 'xop35qwen2b'
    };
}

function getAuthHeader() {
    const config = getConfig();
    return `Bearer ${config.embeddingApi.apiKey}:${config.embeddingApi.apiSecret}`;
}

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
            model: config.modelId,
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
                error: 'Embedding API暂不支持当前模型',
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
