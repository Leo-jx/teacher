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
        
        const { messages, stream = true } = await request.json();

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
                stream: true,
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

        // 流式响应处理
        if (stream && response.body) {
            console.log('开始流式响应');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            
                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split('\n');
                            
                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (trimmed.startsWith('data: ')) {
                                    const jsonStr = trimmed.slice(6);
                                    if (jsonStr === '[DONE]') continue;
                                    try {
                                        const json = JSON.parse(jsonStr);
                                        if (json.choices && json.choices[0] && json.choices[0].delta) {
                                            const content = json.choices[0].delta.content || '';
                                            if (content) {
                                                controller.enqueue(content);
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('解析JSON失败:', e);
                                    }
                                }
                            }
                        }
                        controller.close();
                    } catch (error) {
                        console.error('流式响应错误:', error);
                        controller.error(error);
                    }
                }
            });
            
            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Transfer-Encoding': 'chunked'
                }
            });
        } else {
            // 非流式响应（备用）
            const data = await response.json();
            console.log('AI API响应成功');
            return new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Chat API错误:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误',
            detail: error.message
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

        // 对于其他请求，返回静态文件
        return env.ASSETS.fetch(request);
    }
};
