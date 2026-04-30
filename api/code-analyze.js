const fetch = require('node-fetch');

const CODE_ANALYSIS_PROMPT = `你是一位资深代码架构师。用户会提供一段代码，你需要对其进行深入的结构和逻辑分析。

请严格按照以下格式输出：

## 代码分析报告

### 1. 整体功能概述
简要描述代码的整体功能和用途，用2-3句话概括。

### 2. 主要模块/函数说明
列出代码中的主要模块、类和函数：
| 名称 | 类型 | 作用说明 |
|------|------|----------|
| ... | 函数/类/模块 | ... |

### 3. 关键执行流程
用步骤分解代码的关键执行流程：
1. 步骤一：...
2. 步骤二：...
3. ...

### 4. 数据流转路径
分析数据在代码中的流转路径和变换过程，说明输入数据如何经过各步骤处理变为输出。

### 5. 核心算法/逻辑说明
解释代码中使用的核心算法或关键逻辑，必要时用伪代码辅助说明。

### 6. 代码质量评估
- **可读性**：评分及改进建议
- **可维护性**：评分及改进建议
- **性能**：评分及改进建议
- **安全性**：评分及改进建议

### 7. 改进建议
给出具体的改进方向和优先级。`;

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
            { role: 'system', content: CODE_ANALYSIS_PROMPT },
            { role: 'user', content: `请对以下${language || ''}代码进行深入分析：\n\n\`\`\`${language || ''}\n${code}\n\`\`\`` }
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
        console.error('代码分析API错误:', error);
        res.status(500).json({ error: '服务器内部错误', detail: error.message });
    }
};
