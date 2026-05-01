// 默认配置（备用）
const DEFAULT_CONFIG = {
    API_URL: 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
    MODEL_ID: 'xop35qwen2b',
    API_KEY: 'a87ffea24723ba51b2817406aa6cdf30',
    API_SECRET: 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
};

const SYSTEM_PROMPT = `你是"程序员AI辅助助手"，一位全栈技术专家，专门为程序员提供编程与技术问题的专业解答。你的核心职责是回答以下技术领域的问题：

## 支持的技术领域

### 1. MySQL数据库开发与优化
- SQL语法（SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP等）
- 数据库设计与三大范式
- 索引优化、查询性能调优、执行计划分析
- 存储引擎（InnoDB, MyISAM等）原理与选型
- 事务ACID特性与锁机制（乐观锁、悲观锁、行锁、表锁）
- 主从复制、读写分离、分库分表

### 2. Java编程语言及相关框架
- Java基础语法、面向对象编程、集合框架
- Java并发编程（线程、线程池、锁、CAS）
- JVM原理、内存模型、GC调优
- Spring Framework（IoC、AOP、事务管理）
- Spring Boot自动配置与微服务开发

### 3. Python编程及数据分析
- Python基础语法、数据类型、函数与装饰器
- NumPy/Pandas数据处理与分析
- Flask/Django Web开发框架

### 4. C语言基础与系统开发
- C语言基础语法、指针与内存管理
- 文件I/O操作与系统调用
- 网络编程（Socket）

### 5. C++面向对象编程与高性能应用
- C++基础与面向对象编程
- STL标准模板库
- 智能指针与内存管理

### 6. 微信小程序开发
- 小程序框架与生命周期
- WXML/WXSS/JS页面开发
- 云开发与API调用

### 7. uni-app跨平台应用开发
- uni-app框架与Vue语法
- 跨平台适配

### 8. Coze AI助手开发
- Coze平台基础与Bot创建
- 提示词工程

### 9. Vue前端框架应用
- Vue2/Vue3核心语法
- 组件化开发与通信
- Vue Router路由管理

### 10. Spring后端框架及生态系统
- Spring IoC容器与依赖注入
- Spring MVC请求处理
- Spring Boot自动配置

## 回答原则
1. 专业准确：提供准确、权威的技术解答
2. 代码示例：使用markdown代码块格式
3. 由浅入深：从基础概念讲起
4. 最佳实践：给出行业最佳实践建议

## 边界约束
- 只回答上述10个技术领域相关的编程与技术问题
- 如果用户问的问题与上述领域无关，请礼貌地告知你只能回答编程技术相关问题`;

// 获取配置值（优先环境变量，其次默认配置）
function getConfigValue(env, key) {
    // 尝试从环境变量获取
    if (env && typeof env === 'object') {
        if (env[key] !== undefined && env[key] !== '') return env[key];
        if (env.SITE && env.SITE[key] !== undefined && env.SITE[key] !== '') return env.SITE[key];
        if (env.CF_PAGES && env.CF_PAGES[key] !== undefined && env.CF_PAGES[key] !== '') return env.CF_PAGES[key];
        // 尝试process.env（如果可用）
        if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    }
    // 返回默认值
    return DEFAULT_CONFIG[key];
}

async function handleChatRequest(request, env) {
    try {
        console.log('收到API请求...');
        
        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            console.error('错误：messages参数无效');
            return new Response(JSON.stringify({ error: 'messages参数无效' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 获取配置
        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        console.log('配置信息:', { API_URL, MODEL_ID, hasKey: !!API_KEY, hasSecret: !!API_SECRET });

        // 检查配置
        if (!API_KEY || !API_SECRET) {
            console.error('错误：API_KEY或API_SECRET未配置');
            return new Response(JSON.stringify({
                error: '配置错误',
                detail: 'API_KEY或API_SECRET未配置'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        const authHeader = `Bearer ${API_KEY}:${API_SECRET}`;

        console.log('准备调用AI API...');

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            console.error('请求超时');
            controller.abort();
        }, 60000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: fullMessages,
                stream: false,
                temperature: 0.7,
                max_tokens: 2048
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI API请求失败:', response.status, errorText);
            return new Response(JSON.stringify({
                error: `API请求失败: ${response.status}`,
                detail: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();
        console.log('AI API响应成功');
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Chat API错误:', error);
        let errorMessage = '服务器内部错误';
        let errorDetail = error.message;
        
        if (error.name === 'AbortError') {
            errorMessage = '请求超时';
            errorDetail = 'AI服务响应时间过长，请稍后重试';
        }
        
        return new Response(JSON.stringify({
            error: errorMessage,
            detail: errorDetail
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleConfigRequest(env) {
    return new Response(JSON.stringify({
        success: true,
        config: {
            websocket: {
                available: false,
                message: '当前平台不支持WebSocket，请使用HTTP模式'
            }
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function handleCodeRequest(request, env, toolType) {
    try {
        console.log(`收到代码${toolType}请求...`);
        
        const { code, language } = await request.json();

        if (!code) {
            console.error('错误：code参数无效');
            return new Response(JSON.stringify({ error: 'code参数无效' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        console.log('配置信息:', { API_URL, MODEL_ID, hasKey: !!API_KEY, hasSecret: !!API_SECRET });

        if (!API_KEY || !API_SECRET) {
            console.error('错误：API_KEY或API_SECRET未配置');
            return new Response(JSON.stringify({
                error: '配置错误',
                detail: 'API_KEY或API_SECRET未配置'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const langMap = {
            'javascript': 'JavaScript', 'python': 'Python', 'java': 'Java',
            'cpp': 'C++', 'c': 'C', 'sql': 'SQL', 'go': 'Go', 'rust': 'Rust',
            'typescript': 'TypeScript', 'php': 'PHP', 'html': 'HTML',
            'css': 'CSS', 'vue': 'Vue', 'shell': 'Shell'
        };
        const langLabel = langMap[language] || language;

        let prompt;
        if (toolType === 'fix') {
            prompt = `请对以下${langLabel}代码进行全面的纠错分析，找出所有问题并给出修复方案：\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n请按以下格式输出分析结果：\n\n## 代码纠错报告\n\n### 发现的问题\n\n对每个问题，请提供：\n1. **错误位置**：精确到行号和具体代码段\n2. **错误类型**：语法错误/逻辑错误/性能问题/最佳实践违背\n3. **错误原因**：详细解释为什么这是一个错误\n4. **修改建议**：给出具体的修改后代码\n5. **修改依据**：说明修改的技术原理\n\n### 修改后的完整代码\n\n请给出修复后的完整代码。`;
        } else {
            prompt = `请对以下${langLabel}代码进行深入的结构和逻辑分析：\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n请按以下格式输出分析结果：\n\n## 代码分析报告\n\n### 1. 整体功能概述\n\n简要描述代码的整体功能和用途。\n\n### 2. 主要模块/函数说明\n\n列出代码中的主要模块、类和函数，说明各自的作用。\n\n### 3. 关键执行流程\n\n逐步分解代码的关键执行流程。\n\n### 4. 数据流转路径\n\n分析数据在代码中的流转路径和变换过程。\n\n### 5. 核心算法/逻辑说明\n\n解释代码中使用的核心算法或关键逻辑。\n\n### 6. 代码质量评估\n\n评估代码的可读性、可维护性和性能表现，给出改进建议。`;
        }

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ];

        const authHeader = `Bearer ${API_KEY}:${API_SECRET}`;

        console.log('准备调用AI API...');

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            console.error('请求超时');
            controller.abort();
        }, 30000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: fullMessages,
                stream: false,
                temperature: 0.7,
                max_tokens: 2048
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI API请求失败:', response.status, errorText);
            return new Response(JSON.stringify({
                error: `API请求失败: ${response.status}`,
                detail: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();
        console.log('AI API响应成功');
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(`代码${toolType} API错误:`, error);
        return new Response(JSON.stringify({
            error: '服务器内部错误',
            detail: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleCodeRunRequest(request, env) {
    try {
        console.log('收到代码运行请求...');
        
        const { code, language } = await request.json();

        if (!code) {
            return new Response(JSON.stringify({ error: 'code参数无效' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        if (!API_KEY || !API_SECRET) {
            return new Response(JSON.stringify({
                error: '配置错误',
                detail: 'API_KEY或API_SECRET未配置'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const prompt = `你是一个代码解释器。请执行以下${language === 'python' ? 'Python' : 'JavaScript'}代码，并给出运行结果。

\`\`\`${language}
${code}
\`\`\`

请按以下格式输出：

## 代码执行结果

### 输出
\`\`\`
[这里输出代码的运行结果，包括所有print/console.log的输出]
\`\`\`

### 执行说明
[简要说明代码的执行过程和结果]

注意：
1. 如果代码有错误，请指出错误并说明原因
2. 如果代码需要输入，请假设合理的输入值
3. 对于循环，请显示最终结果而非每次迭代
4. 对于耗时操作，请估算结果`;

        const fullMessages = [
            { role: 'system', content: '你是一个代码解释器，负责执行代码并返回结果。' },
            { role: 'user', content: prompt }
        ];

        const authHeader = `Bearer ${API_KEY}:${API_SECRET}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: fullMessages,
                stream: false,
                temperature: 0.3,
                max_tokens: 2048
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({
                error: `API请求失败: ${response.status}`,
                detail: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('代码运行 API错误:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误',
            detail: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleCodeConvertRequest(request, env) {
    try {
        console.log('收到代码转换请求...');
        
        const { code, sourceLanguage, targetLanguage } = await request.json();

        if (!code || !sourceLanguage || !targetLanguage) {
            return new Response(JSON.stringify({ error: '参数不完整' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        if (!API_KEY || !API_SECRET) {
            return new Response(JSON.stringify({
                error: '配置错误',
                detail: 'API_KEY或API_SECRET未配置'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const langMap = {
            'javascript': 'JavaScript', 'python': 'Python', 'java': 'Java',
            'cpp': 'C++', 'c': 'C', 'sql': 'SQL', 'go': 'Go', 'rust': 'Rust',
            'typescript': 'TypeScript', 'php': 'PHP', 'vue': 'Vue', 'react': 'React JSX'
        };

        const sourceLabel = langMap[sourceLanguage] || sourceLanguage;
        const targetLabel = langMap[targetLanguage] || targetLanguage;

        const prompt = `请将以下${sourceLabel}代码转换为等效的${targetLabel}代码：

\`\`\`${sourceLanguage}
${code}
\`\`\`

请按以下格式输出：

## 代码转换结果

### 转换后的${targetLabel}代码
\`\`\`${targetLanguage}
[转换后的代码]
\`\`\`

### 转换说明
[说明主要的转换点和注意事项]

### 关键差异
[列出两种语言之间的主要差异和需要注意的地方]

注意：
1. 保持代码功能完全一致
2. 遵循目标语言的最佳实践和惯用写法
3. 如果某些功能在目标语言中没有直接等价物，请提供最接近的替代方案
4. 添加必要的注释说明转换的关键点`;

        const fullMessages = [
            { role: 'system', content: '你是一个代码转换专家，精通多种编程语言，能够准确地将代码从一种语言转换为另一种语言。' },
            { role: 'user', content: prompt }
        ];

        const authHeader = `Bearer ${API_KEY}:${API_SECRET}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: fullMessages,
                stream: false,
                temperature: 0.3,
                max_tokens: 2048
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({
                error: `API请求失败: ${response.status}`,
                detail: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('代码转换 API错误:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误',
            detail: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        if (path === '/api/chat' && request.method === 'POST') {
            return handleChatRequest(request, env);
        }

        if (path === '/api/config' && request.method === 'GET') {
            return handleConfigRequest(env);
        }

        if (path === '/api/code-fix' && request.method === 'POST') {
            return handleCodeRequest(request, env, 'fix');
        }

        if (path === '/api/code-analyze' && request.method === 'POST') {
            return handleCodeRequest(request, env, 'analyze');
        }

        if (path === '/api/code-run' && request.method === 'POST') {
            return handleCodeRunRequest(request, env);
        }

        if (path === '/api/code-convert' && request.method === 'POST') {
            return handleCodeConvertRequest(request, env);
        }

        return env.ASSETS.fetch(request);
    }
};
