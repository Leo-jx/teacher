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
        this.practiceData = null;
        this.practiceSelectedLevel = null;
        this.practiceSession = null;
        this.practiceCurrentAnswer = null;
        this.practiceTimerInterval = null;
        this.practiceTimeLeft = 0;

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

        document.querySelectorAll('.learning-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchLearningTab(e.target.dataset.tab));
        });

        document.querySelectorAll('.learning-path-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectLearningPath(e.currentTarget.dataset.path));
        });

        document.getElementById('startLearningBtn')?.addEventListener('click', () => this.startLearning());
        document.getElementById('createPlanBtn')?.addEventListener('click', () => this.createLearningPlan());

        document.getElementById('practiceBtn')?.addEventListener('click', () => this.startChallenge());
        document.getElementById('practiceResumeBtn')?.addEventListener('click', () => this.resumeChallenge());
        document.getElementById('practiceExitBtn')?.addEventListener('click', () => this.exitChallenge());
        document.getElementById('practiceSubmitBtn')?.addEventListener('click', () => this.submitPracticeAnswer());
        document.getElementById('practiceSkipBtn')?.addEventListener('click', () => this.skipPracticeQuestion());
        document.getElementById('practiceNextQuestionBtn')?.addEventListener('click', () => this.nextPracticeQuestion());
        document.getElementById('practiceRetryBtn')?.addEventListener('click', () => this.retryChallenge());
        document.getElementById('practiceNextBtn')?.addEventListener('click', () => this.goNextLevel());
        document.getElementById('practiceBackLobbyBtn')?.addEventListener('click', () => this.backToLobby());
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

    // ============ 闯关式题目练习系统 ============

    getPRACTICE_LEVELS() {
        return [
            { id: 1, name: '启程', difficulty: 'easy',   difficultyLabel: '初级', count: 5, threshold: 60, color: '#55efc4', icon: 'fa-seedling', desc: '基础概念与语法入门' },
            { id: 2, name: '进阶', difficulty: 'easy',   difficultyLabel: '初级', count: 5, threshold: 65, color: '#74b9ff', icon: 'fa-shoe-prints', desc: '巩固核心知识点' },
            { id: 3, name: '实战', difficulty: 'medium', difficultyLabel: '中级', count: 6, threshold: 70, color: '#fdcb6e', icon: 'fa-fire', desc: '场景化综合应用' },
            { id: 4, name: '高手', difficulty: 'medium', difficultyLabel: '中级', count: 6, threshold: 75, color: '#ff7675', icon: 'fa-mountain', desc: '进阶算法与陷阱' },
            { id: 5, name: '大师', difficulty: 'hard',   difficultyLabel: '高级', count: 8, threshold: 80, color: '#a29bfe', icon: 'fa-crown', desc: '深度综合挑战' }
        ];
    }

    getCategoryName(cat) {
        const names = {
            'basic': '基础语法', 'datastructure': '数据结构', 'algorithm': '算法思维',
            'database': '数据库', 'framework': '框架应用', 'comprehensive': '综合实战'
        };
        return names[cat] || '基础语法';
    }

    getLangName(lang) {
        const names = { 'java':'Java', 'python':'Python', 'javascript':'JavaScript',
                        'cpp':'C/C++', 'sql':'SQL', 'vue':'Vue' };
        return names[lang] || 'Java';
    }

    getQuestionTypeLabel(type) {
        const labels = {
            'multiple_choice': '单选题',
            'true_false': '判断题',
            'fill_blank': '填空题',
            'short_answer': '简答题'
        };
        return labels[type] || '题目';
    }

    loadPracticeProgress() {
        const data = JSON.parse(localStorage.getItem('practice_challenge_data') || '{}');
        if (!data.levels) {
            data.levels = this.getPRACTICE_LEVELS().map(l => ({
                id: l.id,
                unlocked: l.id === 1,
                bestAccuracy: 0,
                stars: 0,
                attempts: 0,
                completedQuestions: 0
            }));
            data.totalCompleted = 0;
            data.totalStars = 0;
            localStorage.setItem('practice_challenge_data', JSON.stringify(data));
        }
        this.practiceData = data;
        this.renderPracticeLobby();
        this.checkPracticeResume();
    }

    savePracticeData() {
        if (this.practiceData) {
            localStorage.setItem('practice_challenge_data', JSON.stringify(this.practiceData));
        }
    }

    renderPracticeLobby() {
        const grid = document.getElementById('practiceLevelsGrid');
        if (!grid || !this.practiceData) return;

        const levels = this.getPRACTICE_LEVELS();
        grid.innerHTML = levels.map(level => {
            const state = this.practiceData.levels.find(l => l.id === level.id) || { unlocked: false, stars: 0, bestAccuracy: 0, attempts: 0 };
            const starsHtml = '★★★'.split('').map((s, i) =>
                `<span class="practice-star ${i < state.stars ? 'filled' : ''}">${s}</span>`
            ).join('');
            const lockIcon = state.unlocked ? '' : '<i class="fas fa-lock practice-lock-icon"></i>';
            return `
                <div class="practice-level-card ${state.unlocked ? 'unlocked' : 'locked'} ${this.practiceSelectedLevel === level.id ? 'selected' : ''}"
                     data-level="${level.id}"
                     style="--level-color: ${level.color}">
                    <div class="practice-level-icon"><i class="fas ${level.icon}"></i></div>
                    <div class="practice-level-info">
                        <div class="practice-level-name">第 ${level.id} 关 · ${level.name}</div>
                        <div class="practice-level-desc">${level.desc}</div>
                        <div class="practice-level-meta">
                            <span class="practice-level-tag">${level.difficultyLabel}</span>
                            <span class="practice-level-count">${level.count} 题</span>
                            <span class="practice-level-threshold">通关 ${level.threshold}%</span>
                        </div>
                        <div class="practice-level-stars">${starsHtml}</div>
                        ${state.attempts > 0 ? `<div class="practice-level-best">最佳 ${state.bestAccuracy}% · 已挑战 ${state.attempts} 次</div>` : ''}
                    </div>
                    ${lockIcon}
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.practice-level-card').forEach(card => {
            card.addEventListener('click', () => {
                const levelId = parseInt(card.dataset.level);
                const state = this.practiceData.levels.find(l => l.id === levelId);
                if (!state || !state.unlocked) {
                    this.showToast('该关卡尚未解锁，请先完成前置关卡');
                    return;
                }
                this.practiceSelectedLevel = levelId;
                grid.querySelectorAll('.practice-level-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                document.getElementById('practiceBtn').disabled = false;
            });
        });

        // 更新顶部统计
        const totalStars = this.practiceData.levels.reduce((s, l) => s + (l.stars || 0), 0);
        const totalCompleted = this.practiceData.totalCompleted || 0;
        const unlockedCount = this.practiceData.levels.filter(l => l.unlocked).length;
        const starsEl = document.getElementById('practiceTotalStars');
        const completedEl = document.getElementById('practiceTotalCompleted');
        const unlockedEl = document.getElementById('practiceUnlockedLevels');
        if (starsEl) starsEl.textContent = totalStars;
        if (completedEl) completedEl.textContent = totalCompleted;
        if (unlockedEl) unlockedEl.textContent = unlockedCount;
    }

    checkPracticeResume() {
        const session = JSON.parse(localStorage.getItem('practice_session_save') || 'null');
        const hint = document.getElementById('practiceResumeHint');
        if (hint) hint.style.display = session ? 'flex' : 'none';
    }

    async startChallenge() {
        if (!this.practiceSelectedLevel) {
            this.showToast('请先选择一个关卡');
            return;
        }
        const level = this.getPRACTICE_LEVELS().find(l => l.id === this.practiceSelectedLevel);
        if (!level) return;

        const category = document.getElementById('practiceCategorySelect')?.value || 'basic';
        const lang = document.getElementById('practiceLangSelect')?.value || 'java';
        const timerSec = parseInt(document.getElementById('practiceTimerSelect')?.value || '0');

        this.practiceSession = {
            levelId: level.id,
            level,
            category,
            lang,
            timerSec,
            questions: [],
            currentIndex: 0,
            correctCount: 0,
            startTime: Date.now(),
            answeredHistory: []
        };

        this.openFullscreenPractice();
        await this.loadPracticeQuestions();
    }

    async resumeChallenge() {
        const session = JSON.parse(localStorage.getItem('practice_session_save') || 'null');
        if (!session) {
            this.showToast('未找到可恢复的进度');
            return;
        }
        this.practiceSession = session;
        this.practiceSelectedLevel = session.levelId;
        this.openFullscreenPractice();
        this.renderCurrentQuestion();
    }

    openFullscreenPractice() {
        const fs = document.getElementById('practiceFullscreen');
        if (!fs) return;
        fs.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const level = this.practiceSession.level;
        document.getElementById('practiceFsLevelName').textContent = `第 ${level.id} 关 · ${level.name}`;
        document.getElementById('practiceFsLevelTag').textContent = level.difficultyLabel;
        document.getElementById('practiceFsTotal').textContent = level.count;
        document.getElementById('practiceFsCurrentIndex').textContent = '1';
        document.getElementById('practiceFsCorrect').textContent = '0';
        document.getElementById('practiceFsProgressFill').style.width = '0%';

        // 计时器显示控制
        const timerWrap = document.getElementById('practiceFsTimer');
        timerWrap.style.display = this.practiceSession.timerSec > 0 ? 'flex' : 'none';

        // 显示 loading，隐藏其他
        document.getElementById('practiceFsLoading').style.display = 'flex';
        document.getElementById('practiceFsQuestion').style.display = 'none';
        document.getElementById('practiceFsResult').style.display = 'none';
        document.getElementById('practiceFsFooter').style.display = 'none';
    }

    async loadPracticeQuestions() {
        const { level, category, lang } = this.practiceSession;
        const categoryName = this.getCategoryName(category);
        const langName = this.getLangName(lang);

        const prompt = `你是编程教学出题专家。请基于以下要求生成 ${level.count} 道${langName}编程练习题：
- 知识点方向：${categoryName}
- 难度等级：${level.difficultyLabel}（${level.difficulty}）
- 题型混合：包含单选题(multiple_choice)、判断题(true_false)、填空题(fill_blank)、简答题(short_answer)，简答题不超过 1 道
- 每题必须独立、非重复，紧扣${categoryName}知识点

请严格返回 JSON 数组，每道题字段如下：
{
  "type": "multiple_choice|true_false|fill_blank|short_answer",
  "question": "题干文本",
  "options": ["A.选项1","B.选项2","C.选项3","D.选项4"],  // 仅 multiple_choice 需要
  "answer": "正确答案",  // multiple_choice 填选项字母如 "A"；true_false 填 "true" 或 "false"；fill_blank 填标准答案文本；short_answer 填参考要点
  "points": "考察知识点",
  "explanation": "详细解析"
}

只返回 JSON 数组，不要任何额外文字、markdown 代码块标记或解释。`;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || data.content || '';

            const questions = this.parsePracticeQuestions(content, level.count);
            if (questions.length === 0) {
                throw new Error('AI 返回内容无法解析');
            }

            this.practiceSession.questions = questions;
            this.practiceSession.currentIndex = 0;
            this.practiceSession.correctCount = 0;
            this.renderCurrentQuestion();
        } catch (error) {
            console.error('生成题目失败:', error);
            document.getElementById('practiceFsLoading').style.display = 'none';
            document.getElementById('practiceFsQuestion').style.display = 'block';
            document.getElementById('practiceQTitle').innerHTML =
                `<div style="color:#ff7675;text-align:center;padding:40px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:36px;"></i>
                    <p style="margin-top:12px;">题目生成失败：${error.message}</p>
                    <p style="font-size:13px;opacity:0.7;margin-top:8px;">请稍后重试或检查网络连接</p>
                </div>`;
            document.getElementById('practiceFsFooter').style.display = 'flex';
            document.getElementById('practiceSubmitBtn').style.display = 'none';
            document.getElementById('practiceSkipBtn').style.display = 'none';
            document.getElementById('practiceNextQuestionBtn').style.display = 'none';
        }
    }

    parsePracticeQuestions(content, expectedCount) {
        let text = content.trim();
        // 去除可能的 markdown 代码块标记
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
        // 尝试提取 JSON 数组
        const startIdx = text.indexOf('[');
        const endIdx = text.lastIndexOf(']');
        if (startIdx === -1 || endIdx === -1) return [];
        const jsonStr = text.substring(startIdx, endIdx + 1);
        try {
            const arr = JSON.parse(jsonStr);
            if (!Array.isArray(arr)) return [];
            return arr.filter(q => q && q.type && q.question).slice(0, expectedCount);
        } catch (e) {
            // 尝试宽松解析：去除尾部逗号
            try {
                const cleaned = jsonStr.replace(/,\s*([\]}])/g, '$1');
                const arr = JSON.parse(cleaned);
                return Array.isArray(arr) ? arr.filter(q => q && q.type && q.question).slice(0, expectedCount) : [];
            } catch (e2) {
                return [];
            }
        }
    }

    renderCurrentQuestion() {
        const session = this.practiceSession;
        if (!session || !session.questions.length) return;

        const q = session.questions[session.currentIndex];
        const total = session.questions.length;
        const idx = session.currentIndex + 1;

        document.getElementById('practiceFsLoading').style.display = 'none';
        document.getElementById('practiceFsQuestion').style.display = 'flex';
        document.getElementById('practiceFsResult').style.display = 'none';
        document.getElementById('practiceFsFooter').style.display = 'flex';

        document.getElementById('practiceFsCurrentIndex').textContent = idx;
        document.getElementById('practiceFsTotal').textContent = total;
        document.getElementById('practiceFsCorrect').textContent = session.correctCount;
        document.getElementById('practiceFsProgressFill').style.width = ((idx - 1) / total * 100) + '%';

        document.getElementById('practiceQType').textContent = this.getQuestionTypeLabel(q.type);
        document.getElementById('practiceQPoints').textContent = q.points || '';
        document.getElementById('practiceQTitle').textContent = q.question;

        const optionsEl = document.getElementById('practiceQOptions');
        const answerAreaEl = document.getElementById('practiceQAnswerArea');
        optionsEl.innerHTML = '';
        answerAreaEl.innerHTML = '';

        this.practiceCurrentAnswer = null;

        if (q.type === 'multiple_choice') {
            optionsEl.style.display = 'block';
            answerAreaEl.style.display = 'none';
            (q.options || []).forEach((opt, i) => {
                const letter = opt.match(/^([A-Z])[.、\)]?\s*/)?.[1] || String.fromCharCode(65 + i);
                const text = opt.replace(/^[A-Z][.、\)]?\s*/, '');
                const btn = document.createElement('button');
                btn.className = 'practice-option';
                btn.dataset.value = letter;
                btn.innerHTML = `<span class="practice-option-letter">${letter}</span><span class="practice-option-text">${text}</span>`;
                btn.addEventListener('click', () => {
                    optionsEl.querySelectorAll('.practice-option').forEach(o => o.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.practiceCurrentAnswer = letter;
                });
                optionsEl.appendChild(btn);
            });
        } else if (q.type === 'true_false') {
            optionsEl.style.display = 'block';
            answerAreaEl.style.display = 'none';
            ['true', 'false'].forEach(val => {
                const btn = document.createElement('button');
                btn.className = 'practice-option tf';
                btn.dataset.value = val;
                btn.innerHTML = `<span class="practice-option-letter">${val === 'true' ? '✓' : '✗'}</span><span class="practice-option-text">${val === 'true' ? '正确' : '错误'}</span>`;
                btn.addEventListener('click', () => {
                    optionsEl.querySelectorAll('.practice-option').forEach(o => o.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.practiceCurrentAnswer = val;
                });
                optionsEl.appendChild(btn);
            });
        } else if (q.type === 'fill_blank') {
            optionsEl.style.display = 'none';
            answerAreaEl.style.display = 'block';
            answerAreaEl.innerHTML = `
                <label class="practice-answer-label">请填写答案：</label>
                <input type="text" class="practice-fill-input" id="practiceFillInput"
                       placeholder="请输入你的答案" autocomplete="off">
            `;
            const input = document.getElementById('practiceFillInput');
            input.addEventListener('input', () => { this.practiceCurrentAnswer = input.value.trim(); });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.submitPracticeAnswer(); }
            });
            setTimeout(() => input.focus(), 100);
        } else if (q.type === 'short_answer') {
            optionsEl.style.display = 'none';
            answerAreaEl.style.display = 'block';
            answerAreaEl.innerHTML = `
                <label class="practice-answer-label">请输入你的解答：</label>
                <textarea class="practice-short-textarea" id="practiceShortInput"
                          placeholder="请详细作答..." rows="6"></textarea>
            `;
            const ta = document.getElementById('practiceShortInput');
            ta.addEventListener('input', () => { this.practiceCurrentAnswer = ta.value.trim(); });
            setTimeout(() => ta.focus(), 100);
        }

        // 重置反馈区
        const feedback = document.getElementById('practiceQFeedback');
        feedback.style.display = 'none';
        feedback.innerHTML = '';

        // 重置按钮
        document.getElementById('practiceSubmitBtn').style.display = 'inline-flex';
        document.getElementById('practiceSubmitBtn').disabled = false;
        document.getElementById('practiceSkipBtn').style.display = 'inline-flex';
        document.getElementById('practiceNextQuestionBtn').style.display = 'none';

        // 启动计时器
        this.startPracticeTimer();

        // 保存会话
        this.savePracticeSession();
    }

    startPracticeTimer() {
        this.stopPracticeTimer();
        if (!this.practiceSession || this.practiceSession.timerSec <= 0) return;
        this.practiceTimeLeft = this.practiceSession.timerSec;
        this.updatePracticeTimerDisplay();
        this.practiceTimerInterval = setInterval(() => {
            this.practiceTimeLeft--;
            this.updatePracticeTimerDisplay();
            if (this.practiceTimeLeft <= 0) {
                this.stopPracticeTimer();
                this.showToast('时间到，自动提交');
                this.submitPracticeAnswer(true);
            }
        }, 1000);
    }

    stopPracticeTimer() {
        if (this.practiceTimerInterval) {
            clearInterval(this.practiceTimerInterval);
            this.practiceTimerInterval = null;
        }
    }

    updatePracticeTimerDisplay() {
        const el = document.getElementById('practiceFsTimerText');
        if (!el) return;
        const m = Math.floor(this.practiceTimeLeft / 60).toString().padStart(2, '0');
        const s = (this.practiceTimeLeft % 60).toString().padStart(2, '0');
        el.textContent = `${m}:${s}`;
        const wrap = document.getElementById('practiceFsTimer');
        if (wrap) {
            wrap.classList.toggle('warning', this.practiceTimeLeft <= 10);
        }
    }

    async submitPracticeAnswer(timeout = false) {
        const session = this.practiceSession;
        if (!session) return;
        const q = session.questions[session.currentIndex];
        this.stopPracticeTimer();

        const userAnswer = timeout ? '' : (this.practiceCurrentAnswer || '');
        if (!timeout && !userAnswer) {
            this.showToast('请先选择或填写答案');
            this.startPracticeTimer();
            return;
        }

        let isCorrect = false;
        let aiEvaluation = null;

        // 客户端验证
        if (q.type === 'multiple_choice') {
            isCorrect = userAnswer.toUpperCase() === String(q.answer || '').toUpperCase().charAt(0);
        } else if (q.type === 'true_false') {
            isCorrect = userAnswer.toLowerCase() === String(q.answer || '').toLowerCase();
        } else if (q.type === 'fill_blank') {
            isCorrect = this.normalizeText(userAnswer) === this.normalizeText(q.answer);
        } else if (q.type === 'short_answer') {
            // 简答题调用 AI 评估
            aiEvaluation = await this.evaluateShortAnswer(q, userAnswer);
            isCorrect = aiEvaluation?.correct || false;
        }

        if (isCorrect) session.correctCount++;
        session.answeredHistory.push({
            questionId: session.currentIndex,
            type: q.type,
            userAnswer,
            correctAnswer: q.answer,
            isCorrect,
            aiScore: aiEvaluation?.score
        });

        this.showPracticeFeedback(isCorrect, q, userAnswer, aiEvaluation);
        this.savePracticeSession();
    }

    normalizeText(s) {
        return String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[，。、；：！？""''（）()]/g, '');
    }

    async evaluateShortAnswer(question, userAnswer) {
        const prompt = `请评估以下简答题作答是否正确。

题目：${question.question}
参考答案要点：${question.answer}
考察知识点：${question.points || ''}
学生作答：${userAnswer}

请严格返回 JSON：{"correct": true/false, "score": 0-100, "comment": "点评"}
判断标准：核心要点覆盖即可判正确，不要求字面一致。只返回 JSON，不要任何额外文字。`;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
                },
                body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
            });
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || data.content || '';
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
        } catch (e) {
            console.error('简答题评估失败:', e);
        }
        return { correct: false, score: 0, comment: '评估失败' };
    }

    showPracticeFeedback(isCorrect, question, userAnswer, aiEvaluation) {
        const feedback = document.getElementById('practiceQFeedback');
        feedback.style.display = 'block';
        feedback.className = 'practice-q-feedback ' + (isCorrect ? 'correct' : 'wrong');

        const correctLabel = isCorrect ? '回答正确' : '回答错误';
        let html = `
            <div class="practice-feedback-header">
                <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span>${correctLabel}</span>
            </div>
            <div class="practice-feedback-row">
                <span class="practice-feedback-label">你的答案：</span>
                <span class="practice-feedback-value">${userAnswer || '（未作答）'}</span>
            </div>
        `;
        if (!isCorrect) {
            html += `
                <div class="practice-feedback-row">
                    <span class="practice-feedback-label">正确答案：</span>
                    <span class="practice-feedback-value correct">${question.answer}</span>
                </div>
            `;
        }
        if (aiEvaluation) {
            html += `
                <div class="practice-feedback-row">
                    <span class="practice-feedback-label">AI 评分：</span>
                    <span class="practice-feedback-value">${aiEvaluation.score}</span>
                </div>
                <div class="practice-feedback-row">
                    <span class="practice-feedback-label">AI 点评：</span>
                    <span class="practice-feedback-value">${aiEvaluation.comment || ''}</span>
                </div>
            `;
        }
        html += `
            <div class="practice-feedback-row">
                <span class="practice-feedback-label">考察点：</span>
                <span class="practice-feedback-value">${question.points || ''}</span>
            </div>
            <div class="practice-feedback-explanation">
                <i class="fas fa-lightbulb"></i>
                <div>${question.explanation || '暂无解析'}</div>
            </div>
        `;
        feedback.innerHTML = html;

        // 高亮选项
        if (question.type === 'multiple_choice' || question.type === 'true_false') {
            const options = document.querySelectorAll('.practice-option');
            const correctVal = question.type === 'multiple_choice'
                ? String(question.answer || '').toUpperCase().charAt(0)
                : String(question.answer || '').toLowerCase();
            options.forEach(opt => {
                opt.disabled = true;
                if (opt.dataset.value === correctVal) {
                    opt.classList.add('correct');
                } else if (opt.classList.contains('selected')) {
                    opt.classList.add('wrong');
                }
            });
        }

        // 切换按钮
        document.getElementById('practiceSubmitBtn').style.display = 'none';
        document.getElementById('practiceSkipBtn').style.display = 'none';
        document.getElementById('practiceNextQuestionBtn').style.display = 'inline-flex';
    }

    skipPracticeQuestion() {
        const session = this.practiceSession;
        if (!session) return;
        this.stopPracticeTimer();
        const q = session.questions[session.currentIndex];
        session.answeredHistory.push({
            questionId: session.currentIndex,
            type: q.type,
            userAnswer: '',
            correctAnswer: q.answer,
            isCorrect: false,
            skipped: true
        });
        this.showPracticeFeedback(false, q, '', null);
    }

    nextPracticeQuestion() {
        const session = this.practiceSession;
        if (!session) return;
        session.currentIndex++;
        if (session.currentIndex >= session.questions.length) {
            this.finishChallenge();
        } else {
            this.renderCurrentQuestion();
        }
    }

    finishChallenge() {
        this.stopPracticeTimer();
        const session = this.practiceSession;
        const total = session.questions.length;
        const correct = session.correctCount;
        const accuracy = total > 0 ? Math.round(correct / total * 100) : 0;
        const level = session.level;

        // 计算星数：>=threshold 3星；>=threshold-10 2星；>=threshold-20 1星；否则 0
        let stars = 0;
        if (accuracy >= level.threshold) stars = 3;
        else if (accuracy >= level.threshold - 10) stars = 2;
        else if (accuracy >= level.threshold - 20) stars = 1;

        // 更新关卡状态
        const levelState = this.practiceData.levels.find(l => l.id === level.id);
        if (levelState) {
            levelState.attempts = (levelState.attempts || 0) + 1;
            levelState.bestAccuracy = Math.max(levelState.bestAccuracy || 0, accuracy);
            levelState.stars = Math.max(levelState.stars || 0, stars);
            levelState.completedQuestions = (levelState.completedQuestions || 0) + total;
            this.practiceData.totalCompleted = (this.practiceData.totalCompleted || 0) + total;
            this.practiceData.totalStars = this.practiceData.levels.reduce((s, l) => s + (l.stars || 0), 0);

            // 解锁下一关
            let unlockedNext = false;
            if (accuracy >= level.threshold && level.id < 5) {
                const next = this.practiceData.levels.find(l => l.id === level.id + 1);
                if (next && !next.unlocked) {
                    next.unlocked = true;
                    unlockedNext = true;
                }
            }
            this.savePracticeData();
            this.clearPracticeSession();

            // 显示结果页
            document.getElementById('practiceFsLoading').style.display = 'none';
            document.getElementById('practiceFsQuestion').style.display = 'none';
            document.getElementById('practiceFsResult').style.display = 'flex';
            document.getElementById('practiceFsFooter').style.display = 'none';
            document.getElementById('practiceFsProgressFill').style.width = '100%';

            document.getElementById('practiceResultCorrect').textContent = `${correct}/${total}`;
            document.getElementById('practiceResultAccuracy').textContent = accuracy + '%';
            document.getElementById('practiceResultStars').textContent = stars;

            const passed = accuracy >= level.threshold;
            document.getElementById('practiceResultTitle').textContent = passed ? '🎉 通关成功' : '挑战未通过';
            const iconEl = document.getElementById('practiceResultIcon');
            iconEl.innerHTML = `<i class="fas ${passed ? 'fa-trophy' : 'fa-redo'}"></i>`;
            iconEl.className = 'practice-result-icon ' + (passed ? 'passed' : 'failed');

            const unlockEl = document.getElementById('practiceResultUnlock');
            if (unlockedNext) {
                const nextLevel = this.getPRACTICE_LEVELS().find(l => l.id === level.id + 1);
                unlockEl.style.display = 'flex';
                document.getElementById('practiceResultUnlockText').textContent = `已解锁第 ${nextLevel.id} 关 · ${nextLevel.name}`;
            } else {
                unlockEl.style.display = 'none';
            }

            // 下一关按钮显示控制
            const nextBtn = document.getElementById('practiceNextBtn');
            const nextLevelState = this.practiceData.levels.find(l => l.id === level.id + 1);
            if (passed && nextLevelState && nextLevelState.unlocked) {
                nextBtn.style.display = 'inline-flex';
            } else {
                nextBtn.style.display = 'none';
            }
        }
    }

    savePracticeSession() {
        if (this.practiceSession) {
            localStorage.setItem('practice_session_save', JSON.stringify(this.practiceSession));
        }
    }

    clearPracticeSession() {
        localStorage.removeItem('practice_session_save');
        this.checkPracticeResume();
    }

    exitChallenge() {
        if (!confirm('退出挑战将保存当前进度，可稍后继续。确认退出？')) return;
        this.stopPracticeTimer();
        this.savePracticeSession();
        this.closeFullscreenPractice();
    }

    closeFullscreenPractice() {
        const fs = document.getElementById('practiceFullscreen');
        if (fs) fs.style.display = 'none';
        document.body.style.overflow = '';
        this.stopPracticeTimer();
        this.renderPracticeLobby();
        this.checkPracticeResume();
    }

    retryChallenge() {
        this.clearPracticeSession();
        this.startChallenge();
    }

    goNextLevel() {
        const currentLevel = this.practiceSession?.levelId || this.practiceSelectedLevel;
        this.practiceSelectedLevel = currentLevel + 1;
        this.clearPracticeSession();
        this.startChallenge();
    }

    backToLobby() {
        this.clearPracticeSession();
        this.closeFullscreenPractice();
    }

    showToast(message) {
        let toast = document.getElementById('practiceToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'practiceToast';
            toast.className = 'practice-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(this._practiceToastTimer);
        this._practiceToastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
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
