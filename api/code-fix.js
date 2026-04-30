const fetch = require('node-fetch');

const CODE_FIX_PROMPT = `你是一位资深代码审查专家。用户会提供一段代码，你需要对其进行全面的纠错分析。

请严格按照以下格式输出：

## 代码纠错报告

### 发现的问题

对每个问题，请提供：

**问题 N：[问题简述]**
- **错误位置**：第X行，具体代码段
- **错误类型**：语法错误 / 逻辑错误 / 性能问题 / 最佳实践违背 / 安全隐患
- **错误原因**：详细解释为什么这是一个错误
- **修改建议**：
\`\`\`[语言]
// 修改后的代码
\`\`\`
- **修改依据**：说明修改的技术原理

### 修改后的完整代码

\`\`\`[语言]
// 给出修复后的完整代码
\`\`\`

注意事项：
1. 必须精确定位到行号
2. 区分错误严重程度（致命/警告/建议）
3. 修改建议必须是可直接运行的代码
4. 如果代码没有问题，说明代码质量良好并给出优化建议`;

function getConfig() {
    return {
        httpApi: {
            url: process.env.API_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
            modelId: process.env.MODEL_ID || 'xop35qwen2b',
            apiKey: process.env.API_KEY || 'a87ffea24723ba51b2817406aa6cdf30',
            apiSecret: process.env.API_SECRET || 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
        }
    };
}

function getAuthHeader() {
    const config = getConfig();
    return `Bearer ${config.httpApi.apiKey}:${config.httpApi.apiSecret}`;
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
        const { code, language } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'code参数无效' });
        }

        const config = getConfig();
        const fullMessages = [
            { role: 'system', content: CODE_FIX_PROMPT },
            { role: 'user', content: `请对以下${language || ''}代码进行纠错分析：\n\n\`\`\`${language || ''}\n${code}\n\`\`\`` }
        ];

        const requestBody = {
            model: config.httpApi.modelId,
            messages: fullMessages,
            stream: false,
            temperature: 0.3,
            max_tokens: 4096
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
            return res.status(response.status).json({
                error: `API请求失败: ${response.status}`,
                detail: errorText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('代码纠错API错误:', error);
        res.status(500).json({ error: '服务器内部错误', detail: error.message });
    }
};
