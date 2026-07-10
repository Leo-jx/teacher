class DevAssistant {
    constructor() {
        this.messages = [];
        this.chatHistory = [];
        this.currentChatId = null;
        this.isTyping = false;
        this.typingQueue = [];
        this.typingSpeed = 15;
        this.authToken = null;
        this.username = null;
        this.userId = null;
        this.dbConversationId = null;
        this.activeRequests = new Map();
        this.pendingLearningPathMindmap = false;

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
        this.loadPracticeProgress();
        this.initLearningPath();
        this.showApp();
    }

    initLearningPath() {
        this.selectedLearningPath = null;
        const dateInput = document.getElementById('planStartDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
        this.loadLearningProgress();
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
        this.webSearchToggle = document.getElementById('webSearchToggle');
        
        this.codeToolItems = document.querySelectorAll('.code-tools .tool-item');
        this.codeToolPanels = document.querySelectorAll('.code-tool-panel');
        this.panelCloseBtns = document.querySelectorAll('.tool-panel-close');
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

        this.codeToolItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.openCodeTool(tool);
            });
        });

        this.panelCloseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panelId = e.currentTarget.dataset.panel;
                this.closeCodeToolPanel(panelId);
            });
        });

        document.getElementById('clearFixCode')?.addEventListener('click', () => {
            document.getElementById('fixCodeInput').value = '';
        });

        document.getElementById('clearAnalyzeCode')?.addEventListener('click', () => {
            document.getElementById('analyzeCodeInput').value = '';
        });

        document.getElementById('clearError')?.addEventListener('click', () => {
            document.getElementById('errorInput').value = '';
        });

        document.getElementById('fixCodeBtn')?.addEventListener('click', () => this.fixCode());
        document.getElementById('analyzeCodeBtn')?.addEventListener('click', () => this.analyzeCode());
        document.getElementById('learnSyntaxBtn')?.addEventListener('click', () => this.learnSyntax());
        document.getElementById('learnAlgorithmBtn')?.addEventListener('click', () => this.learnAlgorithm());
        document.getElementById('decodeErrorBtn')?.addEventListener('click', () => this.decodeError());
        document.getElementById('practiceBtn')?.addEventListener('click', () => this.startPractice());

        document.querySelectorAll('.learning-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchLearningTab(e.target.dataset.tab));
        });

        document.querySelectorAll('.learning-path-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectLearningPath(e.currentTarget.dataset.path));
        });

        document.getElementById('startLearningBtn')?.addEventListener('click', () => this.startLearning());
        document.getElementById('createPlanBtn')?.addEventListener('click', () => this.createLearningPlan());

        document.getElementById('generateMindmapBtn')?.addEventListener('click', () => this.generateMindmap());
        document.getElementById('viewMindmapCodeBtn')?.addEventListener('click', () => this.toggleMindmapCode());
        document.getElementById('exportMindmapCodeBtn')?.addEventListener('click', () => this.exportMindmapCode());
        document.getElementById('copyMindmapCodeBtn')?.addEventListener('click', () => this.copyMindmapCode());
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
                    this.scrollToBottom();
                }

                setTimeout(type, speed);
            } else {
                element.innerHTML = this.renderMarkdown(text);
                element.classList.remove('typing');
                this.isTyping = false;
                this.scrollToBottom();

                if (this.pendingLearningPathMindmap) {
                    this.pendingLearningPathMindmap = false;
                    setTimeout(() => this.generateLearningPathMindmap(text, element), 200);
                }

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

    openCodeTool(tool) {
        this.closeAllToolPanels();
        this.codeToolItems.forEach(item => item.classList.remove('active'));
        
        const activeItem = document.querySelector(`.code-tools .tool-item[data-tool="${tool}"]`);
        if (activeItem) activeItem.classList.add('active');

        const panelMap = {
            'fix': 'codeFixPanel',
            'analyze': 'codeAnalyzePanel',
            'syntax': 'syntaxLearnPanel',
            'algorithm': 'algorithmPanel',
            'error': 'errorDecoderPanel',
            'practice': 'practicePanel',
            'learning': 'learningPathPanel'
        };

        const panelId = panelMap[tool];
        if (panelId) {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('active');
            }
        }
        
        this.closeSidebar();
    }

    closeCodeToolPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.remove('active');
        }
        this.codeToolItems.forEach(item => item.classList.remove('active'));
    }

    closeAllToolPanels() {
        this.codeToolPanels.forEach(panel => panel.classList.remove('active'));
    }

    async fixCode() {
        const code = document.getElementById('fixCodeInput')?.value?.trim();
        const lang = document.getElementById('fixLangSelect')?.value || 'auto';
        
        if (!code) {
            alert('请输入需要纠错的代码');
            return;
        }

        this.closeAllToolPanels();
        this.createNewChat(true);
        
        const prompt = `请帮我检查以下${lang === 'auto' ? '' : lang}代码中的错误并提供修复建议：\n\n${code}`;
        this.userInput.value = prompt;
        await this.sendMessage();
    }

    async analyzeCode() {
        const code = document.getElementById('analyzeCodeInput')?.value?.trim();
        const lang = document.getElementById('analyzeLangSelect')?.value || 'auto';
        
        if (!code) {
            alert('请输入需要分析的代码');
            return;
        }

        this.closeAllToolPanels();
        this.createNewChat(true);
        
        const prompt = `请分析以下${lang === 'auto' ? '' : lang}代码的结构、逻辑和潜在问题：\n\n${code}`;
        this.userInput.value = prompt;
        await this.sendMessage();
    }

    async learnSyntax() {
        const lang = document.getElementById('syntaxLangSelect')?.value || 'java';
        const keyword = document.getElementById('syntaxKeywordInput')?.value?.trim();
        
        if (!keyword) {
            alert('请输入语法关键词');
            return;
        }

        this.closeAllToolPanels();
        this.createNewChat(true);
        
        const prompt = `请讲解${lang}中"${keyword}"的语法用法`;
        this.userInput.value = prompt;
        await this.sendMessage();
    }

    async learnAlgorithm() {
        const type = document.getElementById('algorithmTypeSelect')?.value || 'sort';
        const name = document.getElementById('algorithmNameInput')?.value?.trim();
        
        if (!name) {
            alert('请输入算法名称');
            return;
        }

        this.closeAllToolPanels();
        this.createNewChat(true);
        
        const typeNames = {
            'sort': '排序',
            'search': '搜索',
            'dp': '动态规划',
            'graph': '图',
            'tree': '树',
            'other': ''
        };
        
        const prompt = `请讲解${typeNames[type]}算法"${name}"的原理和实现思路`;
        this.userInput.value = prompt;
        await this.sendMessage();
    }

    async decodeError() {
        const error = document.getElementById('errorInput')?.value?.trim();
        const lang = document.getElementById('errorLangSelect')?.value || 'auto';
        
        if (!error) {
            alert('请输入错误信息');
            return;
        }

        this.closeAllToolPanels();
        this.createNewChat(true);
        
        const prompt = `请分析以下${lang === 'auto' ? '' : lang}错误信息的原因和解决方案：\n\n${error}`;
        this.userInput.value = prompt;
        await this.sendMessage();
    }

    async startPractice() {
        const category = document.getElementById('practiceCategorySelect')?.value || 'basic';
        const difficulty = document.getElementById('practiceDifficultySelect')?.value || 'easy';
        const lang = document.getElementById('practiceLangSelect')?.value || 'java';
        const count = document.getElementById('practiceCountSelect')?.value || '3';

        const categoryNames = {
            'basic': '基础语法',
            'datastructure': '数据结构',
            'algorithm': '算法思维',
            'database': '数据库',
            'framework': '框架应用',
            'comprehensive': '综合实战'
        };

        const difficultyNames = {
            'easy': '入门',
            'medium': '进阶',
            'hard': '挑战'
        };

        this.closeAllToolPanels();
        this.createNewChat(true);

        const prompt = `请给我出${count}道${lang}的${categoryNames[category]}练习题，难度为${difficultyNames[difficulty]}级。

要求：
1. 每道题包含：题目描述、输入输出要求、示例
2. 题目由浅入深排列
3. 在所有题目之后，给出每道题的详细解题思路分析
4. 提供参考代码实现
5. 给出常见错误提示和代码优化建议
6. 标注每道题考察的核心知识点`;

        this.userInput.value = prompt;
        await this.sendMessage();

        this.updatePracticeProgress(parseInt(count));
    }

    updatePracticeProgress(newCount) {
        let progress = JSON.parse(localStorage.getItem('practice_progress') || '{"completed":0,"total":0}');
        progress.total += newCount;
        progress.completed += newCount;
        localStorage.setItem('practice_progress', JSON.stringify(progress));

        const completedEl = document.getElementById('practiceCompleted');
        const totalEl = document.getElementById('practiceTotal');
        const fillEl = document.getElementById('practiceProgressFill');

        if (completedEl) completedEl.textContent = progress.completed;
        if (totalEl) totalEl.textContent = progress.total;
        if (fillEl) fillEl.style.width = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) + '%' : '0%';
    }

    loadPracticeProgress() {
        const progress = JSON.parse(localStorage.getItem('practice_progress') || '{"completed":0,"total":0}');
        const completedEl = document.getElementById('practiceCompleted');
        const totalEl = document.getElementById('practiceTotal');
        const fillEl = document.getElementById('practiceProgressFill');

        if (completedEl) completedEl.textContent = progress.completed;
        if (totalEl) totalEl.textContent = progress.total;
        if (fillEl) fillEl.style.width = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) + '%' : '0%';
    }

    switchLearningTab(tab) {
        document.querySelectorAll('.learning-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.learning-tab[data-tab="${tab}"]`)?.classList.add('active');

        document.getElementById('learningPathsContent').style.display = tab === 'paths' ? 'block' : 'none';
        document.getElementById('learningPlanContent').style.display = tab === 'plan' ? 'block' : 'none';
        document.getElementById('learningProgressContent').style.display = tab === 'progress' ? 'block' : 'none';
        document.getElementById('mindmapContent').style.display = tab === 'mindmap' ? 'block' : 'none';

        if (tab === 'plan') {
            this.loadLearningPlans();
        } else if (tab === 'progress') {
            this.loadLearningProgress();
        }
    }

    analyzeMindmapText(text) {
        const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
        const root = { title: '核心主题', children: [] };
        const stopWords = new Set(['的', '了', '和', '与', '或', '在', '是', '为', '及', '等', '可', '以', '需', '要', '应', '该', '将', '被', '把', '让', '使', '由', '从', '到', '向', '对', '于', '并', '且', '而', '但', '则', '即', '也', '都', '已', '已经', '能够', '可以', '应该', '需要', '进行', '通过', '关于', '对于']);

        const extractKeywords = (sentence) => {
            const cleaned = sentence.replace(/[，。；：、！？""''（）()【】《》\[\]{}.,;:!?'"`~\-_+=|\\/<>@#$%^&*]/g, ' ');
            const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && w.length <= 8 && !stopWords.has(w));
            return words;
        };

        if (paragraphs.length === 0) return root;

        const firstLineKeywords = extractKeywords(paragraphs[0]);
        root.title = firstLineKeywords.slice(0, 4).join('') || paragraphs[0].substring(0, 12);

        paragraphs.forEach((para, idx) => {
            const sentences = para.split(/[。！？.!?；;]/).map(s => s.trim()).filter(s => s.length > 4);
            if (sentences.length === 0) return;

            const topicKeywords = extractKeywords(sentences[0]);
            const topicTitle = topicKeywords.slice(0, 3).join('') || `主题${idx + 1}`;

            const branch = {
                title: topicTitle,
                children: []
            };

            sentences.slice(0, 4).forEach(sentence => {
                const keywords = extractKeywords(sentence);
                const suggestion = keywords.slice(0, 2).join('') || sentence.substring(0, 10);
                branch.children.push({
                    title: suggestion,
                    children: []
                });
            });

            root.children.push(branch);
        });

        if (root.children.length === 0) {
            root.children.push({ title: '主要观点', children: [{ title: '详见原文', children: [] }] });
        }

        return root;
    }

    renderMindmapSVG(data) {
        const palette = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff7675', '#a29bfe', '#55efc4', '#ffeaa7', '#fab1a0'];
        const levelHeight = 80;
        const nodeWidth = 180;
        const nodeHeight = 44;
        const hGap = 60;
        const padding = 40;

        const countLeaves = (node) => {
            if (!node.children || node.children.length === 0) return 1;
            return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
        };

        const totalLeaves = countLeaves(data);
        const treeDepth = (node, depth = 0) => {
            if (!node.children || node.children.length === 0) return depth;
            return Math.max(...node.children.map(c => treeDepth(c, depth + 1)));
        };
        const maxDepth = treeDepth(data);

        const width = padding * 2 + (maxDepth + 1) * (nodeWidth + hGap);
        const height = padding * 2 + totalLeaves * levelHeight;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="mindmap-svg">`;
        svg += `<rect width="${width}" height="${height}" fill="#0f0f1a"/>`;

        const layoutNode = (node, x, yCenter, depth, color) => {
            const leaves = countLeaves(node);
            const nodeY = yCenter;

            if (node.children && node.children.length > 0) {
                let currentY = yCenter - (leaves * levelHeight) / 2 + levelHeight / 2;
                node.children.forEach((child, i) => {
                    const childLeaves = countLeaves(child);
                    const childYCenter = currentY + (childLeaves * levelHeight) / 2;
                    const childColor = depth === 0 ? palette[i % palette.length] : color;
                    const childX = x + nodeWidth + hGap;

                    svg += `<path d="M ${x + nodeWidth} ${nodeY + nodeHeight / 2} C ${(x + nodeWidth + childX) / 2} ${nodeY + nodeHeight / 2}, ${(x + nodeWidth + childX) / 2} ${childYCenter + nodeHeight / 2}, ${childX} ${childYCenter + nodeHeight / 2}" stroke="${childColor}" stroke-width="2" fill="none" opacity="0.6"/>`;

                    layoutNode(child, childX, childYCenter, depth + 1, childColor);
                    currentY += childLeaves * levelHeight;
                });
            }

            const fillColor = depth === 0 ? '#6c5ce7' : color;
            const textColor = '#ffffff';
            const fontSize = depth === 0 ? 16 : (depth === 1 ? 14 : 12);
            const fontWeight = depth <= 1 ? 600 : 400;
            const title = (node.title || '').substring(0, 14);

            svg += `<rect x="${x}" y="${nodeY}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="${fillColor}" opacity="${depth === 0 ? 1 : 0.85}"/>`;
            svg += `<text x="${x + nodeWidth / 2}" y="${nodeY + nodeHeight / 2 + 5}" text-anchor="middle" fill="${textColor}" font-size="${fontSize}" font-weight="${fontWeight}" font-family="PingFang SC, Microsoft YaHei, sans-serif">${title}</text>`;
        };

        const rootYCenter = height / 2 - nodeHeight / 2;
        layoutNode(data, padding, rootYCenter, 0, palette[0]);

        svg += '</svg>';
        return svg;
    }

    generateMindmap() {
        const text = document.getElementById('mindmapTextInput')?.value?.trim();
        if (!text) {
            alert('请输入需要总结的文本内容');
            return;
        }

        const data = this.analyzeMindmapText(text);
        const svgContent = this.renderMindmapSVG(data);
        this.currentMindmapSVG = svgContent;

        const previewSection = document.getElementById('mindmapPreviewSection');
        if (previewSection) {
            previewSection.innerHTML = `
                <div class="mindmap-preview-header">
                    <span><i class="fas fa-check-circle"></i> 思维导图已生成</span>
                </div>
                <div class="mindmap-preview-canvas">${svgContent}</div>
            `;
        }

        const codeBlock = document.getElementById('mindmapCodeBlock');
        if (codeBlock) {
            codeBlock.textContent = svgContent;
        }

        const codeSection = document.getElementById('mindmapCodeSection');
        if (codeSection) {
            codeSection.style.display = 'none';
        }
    }

    toggleMindmapCode() {
        if (!this.currentMindmapSVG) {
            alert('请先生成思维导图');
            return;
        }
        const codeSection = document.getElementById('mindmapCodeSection');
        if (codeSection) {
            codeSection.style.display = codeSection.style.display === 'none' ? 'block' : 'none';
        }
    }

    exportMindmapCode() {
        if (!this.currentMindmapSVG) {
            alert('请先生成思维导图');
            return;
        }
        const blob = new Blob([this.currentMindmapSVG], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindmap_${Date.now()}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    copyMindmapCode() {
        if (!this.currentMindmapSVG) {
            alert('请先生成思维导图');
            return;
        }
        navigator.clipboard.writeText(this.currentMindmapSVG).then(() => {
            const btn = document.getElementById('copyMindmapCodeBtn');
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> 已复制';
                setTimeout(() => { btn.innerHTML = original; }, 1500);
            }
        }).catch(() => alert('复制失败，请手动选择代码复制'));
    }

    selectLearningPath(path) {
        document.querySelectorAll('.learning-path-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`.learning-path-card[data-path="${path}"]`)?.classList.add('selected');
        this.selectedLearningPath = path;
    }

    getLearningPathData(path) {
        const paths = {
            'java': {
                name: 'Java全栈开发',
                icon: 'fab fa-java',
                description: '从基础语法到Spring Boot微服务架构',
                modules: [
                    'Java基础语法', '面向对象编程', '集合框架', '异常处理',
                    'IO与NIO', '多线程编程', 'JVM原理', '设计模式',
                    'Spring框架', 'Spring Boot', 'MyBatis/JPA', '微服务架构'
                ],
                resources: [
                    '《Java核心技术》', '《Effective Java》', '《Spring实战》',
                    '官方文档', 'LeetCode练习', '实战项目'
                ]
            },
            'python': {
                name: 'Python数据分析',
                icon: 'fab fa-python',
                description: '从Python基础到数据分析与机器学习',
                modules: [
                    'Python基础语法', '数据结构', '函数与模块', '面向对象',
                    '文件操作', 'NumPy基础', 'Pandas数据分析', 'Matplotlib可视化',
                    'Scikit-learn入门', '机器学习基础', '深度学习入门', '项目实战'
                ],
                resources: [
                    '《Python编程：从入门到实践》', '《利用Python进行数据分析》',
                    'Kaggle竞赛', '官方文档', 'Jupyter Notebook'
                ]
            },
            'javascript': {
                name: 'JavaScript前端开发',
                icon: 'fab fa-js-square',
                description: 'ES6+语法、Vue/React框架、工程化实践',
                modules: [
                    'JavaScript基础', 'ES6+新特性', 'DOM操作', '异步编程',
                    '模块化开发', 'TypeScript基础', 'Vue3框架', 'React框架',
                    '状态管理', '工程化工具', '性能优化', '项目实战'
                ],
                resources: [
                    '《JavaScript高级程序设计》', '《ES6标准入门》',
                    'MDN文档', 'Vue官方文档', 'React官方文档'
                ]
            },
            'cpp': {
                name: 'C++系统编程',
                icon: 'fas fa-microchip',
                description: '指针内存管理、STL、高性能服务器开发',
                modules: [
                    'C++基础语法', '指针与引用', '内存管理', '面向对象',
                    'STL容器', 'STL算法', '智能指针', '多线程编程',
                    '网络编程', '设计模式', '性能优化', '服务器开发'
                ],
                resources: [
                    '《C++ Primer》', '《Effective C++》', '《STL源码剖析》',
                    'LeetCode练习', '开源项目学习'
                ]
            },
            'mysql': {
                name: 'MySQL数据库',
                icon: 'fas fa-database',
                description: 'SQL语法、索引优化、主从复制与分库分表',
                modules: [
                    'SQL基础语法', '数据类型', '表设计', '索引原理',
                    '查询优化', '事务与锁', '存储过程', '触发器',
                    '主从复制', '分库分表', '性能调优', '高可用架构'
                ],
                resources: [
                    '《高性能MySQL》', '《MySQL技术内幕》',
                    '官方文档', '实战案例', '性能分析工具'
                ]
            },
            'vue': {
                name: 'Vue3全家桶',
                icon: 'fab fa-vuejs',
                description: 'Composition API、Pinia、Vue Router实战',
                modules: [
                    'Vue3基础', 'Composition API', '响应式原理', '组件设计',
                    'Vue Router', 'Pinia状态管理', '表单处理', 'HTTP请求',
                    '组件库使用', '自定义指令', '性能优化', '项目实战'
                ],
                resources: [
                    '《Vue.js设计与实现》', 'Vue官方文档',
                    'Vue Router文档', 'Pinia文档', 'Element Plus'
                ]
            }
        };
        return paths[path] || null;
    }

    loadLearningPlans() {
        const plans = JSON.parse(localStorage.getItem('learning_plans') || '[]');
        const listEl = document.getElementById('myPlansList');
        if (!listEl) return;

        if (plans.length === 0) {
            listEl.innerHTML = `
                <div class="empty-plans">
                    <i class="fas fa-clipboard-list"></i>
                    <p>暂无学习计划，快创建一个吧！</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = plans.map(plan => {
            const pathData = this.getLearningPathData(plan.path);
            return `
                <div class="plan-item" data-plan-id="${plan.id}">
                    <div class="plan-item-icon"><i class="${pathData?.icon || 'fas fa-book'}"></i></div>
                    <div class="plan-item-info">
                        <h5>${pathData?.name || plan.path}</h5>
                        <p>目标: ${plan.goal || '未设置'} | 每日${plan.dailyTime}分钟</p>
                    </div>
                    <div class="plan-item-progress">
                        <span>${plan.progress || 0}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadLearningProgress() {
        const progress = JSON.parse(localStorage.getItem('learning_progress') || '{}');
        const plans = JSON.parse(localStorage.getItem('learning_plans') || '[]');

        document.getElementById('totalPathsEnrolled').textContent = plans.length;
        document.getElementById('completedModules').textContent = progress.completedModules || 0;
        document.getElementById('studyStreak').textContent = progress.studyStreak || 0;
        document.getElementById('totalStudyTime').textContent = (progress.totalStudyTime || 0) + 'h';

        const detailsEl = document.getElementById('progressDetails');
        if (!detailsEl) return;

        if (plans.length === 0) {
            detailsEl.innerHTML = `
                <div class="empty-progress">
                    <i class="fas fa-chart-line"></i>
                    <p>开始学习后，这里将显示您的学习进度</p>
                </div>
            `;
            return;
        }

        detailsEl.innerHTML = plans.map(plan => {
            const pathData = this.getLearningPathData(plan.path);
            const totalModules = pathData?.modules?.length || 12;
            const completedModules = plan.completedModules || 0;
            const currentModule = plan.currentModule || 0;
            const progressPercent = Math.round((completedModules / totalModules) * 100);

            const modulesHtml = pathData?.modules?.map((mod, idx) => {
                let status = 'pending';
                if (idx < completedModules) status = 'completed';
                else if (idx === currentModule) status = 'current';
                return `<div class="progress-module-dot ${status}">${idx + 1}</div>`;
            }).join('') || '';

            return `
                <div class="progress-path-item">
                    <div class="progress-path-header">
                        <h5><i class="${pathData?.icon || 'fas fa-book'}"></i> ${pathData?.name || plan.path}</h5>
                        <span>${progressPercent}%</span>
                    </div>
                    <div class="progress-modules-bar">
                        <div class="progress-modules-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-modules-list">${modulesHtml}</div>
                </div>
            `;
        }).join('');
    }

    async startLearning() {
        const selectedPath = this.selectedLearningPath;
        if (!selectedPath) {
            alert('请先选择一个学习路径');
            return;
        }

        const pathData = this.getLearningPathData(selectedPath);
        if (!pathData) return;

        const levelSelect = document.getElementById('learningLevelSelect');
        const level = levelSelect?.value || 'beginner';
        const levelNames = {
            'beginner': '入门阶段',
            'intermediate': '进阶阶段',
            'advanced': '高级阶段'
        };

        this.closeAllToolPanels();
        this.createNewChat(true);

        const prompt = `我正在学习【${pathData.name}】学习路径，当前处于${levelNames[level]}。

请为我制定详细的学习计划，包括：

1. **学习目标**：明确本阶段需要掌握的核心技能
2. **学习模块**：列出需要学习的模块清单
3. **学习资源推荐**：
${pathData.resources.map(r => `   - ${r}`).join('\n')}
4. **学习建议**：针对${levelNames[level]}的学习方法和注意事项
5. **实践项目**：推荐适合当前水平的练习项目
6. **时间规划**：建议的学习时间安排

学习路径包含以下模块：
${pathData.modules.map((m, i) => `${i + 1}. ${m}`).join('\n')}

请给出详细的学习指导。`;

        this.userInput.value = prompt;
        this.pendingLearningPathMindmap = true;
        await this.sendMessage();

        this.updateLearningProgress(selectedPath);
    }

    parseLearningPathText(text) {
        const root = { title: '学习路径', children: [] };
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        const mainTitleMatch = text.match(/【([^】]+)】/);
        if (mainTitleMatch) {
            root.title = mainTitleMatch[1];
        }

        const sectionPatterns = [
            { regex: /^#{1,3}\s*(.+)$|^[\d一二三四五六七八九十]+[.、\)]\s*\*{0,2}(.+?)\*{0,2}$/, type: 'section' },
        ];

        let currentSection = null;
        let lastSectionNode = null;

        lines.forEach(line => {
            const cleanLine = line.replace(/^#{1,6}\s*/, '').replace(/\*+/g, '').replace(/^[一二三四五六七八九十\d]+[.、\)]\s*/, '').trim();
            if (!cleanLine || cleanLine.length < 2) return;

            const isSection = /^#{1,3}\s/.test(line) || /^[\d一二三四五六七八九十]+[.、\)]\s*\*{0,2}[^*]+\*{0,2}$/.test(line);
            const isSubItem = /^[-•\*]\s/.test(line) || /^\d+\.\d+\s/.test(line);

            if (isSection && cleanLine.length < 20) {
                lastSectionNode = { title: cleanLine, children: [] };
                root.children.push(lastSectionNode);
                currentSection = lastSectionNode;
            } else if (isSubItem && currentSection) {
                const subContent = cleanLine.replace(/^[-•\*]\s*/, '').replace(/^\d+\.\d+\s*/, '').trim();
                if (subContent.length > 0) {
                    currentSection.children.push({
                        title: subContent.substring(0, 30),
                        children: []
                    });
                }
            } else if (lastSectionNode && cleanLine.length > 5) {
                lastSectionNode.children.push({
                    title: cleanLine.substring(0, 30),
                    children: []
                });
            } else if (cleanLine.length > 5) {
                root.children.push({
                    title: cleanLine.substring(0, 30),
                    children: []
                });
            }
        });

        if (root.children.length === 0) {
            const fallback = this.analyzeMindmapText(text);
            return fallback;
        }

        return root;
    }

    generateLearningPathMindmap(text, messageElement) {
        const data = this.parseLearningPathText(text);
        const svgContent = this.renderMindmapSVG(data);

        const existingMindmap = messageElement.parentElement.querySelector('.learning-path-mindmap');
        if (existingMindmap) existingMindmap.remove();

        const mindmapWrapper = document.createElement('div');
        mindmapWrapper.className = 'learning-path-mindmap';
        mindmapWrapper.innerHTML = `
            <div class="mindmap-divider">
                <span><i class="fas fa-project-diagram"></i> 学习路径思维导图（自动生成）</span>
            </div>
            <div class="mindmap-canvas-wrapper">${svgContent}</div>
            <div class="mindmap-actions-bar">
                <button class="mindmap-action-btn" data-action="view-code">
                    <i class="fas fa-code"></i> 查看代码
                </button>
                <button class="mindmap-action-btn" data-action="export-svg">
                    <i class="fas fa-download"></i> 导出SVG
                </button>
                <button class="mindmap-action-btn" data-action="copy">
                    <i class="fas fa-copy"></i> 复制代码
                </button>
            </div>
            <pre class="mindmap-code-display" style="display:none"><code></code></pre>
        `;

        messageElement.parentElement.insertBefore(mindmapWrapper, messageElement.nextSibling);

        const codeDisplay = mindmapWrapper.querySelector('.mindmap-code-display code');
        if (codeDisplay) codeDisplay.textContent = svgContent;

        mindmapWrapper.querySelectorAll('.mindmap-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'view-code') {
                    const display = mindmapWrapper.querySelector('.mindmap-code-display');
                    if (display) display.style.display = display.style.display === 'none' ? 'block' : 'none';
                } else if (action === 'export-svg') {
                    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `learning_path_mindmap_${Date.now()}.svg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } else if (action === 'copy') {
                    navigator.clipboard.writeText(svgContent).then(() => {
                        const original = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-check"></i> 已复制';
                        setTimeout(() => { btn.innerHTML = original; }, 1500);
                    });
                }
            });
        });

        this.scrollToBottom();
    }

    updateLearningProgress(path) {
        let progress = JSON.parse(localStorage.getItem('learning_progress') || '{}');
        progress.lastStudyDate = new Date().toISOString().split('T')[0];
        progress.totalStudyTime = (progress.totalStudyTime || 0) + 1;

        const lastDate = progress.lastStudyDate;
        const today = new Date().toISOString().split('T')[0];
        if (lastDate === today) {
            progress.studyStreak = (progress.studyStreak || 0) + 1;
        } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (lastDate === yesterday) {
                progress.studyStreak = (progress.studyStreak || 0) + 1;
            } else {
                progress.studyStreak = 1;
            }
        }

        localStorage.setItem('learning_progress', JSON.stringify(progress));
    }

    createLearningPlan() {
        const pathSelect = document.getElementById('planPathSelect');
        const timeSelect = document.getElementById('planTimeSelect');
        const dateInput = document.getElementById('planStartDate');
        const goalInput = document.getElementById('planGoalInput');

        const path = pathSelect?.value;
        const dailyTime = parseInt(timeSelect?.value || '60');
        const startDate = dateInput?.value;
        const goal = goalInput?.value?.trim();

        if (!path) {
            alert('请选择学习路径');
            return;
        }

        const pathData = this.getLearningPathData(path);
        const plans = JSON.parse(localStorage.getItem('learning_plans') || '[]');

        const newPlan = {
            id: 'plan_' + Date.now(),
            path: path,
            dailyTime: dailyTime,
            startDate: startDate,
            goal: goal || `掌握${pathData?.name || path}`,
            progress: 0,
            completedModules: 0,
            currentModule: 0,
            createdAt: new Date().toISOString()
        };

        plans.push(newPlan);
        localStorage.setItem('learning_plans', JSON.stringify(plans));

        pathSelect.value = '';
        goalInput.value = '';

        this.loadLearningPlans();
        this.loadLearningProgress();

        alert(`学习计划创建成功！\n路径: ${pathData?.name}\n每日学习: ${dailyTime}分钟\n目标: ${newPlan.goal}`);
    }

    deleteLearningPlan(planId) {
        if (!confirm('确定要删除这个学习计划吗？')) return;

        let plans = JSON.parse(localStorage.getItem('learning_plans') || '[]');
        plans = plans.filter(p => p.id !== planId);
        localStorage.setItem('learning_plans', JSON.stringify(plans));

        this.loadLearningPlans();
        this.loadLearningProgress();
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
