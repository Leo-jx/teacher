const DEFAULT_CONFIG = {
    API_URL: 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
    MODEL_ID: 'xop35qwen2b',
    API_KEY: 'a87ffea24723ba51b2817406aa6cdf30',
    API_SECRET: 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw',
    JWT_SECRET: 'xiao-zhi-secret-key-2024-change-in-production'
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

function getConfigValue(env, key) {
    if (env && typeof env === 'object') {
        if (env[key] !== undefined && env[key] !== '') return env[key];
        if (env.SITE && env.SITE[key] !== undefined && env.SITE[key] !== '') return env.SITE[key];
        if (env.CF_PAGES && env.CF_PAGES[key] !== undefined && env.CF_PAGES[key] !== '') return env.CF_PAGES[key];
        if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    }
    return DEFAULT_CONFIG[key];
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + getConfigValue({}, 'JWT_SECRET'));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str) {
    let s = str;
    const pad = s.length % 4;
    if (pad) s += '='.repeat(4 - pad);
    return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

async function createJWT(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signatureData = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureData));
    const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
    return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function verifyJWT(token, secret) {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        const signatureData = `${headerB64}.${payloadB64}`;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const signatureBytes = new Uint8Array(Array.from(base64UrlDecode(signatureB64)).map(c => c.charCodeAt(0)));
        const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(signatureData));
        if (!isValid) return null;
        const payload = JSON.parse(base64UrlDecode(payloadB64));
        if (payload.exp && payload.exp < Date.now() / 1000) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const secret = getConfigValue(env, 'JWT_SECRET');
    const payload = await verifyJWT(token, secret);
    return payload ? { userId: payload.userId, username: payload.username } : null;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
};

async function handleRegister(request, env) {
    try {
        const { username, email, password } = await request.json();
        if (!username || !email || !password) {
            return new Response(JSON.stringify({ error: '请填写所有必填字段' }), { status: 400, headers: corsHeaders });
        }
        if (username.length < 2 || username.length > 20) {
            return new Response(JSON.stringify({ error: '用户名长度需在2-20个字符之间' }), { status: 400, headers: corsHeaders });
        }
        if (password.length < 6) {
            return new Response(JSON.stringify({ error: '密码长度不能少于6个字符' }), { status: 400, headers: corsHeaders });
        }
        const passwordHash = await hashPassword(password);
        if (env.DB) {
            try {
                const result = await env.DB.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').bind(username, email, passwordHash).run();
                if (!result.success) {
                    return new Response(JSON.stringify({ error: '用户名或邮箱已被注册' }), { status: 400, headers: corsHeaders });
                }
                const userId = result.meta.last_row_id;
                const token = await createJWT({ userId, username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
                return new Response(JSON.stringify({ success: true, token, username, userId }), { headers: corsHeaders });
            } catch (dbError) {
                if (dbError.message && dbError.message.includes('UNIQUE')) {
                    return new Response(JSON.stringify({ error: '用户名或邮箱已被注册' }), { status: 400, headers: corsHeaders });
                }
                throw dbError;
            }
        } else {
            const token = await createJWT({ userId: 1, username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username, userId: 1 }), { headers: corsHeaders });
        }
    } catch (error) {
        console.error('注册错误:', error);
        return new Response(JSON.stringify({ error: '注册失败，请稍后重试' }), { status: 500, headers: corsHeaders });
    }
}

async function handleLogin(request, env) {
    try {
        const { username, password } = await request.json();
        if (!username || !password) {
            return new Response(JSON.stringify({ error: '请输入用户名和密码' }), { status: 400, headers: corsHeaders });
        }
        const passwordHash = await hashPassword(password);
        if (env.DB) {
            const result = await env.DB.prepare('SELECT id, username FROM users WHERE (username = ? OR email = ?) AND password_hash = ?').bind(username, username, passwordHash).first();
            if (!result) {
                return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401, headers: corsHeaders });
            }
            await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(result.id).run();
            const token = await createJWT({ userId: result.id, username: result.username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username: result.username, userId: result.id }), { headers: corsHeaders });
        } else {
            const token = await createJWT({ userId: 1, username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username, userId: 1 }), { headers: corsHeaders });
        }
    } catch (error) {
        console.error('登录错误:', error);
        return new Response(JSON.stringify({ error: '登录失败，请稍后重试' }), { status: 500, headers: corsHeaders });
    }
}

async function handleGetMe(request, env, user) {
    return new Response(JSON.stringify({ success: true, userId: user.userId, username: user.username }), { headers: corsHeaders });
}

async function handleGetConversations(request, env, userId) {
    try {
        if (env.DB) {
            const { results } = await env.DB.prepare('SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC').bind(userId).all();
            return new Response(JSON.stringify({ success: true, conversations: results }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, conversations: [] }), { headers: corsHeaders });
    } catch (error) {
        console.error('获取对话列表错误:', error);
        return new Response(JSON.stringify({ error: '获取对话列表失败' }), { status: 500, headers: corsHeaders });
    }
}

async function handleCreateConversation(request, env, userId) {
    try {
        const { title } = await request.json();
        if (env.DB) {
            const result = await env.DB.prepare('INSERT INTO conversations (user_id, title) VALUES (?, ?)').bind(userId, title || '新对话').run();
            const conv = await env.DB.prepare('SELECT id, title, created_at FROM conversations WHERE id = ?').bind(result.meta.last_row_id).first();
            return new Response(JSON.stringify({ success: true, conversation: conv }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, conversation: { id: Date.now(), title: title || '新对话', created_at: new Date().toISOString() } }), { headers: corsHeaders });
    } catch (error) {
        console.error('创建对话错误:', error);
        return new Response(JSON.stringify({ error: '创建对话失败' }), { status: 500, headers: corsHeaders });
    }
}

async function handleGetConversation(request, env, userId, conversationId) {
    try {
        if (env.DB) {
            const conversation = await env.DB.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').bind(conversationId, userId).first();
            if (!conversation) {
                return new Response(JSON.stringify({ error: '对话不存在' }), { status: 404, headers: corsHeaders });
            }
            const { results } = await env.DB.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').bind(conversationId).all();
            return new Response(JSON.stringify({ success: true, conversation, messages: results }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, conversation: { id: conversationId }, messages: [] }), { headers: corsHeaders });
    } catch (error) {
        console.error('获取对话详情错误:', error);
        return new Response(JSON.stringify({ error: '获取对话详情失败' }), { status: 500, headers: corsHeaders });
    }
}

async function handleDeleteConversation(request, env, userId, conversationId) {
    try {
        if (env.DB) {
            await env.DB.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE id = ? AND user_id = ?)').bind(conversationId, userId).run();
            await env.DB.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').bind(conversationId, userId).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } catch (error) {
        console.error('删除对话错误:', error);
        return new Response(JSON.stringify({ error: '删除对话失败' }), { status: 500, headers: corsHeaders });
    }
}

async function handleChatRequest(request, env) {
    try {
        const user = await authenticate(request, env);
        const { messages, conversationId } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'messages参数无效' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        if (!API_KEY || !API_SECRET) {
            const mockResponses = [
                '感谢您的提问！作为您的AI助手小智，我来帮您解答这个问题。',
                '这个问题很有趣！让我来为您详细分析一下。',
                '很好的问题！让我为您提供专业的技术解答。'
            ];
            const aiContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
            return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: aiContent } }] }), { headers: corsHeaders });
        }

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        const authHeader = `Bearer ${API_KEY}:${API_SECRET}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        let response;
        try {
            response = await fetch(API_URL, {
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
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('网络请求失败:', fetchError.message);
            const mockResponses = [
                '感谢您的提问！作为您的AI助手小智，我来帮您解答这个问题。',
                '这个问题很有趣！让我来为您详细分析一下。',
                '很好的问题！让我为您提供专业的技术解答。'
            ];
            const aiContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
            return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: aiContent } }] }), { headers: corsHeaders });
        }

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI API请求失败:', response.status, errorText);
            const mockResponses = [
                '感谢您的提问！作为您的AI助手小智，我来帮您解答这个问题。',
                '这个问题很有趣！让我来为您详细分析一下。',
                '很好的问题！让我为您提供专业的技术解答。'
            ];
            const aiContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
            return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: aiContent } }] }), { headers: corsHeaders });
        }

        const data = await response.json();

        if (env.DB && user && conversationId) {
            try {
                const lastUserMsg = messages.filter(m => m.role === 'user').pop();
                if (lastUserMsg) {
                    await env.DB.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').bind(conversationId, 'user', lastUserMsg.content).run();
                }
                const aiContent = data.choices?.[0]?.message?.content || '';
                if (aiContent) {
                    await env.DB.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').bind(conversationId, 'assistant', aiContent).run();
                    await env.DB.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(conversationId).run();
                }
            } catch (dbError) {
                console.error('保存消息到数据库失败:', dbError);
            }
        }

        return new Response(JSON.stringify(data), { headers: corsHeaders });
    } catch (error) {
        console.error('Chat API错误:', error);
        return new Response(JSON.stringify({ error: '服务器内部错误', detail: error.message }), { status: 500, headers: corsHeaders });
    }
}

async function handleConfigRequest(env) {
    return new Response(JSON.stringify({
        success: true,
        config: {
            websocket: { available: false, message: '当前平台不支持WebSocket，请使用HTTP模式' },
            database: { available: !!env.DB }
        }
    }), { headers: corsHeaders });
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
                    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            });
        }

        if (path === '/api/auth/register' && request.method === 'POST') {
            return handleRegister(request, env);
        }

        if (path === '/api/auth/login' && request.method === 'POST') {
            return handleLogin(request, env);
        }

        if (path === '/api/auth/me' && request.method === 'GET') {
            const user = await authenticate(request, env);
            if (!user) return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            return handleGetMe(request, env, user);
        }

        if (path === '/api/conversations' && request.method === 'GET') {
            const user = await authenticate(request, env);
            if (!user) return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            return handleGetConversations(request, env, user.userId);
        }

        if (path === '/api/conversations' && request.method === 'POST') {
            const user = await authenticate(request, env);
            if (!user) return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            return handleCreateConversation(request, env, user.userId);
        }

        const conversationMatch = path.match(/^\/api\/conversations\/(\d+)$/);
        if (conversationMatch) {
            const user = await authenticate(request, env);
            if (!user) return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            const conversationId = conversationMatch[1];
            if (request.method === 'GET') return handleGetConversation(request, env, user.userId, conversationId);
            if (request.method === 'DELETE') return handleDeleteConversation(request, env, user.userId, conversationId);
        }

        if (path === '/api/chat' && request.method === 'POST') {
            return handleChatRequest(request, env);
        }

        if (path === '/api/config' && request.method === 'GET') {
            return handleConfigRequest(env);
        }

        return env.ASSETS.fetch(request);
    }
};
