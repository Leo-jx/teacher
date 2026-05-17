class DevAssistant {
    constructor() {
        this.messages = [];
        this.chatHistory = [];
        this.currentChatId = null;
        this.currentToolType = null;
        this.isTyping = false;
        this.typingQueue = [];
        this.typingSpeed = 15;
        this.authToken = null;
        this.username = null;
        this.userId = null;
        this.dbConversationId = null;
        this.activeRequests = new Map();

        this.init();
    }

    init() {
        this.checkAuth();
        this.bindElements();
        this.bindAuthEvents();
        this.bindEvents();
        this.setupMarked();
        this.autoResizeTextarea();
        this.updateCharCount();
        this.showApp();
    }

    checkAuth() {
        this.authToken = localStorage.getItem('auth_token');
        this.username = localStorage.getItem('auth_username');
        this.userId = localStorage.getItem('auth_userId');
        if (this.authToken) {
            this.verifyToken();
        }
    }

    async verifyToken() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.username = data.username;
                this.userId = data.userId;
                localStorage.setItem('auth_username', this.username);
                localStorage.setItem('auth_userId', this.userId);
            } else {
                this.logout();
            }
        } catch (e) {
            console.error('Token\u9A8C\u8BC1\u5931\u8D25:', e);
        }
    }

    openAuthModal() {
        document.getElementById('authModal').style.display = 'flex';
    }

    closeAuthModal() {
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('loginError').textContent = '';
        document.getElementById('registerError').textContent = '';
    }

    showApp() {
        if (this.username) {
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('displayUsername').textContent = this.username;
            document.getElementById('authBtns').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'flex';
        } else {
            document.getElementById('userInfo').style.display = 'none';
            document.getElementById('authBtns').style.display = 'flex';
            document.getElementById('logoutBtn').style.display = 'none';
        }
        this.loadChatHistory();
    }

    logout() {
        this.authToken = null;
        this.username = null;
        this.userId = null;
        this.dbConversationId = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        localStorage.removeItem('auth_userId');
        this.showApp();
    }

    bindAuthEvents() {
        const authTabs = document.querySelectorAll('.auth-tab');
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetTab = tab.dataset.tab;
                document.getElementById('loginForm').style.display = targetTab === 'login' ? 'flex' : 'none';
                document.getElementById('registerForm').style.display = targetTab === 'register' ? 'flex' : 'none';
            });
        });

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorEl = document.getElementById('loginError');
            const submitBtn = document.getElementById('loginSubmit');
            errorEl.textContent = '';
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = '\u767B\u5F55\u4E2D...';
            submitBtn.querySelector('i').style.display = 'inline';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (data.success) {
                    this.authToken = data.token;
                    this.username = data.username;
                    this.userId = data.userId;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('auth_username', data.username);
                    localStorage.setItem('auth_userId', data.userId);
                    this.closeAuthModal();
                    this.showApp();
                } else {
                    errorEl.textContent = data.error || '\u767B\u5F55\u5931\u8D25';
                }
            } catch (error) {
                errorEl.textContent = '\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5';
            } finally {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = '\u767B\u5F55';
                submitBtn.querySelector('i').style.display = 'none';
            }
        });

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const errorEl = document.getElementById('registerError');
            const submitBtn = document.getElementById('registerSubmit');
            errorEl.textContent = '';

            if (password !== confirmPassword) {
                errorEl.textContent = '\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = '\u6CE8\u518C\u4E2D...';
            submitBtn.querySelector('i').style.display = 'inline';

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await response.json();
                if (data.success) {
                    this.authToken = data.token;
                    this.username = data.username;
                    this.userId = data.userId;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('auth_username', data.username);
                    localStorage.setItem('auth_userId', data.userId);
                    this.closeAuthModal();
                    this.showApp();
                } else {
                    errorEl.textContent = data.error || '\u6CE8\u518C\u5931\u8D25';
                }
            } catch (error) {
                errorEl.textContent = '\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5';
            } finally {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = '\u6CE8\u518C';
                submitBtn.querySelector('i').style.display = 'none';
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('authBtns').addEventListener('click', () => {
            this.openAuthModal();
        });

        document.getElementById('authModalClose').addEventListener('click', () => {
            this.closeAuthModal();
        });

        document.getElementById('authModalOverlay').addEventListener('click', () => {
            this.closeAuthModal();
        });
    }

    bindElements() {
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.messagesContainer = document.getElementById('messages');
        this.chatContainer = document.getElementById('chatContainer');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.charCount = document.getElementById('charCount');
        this.historyList = document.getElementById('historyList');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarClose = document.getElementById('sidebarClose');
        this.sidebarOpen = document.getElementById('sidebarOpen');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.codeToolPanel = document.getElementById('codeToolPanel');
        this.toolPanelClose = document.getElementById('toolPanelClose');
        this.codeInput = document.getElementById('codeInput');
        this.codeLanguage = document.getElementById('codeLanguage');
        this.codeFileInput = document.getElementById('codeFileInput');
        this.codeCharCount = document.getElementById('codeCharCount');
        this.fileName = document.getElementById('fileName');
        this.clearCodeBtn = document.getElementById('clearCodeBtn');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.analyzeBtnText = document.getElementById('analyzeBtnText');
        this.toolPanelTitle = document.getElementById('toolPanelTitle');
        this.toolCodeFix = document.getElementById('toolCodeFix');
        this.toolCodeAnalysis = document.getElementById('toolCodeAnalysis');
        this.toolSyntaxLearn = document.getElementById('toolSyntaxLearn');
        this.toolAlgorithm = document.getElementById('toolAlgorithm');
        this.toolErrorDecoder = document.getElementById('toolErrorDecoder');
        this.syntaxLearnPanel = document.getElementById('syntaxLearnPanel');
        this.syntaxPanelClose = document.getElementById('syntaxPanelClose');
        this.syntaxLanguage = document.getElementById('syntaxLanguage');
        this.syntaxKeyword = document.getElementById('syntaxKeyword');
        this.syntaxLearnBtn = document.getElementById('syntaxLearnBtn');
        this.algorithmPanel = document.getElementById('algorithmPanel');
        this.algorithmPanelClose = document.getElementById('algorithmPanelClose');
        this.algorithmType = document.getElementById('algorithmType');
        this.algorithmName = document.getElementById('algorithmName');
        this.algorithmLearnBtn = document.getElementById('algorithmLearnBtn');
        this.errorDecoderPanel = document.getElementById('errorDecoderPanel');
        this.errorDecoderPanelClose = document.getElementById('errorDecoderPanelClose');
        this.errorInput = document.getElementById('errorInput');
        this.errorLanguage = document.getElementById('errorLanguage');
        this.errorCharCount = document.getElementById('errorCharCount');
        this.decodeErrorBtn = document.getElementById('decodeErrorBtn');
        this.clearErrorBtn = document.getElementById('clearErrorBtn');
        this.webSearchToggle = document.getElementById('webSearchToggle');
    }

    bindEvents() {
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendBtn.addEventListener('click', () => this.sendMessage());

        this.newChatBtn.addEventListener('click', () => this.createNewChat());

        this.clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());

        this.sidebarClose.addEventListener('click', () => this.closeSidebar());

        this.sidebarOpen.addEventListener('click', () => this.openSidebar());

        this.userInput.addEventListener('input', () => {
            this.updateCharCount();
            this.autoResizeTextarea();
        });

        this.codeInput.addEventListener('input', () => {
            this.codeCharCount.textContent = this.codeInput.value.length + ' \u5B57\u7B26';
        });

        this.codeFileInput.addEventListener('change', (e) => this.handleCodeFileUpload(e));

        this.clearCodeBtn.addEventListener('click', () => {
            this.codeInput.value = '';
            this.codeCharCount.textContent = '0 \u5B57\u7B26';
            this.fileName.textContent = '';
        });

        this.toolPanelClose.addEventListener('click', () => this.closeCodeToolPanel());

        this.analyzeBtn.addEventListener('click', () => this.analyzeCode());

        this.toolCodeFix.addEventListener('click', () => this.openCodeTool('fix'));

        this.toolCodeAnalysis.addEventListener('click', () => this.openCodeTool('analysis'));

        this.toolSyntaxLearn.addEventListener('click', () => this.openSyntaxLearnPanel());

        this.toolAlgorithm.addEventListener('click', () => this.openAlgorithmPanel());

        this.toolErrorDecoder.addEventListener('click', () => this.openErrorDecoderPanel());

        this.syntaxPanelClose.addEventListener('click', () => this.closeSyntaxLearnPanel());

        this.syntaxLearnBtn.addEventListener('click', () => this.learnSyntax());

        document.querySelectorAll('.syntax-quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.syntaxKeyword.value = e.target.dataset.keyword;
            });
        });

        this.algorithmPanelClose.addEventListener('click', () => this.closeAlgorithmPanel());

        this.algorithmLearnBtn.addEventListener('click', () => this.learnAlgorithm());

        document.querySelectorAll('.algorithm-quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.algorithmType.value = e.target.dataset.type;
                this.algorithmName.value = e.target.dataset.name;
            });
        });

        this.errorDecoderPanelClose.addEventListener('click', () => this.closeErrorDecoderPanel());

        this.decodeErrorBtn.addEventListener('click', () => this.decodeError());

        this.clearErrorBtn.addEventListener('click', () => {
            this.errorInput.value = '';
            this.errorCharCount.textContent = '0 \u5B57\u7B26';
        });

        this.errorInput.addEventListener('input', () => {
            this.errorCharCount.textContent = this.errorInput.value.length + ' \u5B57\u7B26';
        });

        document.querySelectorAll('.error-quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.errorInput.value = e.target.dataset.error;
                this.errorCharCount.textContent = this.errorInput.value.length + ' \u5B57\u7B26';
            });
        });

        document.querySelectorAll('.quick-q').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.userInput.value = e.target.dataset.q;
                this.sendMessage();
            });
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const topic = e.currentTarget.dataset.topic;
                this.userInput.value = topic;
                this.sendMessage();
                this.closeSidebar();
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                this.sidebar.classList.remove('open');
            }
        });

        document.addEventListener('click', (e) => {
            if (this.sidebar.classList.contains('open') &&
                !this.sidebar.contains(e.target) &&
                e.target !== this.sidebarOpen) {
                this.closeSidebar();
            }
        });
    }

    autoResizeTextarea() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = Math.min(this.userInput.scrollHeight, 200) + 'px';
    }

    updateCharCount() {
        const count = this.userInput.value.length;
        this.charCount.textContent = count + '/2000';
        if (count > 2000) {
            this.userInput.value = this.userInput.value.substring(0, 2000);
            this.charCount.textContent = '2000/2000';
        }
    }

    async sendMessage() {
        const content = this.userInput.value.trim();
        if (!content) return;

        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.updateCharCount();

        if (this.messages.length === 0) {
            this.createNewChat(true);
            if (this.authToken) {
                const title = content.substring(0, 20) + (content.length > 20 ? '...' : '');
                await this.createDbConversation(title);
            }
        }

        this.addMessage('user', content);
        this.setStatus('typing');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
                },
                body: JSON.stringify({
                    messages: this.messages.map(m => ({ role: m.role, content: m.content })),
                    conversationId: this.dbConversationId
                })
            });

            const data = await response.json();

            if (data.error) {
                this.addMessage('assistant', '\u62B1\u6B49\uFF0C\u53D1\u751F\u9519\u8BEF\uFF1A' + data.error);
            } else {
                const aiContent = data.choices?.[0]?.message?.content || data.content || '\u62B1\u6B49\uFF0C\u672A\u80FD\u83B7\u53D6\u56DE\u590D\u3002';
                this.addMessage('assistant', aiContent);
                if (data.conversationId) {
                    this.dbConversationId = data.conversationId;
                }
            }

            this.setStatus('ready');
            this.scrollToBottom();
            this.saveCurrentChat();
        } catch (error) {
            console.error('\u53D1\u9001\u6D88\u606F\u5931\u8D25:', error);
            this.addMessage('assistant', '\u62B1\u6B49\uFF0C\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002');
            this.setStatus('ready');
            this.scrollToBottom();
        }
    }

    async createDbConversation(title) {
        if (!this.authToken) return;
        try {
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ title })
            });
            if (response.ok) {
                const data = await response.json();
                this.dbConversationId = data.id;
            }
        } catch (e) {
            console.error('\u521B\u5EFA\u6570\u636E\u5E93\u5BF9\u8BDD\u5931\u8D25:', e);
        }
    }

    async loadDbConversations() {
        if (!this.authToken) return [];
        try {
            const response = await fetch('/api/conversations', {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                return data.conversations || [];
            }
        } catch (e) {
            console.error('\u52A0\u8F7D\u6570\u636E\u5E93\u5BF9\u8BDD\u5931\u8D25:', e);
        }
        return [];
    }

    async deleteDbConversation(conversationId) {
        if (!this.authToken) return;
        try {
            await fetch(`/api/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
        } catch (e) {
            console.error('\u5220\u9664\u6570\u636E\u5E93\u5BF9\u8BDD\u5931\u8D25:', e);
        }
    }

    addMessage(role, content) {
        const message = {
            id: Date.now().toString(),
            role,
            content,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        };
        this.messages.push(message);

        if (role === 'assistant') {
            this.renderMessagesWithTypewriter(message);
        } else {
            this.renderMessages();
        }
    }

    renderMessagesWithTypewriter(message) {
        this.welcomeScreen.style.display = 'none';

        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.role}`;
        messageEl.id = `msg-${message.id}`;

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';

        const content = document.createElement('div');
        content.className = 'message-content typing';
        content.id = `content-${message.id}`;

        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = message.timestamp;

        messageEl.appendChild(avatar);
        messageEl.appendChild(content);
        messageEl.appendChild(timestamp);

        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();

        this.typeWriterEffect(content, message.content, message.id);
    }

    typeWriterEffect(element, text, messageId) {
        if (this.isTyping) {
            this.typingQueue.push({ element, text, messageId });
            return;
        }

        this.isTyping = true;
        let index = 0;
        let currentText = '';
        const speed = this.typingSpeed;

        const type = () => {
            if (index < text.length) {
                const char = text.charAt(index);
                currentText += char;

                if (char === '\n') {
                    element.innerHTML = this.renderMarkdown(currentText);
                } else if (char === '`' || char === '*' || char === '#' || char === '-' || char === '|') {
                    element.innerHTML = this.renderMarkdown(currentText);
                } else {
                    if (index % 3 === 0 || char === ' ' || char === '.' || char === '!' || char === '?') {
                        element.innerHTML = this.renderMarkdown(currentText);
                    }
                }

                index++;

                if (index % 5 === 0) {
                    this.highlightCode(element);
                    this.scrollToBottom();
                }

                setTimeout(type, speed);
            } else {
                element.innerHTML = this.renderMarkdown(text);
                this.highlightCode(element);
                element.classList.remove('typing');
                this.isTyping = false;
                this.scrollToBottom();

                if (this.typingQueue.length > 0) {
                    const next = this.typingQueue.shift();
                    this.typeWriterEffect(next.element, next.text, next.messageId);
                }
            }
        };

        type();
    }

    renderMessages() {
        this.welcomeScreen.style.display = 'none';
        this.messagesContainer.innerHTML = '';

        this.messages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.role}`;

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.innerHTML = msg.role === 'user' ?
                '<i class="fas fa-user"></i>' :
                '<i class="fas fa-robot"></i>';

            const content = document.createElement('div');
            content.className = 'message-content';

            if (msg.role === 'assistant') {
                content.innerHTML = this.renderMarkdown(msg.content);
                this.highlightCode(content);
            } else {
                content.textContent = msg.content;
            }

            const timestamp = document.createElement('div');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = msg.timestamp;

            messageEl.appendChild(avatar);
            messageEl.appendChild(content);
            messageEl.appendChild(timestamp);

            this.messagesContainer.appendChild(messageEl);
        });

        this.scrollToBottom();
    }

    renderMarkdown(text) {
        try {
            let decoded = text;
            decoded = decoded.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            decoded = decoded.replace(/&amp;/g, '&');
            decoded = decoded.replace(/&#39;/g, "'");
            decoded = decoded.replace(/&quot;/g, '"');

            const formatted = this.formatContent(decoded);
            const html = marked.parse(formatted);
            return html || text;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return text;
        }
    }

    formatContent(text) {
        let lines = text.split('\n');
        let result = [];
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let prevLine = i > 0 ? lines[i - 1].trim() : '';
            let nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

            if (line.trimStart().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                result.push(line);
                continue;
            }

            if (inCodeBlock) {
                result.push(line);
                continue;
            }

            let trimmed = line.trim();

            if (trimmed === '' || /^\*{2,}$/.test(trimmed) || /^-{2,}$/.test(trimmed) || /^={2,}$/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                continue;
            }

            if (/^#{1,4}\s/.test(trimmed)) {
                result.push('');
                result.push(trimmed);
                result.push('');
                continue;
            }

            if (/^(\u4E00|\u4E8C|\u4E09|\u56DB|\u4E94|\u516D|\u4E03|\u516B|\u4E5D|\u5341|\u5341\u4E00|\u5341\u4E8C|\u5341\u4E09|\u5341\u56DB|\u5341\u4E94)[\u3001.\uFF0E:\uFF1A]/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                result.push('## ' + trimmed);
                continue;
            }

            if (/^(\d+)[\u3001.\uFF0E:\uFF1A]\s*/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                let converted = trimmed.replace(/^(\d+)[\u3001.\uFF0E:\uFF1A]\s*/, '$1. ');
                result.push(converted);
                continue;
            }

            if (/^(\d+)\.\s/.test(trimmed)) {
                if (prevLine !== '' && !/^(\d+)\.\s/.test(prevLine) && !/^$/.test(prevLine)) {
                    result.push('');
                }
                result.push(trimmed);
                continue;
            }

            if (/^[-\u2022\u25CF\u25CB\u25BA\u25B8]\s/.test(trimmed)) {
                let processed = trimmed.replace(/^[-\u2022\u25CF\u25CB\u25BA\u25B8]\s/, '- ');
                result.push(processed);
                continue;
            }

            if (/^\u3010([^\u3011]+)\u3011/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                let sectionTitle = trimmed.replace(/^\u3010([^\u3011]+)\u3011\s*/, '');
                if (sectionTitle) {
                    result.push('### ' + sectionTitle);
                } else {
                    result.push('### ' + trimmed.replace(/\u3010|\u3011/g, ''));
                }
                result.push('');
                continue;
            }

            if (/^(\u6CE8\u610F|\u63D0\u793A|\u8B66\u544A|\u91CD\u8981|\u603B\u7ED3|\u7ED3\u8BBA|\u53C2\u8003|\u5EFA\u8BAE|\u6B65\u9AA4|\u5907\u6CE8|\u8BF4\u660E|\u5173\u952E|\u6838\u5FC3|\u91CD\u70B9)/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                let keyword = trimmed.match(/^(\u6CE8\u610F|\u63D0\u793A|\u8B66\u544A|\u91CD\u8981|\u603B\u7ED3|\u7ED3\u8BBA|\u53C2\u8003|\u5EFA\u8BAE|\u6B65\u9AA4|\u5907\u6CE8|\u8BF4\u660E|\u5173\u952E|\u6838\u5FC3|\u91CD\u70B9)/)[1];
                let colorClass = 'info-tag';
                if (/^(\u8B66\u544A|\u6CE8\u610F)/.test(keyword)) colorClass = 'warn-tag';
                if (/^(\u91CD\u8981|\u5173\u952E|\u6838\u5FC3|\u91CD\u70B9)/.test(keyword)) colorClass = 'important-tag';
                if (/^(\u603B\u7ED3|\u7ED3\u8BBA)/.test(keyword)) colorClass = 'summary-tag';
                if (/^(\u63D0\u793A|\u5EFA\u8BAE|\u5907\u6CE8|\u8BF4\u660E)/.test(keyword)) colorClass = 'tip-tag';
                if (/^(\u6B65\u9AA4|\u53C2\u8003)/.test(keyword)) colorClass = 'step-tag';
                result.push(`<span class="${colorClass}">${keyword}</span>**${trimmed.substring(keyword.length)}**`);
                result.push('');
                continue;
            }

            trimmed = trimmed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

            result.push(trimmed);
        }

        let finalResult = result.join('\n');
        finalResult = finalResult.replace(/\n{3,}/g, '\n\n');
        return finalResult;
    }

    highlightCode(element) {
        element.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }

    setStatus(status) {
        switch (status) {
            case 'typing':
                this.statusText.textContent = '\u601D\u8003\u4E2D...';
                this.statusIndicator.classList.add('typing');
                break;
            case 'ready':
                this.statusText.textContent = '\u5C31\u7EEA';
                this.statusIndicator.classList.remove('typing');
                break;
            case 'error':
                this.statusText.textContent = '\u9519\u8BEF';
                this.statusIndicator.classList.remove('typing');
                break;
        }
    }

    createNewChat(withMessage = false) {
        this.messages = [];
        this.dbConversationId = null;
        if (!withMessage) {
            this.currentChatId = null;
            this.welcomeScreen.style.display = 'flex';
            this.messagesContainer.innerHTML = '';
        } else {
            this.currentChatId = 'chat_' + Date.now();
        }
    }

    saveCurrentChat() {
        if (this.messages.length === 0 || !this.currentChatId) return;
        if (!this.authToken) return;

        const firstUserMsg = this.messages.find(m => m.role === 'user');
        const title = firstUserMsg
            ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
            : '\u65B0\u5BF9\u8BDD';

        const chatData = {
            id: this.currentChatId,
            title: title,
            messages: [...this.messages],
            dbId: this.dbConversationId,
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

    saveChatHistory() {
        try {
            localStorage.setItem('dev_assistant_history', JSON.stringify(this.chatHistory));
        } catch (e) {
            console.error('\u4FDD\u5B58\u804A\u5929\u8BB0\u5F55\u5931\u8D25:', e);
        }
    }

    async loadChatHistory() {
        try {
            const saved = localStorage.getItem('dev_assistant_history');
            if (saved) {
                this.chatHistory = JSON.parse(saved);
            }
        } catch (e) {
            this.chatHistory = [];
        }

        if (this.authToken) {
            const dbConversations = await this.loadDbConversations();
            const localIds = new Set(this.chatHistory.map(h => h.id));
            for (const conv of dbConversations) {
                if (!localIds.has('db_' + conv.id)) {
                    this.chatHistory.unshift({
                        id: 'db_' + conv.id,
                        title: conv.title,
                        messages: [],
                        dbId: conv.id,
                        createdAt: conv.created_at,
                        isFromDb: true
                    });
                }
            }
        }

        this.renderHistoryList();
    }

    renderHistoryList() {
        this.historyList.innerHTML = '';

        if (this.chatHistory.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-history';
            emptyEl.textContent = '\u6682\u65E0\u5BF9\u8BDD\u8BB0\u5F55';
            this.historyList.appendChild(emptyEl);
            return;
        }

        this.chatHistory.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.dataset.chatId = chat.id;

            const title = document.createElement('span');
            title.className = 'history-title';
            title.textContent = chat.title;

            const time = document.createElement('span');
            time.className = 'history-time';
            time.textContent = chat.updatedAt ?
                new Date(chat.updatedAt).toLocaleDateString('zh-CN') :
                (chat.createdAt ? new Date(chat.createdAt).toLocaleDateString('zh-CN') : '');

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'history-delete';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id, chat.dbId);
            });

            item.appendChild(title);
            item.appendChild(time);
            item.appendChild(deleteBtn);

            item.addEventListener('click', () => {
                this.loadChat(chat);
            });

            this.historyList.appendChild(item);
        });
    }

    async loadChat(chat) {
        this.currentChatId = chat.id;
        this.dbConversationId = chat.dbId;

        if (chat.isFromDb && chat.dbId && this.authToken) {
            await this.loadDbMessages(chat.dbId);
        } else {
            this.messages = chat.messages || [];
        }

        this.renderMessages();
        this.closeSidebar();
    }

    async loadDbMessages(conversationId) {
        if (!this.authToken) return;
        try {
            const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.messages = data.messages.map(m => ({
                    id: m.id.toString(),
                    role: m.role,
                    content: m.content,
                    timestamp: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                }));
            }
        } catch (e) {
            console.error('\u52A0\u8F7D\u6570\u636E\u5E93\u6D88\u606F\u5931\u8D25:', e);
        }
    }

    async deleteChat(chatId, dbId) {
        if (dbId && this.authToken) {
            await this.deleteDbConversation(dbId);
        }

        this.chatHistory = this.chatHistory.filter(c => c.id !== chatId);
        this.saveChatHistory();
        this.renderHistoryList();

        if (this.currentChatId === chatId) {
            this.createNewChat();
        }
    }

    async clearAllHistory() {
        if (!confirm('\u786E\u5B9A\u8981\u6E05\u9664\u6240\u6709\u804A\u5929\u8BB0\u5F55\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002')) return;

        if (this.authToken) {
            for (const chat of this.chatHistory) {
                if (chat.dbId) {
                    await this.deleteDbConversation(chat.dbId);
                }
            }
        }

        this.chatHistory = [];
        this.saveChatHistory();
        this.renderHistoryList();
        this.createNewChat();
    }

    openSidebar() {
        this.sidebar.classList.add('open');
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
    }

    closeAllToolPanels() {
        this.codeToolPanel.style.display = 'none';
        this.syntaxLearnPanel.style.display = 'none';
        this.algorithmPanel.style.display = 'none';
        this.errorDecoderPanel.style.display = 'none';
    }

    openCodeTool(type) {
        this.closeAllToolPanels();
        this.currentToolType = type;
        this.toolPanelTitle.innerHTML = type === 'fix' ?
            '<i class="fas fa-bug"></i> \u4EE3\u7801\u7EA0\u9519' :
            '<i class="fas fa-search-plus"></i> \u4EE3\u7801\u5206\u6790';
        this.analyzeBtnText.textContent = type === 'fix' ? '\u5F00\u59CB\u7EA0\u9519' : '\u5F00\u59CB\u5206\u6790';
        this.analyzeBtn.disabled = false;
        this.codeToolPanel.style.display = 'flex';
        this.codeInput.focus();
    }

    closeCodeToolPanel() {
        this.codeToolPanel.style.display = 'none';
        this.codeInput.value = '';
        this.codeCharCount.textContent = '0 \u5B57\u7B26';
        this.fileName.textContent = '';
        this.analyzeBtn.disabled = false;
        this.analyzeBtnText.textContent = this.currentToolType === 'fix' ? '\u5F00\u59CB\u7EA0\u9519' : '\u5F00\u59CB\u5206\u6790';
        this.cancelActiveRequest('analyze');
    }

    handleCodeFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 500 * 1024;
        if (file.size > maxSize) {
            alert('\u6587\u4EF6\u5927\u5C0F\u4E0D\u80FD\u8D85\u8FC7500KB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            this.codeInput.value = event.target.result;
            this.codeCharCount.textContent = this.codeInput.value.length + ' \u5B57\u7B26';
            this.fileName.textContent = file.name;
        };
        reader.readAsText(file);
    }

    cancelActiveRequest(key) {
        const controller = this.activeRequests.get(key);
        if (controller) {
            controller.abort();
            this.activeRequests.delete(key);
        }
    }

    setButtonLoading(btn, loadingText) {
        btn.disabled = true;
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');
        if (icon) icon.style.display = 'none';
        if (span) span.textContent = loadingText;
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner';
        btn.insertBefore(spinner, btn.firstChild);
    }

    resetButton(btn, iconClass, text) {
        btn.disabled = false;
        const spinner = btn.querySelector('.loading-spinner');
        if (spinner) spinner.remove();
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = iconClass;
            icon.style.display = '';
        }
        const span = btn.querySelector('span');
        if (span) span.textContent = text;
    }

    async analyzeCode() {
        const code = this.codeInput.value.trim();
        if (!code) {
            alert('\u8BF7\u8F93\u5165\u6216\u4E0A\u4F20\u4EE3\u7801');
            return;
        }

        if (code.length > 10000) {
            alert('\u4EE3\u7801\u957F\u5EA6\u4E0D\u80FD\u8D85\u8FC710000\u5B57\u7B26');
            return;
        }

        const language = this.codeLanguage.value;
        const toolType = this.currentToolType;

        this.cancelActiveRequest('analyze');
        const controller = new AbortController();
        this.activeRequests.set('analyze', controller);
        const timeout = setTimeout(() => controller.abort(), 125000);

        const loadingText = toolType === 'fix' ? '\u7EA0\u9519\u4E2D...' : '\u5206\u6790\u4E2D...';
        this.setButtonLoading(this.analyzeBtn, loadingText);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
                },
                body: JSON.stringify({
                    code,
                    language,
                    type: toolType
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const data = await response.json();

            if (data.error) {
                alert('\u5206\u6790\u5931\u8D25\uFF1A' + data.error);
            } else {
                this.userInput.value = toolType === 'fix' ?
                    `\u8BF7\u5E2E\u6211\u7EA0\u9519\u8FD9\u6BB5${language}\u4EE3\u7801\uFF1A\n\n${code}\n\n\u9519\u8BEF\u5206\u6790\uFF1A${data.content}` :
                    `\u8BF7\u5E2E\u6211\u5206\u6790\u8FD9\u6BB5${language}\u4EE3\u7801\uFF1A\n\n${code}\n\n\u5206\u6790\u7ED3\u679C\uFF1A${data.content}`;
                this.closeCodeToolPanel();
                this.sendMessage();
            }
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                alert('\u8BF7\u6C42\u5DF2\u53D6\u6D88\u6216\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            } else {
                alert('\u8BF7\u6C42\u8D85\u65F6\u6216\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            }
        } finally {
            this.activeRequests.delete('analyze');
            const iconClass = toolType === 'fix' ? 'fas fa-bug' : 'fas fa-search-plus';
            const text = toolType === 'fix' ? '\u5F00\u59CB\u7EA0\u9519' : '\u5F00\u59CB\u5206\u6790';
            this.resetButton(this.analyzeBtn, iconClass, text);
        }
    }

    openSyntaxLearnPanel() {
        this.closeAllToolPanels();
        this.syntaxLearnPanel.style.display = 'flex';
        this.syntaxKeyword.focus();
    }

    closeSyntaxLearnPanel() {
        this.syntaxLearnPanel.style.display = 'none';
        this.syntaxKeyword.value = '';
        this.syntaxLearnBtn.disabled = false;
        this.cancelActiveRequest('learn');
    }

    async learnSyntax() {
        const language = this.syntaxLanguage.value;
        const keyword = this.syntaxKeyword.value.trim();

        if (!keyword) {
            alert('\u8BF7\u8F93\u5165\u8BED\u6CD5\u5173\u952E\u8BCD');
            return;
        }

        this.cancelActiveRequest('learn');
        const controller = new AbortController();
        this.activeRequests.set('learn', controller);
        const timeout = setTimeout(() => controller.abort(), 125000);

        this.setButtonLoading(this.syntaxLearnBtn, '\u5B66\u4E60\u4E2D...');

        try {
            const response = await fetch('/api/learn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
                },
                body: JSON.stringify({
                    language,
                    keyword,
                    type: 'syntax'
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const data = await response.json();

            if (data.error) {
                alert('\u5B66\u4E60\u5931\u8D25\uFF1A' + data.error);
            } else {
                this.userInput.value = `\u8BF7\u8BE6\u7EC6\u8BB2\u89E3${language}\u8BED\u8A00\u4E2D\u7684"${keyword}"\u8BED\u6CD5\uFF0C\u5305\u62EC\u7528\u6CD5\u3001\u793A\u4F8B\u548C\u6700\u4F73\u5B9E\u8DF5\u3002\n\n${data.content}`;
                this.closeSyntaxLearnPanel();
                this.sendMessage();
            }
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                alert('\u8BF7\u6C42\u5DF2\u53D6\u6D88\u6216\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            } else {
                alert('\u8BF7\u6C42\u8D85\u65F6\u6216\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            }
        } finally {
            this.activeRequests.delete('learn');
            this.resetButton(this.syntaxLearnBtn, 'fas fa-lightbulb', '\u5F00\u59CB\u5B66\u4E60');
        }
    }

    openAlgorithmPanel() {
        this.closeAllToolPanels();
        this.algorithmPanel.style.display = 'flex';
        this.algorithmName.focus();
    }

    closeAlgorithmPanel() {
        this.algorithmPanel.style.display = 'none';
        this.algorithmName.value = '';
        this.algorithmLearnBtn.disabled = false;
        this.cancelActiveRequest('algorithm');
    }

    async learnAlgorithm() {
        const type = this.algorithmType.value;
        const name = this.algorithmName.value.trim();

        if (!name) {
            alert('\u8BF7\u8F93\u5165\u7B97\u6CD5\u540D\u79F0');
            return;
        }

        this.cancelActiveRequest('algorithm');
        const controller = new AbortController();
        this.activeRequests.set('algorithm', controller);
        const timeout = setTimeout(() => controller.abort(), 125000);

        this.setButtonLoading(this.algorithmLearnBtn, '\u8BB2\u89E3\u4E2D...');

        try {
            const response = await fetch('/api/learn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
                },
                body: JSON.stringify({
                    type: 'algorithm',
                    algorithmType: type,
                    name
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const data = await response.json();

            if (data.error) {
                alert('\u8BB2\u89E3\u5931\u8D25\uFF1A' + data.error);
            } else {
                this.userInput.value = `\u8BF7\u8BE6\u7EC6\u8BB2\u89E3"${name}"\u7B97\u6CD5\uFF0C\u5305\u62EC\u539F\u7406\u3001\u5B9E\u73B0\u6B65\u9AA4\u3001\u65F6\u95F4\u590D\u6742\u5EA6\u5206\u6790\u548C\u4EE3\u7801\u793A\u4F8B\u3002\n\n${data.content}`;
                this.closeAlgorithmPanel();
                this.sendMessage();
            }
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                alert('\u8BF7\u6C42\u5DF2\u53D6\u6D88\u6216\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            } else {
                alert('\u8BF7\u6C42\u8D85\u65F6\u6216\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            }
        } finally {
            this.activeRequests.delete('algorithm');
            this.resetButton(this.algorithmLearnBtn, 'fas fa-play-circle', '\u5F00\u59CB\u8BB2\u89E3');
        }
    }

    openErrorDecoderPanel() {
        this.closeAllToolPanels();
        this.errorDecoderPanel.style.display = 'flex';
        this.errorInput.focus();
    }

    closeErrorDecoderPanel() {
        this.errorDecoderPanel.style.display = 'none';
        this.errorInput.value = '';
        this.errorCharCount.textContent = '0 \u5B57\u7B26';
        this.decodeErrorBtn.disabled = false;
        this.cancelActiveRequest('decode');
    }

    async decodeError() {
        const error = this.errorInput.value.trim();
        if (!error) {
            alert('\u8BF7\u8F93\u5165\u9519\u8BEF\u4FE1\u606F');
            return;
        }

        if (error.length > 5000) {
            alert('\u9519\u8BEF\u4FE1\u606F\u4E0D\u80FD\u8D85\u8FC75000\u5B57\u7B26');
            return;
        }

        const language = this.errorLanguage.value;

        this.cancelActiveRequest('decode');
        const controller = new AbortController();
        this.activeRequests.set('decode', controller);
        const timeout = setTimeout(() => controller.abort(), 125000);

        this.setButtonLoading(this.decodeErrorBtn, '\u89E3\u8BFB\u4E2D...');

        try {
            const response = await fetch('/api/decode-error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
                },
                body: JSON.stringify({
                    error,
                    language
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const data = await response.json();

            if (data.error) {
                alert('\u89E3\u8BFB\u5931\u8D25\uFF1A' + data.error);
            } else {
                this.userInput.value = `\u8BF7\u5E2E\u6211\u89E3\u8BFB\u8FD9\u4E2A${language}\u9519\u8BEF\uFF1A\n\n${error}\n\n\u89E3\u8BFB\u7ED3\u679C\uFF1A${data.content}`;
                this.closeErrorDecoderPanel();
                this.sendMessage();
            }
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                alert('\u8BF7\u6C42\u5DF2\u53D6\u6D88\u6216\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            } else {
                alert('\u8BF7\u6C42\u8D85\u65F6\u6216\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
            }
        } finally {
            this.activeRequests.delete('decode');
            this.resetButton(this.decodeErrorBtn, 'fas fa-search', '\u89E3\u8BFB\u9519\u8BEF');
        }
    }

    setupMarked() {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DevAssistant();
});
