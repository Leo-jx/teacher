const DEFAULT_CONFIG = {
    API_URL: 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
    MODEL_ID: 'xop35qwen2b',
    API_KEY: 'a87ffea24723ba51b2817406aa6cdf30',
    API_SECRET: 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw',
    JWT_SECRET: 'xiao-zhi-secret-key-2024-change-in-production-change-very-long-key',
    IMAGE_API_URL: 'https://maas-api.cn-huabei-1.xf-yun.com/v2/images/generations',
    IMAGE_MODEL_ID: 'xopqwentti20b',
    IMAGE_APP_ID: 'f3f40af8',
    IMAGE_API_KEY: 'a87ffea24723ba51b2817406aa6cdf30',
    IMAGE_API_SECRET: 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
};

const SYSTEM_PROMPT = `你是"程序员AI辅助学习助手小智"，一位全栈技术专家。你的名字叫"小智"。

支持领域：MySQL、Java/Spring、Python、C/C++、微信小程序、uni-app、Vue、Coze AI。

回答原则：在AI回复的最大输出范围内，针对用户提出的技术问题或需求，提供专业且准确的解答。回答内容应遵循由浅入深的知识传递逻辑，从基础概念逐步过渡到复杂应用。为增强解释的清晰度和实用性，必须包含相关的代码示例、实际应用场景分析、具体案例说明以及行业公认的最佳实践指南。确保所有技术内容准确无误，代码示例可直接运行或稍作调整即可使用，实例和案例具有代表性和参考价值，最佳实践符合当前技术标准和发展趋势。

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

const MAX_CONTINUATION_ROUNDS = 5;

async function fetchAIWithContinuation(API_URL, API_KEY, API_SECRET, MODEL_ID, messages, maxTokens, temperature, abortSignal) {
    const authHeader = `Bearer ${API_KEY}:${API_SECRET}`;
    let fullContent = '';
    let currentMessages = [...messages];
    let rounds = 0;

    while (rounds <= MAX_CONTINUATION_ROUNDS) {
        const remainingTokens = maxTokens - Math.floor(fullContent.length / 2);
        const requestTokens = Math.max(remainingTokens, 1024);

        const body = {
            model: MODEL_ID,
            messages: currentMessages,
            stream: false,
            temperature: temperature,
            max_tokens: requestTokens
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
            throw new Error(`API\u8BF7\u6C42\u5931\u8D25: ${response.status} ${errorText}`);
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
            { role: 'user', content: '\u8BF7\u7EE7\u7EED\u8F93\u51FA\u5269\u4F59\u5185\u5BB9\uFF0C\u4ECE\u4E0A\u6B21\u4E2D\u65AD\u7684\u5730\u65B9\u7EE7\u7EED\uFF0C\u4E0D\u8981\u91CD\u590D\u5DF2\u8F93\u51FA\u7684\u5185\u5BB9' }
        ];
    }

    return fullContent;
}

async function handleRegister(request, env) {
    try {
        const { username, email, password } = await request.json();

        if (!username || !email || !password) {
            return new Response(JSON.stringify({ error: '\u8BF7\u586B\u5199\u6240\u6709\u5FC5\u586B\u5B57\u6BB5' }), { status: 400, headers: corsHeaders });
        }

        const cleanUsername = sanitizeInput(username);
        const cleanEmail = sanitizeInput(email);

        if (!isValidUsername(cleanUsername)) {
            return new Response(JSON.stringify({ error: '\u7528\u6237\u540D\u957F\u5EA6\u9700\u57282-20\u4E2A\u5B57\u7B26\u4E4B\u95F4\uFF0C\u53EA\u80FD\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u4E2D\u6587' }), { status: 400, headers: corsHeaders });
        }

        if (!isValidEmail(cleanEmail)) {
            return new Response(JSON.stringify({ error: '\u8BF7\u8F93\u5165\u6709\u6548\u7684\u90AE\u7BB1\u5730\u5740' }), { status: 400, headers: corsHeaders });
        }

        if (password.length < 8) {
            return new Response(JSON.stringify({ error: '\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u5C11\u4E8E8\u4E2A\u5B57\u7B26' }), { status: 400, headers: corsHeaders });
        }

        const salt = await generateSalt();
        const passwordHash = await hashPassword(password, salt);

        if (env.DB) {
            try {
                const result = await env.DB.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').bind(cleanUsername, cleanEmail, passwordHash).run();
                if (!result.success) {
                    return new Response(JSON.stringify({ error: '\u7528\u6237\u540D\u6216\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C' }), { status: 400, headers: corsHeaders });
                }
                const userId = result.meta.last_row_id;
                const token = await createJWT({ userId, username: cleanUsername, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
                return new Response(JSON.stringify({ success: true, token, username: cleanUsername, userId }), { headers: corsHeaders });
            } catch (dbError) {
                if (dbError.message && dbError.message.includes('UNIQUE')) {
                    return new Response(JSON.stringify({ error: '\u7528\u6237\u540D\u6216\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C' }), { status: 400, headers: corsHeaders });
                }
                throw dbError;
            }
        } else {
            const token = await createJWT({ userId: 1, username: cleanUsername, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username: cleanUsername, userId: 1 }), { headers: corsHeaders });
        }
    } catch (error) {
        console.error('\u6CE8\u518C\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5' }), { status: 500, headers: corsHeaders });
    }
}

async function handleLogin(request, env) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return new Response(JSON.stringify({ error: '\u8BF7\u8F93\u5165\u7528\u6237\u540D\u548C\u5BC6\u7801' }), { status: 400, headers: corsHeaders });
        }

        const cleanUsername = sanitizeInput(username);

        if (env.DB) {
            const result = await env.DB.prepare('SELECT id, username, password_hash FROM users WHERE username = ? OR email = ?').bind(cleanUsername, cleanUsername).first();

            if (!result) {
                return new Response(JSON.stringify({ error: '\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF' }), { status: 401, headers: corsHeaders });
            }

            const isValid = await verifyPassword(password, result.password_hash);
            if (!isValid) {
                return new Response(JSON.stringify({ error: '\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF' }), { status: 401, headers: corsHeaders });
            }

            await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(result.id).run();
            const token = await createJWT({ userId: result.id, username: result.username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username: result.username, userId: result.id }), { headers: corsHeaders });
        } else {
            const token = await createJWT({ userId: 1, username: cleanUsername, exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, getConfigValue(env, 'JWT_SECRET'));
            return new Response(JSON.stringify({ success: true, token, username: cleanUsername, userId: 1 }), { headers: corsHeaders });
        }
    } catch (error) {
        console.error('\u767B\u5F55\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5' }), { status: 500, headers: corsHeaders });
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
        console.error('\u83B7\u53D6\u5BF9\u8BDD\u5217\u8868\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u83B7\u53D6\u5BF9\u8BDD\u5217\u8868\u5931\u8D25' }), { status: 500, headers: corsHeaders });
    }
}

async function handleCreateConversation(request, env, userId) {
    try {
        const { title } = await request.json();
        if (env.DB) {
            const result = await env.DB.prepare('INSERT INTO conversations (user_id, title) VALUES (?, ?)').bind(userId, title || '\u65B0\u5BF9\u8BDD').run();
            const conv = await env.DB.prepare('SELECT id, title, created_at FROM conversations WHERE id = ?').bind(result.meta.last_row_id).first();
            return new Response(JSON.stringify({ success: true, conversation: conv }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, conversation: { id: Date.now(), title: title || '\u65B0\u5BF9\u8BDD', created_at: new Date().toISOString() } }), { headers: corsHeaders });
    } catch (error) {
        console.error('\u521B\u5EFA\u5BF9\u8BDD\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u521B\u5EFA\u5BF9\u8BDD\u5931\u8D25' }), { status: 500, headers: corsHeaders });
    }
}

async function handleGetConversation(request, env, userId, conversationId) {
    try {
        if (env.DB) {
            const conversation = await env.DB.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').bind(conversationId, userId).first();
            if (!conversation) {
                return new Response(JSON.stringify({ error: '\u5BF9\u8BDD\u4E0D\u5B58\u5728' }), { status: 404, headers: corsHeaders });
            }
            const { results } = await env.DB.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').bind(conversationId).all();
            return new Response(JSON.stringify({ success: true, conversation, messages: results }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, conversation: { id: conversationId }, messages: [] }), { headers: corsHeaders });
    } catch (error) {
        console.error('\u83B7\u53D6\u5BF9\u8BDD\u8BE6\u60C5\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u83B7\u53D6\u5BF9\u8BDD\u8BE6\u60C5\u5931\u8D25' }), { status: 500, headers: corsHeaders });
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
        console.error('\u5220\u9664\u5BF9\u8BDD\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u5220\u9664\u5BF9\u8BDD\u5931\u8D25' }), { status: 500, headers: corsHeaders });
    }
}

async function handleChatRequest(request, env) {
    try {
        const user = await authenticate(request, env);
        const { messages, conversationId } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'messages\u53C2\u6570\u65E0\u6548' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        if (!API_KEY || !API_SECRET) {
            const mockResponses = [
                '\u611F\u8C22\u60A8\u7684\u63D0\u95EE\uFF01\u4F5C\u4E3A\u60A8\u7684AI\u52A9\u624B\u5C0F\u667A\uFF0C\u6211\u6765\u5E2E\u60A8\u89E3\u7B54\u8FD9\u4E2A\u95EE\u9898\u3002',
                '\u8FD9\u4E2A\u95EE\u9898\u5F88\u6709\u8DA3\uFF01\u8BA9\u6211\u6765\u4E3A\u60A8\u8BE6\u7EC6\u5206\u6790\u4E00\u4E0B\u3002',
                '\u5F88\u597D\u7684\u95EE\u9898\uFF01\u8BA9\u6211\u4E3A\u60A8\u63D0\u4F9B\u4E13\u4E1A\u7684\u6280\u672F\u89E3\u7B54\u3002'
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
                fullMessages, 8192, 0.7, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25:', fetchError.message);
            const mockResponses = [
                '\u611F\u8C22\u60A8\u7684\u63D0\u95EE\uFF01\u4F5C\u4E3A\u60A8\u7684AI\u52A9\u624B\u5C0F\u667A\uFF0C\u6211\u6765\u5E2E\u60A8\u89E3\u7B54\u8FD9\u4E2A\u95EE\u9898\u3002',
                '\u8FD9\u4E2A\u95EE\u9898\u5F88\u6709\u8DA3\uFF01\u8BA9\u6211\u6765\u4E3A\u60A8\u8BE6\u7EC6\u5206\u6790\u4E00\u4E0B\u3002',
                '\u5F88\u597D\u7684\u95EE\u9898\uFF01\u8BA9\u6211\u4E3A\u60A8\u63D0\u4F9B\u4E13\u4E1A\u7684\u6280\u672F\u89E3\u7B54\u3002'
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
                console.error('\u4FDD\u5B58\u6D88\u606F\u5230\u6570\u636E\u5E93\u5931\u8D25:', dbError);
            }
        }

        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: aiContent } }] }), { headers: corsHeaders });
    } catch (error) {
        console.error('Chat API\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF', detail: error.message }), { status: 500, headers: corsHeaders });
    }
}

async function handleGenerateImage(request, env) {
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return new Response(JSON.stringify({ error: '\u8BF7\u8F93\u5165\u751F\u6210\u63D0\u793A' }), { status: 400, headers: corsHeaders });
        }

        const IMAGE_API_URL = getConfigValue(env, 'IMAGE_API_URL');
        const IMAGE_MODEL_ID = getConfigValue(env, 'IMAGE_MODEL_ID');
        const IMAGE_APP_ID = getConfigValue(env, 'IMAGE_APP_ID');
        const IMAGE_API_KEY = getConfigValue(env, 'IMAGE_API_KEY');
        const IMAGE_API_SECRET = getConfigValue(env, 'IMAGE_API_SECRET');

        if (!IMAGE_API_KEY || !IMAGE_API_SECRET || !IMAGE_MODEL_ID) {
            return new Response(JSON.stringify({
                error: '\u6587\u751F\u56FEAPI\u914D\u7F6E\u672A\u5B8C\u6210',
                message: '\u8BF7\u5728\u914D\u7F6E\u4E2D\u8BBE\u7F6EIMAGE_API_KEY\u3001IMAGE_API_SECRET\u548CIMAGE_MODEL_ID'
            }), { status: 400, headers: corsHeaders });
        }

        const authHeader = `Bearer ${IMAGE_API_KEY}:${IMAGE_API_SECRET}`;
        const body = {
            model: IMAGE_MODEL_ID,
            prompt: prompt,
            n: 1,
            size: '1024x1024'
        };

        if (IMAGE_APP_ID) {
            body.app_id = IMAGE_APP_ID;
        }

        const response = await fetch(IMAGE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`\u6587\u751F\u56FEAPI\u8BF7\u6C42\u5931\u8D25: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url || data.url || data.images?.[0]?.url;

        if (!imageUrl) {
            return new Response(JSON.stringify({
                error: '\u751F\u6210\u56FE\u7247\u5931\u8D25',
                raw: data
            }), { status: 500, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, imageUrl }), { headers: corsHeaders });
    } catch (error) {
        console.error('\u751F\u6210\u56FE\u7247\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u751F\u6210\u56FE\u7247\u5931\u8D25', detail: error.message }), { status: 500, headers: corsHeaders });
    }
}

async function handleConfigRequest(env) {
    return new Response(JSON.stringify({
        success: true,
        config: {
            websocket: { available: false, message: '\u5F53\u524D\u5E73\u53F0\u4E0D\u652F\u6301WebSocket\uFF0C\u8BF7\u4F7F\u7528HTTP\u6A21\u5F0F' },
            database: { available: !!env.DB },
            imageGeneration: { available: !!(getConfigValue(env, 'IMAGE_API_KEY') && getConfigValue(env, 'IMAGE_API_SECRET') && getConfigValue(env, 'IMAGE_MODEL_ID')) }
        }
    }), { headers: corsHeaders });
}

const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net;"
};

function addSecurityHeaders(response) {
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
                response = new Response(JSON.stringify({ error: '\u672A\u767B\u5F55' }), { status: 401, headers: corsHeaders });
            } else {
                response = await handleGetMe(request, env, user);
            }
        } else if (path === '/api/conversations' && request.method === 'GET') {
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '\u672A\u767B\u5F55' }), { status: 401, headers: corsHeaders });
            } else {
                response = await handleGetConversations(request, env, user.userId);
            }
        } else if (path === '/api/conversations' && request.method === 'POST') {
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '\u672A\u767B\u5F55' }), { status: 401, headers: corsHeaders });
            } else {
                response = await handleCreateConversation(request, env, user.userId);
            }
        } else if (path.startsWith('/api/conversations/') && request.method === 'GET') {
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '\u672A\u767B\u5F55' }), { status: 401, headers: corsHeaders });
            } else {
                const conversationId = parseInt(path.split('/')[3]);
                response = await handleGetConversation(request, env, user.userId, conversationId);
            }
        } else if (path.startsWith('/api/conversations/') && request.method === 'DELETE') {
            const user = await authenticate(request, env);
            if (!user) {
                response = new Response(JSON.stringify({ error: '\u672A\u767B\u5F55' }), { status: 401, headers: corsHeaders });
            } else {
                const conversationId = parseInt(path.split('/')[3]);
                response = await handleDeleteConversation(request, env, user.userId, conversationId);
            }
        } else if (path === '/api/chat' && request.method === 'POST') {
            response = await handleChatRequest(request, env);
        } else if (path === '/api/config' && request.method === 'GET') {
            response = await handleConfigRequest(env);
        } else if (path === '/api/generate-image' && request.method === 'POST') {
            response = await handleGenerateImage(request, env);
        } else {
            response = await env.ASSETS.fetch(request);
        }

        return addSecurityHeaders(response);
    }
};
