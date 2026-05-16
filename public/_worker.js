const DEFAULT_CONFIG = {
    API_URL: 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
    MODEL_ID: 'xop35qwen2b',
    API_KEY: 'a87ffea24723ba51b2817406aa6cdf30',
    API_SECRET: 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw',
    JWT_SECRET: 'xiao-zhi-secret-key-2024-change-in-production-change-very-long-key'
};

const SYSTEM_PROMPT = `你是"程序员AI辅助助手小智"，一位全栈技术专家。你的名字叫"小智"。

支持领域：MySQL、Java/Spring、Python、C/C++、微信小程序、uni-app、Vue、Coze AI。

回答原则：专业准确、提供代码示例（markdown格式）、由浅入深、给出最佳实践。

边界：只回答编程技术问题，非技术问题请礼貌拒绝。`;

function getConfigValue(env, key) {
    if (env && typeof env === 'object') {
        if (env[key] !== undefined && env[key] !== '') return env[key];
        if (env.SITE && env.SITE[key] !== undefined && env.SITE[key] !== '') return env.SITE[key];
        if (env.CF_PAGES && env.CF_PAGES[key] !== undefined && env.CF_PAGES[key] !== '') return env.CF_PAGES[key];
        if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    }
    return DEFAULT_CONFIG[key];
}

async function generateSalt() {
    const saltBuffer = new Uint8Array(16);
    crypto.getRandomValues(saltBuffer);
    return Array.from(saltBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

const MAX_CONTINUATION_ROUNDS = 3;

async function fetchAIWithContinuation(API_URL, API_KEY, API_SECRET, MODEL_ID, messages, maxTokens, temperature, abortSignal) {
    const authHeader = `Bearer ${API_KEY}:${API_SECRET}`;
    let fullContent = '';
    let currentMessages = [...messages];
    let rounds = 0;

    while (rounds <= MAX_CONTINUATION_ROUNDS) {
        const body = {
            model: MODEL_ID,
            messages: currentMessages,
            stream: false,
            temperature: temperature,
            max_tokens: maxTokens
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(body),
            signal: abortSignal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        if (!choice) break;

        const chunk = choice.message?.content || '';
        fullContent += chunk;

        const finishReason = choice.finish_reason;
        if (finishReason !== 'length') break;

        rounds++;
        currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: chunk },
            { role: 'user', content: '请继续' }
        ];
    }

    return fullContent;
}

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return salt + ':' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === hash;
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

function isValidUsername(username) {
    const regex = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;
    return regex.test(username);
}

function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().substring(0, 200);
}

async function handleRegister(request, env) {
    try {
        const { username, email, password } = await request.json();
        
        if (!username || !email || !password) {
            return new Response(JSON.stringify({ error: '请填写所有必填字段' }), { status: 400, headers: corsHeaders });
        }
        
        const cleanUsername = sanitizeInput(username);
        const cleanEmail = sanitizeInput(email);
        
        if (!isValidUsername(cleanUsername)) {
            return new Response(JSON.stringify({ error: '用户名长度需在2-20个字符之间，只能包含字母、数字、下划线和中文' }), { status: 400, headers: corsHeaders });
        }
        
        if (!isValidEmail(cleanEmail)) {
            return new Response(JSON.stringify({ error: '请输入有效的邮箱地址' }), { status: 400, headers: corsHeaders });
        }
        
        if (password.length < 8) {
            return new Response(JSON.stringify({ error: '密码长度不能少于8个字符' }), { status: 400, headers: corsHeaders });
        }
        
        const salt = await generateSalt();
        const passwordHash = await hashPassword(password, salt);
        
        if (env.DB) {
            try {
                const result = await env.DB.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').bind(cleanUsername, cleanEmail, passwordHash).run();
                if (!result.success) {
                    return new Response(JSON.stringify({ error: '用户名或邮箱已被注册' }), { status: 400, headers: corsHeaders });
                }
                const userId = result.meta.last_row_id;
                const token = await createJWT({ userId, username: cleanUsername, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
                return new Response(JSON.stringify({ success: true, token, username: cleanUsername, userId }), { headers: corsHeaders });
            } catch (dbError) {
                if (dbError.message && dbError.message.includes('UNIQUE')) {
                    return new Response(JSON.stringify({ error: '用户名或邮箱已被注册' }), { status: 400, headers: corsHeaders });
                }
                throw dbError;
            }
        } else {
            const token = await createJWT({ userId: 1, username: cleanUsername, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username: cleanUsername, userId: 1 }), { headers: corsHeaders });
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
        
        const cleanUsername = sanitizeInput(username);
        
        if (env.DB) {
            const result = await env.DB.prepare('SELECT id, username, password_hash FROM users WHERE username = ? OR email = ?').bind(cleanUsername, cleanUsername).first();
            
            if (!result) {
                return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401, headers: corsHeaders });
            }
            
            const isValid = await verifyPassword(password, result.password_hash);
            if (!isValid) {
                return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401, headers: corsHeaders });
            }
            
            await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(result.id).run();
            const token = await createJWT({ userId: result.id, username: result.username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username: result.username, userId: result.id }), { headers: corsHeaders });
        } else {
            const token = await createJWT({ userId: 1, username: cleanUsername, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username: cleanUsername, userId: 1 }), { headers: corsHeaders });
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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        let aiContent;
        try {
            aiContent = await fetchAIWithContinuation(
                API_URL, API_KEY, API_SECRET, MODEL_ID,
                fullMessages, 4096, 0.7, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('网络请求失败:', fetchError.message);
            const mockResponses = [
                '感谢您的提问！作为您的AI助手小智，我来帮您解答这个问题。',
                '这个问题很有趣！让我来为您详细分析一下。',
                '很好的问题！让我为您提供专业的技术解答。'
            ];
            aiContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
        }

        clearTimeout(timeout);

        if (env.DB && user && conversationId) {
            try {
                const lastUserMsg = messages.filter(m => m.role === 'user').pop();
                if (lastUserMsg) {
                    await env.DB.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').bind(conversationId, 'user', lastUserMsg.content).run();
                }
                if (aiContent) {
                    await env.DB.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').bind(conversationId, 'assistant', aiContent).run();
                    await env.DB.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(conversationId).run();
                }
            } catch (dbError) {
                console.error('保存消息到数据库失败:', dbError);
            }
        }

        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: aiContent } }] }), { headers: corsHeaders });
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

async function handleAnalyzeRequest(request, env) {
    try {
        const { code, language, type } = await request.json();

        if (!code) {
            return new Response(JSON.stringify({ error: 'code参数无效' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        const prompt = type === 'fix' ? CODE_FIX_PROMPT : CODE_ANALYSIS_PROMPT;
        const actionText = type === 'fix' ? '纠错分析' : '深入分析';

        const fullMessages = [
            { role: 'system', content: prompt },
            { role: 'user', content: `请对以下${language || ''}代码进行${actionText}：\n\n\`\`\`${language || ''}\n${code}\n\`\`\`` }
        ];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        let content;
        try {
            content = await fetchAIWithContinuation(
                API_URL, API_KEY, API_SECRET, MODEL_ID,
                fullMessages, 4096, 0.3, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('代码分析API请求失败:', fetchError);
            return new Response(JSON.stringify({ error: '请求超时或网络异常，请稍后重试' }), { status: 504, headers: corsHeaders });
        }
        clearTimeout(timeout);

        return new Response(JSON.stringify({ content }), { headers: corsHeaders });
    } catch (error) {
        console.error('代码分析API错误:', error);
        return new Response(JSON.stringify({ error: '服务器内部错误' }), { status: 500, headers: corsHeaders });
    }
}

async function handleLearnRequest(request, env) {
    try {
        const { language, keyword, type, algorithmType, name } = await request.json();

        if (type === 'syntax' && (!language || !keyword)) {
            return new Response(JSON.stringify({ error: '请提供语言和关键词参数' }), { status: 400, headers: corsHeaders });
        }
        if (type === 'algorithm' && !name) {
            return new Response(JSON.stringify({ error: '请提供算法名称参数' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        let prompt = '';
        let userContent = '';

        if (type === 'syntax') {
            prompt = `你是一位编程语言专家，擅长用通俗易懂的方式讲解编程语法。`;
            userContent = `请详细讲解${language}语言中的"${keyword}"语法，包括用法、示例和最佳实践。`;
        } else if (type === 'algorithm') {
            prompt = `你是一位算法专家，擅长深入浅出地讲解各种算法。`;
            userContent = `请详细讲解"${name}"算法，包括原理、实现步骤、时间复杂度分析和代码示例。`;
        } else {
            return new Response(JSON.stringify({ error: '无效的type参数' }), { status: 400, headers: corsHeaders });
        }

        const fullMessages = [
            { role: 'system', content: prompt },
            { role: 'user', content: userContent }
        ];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        let content;
        try {
            content = await fetchAIWithContinuation(
                API_URL, API_KEY, API_SECRET, MODEL_ID,
                fullMessages, 4096, 0.7, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('学习API请求失败:', fetchError);
            return new Response(JSON.stringify({ error: '请求超时或网络异常，请稍后重试' }), { status: 504, headers: corsHeaders });
        }
        clearTimeout(timeout);

        return new Response(JSON.stringify({ content }), { headers: corsHeaders });
    } catch (error) {
        console.error('学习API错误:', error);
        return new Response(JSON.stringify({ error: '服务器内部错误' }), { status: 500, headers: corsHeaders });
    }
}

async function handleDecodeErrorRequest(request, env) {
    try {
        const { error, language } = await request.json();

        if (!error) {
            return new Response(JSON.stringify({ error: 'error参数无效' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        const prompt = `你是一位资深的错误诊断专家。用户会提供一段错误信息，你需要对其进行详细解读。

请严格按照以下格式输出：

## 错误解读报告

### 1. 错误类型
说明这是什么类型的错误（语法错误、运行时错误、逻辑错误等）

### 2. 错误原因
详细解释产生这个错误的根本原因

### 3. 可能的解决方案
列出多种可能的解决方案，并说明每种方案的适用场景

### 4. 预防措施
说明如何避免类似错误的发生`;

        const fullMessages = [
            { role: 'system', content: prompt },
            { role: 'user', content: `请帮我解读这个${language || ''}错误：\n\n${error}` }
        ];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        let content;
        try {
            content = await fetchAIWithContinuation(
                API_URL, API_KEY, API_SECRET, MODEL_ID,
                fullMessages, 4096, 0.3, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('错误解码API请求失败:', fetchError);
            return new Response(JSON.stringify({ error: '请求超时或网络异常，请稍后重试' }), { status: 504, headers: corsHeaders });
        }
        clearTimeout(timeout);

        return new Response(JSON.stringify({ content }), { headers: corsHeaders });
    } catch (error) {
        console.error('错误解码API错误:', error);
        return new Response(JSON.stringify({ error: '服务器内部错误' }), { status: 500, headers: corsHeaders });
    }
}

const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net;"
};

function addSecurityHeaders(response, isStatic = false) {
    const newResponse = new Response(response.body, response);
    Object.entries(securityHeaders).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
    });
    return newResponse;
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
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    ...securityHeaders
                }
            });
        }

        let response;

        if (path === '/api/auth/register' && request.method === 'POST') {
            response = await handleRegister(request, env);
        } else if (path === '/api/auth/login' && request.method === 'POST') {
            response = await handleLogin(request, env);
        } else if (path === '/api/auth/me' && request.method === 'GET') {
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            } else {
                response = await handleGetMe(request, env, user);
            }
        } else if (path === '/api/conversations' && request.method === 'GET') {
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            } else {
                response = await handleGetConversations(request, env, user.userId);
            }
        } else if (path === '/api/conversations' && request.method === 'POST') {
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            } else {
                response = await handleCreateConversation(request, env, user.userId);
            }
        } else if (path.match(/^\/api\/conversations\/(\d+)$/)) {
            const conversationMatch = path.match(/^\/api\/conversations\/(\d+)$/);
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: corsHeaders });
            } else {
                const conversationId = conversationMatch[1];
                if (request.method === 'GET') {
                    response = await handleGetConversation(request, env, user.userId, conversationId);
                } else if (request.method === 'DELETE') {
                    response = await handleDeleteConversation(request, env, user.userId, conversationId);
                }
            }
        } else if (path === '/api/chat' && request.method === 'POST') {
            response = await handleChatRequest(request, env);
        } else if (path === '/api/analyze' && request.method === 'POST') {
            response = await handleAnalyzeRequest(request, env);
        } else if (path === '/api/learn' && request.method === 'POST') {
            response = await handleLearnRequest(request, env);
        } else if (path === '/api/decode-error' && request.method === 'POST') {
            response = await handleDecodeErrorRequest(request, env);
        } else if (path === '/api/config' && request.method === 'GET') {
            response = await handleConfigRequest(env);
        } else {
            response = await env.ASSETS.fetch(request);
        }

        return addSecurityHeaders(response);
    }
};
