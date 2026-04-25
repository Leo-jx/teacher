const { getConfig } = require('./_lib/config');

module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const config = getConfig();
    
    res.json({
        httpApi: {
            url: config.httpApi.url,
            modelId: config.httpApi.modelId,
            configured: !!(config.httpApi.apiKey && config.httpApi.apiSecret)
        },
        embeddingApi: {
            url: config.embeddingApi.url,
            configured: !!(config.embeddingApi.apiKey && config.embeddingApi.apiSecret)
        },
        platform: 'Vercel Serverless',
        websocket: {
            available: false,
            message: 'Vercel平台不支持WebSocket，请使用HTTP API模式'
        }
    });
};
