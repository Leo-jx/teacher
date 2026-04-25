module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    res.json({
        httpApi: {
            url: process.env.API_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
            modelId: process.env.MODEL_ID || 'xop35qwen2b',
            configured: !!(process.env.API_KEY && process.env.API_SECRET)
        },
        platform: 'Vercel Serverless',
        websocket: {
            available: false,
            message: 'Vercel平台不支持WebSocket，请使用HTTP API模式'
        },
        status: 'ok'
    });
};
