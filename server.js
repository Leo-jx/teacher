const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const fetch = require('node-fetch');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('数据库连接成功');
        initDatabase();
    }
});

function initDatabase() {
    const schema = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    sync_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    ip_address TEXT,
    user_agent TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_trusted INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, device_id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_version INTEGER DEFAULT 1,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    sync_type TEXT NOT NULL,
    last_sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, device_id, sync_type)
);

CREATE TABLE IF NOT EXISTS user_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id TEXT,
    activity_type TEXT NOT NULL,
    activity_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
`;
    
    db.exec(schema, (err) => {
        if (err) {
            console.error('数据库初始化失败:', err.message);
        } else {
            console.log('数据库表初始化成功');
        }
    });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '令牌无效或已过期' });
        }
        req.user = user;
        next();
    });
}

function generateDeviceId(req) {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    return crypto.createHash('sha256').update(userAgent + ip + Date.now()).digest('hex').substring(0, 32);
}

function parseUserAgent(userAgent) {
    const result = { browser: 'Unknown', os: 'Unknown', deviceType: 'Desktop' };
    
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
        result.deviceType = 'Mobile';
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
        result.deviceType = 'Tablet';
    }
    
    if (userAgent.includes('Windows')) result.os = 'Windows';
    else if (userAgent.includes('Mac')) result.os = 'macOS';
    else if (userAgent.includes('Linux')) result.os = 'Linux';
    else if (userAgent.includes('Android')) result.os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) result.os = 'iOS';
    
    if (userAgent.includes('Chrome')) result.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) result.browser = 'Firefox';
    else if (userAgent.includes('Safari')) result.browser = 'Safari';
    else if (userAgent.includes('Edge')) result.browser = 'Edge';
    
    return result;
}

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

const SYSTEM_PROMPT = `你是"程序员AI辅助助手小智"，一位全栈技术专家，专门为程序员提供编程与技术问题的专业解答。你的名字叫"小智"，在回答问题时可以自称"小智"。你的核心职责是回答以下技术领域的问题：

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

app.post('/api/code/fix', async (req, res) => {
    try {
        const { code, language } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'code参数无效' });
        }

        const fullMessages = [
            { role: 'system', content: CODE_FIX_PROMPT },
            { role: 'user', content: `请对以下${language || ''}代码进行纠错分析：\n\n\`\`\`${language || ''}\n${code}\n\`\`\`` }
        ];

        const requestBody = {
            model: CONFIG.httpApi.modelId,
            messages: fullMessages,
            stream: false,
            temperature: 0.3,
            max_tokens: 4096
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
            console.error('代码纠错API请求失败:', response.status, errorText);
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
});

app.post('/api/code/analyze', async (req, res) => {
    try {
        const { code, language } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'code参数无效' });
        }

        const fullMessages = [
            { role: 'system', content: CODE_ANALYSIS_PROMPT },
            { role: 'user', content: `请对以下${language || ''}代码进行深入分析：\n\n\`\`\`${language || ''}\n${code}\n\`\`\`` }
        ];

        const requestBody = {
            model: CONFIG.httpApi.modelId,
            messages: fullMessages,
            stream: false,
            temperature: 0.3,
            max_tokens: 4096
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
            console.error('代码分析API请求失败:', response.status, errorText);
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
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }
        
        if (username.length < 2 || username.length > 20) {
            return res.status(400).json({ error: '用户名长度应为2-20个字符' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少6个字符' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: '用户名或邮箱已被注册' });
                    }
                    return res.status(500).json({ error: '注册失败' });
                }
                
                const token = jwt.sign(
                    { id: this.lastID, username, email },
                    JWT_SECRET,
                    { expiresIn: '30d' }
                );
                
                res.json({ 
                    success: true, 
                    token,
                    user: { id: this.lastID, username, email }
                });
            }
        );
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '请填写用户名和密码' });
        }
        
        db.get(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: '登录失败' });
                }
                
                if (!user) {
                    return res.status(401).json({ error: '用户名或密码错误' });
                }
                
                const validPassword = await bcrypt.compare(password, user.password_hash);
                
                if (!validPassword) {
                    return res.status(401).json({ error: '用户名或密码错误' });
                }
                
                db.run(
                    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [user.id]
                );
                
                const token = jwt.sign(
                    { id: user.id, username: user.username, email: user.email },
                    JWT_SECRET,
                    { expiresIn: '30d' }
                );
                
                res.json({
                    success: true,
                    token,
                    user: { id: user.id, username: user.username, email: user.email }
                });
            }
        );
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        success: true, 
        user: req.user 
    });
});

app.post('/api/devices/register', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    const deviceInfo = parseUserAgent(userAgent);
    const deviceId = req.body.deviceId || generateDeviceId(req);
    
    db.run(
        `INSERT OR REPLACE INTO devices 
        (user_id, device_id, device_name, device_type, os, browser, ip_address, user_agent, last_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, deviceId, req.body.deviceName || deviceInfo.deviceType, deviceInfo.deviceType, deviceInfo.os, deviceInfo.browser, ip, userAgent],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '设备注册失败' });
            }
            res.json({ success: true, deviceId });
        }
    );
});

app.get('/api/devices', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM devices WHERE user_id = ? ORDER BY last_active DESC',
        [req.user.id],
        (err, devices) => {
            if (err) {
                return res.status(500).json({ error: '获取设备列表失败' });
            }
            res.json({ success: true, devices });
        }
    );
});

app.delete('/api/devices/:deviceId', authenticateToken, (req, res) => {
    db.run(
        'DELETE FROM devices WHERE user_id = ? AND device_id = ?',
        [req.user.id, req.params.deviceId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '删除设备失败' });
            }
            res.json({ success: true });
        }
    );
});

app.post('/api/conversations', authenticateToken, (req, res) => {
    const { title } = req.body;
    const userId = req.user.id;
    
    db.run(
        'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
        [userId, title || '新对话'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '创建对话失败' });
            }
            res.json({ 
                success: true, 
                conversationId: this.lastID 
            });
        }
    );
});

app.get('/api/conversations', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM conversations WHERE user_id = ? AND is_deleted = 0 ORDER BY updated_at DESC',
        [req.user.id],
        (err, conversations) => {
            if (err) {
                return res.status(500).json({ error: '获取对话列表失败' });
            }
            res.json({ success: true, conversations });
        }
    );
});

app.get('/api/conversations/:id', authenticateToken, (req, res) => {
    db.get(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ? AND is_deleted = 0',
        [req.params.id, req.user.id],
        (err, conversation) => {
            if (err) {
                return res.status(500).json({ error: '获取对话失败' });
            }
            if (!conversation) {
                return res.status(404).json({ error: '对话不存在' });
            }
            
            db.all(
                'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
                [req.params.id],
                (err, messages) => {
                    if (err) {
                        return res.status(500).json({ error: '获取消息失败' });
                    }
                    res.json({ success: true, conversation, messages });
                }
            );
        }
    );
});

app.delete('/api/conversations/:id', authenticateToken, (req, res) => {
    db.run(
        'UPDATE conversations SET is_deleted = 1 WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '删除对话失败' });
            }
            res.json({ success: true });
        }
    );
});

app.post('/api/messages', authenticateToken, (req, res) => {
    const { conversationId, role, content } = req.body;
    
    db.get(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [conversationId, req.user.id],
        (err, conversation) => {
            if (err || !conversation) {
                return res.status(404).json({ error: '对话不存在' });
            }
            
            db.run(
                'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
                [conversationId, role, content],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: '保存消息失败' });
                    }
                    
                    db.run(
                        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, sync_version = sync_version + 1 WHERE id = ?',
                        [conversationId]
                    );
                    
                    res.json({ success: true, messageId: this.lastID });
                }
            );
        }
    );
});

app.post('/api/sync', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const deviceId = req.body.deviceId || generateDeviceId(req);
    const lastSyncTime = req.body.lastSyncTime || '1970-01-01 00:00:00';
    
    db.serialize(() => {
        db.run(
            `INSERT OR REPLACE INTO sync_logs (user_id, device_id, sync_type, last_sync_at, sync_count)
            VALUES (?, ?, 'full', CURRENT_TIMESTAMP, COALESCE((SELECT sync_count FROM sync_logs WHERE user_id = ? AND device_id = ? AND sync_type = 'full'), 0) + 1)`,
            [userId, deviceId, userId, deviceId]
        );
        
        db.all(
            'SELECT * FROM conversations WHERE user_id = ? AND updated_at > ? AND is_deleted = 0 ORDER BY updated_at DESC',
            [userId, lastSyncTime],
            (err, conversations) => {
                if (err) {
                    return res.status(500).json({ error: '同步失败' });
                }
                
                if (conversations.length === 0) {
                    return res.json({ 
                        success: true, 
                        conversations: [],
                        syncTime: new Date().toISOString()
                    });
                }
                
                const conversationIds = conversations.map(c => c.id);
                const placeholders = conversationIds.map(() => '?').join(',');
                
                db.all(
                    `SELECT * FROM messages WHERE conversation_id IN (${placeholders}) ORDER BY created_at ASC`,
                    conversationIds,
                    (err, messages) => {
                        if (err) {
                            return res.status(500).json({ error: '同步失败' });
                        }
                        
                        const messagesByConversation = {};
                        messages.forEach(msg => {
                            if (!messagesByConversation[msg.conversation_id]) {
                                messagesByConversation[msg.conversation_id] = [];
                            }
                            messagesByConversation[msg.conversation_id].push(msg);
                        });
                        
                        const conversationsWithMessages = conversations.map(conv => ({
                            ...conv,
                            messages: messagesByConversation[conv.id] || []
                        }));
                        
                        res.json({
                            success: true,
                            conversations: conversationsWithMessages,
                            syncTime: new Date().toISOString()
                        });
                    }
                );
            }
        );
    });
});

app.post('/api/sync/upload', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const deviceId = req.body.deviceId || generateDeviceId(req);
    const conversations = req.body.conversations || [];
    
    db.serialize(() => {
        conversations.forEach(conv => {
            db.get(
                'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
                [conv.id, userId],
                (err, existingConv) => {
                    if (err) return;
                    
                    if (!existingConv) {
                        db.run(
                            'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                            [conv.id, userId, conv.title, conv.created_at, conv.updated_at]
                        );
                    } else if (new Date(conv.updated_at) > new Date(existingConv.updated_at)) {
                        db.run(
                            'UPDATE conversations SET title = ?, updated_at = ?, sync_version = sync_version + 1 WHERE id = ?',
                            [conv.title, conv.updated_at, conv.id]
                        );
                    }
                    
                    if (conv.messages) {
                        conv.messages.forEach(msg => {
                            db.get(
                                'SELECT * FROM messages WHERE id = ?',
                                [msg.id],
                                (err, existingMsg) => {
                                    if (err) return;
                                    
                                    if (!existingMsg) {
                                        db.run(
                                            'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
                                            [msg.id, msg.conversation_id, msg.role, msg.content, msg.created_at]
                                        );
                                    }
                                }
                            );
                        });
                    }
                }
            );
        });
        
        db.run(
            `INSERT OR REPLACE INTO sync_logs (user_id, device_id, sync_type, last_sync_at, sync_count)
            VALUES (?, ?, 'upload', CURRENT_TIMESTAMP, COALESCE((SELECT sync_count FROM sync_logs WHERE user_id = ? AND device_id = ? AND sync_type = 'upload'), 0) + 1)`,
            [userId, deviceId, userId, deviceId]
        );
        
        res.json({ success: true, message: '数据上传成功' });
    });
});

app.post('/api/activities', authenticateToken, (req, res) => {
    const { activityType, activityData, deviceId } = req.body;
    
    db.run(
        'INSERT INTO user_activities (user_id, device_id, activity_type, activity_data) VALUES (?, ?, ?, ?)',
        [req.user.id, deviceId || generateDeviceId(req), activityType, JSON.stringify(activityData)],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '记录活动失败' });
            }
            res.json({ success: true });
        }
    );
});

app.get('/api/activities', authenticateToken, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    db.all(
        'SELECT * FROM user_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [req.user.id, limit, offset],
        (err, activities) => {
            if (err) {
                return res.status(500).json({ error: '获取活动记录失败' });
            }
            res.json({ success: true, activities });
        }
    );
});

server.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`  程序员AI辅助助手服务已启动`);
    console.log(`  环境: ${NODE_ENV}`);
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}/ws/chat`);
    console.log(`=================================`);
});
