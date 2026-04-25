const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CONFIG = {
    httpApi: {
        url: process.env.API_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
        modelId: process.env.MODEL_ID || 'xop35qwen2b',
        apiKey: process.env.API_KEY || 'a87ffea24723ba51b2817406aa6cdf30',
        apiSecret: process.env.API_SECRET || 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
    },
    wsApi: {
        url: process.env.WS_URL || 'wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/ch',
        appId: process.env.APP_ID || 'f3f40af8',
        apiKey: process.env.API_KEY || 'a87ffea24723ba51b2817406aa6cdf30',
        apiSecret: process.env.API_SECRET || 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
    },
    embeddingApi: {
        url: process.env.EMBEDDING_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2/embeddings',
        apiKey: process.env.API_KEY || 'a87ffea24723ba51b2817406aa6cdf30',
        apiSecret: process.env.API_SECRET || 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
    }
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
- 备份与恢复策略
- 用户权限与安全管理

### 2. Java编程语言及相关框架
- Java基础语法、面向对象编程、集合框架
- Java并发编程（线程、线程池、锁、CAS）
- JVM原理、内存模型、GC调优
- Spring Framework（IoC、AOP、事务管理）
- Spring Boot自动配置与微服务开发
- Spring Security安全框架
- MyBatis/MyBatis-Plus持久层框架
- Maven/Gradle构建工具

### 3. Python编程及数据分析
- Python基础语法、数据类型、函数与装饰器
- 面向对象编程与设计模式
- NumPy/Pandas数据处理与分析
- Matplotlib/Seaborn数据可视化
- Flask/Django Web开发框架
- 爬虫开发（Scrapy、BeautifulSoup）
- 自动化脚本与工具开发

### 4. C语言基础与系统开发
- C语言基础语法、指针与内存管理
- 结构体、联合体、枚举
- 文件I/O操作与系统调用
- 多进程/多线程编程（POSIX）
- 网络编程（Socket）
- 数据结构与算法实现
- 编译原理与Makefile

### 5. C++面向对象编程与高性能应用
- C++基础与面向对象编程
- STL标准模板库（容器、算法、迭代器）
- 智能指针与内存管理
- 模板编程与泛型设计
- 多线程与并发编程
- 网络编程与高性能服务器开发
- C++11/14/17/20新特性

### 6. 微信小程序开发
- 小程序框架与生命周期
- WXML/WXSS/JS页面开发
- 组件开发与自定义组件
- API调用（网络请求、存储、位置等）
- 云开发（云函数、云数据库、云存储）
- 小程序登录与支付集成
- 性能优化与发布上线

### 7. uni-app跨平台应用开发
- uni-app框架与Vue语法
- 跨平台适配（H5、小程序、App）
- 组件与API使用
- 状态管理（Vuex/Pinia）
- 原生插件开发与集成
- 打包与发布流程

### 8. Coze AI助手开发
- Coze平台基础与Bot创建
- 提示词工程与Prompt设计
- 插件开发与集成
- 知识库配置与RAG
- 工作流编排
- API调用与集成部署

### 9. Vue前端框架应用
- Vue2/Vue3核心语法与响应式原理
- 组件化开发与通信
- Vue Router路由管理
- Vuex/Pinia状态管理
- Composition API与组合式函数
- Element UI/Ant Design Vue组件库
- Vite构建工具与项目优化

### 10. Spring后端框架及生态系统
- Spring IoC容器与依赖注入
- Spring AOP面向切面编程
- Spring MVC请求处理与RESTful API
- Spring Boot自动配置与Starter
- Spring Cloud微服务架构
- Spring Security认证授权
- Spring Data JPA数据访问
- Spring Batch批处理

## 回答原则

1. **专业准确**：提供准确、权威的技术解答，确保代码示例可直接运行
2. **代码示例**：使用markdown代码块格式，标注正确的语言类型（java/python/cpp/sql/javascript/vue等）
3. **由浅入深**：从基础概念讲起，逐步深入到高级应用
4. **最佳实践**：指出常见陷阱、性能瓶颈，给出行业最佳实践建议
5. **问题排查**：提供系统性的问题定位思路和解决方案
6. **对比分析**：对同类技术/方案进行客观对比，帮助用户做出合理选择

## 边界约束

- 只回答上述10个技术领域相关的编程与技术问题
- 如果用户问的问题与上述领域无关，请礼貌地告知你只能回答编程技术相关问题，并引导用户提出技术问题
- 对于模糊的问题，主动追问以明确需求后再给出精准解答`;

function getAuthHeader() {
    const key = CONFIG.httpApi.apiKey;
    const secret = CONFIG.httpApi.apiSecret;
    return `Bearer ${key}:${secret}`;
}

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, stream = false } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages参数无效' });
        }

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        const requestBody = {
            model: CONFIG.httpApi.modelId,
            messages: fullMessages,
            stream: stream,
            temperature: 0.7,
            max_tokens: 2048
        };

        const response = await fetch(CONFIG.httpApi.url, {
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

            req.on('close', () => {
                response.body.destroy();
            });
        } else {
            const data = await response.json();
            res.json(data);
        }
    } catch (error) {
        console.error('Chat API错误:', error);
        res.status(500).json({ error: '服务器内部错误', detail: error.message });
    }
});

app.post('/api/embeddings', async (req, res) => {
    try {
        const { input } = req.body;

        if (!input) {
            return res.status(400).json({ error: 'input参数无效' });
        }

        const texts = Array.isArray(input) ? input : [input];

        const requestBody = {
            model: CONFIG.httpApi.modelId,
            input: texts
        };

        const response = await fetch(CONFIG.embeddingApi.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Embedding API请求失败:', response.status);
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
});

function generateWsUrl() {
    const apiKey = CONFIG.wsApi.apiKey;
    const apiSecret = CONFIG.wsApi.apiSecret;
    const url = new URL(CONFIG.wsApi.url);
    const host = url.hostname;
    const path = url.pathname;
    const date = new Date().toUTCString();

    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const signature = crypto.createHmac('sha256', apiSecret)
        .update(signatureOrigin)
        .digest('base64');
    const authorization = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;

    const params = new URLSearchParams({
        authorization: Buffer.from(authorization).toString('base64'),
        date: date,
        host: host
    });

    return `${CONFIG.wsApi.url}?${params.toString()}`;
}

const wss = new WebSocket.Server({ server, path: '/ws/chat' });

wss.on('connection', (ws) => {
    console.log('客户端WebSocket已连接');
    let maasWs = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'chat') {
                const { messages } = message;

                const fullMessages = [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...messages
                ];

                const wsUrl = generateWsUrl();

                maasWs = new WebSocket(wsUrl);

                maasWs.on('open', () => {
                    const requestPayload = {
                        header: {
                            app_id: CONFIG.wsApi.appId,
                            uid: 'user_' + Date.now()
                        },
                        parameter: {
                            chat: {
                                domain: CONFIG.httpApi.modelId,
                                temperature: 0.7,
                                max_tokens: 2048
                            }
                        },
                        payload: {
                            message: {
                                text: fullMessages
                            }
                        }
                    };

                    maasWs.send(JSON.stringify(requestPayload));
                });

                maasWs.on('message', (event) => {
                    try {
                        const response = JSON.parse(event);
                        ws.send(JSON.stringify({
                            type: 'chunk',
                            data: response
                        }));

                        if (response.header && response.header.code !== 0) {
                            console.error('MaaS WebSocket错误:', response.header.message);
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: response.header.message || '模型服务错误'
                            }));
                        }

                        if (response.header && response.header.status === 2) {
                            ws.send(JSON.stringify({ type: 'done' }));
                            maasWs.close();
                        }
                    } catch (e) {
                        console.error('解析MaaS响应失败:', e);
                    }
                });

                maasWs.on('error', (error) => {
                    console.error('MaaS WebSocket连接错误:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '模型服务连接失败'
                    }));
                });

                maasWs.on('close', () => {
                    maasWs = null;
                });
            }
        } catch (e) {
            console.error('处理客户端消息失败:', e);
            ws.send(JSON.stringify({
                type: 'error',
                message: '消息处理失败'
            }));
        }
    });

    ws.on('close', () => {
        console.log('客户端WebSocket已断开');
        if (maasWs) {
            maasWs.close();
            maasWs = null;
        }
    });
});

app.post('/api/test/http', async (req, res) => {
    try {
        const startTime = Date.now();
        const requestBody = {
            model: CONFIG.httpApi.modelId,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: '你好，请简单介绍一下MySQL' }
            ],
            stream: false,
            temperature: 0.7,
            max_tokens: 100
        };

        const response = await fetch(CONFIG.httpApi.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
            },
            body: JSON.stringify(requestBody)
        });

        const endTime = Date.now();
        const data = await response.json();

        res.json({
            success: response.ok,
            statusCode: response.status,
            responseTime: endTime - startTime,
            data: data
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/test/embedding', async (req, res) => {
    try {
        const startTime = Date.now();
        const requestBody = {
            model: CONFIG.httpApi.modelId,
            input: ['MySQL数据库索引优化']
        };

        const response = await fetch(CONFIG.embeddingApi.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
            },
            body: JSON.stringify(requestBody)
        });

        const endTime = Date.now();
        const data = await response.json();

        res.json({
            success: response.ok,
            statusCode: response.status,
            responseTime: endTime - startTime,
            note: response.ok ? '' : '当前模型可能不支持Embedding，核心对话功能正常',
            data: data
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            note: 'Embedding服务暂时不可用，核心对话功能正常'
        });
    }
});

app.get('/api/test/ws', (req, res) => {
    try {
        const wsUrl = generateWsUrl();
        res.json({
            success: true,
            wsUrl: wsUrl.substring(0, 50) + '...',
            message: 'WebSocket URL已生成，请通过WebSocket客户端测试'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        httpApi: {
            url: CONFIG.httpApi.url,
            modelId: CONFIG.httpApi.modelId,
            configured: !!(CONFIG.httpApi.apiKey && CONFIG.httpApi.apiSecret)
        },
        wsApi: {
            url: CONFIG.wsApi.url,
            appId: CONFIG.wsApi.appId,
            configured: !!(CONFIG.wsApi.apiKey && CONFIG.wsApi.apiSecret)
        },
        embeddingApi: {
            url: CONFIG.embeddingApi.url,
            configured: !!(CONFIG.embeddingApi.apiKey && CONFIG.embeddingApi.apiSecret)
        }
    });
});

server.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`  程序员AI辅助助手服务已启动`);
    console.log(`  环境: ${NODE_ENV}`);
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}/ws/chat`);
    console.log(`=================================`);
});
