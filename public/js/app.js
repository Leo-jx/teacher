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
        this.initQuestSystem();
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
        document.getElementById('practiceBtn')?.addEventListener('click', () => this.openCodeTool('practice'));
        document.getElementById('questLeaderboardBtn')?.addEventListener('click', () => this.showQuestLeaderboard());
        document.getElementById('questBackBtn')?.addEventListener('click', () => this.showQuestMap());
        document.getElementById('leaderboardBackBtn')?.addEventListener('click', () => this.showQuestMap());
        document.getElementById('quizSubmitBtn')?.addEventListener('click', () => this.submitQuestAnswer());
        document.getElementById('quizQuitBtn')?.addEventListener('click', () => this.quitQuest());

        document.querySelectorAll('.learning-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchLearningTab(e.target.dataset.tab));
        });

        document.querySelectorAll('.learning-path-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectLearningPath(e.currentTarget.dataset.path));
        });

        document.getElementById('startLearningBtn')?.addEventListener('click', () => this.startLearning());
        document.getElementById('createPlanBtn')?.addEventListener('click', () => this.createLearningPlan());
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

    initQuestSystem() {
        this.questLevels = [
            {
                id: 1, name: '编程基础入门', subtitle: '变量与控制流', icon: 'fa-seedling',
                theme: 'forest', difficulty: '入门', category: '基础语法',
                knowledgePoints: ['变量声明', '数据类型', '条件语句', '循环结构', '函数定义'],
                passThreshold: 80, totalQuestions: 5, lang: 'java',
                gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                description: '从零开始，掌握编程的基本要素：变量、条件、循环与函数。'
            },
            {
                id: 2, name: '数据结构探险', subtitle: '数组·链表·栈·队列', icon: 'fa-cubes',
                theme: 'ocean', difficulty: '进阶', category: '数据结构',
                knowledgePoints: ['数组操作', '链表遍历', '栈与队列', '哈希表', '树结构基础'],
                passThreshold: 80, totalQuestions: 5, lang: 'java',
                gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                description: '潜入数据结构深海，理解线性与非线性结构的奥秘。'
            },
            {
                id: 3, name: '算法思维挑战', subtitle: '排序·查找·递归', icon: 'fa-rocket',
                theme: 'cosmos', difficulty: '进阶', category: '算法思维',
                knowledgePoints: ['冒泡排序', '二分查找', '递归思想', '时间复杂度', '贪心算法'],
                passThreshold: 80, totalQuestions: 5, lang: 'java',
                gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                description: '冲向算法星空，掌握经典排序、查找与递归思想。'
            },
            {
                id: 4, name: '数据库奥秘', subtitle: 'SQL·表·查询', icon: 'fa-database',
                theme: 'desert', difficulty: '进阶', category: '数据库',
                knowledgePoints: ['SELECT查询', 'WHERE条件', 'JOIN连接', 'GROUP BY', '索引原理'],
                passThreshold: 80, totalQuestions: 5, lang: 'sql',
                gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                description: '穿越数据库沙漠，学会用SQL查询与分析数据。'
            },
            {
                id: 5, name: '框架应用实战', subtitle: 'Spring·Vue·Web', icon: 'fa-fire',
                theme: 'volcano', difficulty: '挑战', category: '框架应用',
                knowledgePoints: ['IoC容器', 'REST接口', 'Vue组件', '状态管理', '路由配置'],
                passThreshold: 80, totalQuestions: 5, lang: 'vue',
                gradient: 'linear-gradient(135deg, #ff5858 0%, #f09819 100%)',
                description: '攀登框架火山，在实战中融会贯通现代Web开发。'
            },
            {
                id: 6, name: '综合实战巅峰', subtitle: '全栈终极挑战', icon: 'fa-crown',
                theme: 'sky', difficulty: '挑战', category: '综合实战',
                knowledgePoints: ['系统设计', '性能优化', '安全防护', '部署运维', '架构演进'],
                passThreshold: 80, totalQuestions: 5, lang: 'java',
                gradient: 'linear-gradient(135deg, #ffd700 0%, #ff9a44 100%)',
                description: '登顶全栈巅峰，挑战真实工程问题与系统设计。'
            }
        ];

        this.questState = this.loadQuestState();
        this.questSession = null;
        this.questTimer = null;
        this.questAudioCtx = null;

        this.renderQuestMap();
    }

    loadQuestState() {
        const defaultState = {
            cleared: {},
            stars: {},
            bestScore: {},
            bestTime: {},
            leaderboard: []
        };
        try {
            return JSON.parse(localStorage.getItem('quest_state')) || defaultState;
        } catch {
            return defaultState;
        }
    }

    saveQuestState() {
        localStorage.setItem('quest_state', JSON.stringify(this.questState));
    }

    renderQuestMap() {
        const mapEl = document.getElementById('questMap');
        if (!mapEl) return;

        mapEl.innerHTML = this.questLevels.map(level => {
            const cleared = this.questState.cleared[level.id];
            const stars = this.questState.stars[level.id] || 0;
            const prevCleared = level.id === 1 || this.questState.cleared[level.id - 1];
            const locked = !prevCleared;

            const starsHtml = Array(3).fill(0).map((_, i) =>
                `<i class="fas fa-star ${i < stars ? 'star--active' : ''}"></i>`
            ).join('');

            return `
                <div class="quest-level-card quest-theme--${level.theme} ${locked ? 'is-locked' : ''} ${cleared ? 'is-cleared' : ''}" data-level-id="${level.id}">
                    <div class="quest-level-lock">${locked ? '<i class="fas fa-lock"></i>' : ''}</div>
                    <div class="quest-level-icon"><i class="fas ${level.icon}"></i></div>
                    <div class="quest-level-info">
                        <div class="quest-level-name">第${level.id}关 · ${level.name}</div>
                        <div class="quest-level-subtitle">${level.subtitle}</div>
                        <div class="quest-level-stars">${starsHtml}</div>
                    </div>
                    <div class="quest-level-difficulty quest-difficulty--${level.difficulty}">${level.difficulty}</div>
                </div>
            `;
        }).join('');

        mapEl.querySelectorAll('.quest-level-card').forEach(card => {
            card.addEventListener('click', () => {
                const levelId = parseInt(card.dataset.levelId);
                if (!card.classList.contains('is-locked')) {
                    this.showQuestDetail(levelId);
                }
            });
        });

        this.updateQuestStats();
    }

    updateQuestStats() {
        const clearedCount = Object.keys(this.questState.cleared).length;
        const totalStars = Object.values(this.questState.stars).reduce((a, b) => a + b, 0);
        const totalScore = Object.values(this.questState.bestScore).reduce((a, b) => a + b, 0);

        const clearedEl = document.getElementById('questClearedCount');
        const starsEl = document.getElementById('questTotalStars');
        const scoreEl = document.getElementById('questTotalScore');

        if (clearedEl) clearedEl.textContent = `${clearedCount}/${this.questLevels.length}`;
        if (starsEl) starsEl.textContent = totalStars;
        if (scoreEl) scoreEl.textContent = totalScore;
    }

    showQuestMap() {
        document.getElementById('questMapView').style.display = 'block';
        document.getElementById('questDetailView').style.display = 'none';
        document.getElementById('questQuizView').style.display = 'none';
        document.getElementById('questResultView').style.display = 'none';
        document.getElementById('questLeaderboardView').style.display = 'none';
        this.renderQuestMap();
    }

    showQuestDetail(levelId) {
        const level = this.questLevels.find(l => l.id === levelId);
        if (!level) return;

        document.getElementById('questMapView').style.display = 'none';
        document.getElementById('questDetailView').style.display = 'block';

        const card = document.getElementById('questDetailCard');
        const cleared = this.questState.cleared[levelId];
        const bestScore = this.questState.bestScore[levelId] || 0;
        const bestTime = this.questState.bestTime[levelId];
        const stars = this.questState.stars[levelId] || 0;

        card.style.background = level.gradient;
        card.innerHTML = `
            <div class="quest-detail-icon"><i class="fas ${level.icon}"></i></div>
            <h3>第${level.id}关 · ${level.name}</h3>
            <p class="quest-detail-desc">${level.description}</p>
            <div class="quest-detail-meta">
                <span><i class="fas fa-tag"></i> ${level.category}</span>
                <span><i class="fas fa-signal"></i> ${level.difficulty}</span>
                <span><i class="fas fa-list-check"></i> ${level.totalQuestions}题</span>
                <span><i class="fas fa-percent"></i> 通关需 ${level.passThreshold}%</span>
            </div>
            <div class="quest-detail-knowledge">
                <h5>知识点目标</h5>
                <div class="quest-knowledge-tags">
                    ${level.knowledgePoints.map(kp => `<span class="quest-knowledge-tag">${kp}</span>`).join('')}
                </div>
            </div>
            ${cleared ? `
                <div class="quest-detail-record">
                    <div><i class="fas fa-star"></i> ${stars} 星</div>
                    <div><i class="fas fa-bolt"></i> 最高分 ${bestScore}</div>
                    <div><i class="fas fa-clock"></i> 最快 ${this.formatTime(bestTime || 0)}</div>
                </div>
            ` : ''}
            <button class="quest-btn quest-btn--primary quest-btn--large" id="questStartBtn">
                <i class="fas fa-play"></i> ${cleared ? '再次挑战' : '开始闯关'}
            </button>
        `;

        document.getElementById('questStartBtn').addEventListener('click', () => this.startQuest(levelId));
    }

    showQuestLeaderboard() {
        document.getElementById('questMapView').style.display = 'none';
        document.getElementById('questLeaderboardView').style.display = 'block';

        const listEl = document.getElementById('questLeaderboardList');
        const records = this.questState.leaderboard || [];

        if (records.length === 0) {
            listEl.innerHTML = `
                <div class="quest-leaderboard-empty">
                    <i class="fas fa-flag-checkered"></i>
                    <p>暂无闯关记录</p>
                    <p class="quest-leaderboard-hint">完成任意关卡后，将自动登榜</p>
                </div>
            `;
            return;
        }

        records.sort((a, b) => b.score - a.score);
        listEl.innerHTML = records.slice(0, 20).map((r, idx) => {
            const rankClass = idx === 0 ? 'rank--1' : (idx === 1 ? 'rank--2' : (idx === 2 ? 'rank--3' : ''));
            return `
                <div class="quest-leaderboard-item ${rankClass}">
                    <div class="quest-leaderboard-rank">${idx + 1}</div>
                    <div class="quest-leaderboard-info">
                        <div class="quest-leaderboard-level">第${r.levelId}关 · ${r.levelName}</div>
                        <div class="quest-leaderboard-time">${new Date(r.date).toLocaleString('zh-CN')}</div>
                    </div>
                    <div class="quest-leaderboard-stats">
                        <div><i class="fas fa-star"></i> ${r.stars}</div>
                        <div><i class="fas fa-bolt"></i> ${r.score}</div>
                        <div><i class="fas fa-clock"></i> ${this.formatTime(r.time)}</div>
                        <div><i class="fas fa-percent"></i> ${r.accuracy}%</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async startQuest(levelId) {
        const level = this.questLevels.find(l => l.id === levelId);
        if (!level) return;

        document.getElementById('questDetailView').style.display = 'none';
        document.getElementById('questQuizView').style.display = 'block';

        document.getElementById('quizLevelName').textContent = `第${level.id}关 · ${level.name}`;

        this.questSession = {
            level,
            questions: [],
            currentIdx: 0,
            answers: [],
            correctCount: 0,
            startTime: Date.now(),
            endTime: null
        };

        this.startQuestTimer();
        await this.generateQuestQuestions(level);
    }

    startQuestTimer() {
        if (this.questTimer) clearInterval(this.questTimer);
        const timerEl = document.getElementById('quizTimer');
        this.questTimer = setInterval(() => {
            if (!this.questSession) return;
            const elapsed = Math.floor((Date.now() - this.questSession.startTime) / 1000);
            if (timerEl) timerEl.textContent = this.formatTime(elapsed);
        }, 1000);
    }

    stopQuestTimer() {
        if (this.questTimer) {
            clearInterval(this.questTimer);
            this.questTimer = null;
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    async generateQuestQuestions(level) {
        const bodyEl = document.getElementById('quizBody');
        const submitBtn = document.getElementById('quizSubmitBtn');

        bodyEl.innerHTML = `
            <div class="quest-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>正在生成第 ${level.id} 关题目...</p>
            </div>
        `;
        submitBtn.disabled = true;

        const prompt = `作为编程闯关系统，请为"${level.name}"关卡生成 ${level.totalQuestions} 道${level.lang}题目。

关卡主题：${level.category}
知识点：${level.knowledgePoints.join('、')}
难度：${level.difficulty}

要求：
1. 题目由浅入深排列
2. 每道题以JSON数组返回，每个对象包含：
   - "question": 题目描述
   - "options": 4个选项数组
   - "answer": 正确选项索引(0-3)
   - "explanation": 详细解析
   - "knowledge": 考察的知识点

只返回JSON数组，不要其他文字。`;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    history: [],
                    stream: false
                })
            });

            if (!response.ok) throw new Error('请求失败');
            const data = await response.json();
            const content = data.response || data.content || data.message || '';

            let questions = this.parseQuestQuestions(content);
            if (questions.length === 0) {
                questions = this.getFallbackQuestions(level);
            }

            this.questSession.questions = questions;
            this.renderQuestQuestion();
            submitBtn.disabled = false;
        } catch (err) {
            console.error('生成题目失败', err);
            this.questSession.questions = this.getFallbackQuestions(level);
            this.renderQuestQuestion();
            submitBtn.disabled = false;
        }
    }

    parseQuestQuestions(content) {
        try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return [];
            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(q =>
                q.question && Array.isArray(q.options) && typeof q.answer === 'number'
            ).slice(0, this.questSession.level.totalQuestions);
        } catch {
            return [];
        }
    }

    getFallbackQuestions(level) {
        return Array(level.totalQuestions).fill(0).map((_, i) => ({
            question: `${level.knowledgePoints[i % level.knowledgePoints.length]}相关练习题 ${i + 1}：以下哪个描述是正确的？`,
            options: [
                '选项 A：符合知识点的正确描述',
                '选项 B：错误的描述',
                '选项 C：无关的描述',
                '选项 D：部分正确但不完整的描述'
            ],
            answer: 0,
            explanation: '正确答案为A。本题考察' + level.knowledgePoints[i % level.knowledgePoints.length] + '相关知识点。',
            knowledge: level.knowledgePoints[i % level.knowledgePoints.length]
        }));
    }

    renderQuestQuestion() {
        const session = this.questSession;
        if (!session) return;

        session.phase = 'answering';

        const level = session.level;
        const idx = session.currentIdx;
        const q = session.questions[idx];
        const bodyEl = document.getElementById('quizBody');
        const progressText = document.getElementById('quizProgressText');
        const progressFill = document.getElementById('quizProgressFill');

        if (progressText) progressText.textContent = `第 ${idx + 1} / ${level.totalQuestions} 题`;
        if (progressFill) progressFill.style.width = `${((idx + 1) / level.totalQuestions) * 100}%`;

        const themeClass = `quest-theme--${level.theme}`;

        bodyEl.innerHTML = `
            <div class="quest-question ${themeClass}">
                <div class="quest-question-meta">
                    <span class="quest-question-tag"><i class="fas fa-tag"></i> ${q.knowledge || level.category}</span>
                    <span class="quest-question-number">第 ${idx + 1} 题</span>
                </div>
                <div class="quest-question-text">${this.escapeHtml(q.question)}</div>
                <div class="quest-question-options">
                    ${q.options.map((opt, i) => `
                        <label class="quest-option" data-idx="${i}">
                            <input type="radio" name="questAnswer" value="${i}">
                            <span class="quest-option-marker">${String.fromCharCode(65 + i)}</span>
                            <span class="quest-option-text">${this.escapeHtml(opt)}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="quest-feedback" id="questFeedback" style="display:none"></div>
            </div>
        `;

        bodyEl.querySelectorAll('.quest-option').forEach(opt => {
            opt.addEventListener('click', () => {
                bodyEl.querySelectorAll('.quest-option').forEach(o => o.classList.remove('is-selected'));
                opt.classList.add('is-selected');
            });
        });

        const submitBtn = document.getElementById('quizSubmitBtn');
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 提交答案';
        submitBtn.disabled = false;
    }

    escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    submitQuestAnswer() {
        const session = this.questSession;
        if (!session) return;

        const submitBtn = document.getElementById('quizSubmitBtn');

        if (session.phase === 'answered') {
            if (session.currentIdx < session.questions.length - 1) {
                session.currentIdx++;
                session.phase = 'answering';
                this.renderQuestQuestion();
            } else {
                this.finishQuest();
            }
            return;
        }

        const selected = document.querySelector('input[name="questAnswer"]:checked');
        const feedbackEl = document.getElementById('questFeedback');

        if (!selected) {
            alert('请选择一个答案');
            return;
        }

        const userAnswer = parseInt(selected.value);
        const q = session.questions[session.currentIdx];
        const isCorrect = userAnswer === q.answer;

        session.answers.push({ userAnswer, correct: isCorrect });
        if (isCorrect) session.correctCount++;

        document.querySelectorAll('.quest-option').forEach((opt, i) => {
            opt.classList.add('is-disabled');
            if (i === q.answer) opt.classList.add('is-correct');
            if (i === userAnswer && !isCorrect) opt.classList.add('is-wrong');
        });

        feedbackEl.style.display = 'block';
        feedbackEl.className = `quest-feedback ${isCorrect ? 'quest-feedback--correct' : 'quest-feedback--wrong'}`;
        feedbackEl.innerHTML = `
            <div class="quest-feedback-header">
                <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span>${isCorrect ? '回答正确！' : '回答错误'}</span>
            </div>
            <div class="quest-feedback-body">
                <strong>解析：</strong>${this.escapeHtml(q.explanation || '暂无解析')}
            </div>
        `;

        if (isCorrect) {
            this.playSound('correct');
            this.playConfetti();
        } else {
            this.playSound('wrong');
        }

        session.phase = 'answered';
        submitBtn.disabled = true;
        setTimeout(() => {
            submitBtn.disabled = false;
            const isLast = session.currentIdx >= session.questions.length - 1;
            submitBtn.innerHTML = isLast
                ? '<i class="fas fa-flag-checkered"></i> 查看结果'
                : '<i class="fas fa-arrow-right"></i> 下一题';
        }, 1200);
    }

    playSound(type) {
        try {
            if (!this.questAudioCtx) {
                this.questAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.questAudioCtx;
            const now = ctx.currentTime;

            if (type === 'correct') {
                [523.25, 659.25, 783.99].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0, now + i * 0.1);
                    gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + i * 0.1);
                    osc.stop(now + i * 0.1 + 0.3);
                });
            } else if (type === 'wrong') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'win') {
                [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0, now + i * 0.12);
                    gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + i * 0.12);
                    osc.stop(now + i * 0.12 + 0.4);
                });
            }
        } catch (e) {
            console.warn('音效播放失败', e);
        }
    }

    playConfetti() {
        const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#5f27cd', '#ff9ff3'];
        const container = document.createElement('div');
        container.className = 'quest-confetti-container';
        document.body.appendChild(container);

        for (let i = 0; i < 30; i++) {
            const piece = document.createElement('div');
            piece.className = 'quest-confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 0.3 + 's';
            piece.style.animationDuration = (1 + Math.random()) + 's';
            piece.style.transform = `rotate(${Math.random() * 360}deg)`;
            container.appendChild(piece);
        }

        setTimeout(() => container.remove(), 2500);
    }

    finishQuest() {
        const session = this.questSession;
        if (!session) return;

        this.stopQuestTimer();
        session.endTime = Date.now();
        const totalTime = Math.floor((session.endTime - session.startTime) / 1000);
        const total = session.questions.length;
        const correct = session.correctCount;
        const accuracy = Math.round((correct / total) * 100);
        const level = session.level;
        const passed = accuracy >= level.passThreshold;

        let stars = 0;
        if (passed) {
            stars = 1;
            if (accuracy === 100) stars = 3;
            else if (accuracy >= 90) stars = 2;
        }

        const score = passed ? Math.round(accuracy * 100 + Math.max(0, 300 - totalTime) * 2 + stars * 50) : Math.round(accuracy * 30);

        if (passed) {
            this.questState.cleared[level.id] = true;
            const prevStars = this.questState.stars[level.id] || 0;
            this.questState.stars[level.id] = Math.max(prevStars, stars);
            const prevScore = this.questState.bestScore[level.id] || 0;
            this.questState.bestScore[level.id] = Math.max(prevScore, score);
            const prevTime = this.questState.bestTime[level.id];
            if (!prevTime || totalTime < prevTime) {
                this.questState.bestTime[level.id] = totalTime;
            }

            this.questState.leaderboard = this.questState.leaderboard || [];
            this.questState.leaderboard.push({
                levelId: level.id,
                levelName: level.name,
                score,
                stars,
                time: totalTime,
                accuracy,
                date: new Date().toISOString()
            });
            this.questState.leaderboard.sort((a, b) => b.score - a.score);
            this.questState.leaderboard = this.questState.leaderboard.slice(0, 50);

            this.saveQuestState();
            this.playSound('win');
            this.playConfetti();
        }

        document.getElementById('questQuizView').style.display = 'none';
        document.getElementById('questResultView').style.display = 'block';

        const card = document.getElementById('questResultCard');
        card.style.background = passed ? level.gradient : 'linear-gradient(135deg, #636e72 0%, #2d3436 100%)';
        card.innerHTML = `
            <div class="quest-result-icon">
                <i class="fas ${passed ? 'fa-trophy' : 'fa-redo'}"></i>
            </div>
            <h3>${passed ? '闯关成功！' : '闯关失败'}</h3>
            <div class="quest-result-stars">
                ${Array(3).fill(0).map((_, i) => `<i class="fas fa-star ${i < stars ? 'star--active' : ''}"></i>`).join('')}
            </div>
            <div class="quest-result-stats">
                <div class="quest-result-stat">
                    <div class="quest-result-stat-value">${correct}/${total}</div>
                    <div class="quest-result-stat-label">答对题数</div>
                </div>
                <div class="quest-result-stat">
                    <div class="quest-result-stat-value">${accuracy}%</div>
                    <div class="quest-result-stat-label">正确率</div>
                </div>
                <div class="quest-result-stat">
                    <div class="quest-result-stat-value">${this.formatTime(totalTime)}</div>
                    <div class="quest-result-stat-label">用时</div>
                </div>
                <div class="quest-result-stat">
                    <div class="quest-result-stat-value">${score}</div>
                    <div class="quest-result-stat-label">得分</div>
                </div>
            </div>
            ${passed && level.id < this.questLevels.length ? `
                <div class="quest-result-unlock">
                    <i class="fas fa-unlock"></i>
                    已解锁第 ${level.id + 1} 关：${this.questLevels[level.id].name}
                </div>
            ` : ''}
            <div class="quest-result-actions">
                <button class="quest-btn quest-btn--secondary" id="resultRetryBtn">
                    <i class="fas fa-redo"></i> 再次挑战
                </button>
                <button class="quest-btn quest-btn--primary" id="resultBackBtn">
                    <i class="fas fa-arrow-left"></i> 返回关卡
                </button>
            </div>
        `;

        document.getElementById('resultRetryBtn').addEventListener('click', () => this.startQuest(level.id));
        document.getElementById('resultBackBtn').addEventListener('click', () => this.showQuestMap());

        this.questSession = null;
    }

    quitQuest() {
        if (!confirm('确定要退出本次闯关吗？进度将不会保存。')) return;
        this.stopQuestTimer();
        this.questSession = null;
        this.showQuestMap();
    }

    switchLearningTab(tab) {
        document.querySelectorAll('.learning-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.learning-tab[data-tab="${tab}"]`)?.classList.add('active');

        document.getElementById('learningPathsContent').style.display = tab === 'paths' ? 'block' : 'none';
        document.getElementById('learningPlanContent').style.display = tab === 'plan' ? 'block' : 'none';
        document.getElementById('learningProgressContent').style.display = tab === 'progress' ? 'block' : 'none';

        if (tab === 'plan') {
            this.loadLearningPlans();
        } else if (tab === 'progress') {
            this.loadLearningProgress();
        }
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
        await this.sendMessage();

        this.updateLearningProgress(selectedPath);
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
