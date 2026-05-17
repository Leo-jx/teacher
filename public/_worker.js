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

async function handleConfigRequest(env) {
    return new Response(JSON.stringify({
        success: true,
        config: {
            websocket: { available: false, message: '\u5F53\u524D\u5E73\u53F0\u4E0D\u652F\u6301WebSocket\uFF0C\u8BF7\u4F7F\u7528HTTP\u6A21\u5F0F' },
            database: { available: !!env.DB }
        }
    }), { headers: corsHeaders });
}

const CODE_ANALYSIS_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u4EE3\u7801\u67B6\u6784\u5E08\u3002\u8BF7\u5BF9\u7528\u6237\u63D0\u4F9B\u7684\u4EE3\u7801\u8FDB\u884C\u6DF1\u5165\u5206\u6790\uFF0C\u6309\u4EE5\u4E0B\u683C\u5F0F\u8F93\u51FA\uFF1A

## \u4EE3\u7801\u5206\u6790\u62A5\u544A

### 1. \u6574\u4F53\u529F\u80FD\u6982\u8FF0
\u75282-3\u53E5\u8BDD\u6982\u62EC\u4EE3\u7801\u7684\u6574\u4F53\u529F\u80FD\u548C\u7528\u9014\u3002

### 2. \u4E3B\u8981\u6A21\u5757/\u51FD\u6570\u8BF4\u660E
| \u540D\u79F0 | \u7C7B\u578B | \u4F5C\u7528\u8BF4\u660E |
|------|------|----------|
| ... | \u51FD\u6570/\u7C7B/\u6A21\u5757 | ... |

### 3. \u5173\u952E\u6267\u884C\u6D41\u7A0B
\u7528\u6B65\u9AA4\u5206\u89E3\u4EE3\u7801\u7684\u5173\u952E\u6267\u884C\u6D41\u7A0B\u3002

### 4. \u6570\u636E\u6D41\u8F6C\u8DEF\u5F84
\u5206\u6790\u6570\u636E\u5728\u4EE3\u7801\u4E2D\u7684\u6D41\u8F6C\u548C\u53D8\u6362\u8FC7\u7A0B\u3002

### 5. \u6838\u5FC3\u7B97\u6CD5/\u903B\u8F91\u8BF4\u660E
\u89E3\u91CA\u6838\u5FC3\u7B97\u6CD5\u6216\u5173\u952E\u903B\u8F91\u3002

### 6. \u4EE3\u7801\u8D28\u91CF\u8BC4\u4F30
- \u53EF\u8BFB\u6027\uFF1A\u8BC4\u5206\u53CA\u6539\u8FDB\u5EFA\u8BAE
- \u53EF\u7EF4\u62A4\u6027\uFF1A\u8BC4\u5206\u53CA\u6539\u8FDB\u5EFA\u8BAE
- \u6027\u80FD\uFF1A\u8BC4\u5206\u53CA\u6539\u8FDB\u5EFA\u8BAE
- \u5B89\u5168\u6027\uFF1A\u8BC4\u5206\u53CA\u6539\u8FDB\u5EFA\u8BAE

### 7. \u6539\u8FDB\u5EFA\u8BAE
\u7ED9\u51FA\u5177\u4F53\u7684\u6539\u8FDB\u65B9\u5411\u548C\u4F18\u5148\u7EA7\u3002`;

const CODE_FIX_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u4EE3\u7801\u5BA1\u67E5\u4E13\u5BB6\u3002\u8BF7\u5BF9\u7528\u6237\u63D0\u4F9B\u7684\u4EE3\u7801\u8FDB\u884C\u5168\u9762\u7684\u7EA0\u9519\u5206\u6790\uFF0C\u6309\u4EE5\u4E0B\u683C\u5F0F\u8F93\u51FA\uFF1A

## \u4EE3\u7801\u7EA0\u9519\u62A5\u544A

### \u53D1\u73B0\u7684\u95EE\u9898

\u5BF9\u6BCF\u4E2A\u95EE\u9898\uFF0C\u8BF7\u63D0\u4F9B\uFF1A

**\u95EE\u9898 N\uFF1A[\u95EE\u9898\u7B80\u8FF0]**
- \u9519\u8BEF\u4F4D\u7F6E\uFF1A\u7B2CX\u884C\uFF0C\u5177\u4F53\u4EE3\u7801\u6BB5
- \u9519\u8BEF\u7C7B\u578B\uFF1A\u8BED\u6CD5\u9519\u8BEF / \u903B\u8F91\u9519\u8BEF / \u6027\u80FD\u95EE\u9898 / \u6700\u4F73\u5B9E\u8DF5\u8FDD\u80CC / \u5B89\u5168\u9690\u60A3
- \u9519\u8BEF\u539F\u56E0\uFF1A\u8BE6\u7EC6\u89E3\u91CA\u4E3A\u4EC0\u4E48\u8FD9\u662F\u4E00\u4E2A\u9519\u8BEF
- \u4FEE\u6539\u5EFA\u8BAE\uFF1A\u7ED9\u51FA\u4FEE\u6539\u540E\u7684\u4EE3\u7801

### \u4FEE\u6539\u540E\u7684\u5B8C\u6574\u4EE3\u7801

\`\`\`[\u8BED\u8A00]
// \u7ED9\u51FA\u4FEE\u590D\u540E\u7684\u5B8C\u6574\u4EE3\u7801
\`\`\`

\u6CE8\u610F\uFF1A\u5FC5\u987B\u7CBE\u786E\u5B9A\u4F4D\u5230\u884C\u53F7\uFF0C\u533A\u5206\u9519\u8BEF\u4E25\u91CD\u7A0B\u5EA6\uFF0C\u4FEE\u6539\u5EFA\u8BAE\u5FC5\u987B\u662F\u53EF\u76F4\u63A5\u8FD0\u884C\u7684\u4EE3\u7801\u3002`;

const SYNTAX_LEARN_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u7F16\u7A0B\u8BED\u8A00\u4E13\u5BB6\uFF0C\u64C5\u957F\u7528\u901A\u4FD7\u6613\u61C2\u7684\u65B9\u5F0F\u8BB2\u89E3\u7F16\u7A0B\u8BED\u6CD5\u3002\u8BF7\u6309\u4EE5\u4E0B\u7ED3\u6784\u8BB2\u89E3\uFF1A

## \u8BED\u6CD5\u8BB2\u89E3\uFF1A{keyword}

### 1. \u57FA\u672C\u6982\u5FF5
\u7528\u7B80\u6D01\u7684\u8BED\u8A00\u89E3\u91CA\u8FD9\u4E2A\u8BED\u6CD5\u662F\u4EC0\u4E48\u3001\u7528\u6765\u505A\u4EC0\u4E48\u3002

### 2. \u57FA\u672C\u7528\u6CD5
\u5C55\u793A\u6700\u5E38\u89C1\u7684\u4F7F\u7528\u65B9\u5F0F\uFF0C\u914D\u5408\u4EE3\u7801\u793A\u4F8B\u3002

### 3. \u8FDB\u9636\u7528\u6CD5
\u5C55\u793A\u66F4\u590D\u6742\u7684\u4F7F\u7528\u573A\u666F\u548C\u6280\u5DE7\u3002

### 4. \u5E38\u89C1\u9519\u8BEF\u4E0E\u6CE8\u610F\u4E8B\u9879
\u5217\u51FA\u521D\u5B66\u8005\u5BB9\u6613\u72AF\u7684\u9519\u8BEF\u548C\u6CE8\u610F\u70B9\u3002

### 5. \u6700\u4F73\u5B9E\u8DF5
\u7ED9\u51FA\u884C\u4E1A\u6700\u4F73\u5B9E\u8DF5\u5EFA\u8BAE\u3002`;

const ALGORITHM_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u7B97\u6CD5\u4E13\u5BB6\uFF0C\u64C5\u957F\u6DF1\u5165\u6D45\u51FA\u5730\u8BB2\u89E3\u5404\u79CD\u7B97\u6CD5\u3002\u8BF7\u6309\u4EE5\u4E0B\u7ED3\u6784\u8BB2\u89E3\uFF1A

## \u7B97\u6CD5\u8BB2\u89E3\uFF1A{name}

### 1. \u7B97\u6CD5\u7B80\u4ECB
\u7528\u901A\u4FD7\u7684\u8BED\u8A00\u89E3\u91CA\u8FD9\u4E2A\u7B97\u6CD5\u662F\u4EC0\u4E48\u3001\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\u3002

### 2. \u7B97\u6CD5\u539F\u7406
\u8BE6\u7EC6\u89E3\u91CA\u7B97\u6CD5\u7684\u5DE5\u4F5C\u539F\u7406\uFF0C\u53EF\u4F7F\u7528\u56FE\u793A\u6216\u4F2A\u4EE3\u7801\u3002

### 3. \u5B9E\u73B0\u6B65\u9AA4
\u5206\u6B65\u9AA4\u8BF4\u660E\u7B97\u6CD5\u7684\u5B9E\u73B0\u8FC7\u7A0B\u3002

### 4. \u4EE3\u7801\u5B9E\u73B0
\u63D0\u4F9B\u5B8C\u6574\u7684\u4EE3\u7801\u5B9E\u73B0\uFF08\u5E26\u8BE6\u7EC6\u6CE8\u91CA\uFF09\u3002

### 5. \u590D\u6742\u5EA6\u5206\u6790
- \u65F6\u95F4\u590D\u6742\u5EA6\uFF1A\u6700\u597D/\u6700\u574F/\u5E73\u5747
- \u7A7A\u95F4\u590D\u6742\u5EA6

### 6. \u5E94\u7528\u573A\u666F
\u5217\u4E3E\u5B9E\u9645\u5F00\u53D1\u4E2D\u7684\u5E94\u7528\u573A\u666F\u3002`;

const ERROR_DECODE_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u7684\u9519\u8BEF\u8BCA\u65AD\u4E13\u5BB6\u3002\u8BF7\u5BF9\u7528\u6237\u63D0\u4F9B\u7684\u9519\u8BEF\u4FE1\u606F\u8FDB\u884C\u8BE6\u7EC6\u89E3\u8BFB\uFF0C\u6309\u4EE5\u4E0B\u683C\u5F0F\u8F93\u51FA\uFF1A

## \u9519\u8BEF\u89E3\u8BFB\u62A5\u544A

### 1. \u9519\u8BEF\u7C7B\u578B
\u8BF4\u660E\u8FD9\u662F\u4EC0\u4E48\u7C7B\u578B\u7684\u9519\u8BEF\uFF08\u8BED\u6CD5\u9519\u8BEF\u3001\u8FD0\u884C\u65F6\u9519\u8BEF\u3001\u903B\u8F91\u9519\u8BEF\u7B49\uFF09\u3002

### 2. \u9519\u8BEF\u539F\u56E0
\u8BE6\u7EC6\u89E3\u91CA\u4EA7\u751F\u8FD9\u4E2A\u9519\u8BEF\u7684\u6839\u672C\u539F\u56E0\u3002

### 3. \u89E3\u51B3\u65B9\u6848
\u5217\u51FA\u591A\u79CD\u53EF\u80FD\u7684\u89E3\u51B3\u65B9\u6848\uFF0C\u5E76\u8BF4\u660E\u6BCF\u79CD\u65B9\u6848\u7684\u9002\u7528\u573A\u666F\u3002

### 4. \u4FEE\u590D\u4EE3\u7801\u793A\u4F8B
\u63D0\u4F9B\u4FEE\u590D\u540E\u7684\u4EE3\u7801\u793A\u4F8B\u3002

### 5. \u9884\u9632\u63AA\u65BD
\u8BF4\u660E\u5982\u4F55\u907F\u514D\u7C7B\u4F3C\u9519\u8BEF\u7684\u53D1\u751F\u3002`;

async function handleAnalyzeRequest(request, env) {
    try {
        const { code, language, type } = await request.json();

        if (!code) {
            return new Response(JSON.stringify({ error: '\u8BF7\u63D0\u4F9B\u4EE3\u7801\u5185\u5BB9' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        const prompt = type === 'fix' ? CODE_FIX_PROMPT : CODE_ANALYSIS_PROMPT;
        const actionText = type === 'fix' ? '\u7EA0\u9519\u5206\u6790' : '\u6DF1\u5165\u5206\u6790';

        const fullMessages = [
            { role: 'system', content: prompt },
            { role: 'user', content: `\u8BF7\u5BF9\u4EE5\u4E0B${language || ''}\u4EE3\u7801\u8FDB\u884C${actionText}\uFF1A\n\n\`\`\`${language || ''}\n${code}\n\`\`\`` }
        ];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        let content;
        try {
            content = await fetchAIWithContinuation(
                API_URL, API_KEY, API_SECRET, MODEL_ID,
                fullMessages, 8192, 0.3, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('\u4EE3\u7801\u5206\u6790API\u8BF7\u6C42\u5931\u8D25:', fetchError);
            return new Response(JSON.stringify({ error: '\u8BF7\u6C42\u8D85\u65F6\u6216\u7F51\u7EDC\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5' }), { status: 504, headers: corsHeaders });
        }
        clearTimeout(timeout);

        return new Response(JSON.stringify({ content }), { headers: corsHeaders });
    } catch (error) {
        console.error('\u4EE3\u7801\u5206\u6790API\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF' }), { status: 500, headers: corsHeaders });
    }
}

async function handleLearnRequest(request, env) {
    try {
        const { language, keyword, type, algorithmType, name } = await request.json();

        if (type === 'syntax' && (!language || !keyword)) {
            return new Response(JSON.stringify({ error: '\u8BF7\u63D0\u4F9B\u8BED\u8A00\u548C\u5173\u952E\u8BCD\u53C2\u6570' }), { status: 400, headers: corsHeaders });
        }
        if (type === 'algorithm' && !name) {
            return new Response(JSON.stringify({ error: '\u8BF7\u63D0\u4F9B\u7B97\u6CD5\u540D\u79F0\u53C2\u6570' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        let prompt = '';
        let userContent = '';

        if (type === 'syntax') {
            prompt = SYNTAX_LEARN_PROMPT.replace('{keyword}', keyword);
            userContent = `\u8BF7\u8BE6\u7EC6\u8BB2\u89E3${language}\u8BED\u8A00\u4E2D\u7684"${keyword}"\u8BED\u6CD5\uFF0C\u5305\u62EC\u7528\u6CD5\u3001\u793A\u4F8B\u548C\u6700\u4F73\u5B9E\u8DF5\u3002`;
        } else if (type === 'algorithm') {
            prompt = ALGORITHM_PROMPT.replace('{name}', name);
            userContent = `\u8BF7\u8BE6\u7EC6\u8BB2\u89E3"${name}"\u7B97\u6CD5\uFF0C\u5305\u62EC\u539F\u7406\u3001\u5B9E\u73B0\u6B65\u9AA4\u3001\u65F6\u95F4\u590D\u6742\u5EA6\u5206\u6790\u548C\u4EE3\u7801\u793A\u4F8B\u3002`;
        } else {
            return new Response(JSON.stringify({ error: '\u65E0\u6548\u7684type\u53C2\u6570' }), { status: 400, headers: corsHeaders });
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
                fullMessages, 8192, 0.7, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('\u5B66\u4E60API\u8BF7\u6C42\u5931\u8D25:', fetchError);
            return new Response(JSON.stringify({ error: '\u8BF7\u6C42\u8D85\u65F6\u6216\u7F51\u7EDC\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5' }), { status: 504, headers: corsHeaders });
        }
        clearTimeout(timeout);

        return new Response(JSON.stringify({ content }), { headers: corsHeaders });
    } catch (error) {
        console.error('\u5B66\u4E60API\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF' }), { status: 500, headers: corsHeaders });
    }
}

async function handleDecodeErrorRequest(request, env) {
    try {
        const { error: errorMsg, language } = await request.json();

        if (!errorMsg) {
            return new Response(JSON.stringify({ error: '\u8BF7\u63D0\u4F9B\u9519\u8BEF\u4FE1\u606F' }), { status: 400, headers: corsHeaders });
        }

        const API_URL = getConfigValue(env, 'API_URL');
        const MODEL_ID = getConfigValue(env, 'MODEL_ID');
        const API_KEY = getConfigValue(env, 'API_KEY');
        const API_SECRET = getConfigValue(env, 'API_SECRET');

        const fullMessages = [
            { role: 'system', content: ERROR_DECODE_PROMPT },
            { role: 'user', content: `\u8BF7\u5E2E\u6211\u89E3\u8BFB\u8FD9\u4E2A${language || ''}\u9519\u8BEF\uFF1A\n\n${errorMsg}` }
        ];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        let content;
        try {
            content = await fetchAIWithContinuation(
                API_URL, API_KEY, API_SECRET, MODEL_ID,
                fullMessages, 8192, 0.3, controller.signal
            );
        } catch (fetchError) {
            clearTimeout(timeout);
            console.error('\u9519\u8BEF\u89E3\u7801API\u8BF7\u6C42\u5931\u8D25:', fetchError);
            return new Response(JSON.stringify({ error: '\u8BF7\u6C42\u8D85\u65F6\u6216\u7F51\u7EDC\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5' }), { status: 504, headers: corsHeaders });
        }
        clearTimeout(timeout);

        return new Response(JSON.stringify({ content }), { headers: corsHeaders });
    } catch (error) {
        console.error('\u9519\u8BEF\u89E3\u7801API\u9519\u8BEF:', error);
        return new Response(JSON.stringify({ error: '\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF' }), { status: 500, headers: corsHeaders });
    }
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
