class DevAssistant {
    constructor() {
        this.messages = [];
        this.chatHistory = [];
        this.currentChatId = null;
        this.isStreaming = false;
        this.useWebSocket = false;
        this.ws = null;
        this.currentToolType = null;

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.loadChatHistory();
        this.setupMarked();
        this.autoResizeTextarea();
        this.updateCharCount();
    }

    bindElements() {
        this.chatContainer = document.getElementById('chatContainer');
        this.messagesDiv = document.getElementById('messages');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.charCount = document.getElementById('charCount');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOpen = document.getElementById('sidebarOpen');
        this.sidebarClose = document.getElementById('sidebarClose');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.historyList = document.getElementById('historyList');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.modeToggle = document.getElementById('modeToggle');
        this.modeLabel = document.getElementById('modeLabel');
        this.testBtn = document.getElementById('testBtn');
        this.testModal = document.getElementById('testModal');
        this.testModalClose = document.getElementById('testModalClose');
        this.runTestBtn = document.getElementById('runTestBtn');
        this.toolCodeFix = document.getElementById('toolCodeFix');
        this.toolCodeAnalysis = document.getElementById('toolCodeAnalysis');
        this.codeToolPanel = document.getElementById('codeToolPanel');
        this.toolPanelClose = document.getElementById('toolPanelClose');
        this.codeInput = document.getElementById('codeInput');
        this.codeFileInput = document.getElementById('codeFileInput');
        this.clearCodeBtn = document.getElementById('clearCodeBtn');
        this.analyzeBtn = document.getElementById('analyzeBtn');
    }

    bindEvents() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.userInput.addEventListener('input', () => {
            this.autoResizeTextarea();
            this.updateCharCount();
        });

        this.sidebarOpen.addEventListener('click', () => this.toggleSidebar(true));
        this.sidebarClose.addEventListener('click', () => this.toggleSidebar(false));

        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());

        this.modeToggle.addEventListener('click', () => this.toggleMode());
        this.testBtn.addEventListener('click', () => this.openTestModal());
        this.testModalClose.addEventListener('click', () => this.closeTestModal());
        this.runTestBtn.addEventListener('click', () => this.runAllTests());

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const topic = item.dataset.topic;
                this.userInput.value = `请详细讲解${topic}相关的知识，并给出示例`;
                this.sendMessage();
            });
        });

        document.querySelectorAll('.quick-q').forEach(btn => {
            btn.addEventListener('click', () => {
                this.userInput.value = btn.dataset.q;
                this.sendMessage();
            });
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn')) {
                this.copyCode(e.target);
            }
        });

        this.toolCodeFix.addEventListener('click', () => this.openCodeTool('fix'));
        this.toolCodeAnalysis.addEventListener('click', () => this.openCodeTool('analysis'));
        this.toolPanelClose.addEventListener('click', () => this.closeCodeTool());
        this.codeFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.clearCodeBtn.addEventListener('click', () => {
            this.codeInput.value = '';
            document.getElementById('fileName').textContent = '';
            this.updateCodeCharCount();
        });
        this.codeInput.addEventListener('input', () => this.updateCodeCharCount());
        this.analyzeBtn.addEventListener('click', () => this.analyzeCode());
    }

    setupMarked() {
        const renderer = new marked.Renderer();
        renderer.code = function (code, language) {
            const lang = language || 'sql';
            let highlighted;
            try {
                if (hljs.getLanguage(lang)) {
                    highlighted = hljs.highlight(code, { language: lang }).value;
                } else {
                    highlighted = hljs.highlightAuto(code).value;
                }
            } catch {
                highlighted = code;
            }
            return `<pre><div class="code-header"><span>${lang}</span><button class="copy-btn" onclick="app.copyCode(this)"><i class="fas fa-copy"></i> 复制</button></div><code class="hljs language-${lang}">${highlighted}</code></pre>`;
        };
        marked.setOptions({
            renderer: renderer,
            breaks: true,
            gfm: true
        });
    }

    autoResizeTextarea() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = Math.min(this.userInput.scrollHeight, 120) + 'px';
    }

    updateCharCount() {
        const len = this.userInput.value.length;
        this.charCount.textContent = `${len}/2000`;
        if (len > 2000) {
            this.charCount.style.color = 'var(--error)';
        } else {
            this.charCount.style.color = 'var(--text-muted)';
        }
    }

    toggleSidebar(open) {
        this.sidebar.classList.toggle('open', open);
        const overlay = document.querySelector('.sidebar-overlay');
        if (open && !overlay) {
            const div = document.createElement('div');
            div.className = 'sidebar-overlay active';
            div.addEventListener('click', () => this.toggleSidebar(false));
            document.body.appendChild(div);
        } else if (!open && overlay) {
            overlay.remove();
        }
    }

    async toggleMode() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            if (config.websocket && !config.websocket.available) {
                alert(config.websocket.message || '当前平台不支持WebSocket模式，请使用HTTP模式');
                return;
            }
        } catch (e) {
            console.log('无法获取配置，默认使用HTTP模式');
        }
        
        this.useWebSocket = !this.useWebSocket;
        this.modeLabel.textContent = this.useWebSocket ? 'WS模式' : 'HTTP模式';
        this.modeToggle.classList.toggle('active', this.useWebSocket);
    }

    setStatus(status, text) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }

    async sendMessage() {
        const content = this.userInput.value.trim();
        if (!content || this.isStreaming) return;
        if (content.length > 2000) {
            this.setStatus('error', '消息过长，请控制在2000字以内');
            return;
        }

        if (this.messages.length === 0) {
            this.createNewChat(true);
        }

        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';

        this.messages.push({ role: 'user', content: content });
        this.appendMessage('user', content);
        this.userInput.value = '';
        this.autoResizeTextarea();
        this.updateCharCount();

        this.isStreaming = true;
        this.sendBtn.disabled = true;
        this.setStatus('loading', '思考中...');

        const aiMessageEl = this.appendMessage('assistant', '', true);

        try {
            if (this.useWebSocket) {
                await this.sendViaWebSocket(aiMessageEl);
            } else {
                await this.sendViaHTTP(aiMessageEl);
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            this.updateAIMessage(aiMessageEl, `抱歉，发生了错误：${error.message}。请稍后重试。`);
            this.setStatus('error', '请求失败');
        } finally {
            this.isStreaming = false;
            this.sendBtn.disabled = false;
            this.setStatus('ready', '就绪');
            this.saveCurrentChat();
        }
    }

    async sendViaHTTP(aiMessageEl) {
        const apiMessages = this.messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: apiMessages,
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        let aiContent = '';

        if (data.choices && data.choices.length > 0) {
            aiContent = data.choices[0].message?.content || data.choices[0].text || '';
        } else if (data.output) {
            aiContent = data.output.text || data.output;
        } else if (data.data && data.data.output) {
            aiContent = data.data.output.text || JSON.stringify(data.data.output);
        } else if (typeof data === 'string') {
            aiContent = data;
        } else {
            aiContent = JSON.stringify(data);
        }

        this.messages.push({ role: 'assistant', content: aiContent });
        this.updateAIMessage(aiMessageEl, aiContent);
    }

    sendViaWebSocket(aiMessageEl) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`ws://${window.location.host}/ws/chat`);

                let fullContent = '';

                this.ws.onopen = () => {
                    const apiMessages = this.messages.map(m => ({
                        role: m.role,
                        content: m.content
                    }));

                    this.ws.send(JSON.stringify({
                        type: 'chat',
                        messages: apiMessages
                    }));
                };

                this.ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);

                        if (msg.type === 'chunk' && msg.data) {
                            const payload = msg.data.payload;
                            if (payload && payload.choices && payload.choices.text) {
                                fullContent += payload.choices.text[0].content || '';
                                this.updateAIMessage(aiMessageEl, fullContent);
                            }
                        } else if (msg.type === 'error') {
                            reject(new Error(msg.message || 'WebSocket错误'));
                            this.ws.close();
                        } else if (msg.type === 'done') {
                            if (fullContent) {
                                this.messages.push({ role: 'assistant', content: fullContent });
                            }
                            this.ws.close();
                            resolve();
                        }
                    } catch (e) {
                        console.error('解析WebSocket消息失败:', e);
                    }
                };

                this.ws.onerror = (error) => {
                    reject(new Error('WebSocket连接失败'));
                };

                this.ws.onclose = () => {
                    if (!fullContent) {
                        resolve();
                    }
                };

                setTimeout(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.close();
                    }
                    resolve();
                }, 30000);
            } catch (e) {
                reject(e);
            }
        });
    }

    appendMessage(role, content, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user'
            ? '<i class="fas fa-user"></i>'
            : '<i class="fas fa-robot"></i>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (isLoading) {
            contentDiv.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
        } else if (role === 'user') {
            contentDiv.textContent = content;
        } else {
            contentDiv.innerHTML = this.renderMarkdown(content);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.messagesDiv.appendChild(messageDiv);
        this.scrollToBottom();

        return contentDiv;
    }

    updateAIMessage(contentEl, content) {
        contentEl.innerHTML = this.renderMarkdown(content);
        this.scrollToBottom();
    }

    renderMarkdown(text) {
        try {
            return marked.parse(text);
        } catch {
            return text.replace(/\n/g, '<br>');
        }
    }

    copyCode(btn) {
        const codeBlock = btn.closest('pre').querySelector('code');
        const text = codeBlock.textContent;
        navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = '<i class="fas fa-check"></i> 已复制';
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-copy"></i> 复制';
            }, 2000);
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            btn.innerHTML = '<i class="fas fa-check"></i> 已复制';
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-copy"></i> 复制';
            }, 2000);
        });
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        });
    }

    createNewChat(silent = false) {
        if (this.messages.length > 0 && this.currentChatId) {
            this.saveCurrentChat();
        }

        this.messages = [];
        this.currentChatId = 'chat_' + Date.now();
        this.messagesDiv.innerHTML = '';
        this.messagesDiv.style.display = 'none';
        this.welcomeScreen.style.display = 'flex';

        if (!silent) {
            this.renderHistoryList();
        }
    }

    saveCurrentChat() {
        if (this.messages.length === 0 || !this.currentChatId) return;

        const firstUserMsg = this.messages.find(m => m.role === 'user');
        const title = firstUserMsg
            ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
            : '新对话';

        const chatData = {
            id: this.currentChatId,
            title: title,
            messages: [...this.messages],
            updatedAt: Date.now()
        };

        const existingIndex = this.chatHistory.findIndex(c => c.id === this.currentChatId);
        if (existingIndex >= 0) {
            this.chatHistory[existingIndex] = chatData;
        } else {
            this.chatHistory.unshift(chatData);
        }

        if (this.chatHistory.length > 50) {
            this.chatHistory = this.chatHistory.slice(0, 50);
        }

        this.saveChatHistory();
        this.renderHistoryList();
    }

    loadChat(chatId) {
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (!chat) return;

        this.currentChatId = chat.id;
        this.messages = [...chat.messages];

        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';
        this.messagesDiv.innerHTML = '';

        this.messages.forEach(msg => {
            this.appendMessage(msg.role, msg.content);
        });

        this.scrollToBottom();
    }

    deleteChat(chatId) {
        this.chatHistory = this.chatHistory.filter(c => c.id !== chatId);
        this.saveChatHistory();
        this.renderHistoryList();

        if (this.currentChatId === chatId) {
            this.createNewChat();
        }
    }

    clearAllHistory() {
        if (!confirm('确定要清除所有聊天记录吗？此操作不可恢复。')) return;

        this.chatHistory = [];
        this.saveChatHistory();
        this.renderHistoryList();
        this.createNewChat();
    }

    saveChatHistory() {
        try {
            localStorage.setItem('dev_assistant_history', JSON.stringify(this.chatHistory));
        } catch (e) {
            console.error('保存聊天记录失败:', e);
        }
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem('dev_assistant_history');
            if (saved) {
                this.chatHistory = JSON.parse(saved);
                this.renderHistoryList();
            }
        } catch (e) {
            console.error('加载聊天记录失败:', e);
            this.chatHistory = [];
        }
    }

    renderHistoryList() {
        this.historyList.innerHTML = '';

        if (this.chatHistory.length === 0) {
            this.historyList.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">暂无历史记录</div>';
            return;
        }

        this.chatHistory.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (chat.id === this.currentChatId) {
                item.style.background = 'var(--bg-card)';
                item.style.color = 'var(--primary-light)';
            }

            item.innerHTML = `
                <span class="history-text"><i class="fas fa-comment" style="margin-right: 6px; font-size: 11px;"></i>${this.escapeHtml(chat.title)}</span>
                <button class="delete-chat" title="删除此对话"><i class="fas fa-times"></i></button>
            `;

            item.querySelector('.history-text').addEventListener('click', () => this.loadChat(chat.id));
            item.querySelector('.delete-chat').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });

            this.historyList.appendChild(item);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openTestModal() {
        this.testModal.classList.add('active');
        this.resetTestStatus();
    }

    closeTestModal() {
        this.testModal.classList.remove('active');
    }

    resetTestStatus() {
        ['testHttp', 'testWs', 'testEmbedding'].forEach(id => {
            const el = document.getElementById(id);
            const status = el.querySelector('.test-status');
            const detail = el.querySelector('.test-detail');
            status.className = 'test-status pending';
            status.textContent = '待测试';
            detail.textContent = '';
        });
    }

    async runAllTests() {
        this.runTestBtn.disabled = true;
        this.runTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 测试中...';

        await this.testHttpApi();
        await this.testWebSocketApi();
        await this.testEmbeddingApi();

        this.runTestBtn.disabled = false;
        this.runTestBtn.innerHTML = '<i class="fas fa-play"></i> 运行所有测试';
    }

    async testHttpApi() {
        const el = document.getElementById('testHttp');
        const status = el.querySelector('.test-status');
        const detail = el.querySelector('.test-detail');

        status.className = 'test-status running';
        status.textContent = '测试中...';
        detail.textContent = '正在发送HTTP请求...';

        try {
            const startTime = Date.now();
            const response = await fetch('/api/test/http', { method: 'POST' });
            const data = await response.json();
            const elapsed = Date.now() - startTime;

            if (data.success) {
                status.className = 'test-status success';
                status.textContent = `成功 (${elapsed}ms)`;
                detail.textContent = `状态码: ${data.statusCode}\n响应时间: ${data.responseTime}ms`;
            } else {
                status.className = 'test-status error';
                status.textContent = '失败';
                detail.textContent = `错误: ${data.error || '未知错误'}`;
            }
        } catch (error) {
            status.className = 'test-status error';
            status.textContent = '失败';
            detail.textContent = `连接错误: ${error.message}`;
        }
    }

    async testWebSocketApi() {
        const el = document.getElementById('testWs');
        const status = el.querySelector('.test-status');
        const detail = el.querySelector('.test-detail');

        status.className = 'test-status running';
        status.textContent = '测试中...';
        detail.textContent = '正在检查WebSocket端点...';

        try {
            const response = await fetch('/api/test/ws');
            const data = await response.json();

            if (data.success) {
                status.className = 'test-status success';
                status.textContent = '就绪';
                detail.textContent = `WebSocket端点可用\nURL前缀: ${data.wsUrl}`;
            } else {
                status.className = 'test-status error';
                status.textContent = '失败';
                detail.textContent = `错误: ${data.error}`;
            }
        } catch (error) {
            status.className = 'test-status error';
            status.textContent = '失败';
            detail.textContent = `连接错误: ${error.message}`;
        }
    }

    async testEmbeddingApi() {
        const el = document.getElementById('testEmbedding');
        const status = el.querySelector('.test-status');
        const detail = el.querySelector('.test-detail');

        status.className = 'test-status running';
        status.textContent = '测试中...';
        detail.textContent = '正在发送Embedding请求...';

        try {
            const startTime = Date.now();
            const response = await fetch('/api/test/embedding', { method: 'POST' });
            const data = await response.json();
            const elapsed = Date.now() - startTime;

            if (data.success) {
                status.className = 'test-status success';
                status.textContent = `成功 (${elapsed}ms)`;
                detail.textContent = `状态码: ${data.statusCode}\n响应时间: ${data.responseTime}ms`;
            } else {
                status.className = 'test-status error';
                status.textContent = '失败';
                detail.textContent = `错误: ${data.error || '未知错误'}`;
            }
        } catch (error) {
            status.className = 'test-status error';
            status.textContent = '失败';
            detail.textContent = `连接错误: ${error.message}`;
        }
    }
}

    openCodeTool(toolType) {
        const panel = document.getElementById('codeToolPanel');
        const title = document.getElementById('toolPanelTitle');
        const btnText = document.getElementById('analyzeBtnText');
        const codeInput = document.getElementById('codeInput');

        document.getElementById('toolCodeFix').classList.toggle('active', toolType === 'fix');
        document.getElementById('toolCodeAnalysis').classList.toggle('active', toolType === 'analysis');

        if (toolType === 'fix') {
            title.innerHTML = '<i class="fas fa-bug"></i> 代码纠错';
            btnText.textContent = '开始纠错';
            codeInput.placeholder = '在此粘贴或输入需要纠错的代码...\n\n支持直接粘贴代码或点击上传按钮导入代码文件';
        } else {
            title.innerHTML = '<i class="fas fa-search-plus"></i> 代码分析';
            btnText.textContent = '开始分析';
            codeInput.placeholder = '在此粘贴或输入需要分析的代码...\n\n支持直接粘贴代码或点击上传按钮导入代码文件';
        }

        this.currentToolType = toolType;
        panel.classList.add('active');
        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';
    }

    closeCodeTool() {
        const panel = document.getElementById('codeToolPanel');
        panel.classList.remove('active');
        document.getElementById('toolCodeFix').classList.remove('active');
        document.getElementById('toolCodeAnalysis').classList.remove('active');
        this.currentToolType = null;
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            document.getElementById('codeInput').value = content;
            document.getElementById('fileName').textContent = file.name;
            this.updateCodeCharCount();

            const ext = file.name.split('.').pop().toLowerCase();
            const langMap = {
                'js': 'javascript', 'mjs': 'javascript',
                'py': 'python',
                'java': 'java',
                'cpp': 'cpp', 'cxx': 'cpp', 'cc': 'cpp', 'hpp': 'cpp',
                'c': 'c', 'h': 'c',
                'sql': 'sql',
                'go': 'go',
                'rs': 'rust',
                'ts': 'typescript', 'tsx': 'typescript',
                'php': 'php',
                'html': 'html', 'htm': 'html',
                'css': 'css',
                'vue': 'vue',
                'sh': 'shell', 'bash': 'shell',
                'txt': 'javascript'
            };
            const detectedLang = langMap[ext] || 'javascript';
            document.getElementById('codeLanguage').value = detectedLang;
        };
        reader.readAsText(file);
    }

    updateCodeCharCount() {
        const code = document.getElementById('codeInput').value;
        document.getElementById('codeCharCount').textContent = `${code.length} 字符`;
    }

    async analyzeCode() {
        const code = document.getElementById('codeInput').value.trim();
        const language = document.getElementById('codeLanguage').value;
        const toolType = this.currentToolType;

        if (!code) {
            alert('请先输入或上传代码');
            return;
        }

        if (!toolType) {
            alert('请先选择工具类型');
            return;
        }

        if (this.messages.length === 0) {
            this.createNewChat(true);
        }

        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';

        const langLabel = document.getElementById('codeLanguage').selectedOptions[0].text;

        let prompt;
        if (toolType === 'fix') {
            prompt = `请对以下${langLabel}代码进行全面的纠错分析，找出所有问题并给出修复方案：\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n请按以下格式输出分析结果：\n\n## 代码纠错报告\n\n### 发现的问题\n\n对每个问题，请提供：\n1. **错误位置**：精确到行号和具体代码段\n2. **错误类型**：语法错误/逻辑错误/性能问题/最佳实践违背\n3. **错误原因**：详细解释为什么这是一个错误\n4. **修改建议**：给出具体的修改后代码\n5. **修改依据**：说明修改的技术原理\n\n### 修改后的完整代码\n\n请给出修复后的完整代码。`;
        } else {
            prompt = `请对以下${langLabel}代码进行深入的结构和逻辑分析：\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n请按以下格式输出分析结果：\n\n## 代码分析报告\n\n### 1. 整体功能概述\n\n简要描述代码的整体功能和用途。\n\n### 2. 主要模块/函数说明\n\n列出代码中的主要模块、类和函数，说明各自的作用。\n\n### 3. 关键执行流程\n\n逐步分解代码的关键执行流程。\n\n### 4. 数据流转路径\n\n分析数据在代码中的流转路径和变换过程。\n\n### 5. 核心算法/逻辑说明\n\n解释代码中使用的核心算法或关键逻辑。\n\n### 6. 代码质量评估\n\n评估代码的可读性、可维护性和性能表现，给出改进建议。`;
        }

        this.messages.push({ role: 'user', content: prompt });
        this.appendMessage('user', prompt);

        this.isStreaming = true;
        this.sendBtn.disabled = true;
        document.getElementById('analyzeBtn').disabled = true;
        this.setStatus('loading', '分析中...');

        const aiMessageEl = this.appendMessage('assistant', '', true);

        try {
            await this.sendViaHTTP(aiMessageEl);
        } catch (error) {
            console.error('代码分析失败:', error);
            this.updateAIMessage(aiMessageEl, `抱歉，代码分析失败：${error.message}。请稍后重试。`);
            this.setStatus('error', '分析失败');
        } finally {
            this.isStreaming = false;
            this.sendBtn.disabled = false;
            document.getElementById('analyzeBtn').disabled = false;
            this.setStatus('ready', '就绪');
            this.saveCurrentChat();
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new DevAssistant();
});
