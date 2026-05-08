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
        this.deviceId = null;
        this.lastSyncTime = null;
        this.syncEnabled = true;

        this.init();
    }

    init() {
        this.checkAuth();
        this.initDeviceId();
        this.bindElements();
        this.bindAuthEvents();
        this.bindEvents();
        this.setupMarked();
        this.autoResizeTextarea();
        this.updateCharCount();
        this.showApp();
    }

    initDeviceId() {
        this.deviceId = localStorage.getItem('device_id');
        if (!this.deviceId) {
            this.deviceId = this.generateDeviceId();
            localStorage.setItem('device_id', this.deviceId);
        }
        this.lastSyncTime = localStorage.getItem('last_sync_time') || '1970-01-01 00:00:00';
    }

    generateDeviceId() {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 15);
        return `device_${timestamp}_${randomStr}`;
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
            const response = await fetch('/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.username = data.user.username;
                this.userId = data.user.id;
                localStorage.setItem('auth_username', this.username);
                localStorage.setItem('auth_userId', this.userId);
                await this.registerDevice();
                await this.syncData();
            } else {
                this.logout();
            }
        } catch (e) {
            console.error('Token验证失败:', e);
        }
    }

    async registerDevice() {
        if (!this.authToken) return;
        
        try {
            const deviceName = this.getDeviceName();
            await fetch('/api/devices/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    deviceName
                })
            });
        } catch (e) {
            console.error('设备注册失败:', e);
        }
    }

    getDeviceName() {
        const ua = navigator.userAgent;
        let deviceType = 'Desktop';
        let os = 'Unknown';
        
        if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'Mobile';
        else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';
        
        if (/Windows/i.test(ua)) os = 'Windows';
        else if (/Mac/i.test(ua)) os = 'macOS';
        else if (/Linux/i.test(ua)) os = 'Linux';
        else if (/Android/i.test(ua)) os = 'Android';
        else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
        
        return `${deviceType} - ${os}`;
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
            submitBtn.querySelector('span').textContent = '登录中...';
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
                    this.username = data.user.username;
                    this.userId = data.user.id;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('auth_username', this.username);
                    localStorage.setItem('auth_userId', this.userId);
                    this.closeAuthModal();
                    await this.registerDevice();
                    this.showApp();
                } else {
                    errorEl.textContent = data.error || '注册失败';
                }
                    this.username = data.user.username;
                    this.userId = data.user.id;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('auth_username', this.username);
                    localStorage.setItem('auth_userId', this.userId);
                    this.closeAuthModal();
                    await this.registerDevice();
                    await this.syncData();
                    this.showApp();
                } else {
                    errorEl.textContent = data.error || '登录失败';
                }
            } catch (error) {
                errorEl.textContent = '网络错误，请稍后重试';
            } finally {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = '登录';
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
                errorEl.textContent = '两次输入的密码不一致';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = '注册中...';
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
                    this.username = data.user.username;
                    this.userId = data.user.id;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('auth_username', this.username);
                    localStorage.setItem('auth_userId', this.userId);
                    this.closeAuthModal();
                    await this.registerDevice();
                    this.showApp();
                } else {
                    errorEl.textContent = data.error || '注册失败';
                }
            } catch (error) {
                errorEl.textContent = '网络错误，请稍后重试';
            } finally {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = '注册';
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
        this.webSearchToggle = document.getElementById('webSearchToggle');
    }

    async syncData() {
        if (!this.authToken || !this.syncEnabled) return;
        
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    lastSyncTime: this.lastSyncTime
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.conversations.length > 0) {
                    this.mergeSyncedData(data.conversations);
                    this.lastSyncTime = data.syncTime;
                    localStorage.setItem('last_sync_time', this.lastSyncTime);
                }
            }
        } catch (e) {
            console.error('同步失败:', e);
        }
    }

    mergeSyncedData(conversations) {
        const localHistory = JSON.parse(localStorage.getItem('chat_history') || '[]');
        const localMap = new Map(localHistory.map(h => [h.id, h]));
        
        conversations.forEach(conv => {
            const localConv = localMap.get(conv.id);
            if (!localConv) {
                localMap.set(conv.id, {
                    id: conv.id,
                    title: conv.title,
                    messages: conv.messages || [],
                    timestamp: conv.updated_at || conv.created_at
                });
            } else {
                const localTime = new Date(localConv.timestamp).getTime();
                const remoteTime = new Date(conv.updated_at).getTime();
                if (remoteTime > localTime) {
                    localMap.set(conv.id, {
                        id: conv.id,
                        title: conv.title,
                        messages: conv.messages || localConv.messages,
                        timestamp: conv.updated_at
                    });
                }
            }
        });
        
        const mergedHistory = Array.from(localMap.values())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        localStorage.setItem('chat_history', JSON.stringify(mergedHistory));
        this.chatHistory = mergedHistory;
        this.renderHistory();
    }

    async uploadLocalData() {
        if (!this.authToken || !this.syncEnabled) return;
        
        const localHistory = JSON.parse(localStorage.getItem('chat_history') || '[]');
        if (localHistory.length === 0) return;
        
        try {
            await fetch('/api/sync/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    conversations: localHistory
                })
            });
        } catch (e) {
            console.error('上传数据失败:', e);
        }
    }

    async saveToCloud(conversation) {
        if (!this.authToken) return;
        
        try {
            let conversationId = conversation.id;
            
            if (!conversationId || conversationId.startsWith('local_')) {
                const createResponse = await fetch('/api/conversations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.authToken}`
                    },
                    body: JSON.stringify({ title: conversation.title })
                });
                
                if (createResponse.ok) {
                    const createData = await createResponse.json();
                    conversationId = createData.conversationId;
                    conversation.id = conversationId;
                }
            }
            
            if (conversation.messages && conversation.messages.length > 0) {
                const lastMessage = conversation.messages[conversation.messages.length - 1];
                await fetch('/api/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.authToken}`
                    },
                    body: JSON.stringify({
                        conversationId,
                        role: lastMessage.role,
                        content: lastMessage.content
                    })
                });
            }
        } catch (e) {
            console.error('保存到云端失败:', e);
        }
    }

    async loadFromCloud(conversationId) {
        if (!this.authToken) return null;
        
        try {
            const response = await fetch(`/api/conversations/${conversationId}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (e) {
            console.error('从云端加载失败:', e);
        }
        
        return null;
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
            this.codeCharCount.textContent = this.codeInput.value.length + ' 字符';
        });

        this.codeFileInput.addEventListener('change', (e) => this.handleCodeFileUpload(e));

        this.clearCodeBtn.addEventListener('click', () => {
            this.codeInput.value = '';
            this.codeCharCount.textContent = '0 字符';
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

        this.errorInput.addEventListener('input', () => {
            this.errorCharCount.textContent = this.errorInput.value.length + ' 字符';
        });

        this.clearCodeBtn.addEventListener('click', () => {
            this.errorInput.value = '';
            this.errorCharCount.textContent = '0 字符';
        });

        document.querySelectorAll('.error-quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.errorInput.value = e.target.dataset.error;
                this.errorCharCount.textContent = this.errorInput.value.length + ' 字符';
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
                this.addMessage('assistant', '抱歉，发生错误：' + data.error);
            } else {
                const aiContent = data.choices?.[0]?.message?.content || data.content || '抱歉，未能获取回复。';
                this.addMessage('assistant', aiContent);
                if (data.conversationId) {
                    this.dbConversationId = data.conversationId;
                }
            }

            this.setStatus('ready');
            this.scrollToBottom();
            this.saveCurrentChat();
        } catch (error) {
            console.error('发送消息失败:', error);
            this.addMessage('assistant', '抱歉，网络错误，请稍后重试。');
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
            console.error('创建数据库对话失败:', e);
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
            console.error('加载数据库对话失败:', e);
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
            console.error('删除数据库对话失败:', e);
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
                    const lines = currentText.split('\n');
                    const lastLine = lines[lines.length - 1];
                    if (lastLine.trim() === '' || lastLine.startsWith('  ')) {
                        element.innerHTML = this.renderMarkdown(currentText);
                    } else {
                        element.innerHTML = this.renderMarkdown(currentText);
                    }
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

            if (/^(一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五)[、.．:：]/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                result.push('## ' + trimmed);
                continue;
            }

            if (/^(\d+)[、.．:：]\s*/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                let converted = trimmed.replace(/^(\d+)[、.．:：]\s*/, '$1. ');
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

            if (/^[-•●○►▸]\s/.test(trimmed)) {
                let processed = trimmed.replace(/^[-•●○►▸]\s/, '- ');
                result.push(processed);
                continue;
            }

            if (/^【([^】]+)】/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                let sectionTitle = trimmed.replace(/^【([^】]+)】\s*/, '');
                if (sectionTitle) {
                    result.push('### ' + sectionTitle);
                } else {
                    result.push('### ' + trimmed.replace(/【|】/g, ''));
                }
                result.push('');
                continue;
            }

            if (/^(注意|提示|警告|重要|总结|结论|参考|建议|步骤|备注|说明|关键|核心|重点)/.test(trimmed)) {
                if (result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                let keyword = trimmed.match(/^(注意|提示|警告|重要|总结|结论|参考|建议|步骤|备注|说明|关键|核心|重点)/)[1];
                let colorClass = 'info-tag';
                if (/^(警告|注意)/.test(keyword)) colorClass = 'warn-tag';
                if (/^(重要|关键|核心|重点)/.test(keyword)) colorClass = 'important-tag';
                if (/^(总结|结论)/.test(keyword)) colorClass = 'summary-tag';
                if (/^(提示|建议|备注|说明)/.test(keyword)) colorClass = 'tip-tag';
                if (/^(步骤|参考)/.test(keyword)) colorClass = 'step-tag';
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
                this.statusText.textContent = '思考中...';
                this.statusIndicator.classList.add('typing');
                break;
            case 'ready':
                this.statusText.textContent = '就绪';
                this.statusIndicator.classList.remove('typing');
                break;
            case 'error':
                this.statusText.textContent = '错误';
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
            : '新对话';

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
            console.error('保存聊天记录失败:', e);
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
            emptyEl.textContent = '暂无对话记录';
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
            console.error('加载数据库消息失败:', e);
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
        if (!confirm('确定要清除所有聊天记录吗？此操作不可恢复。')) return;

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

    openCodeTool(type) {
        this.currentToolType = type;
        this.toolPanelTitle.innerHTML = type === 'fix' ? 
            '<i class="fas fa-bug"></i> 代码纠错' : 
            '<i class="fas fa-search-plus"></i> 代码分析';
        this.analyzeBtnText.textContent = type === 'fix' ? '开始纠错' : '开始分析';
        this.codeToolPanel.style.display = 'block';
        this.codeInput.focus();
    }

    closeCodeToolPanel() {
        this.codeToolPanel.style.display = 'none';
        this.codeInput.value = '';
        this.codeCharCount.textContent = '0 字符';
        this.fileName.textContent = '';
    }

    handleCodeFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this.codeInput.value = event.target.result;
            this.codeCharCount.textContent = this.codeInput.value.length + ' 字符';
            this.fileName.textContent = file.name;
        };
        reader.readAsText(file);
    }

    async analyzeCode() {
        const code = this.codeInput.value.trim();
        if (!code) {
            alert('请输入或上传代码');
            return;
        }

        const language = this.codeLanguage.value;
        const toolType = this.currentToolType;

        this.analyzeBtn.disabled = true;
        this.analyzeBtnText.textContent = '分析中...';

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
                })
            });

            const data = await response.json();

            if (data.error) {
                alert('分析失败：' + data.error);
            } else {
                this.userInput.value = toolType === 'fix' ? 
                    `请帮我纠错这段${language}代码：\n\n${code}\n\n错误分析：${data.content}` :
                    `请帮我分析这段${language}代码：\n\n${code}\n\n分析结果：${data.content}`;
                this.closeCodeToolPanel();
            }
        } catch (error) {
            alert('网络错误，请稍后重试');
        } finally {
            this.analyzeBtn.disabled = false;
            this.analyzeBtnText.textContent = toolType === 'fix' ? '开始纠错' : '开始分析';
        }
    }

    openSyntaxLearnPanel() {
        this.syntaxLearnPanel.style.display = 'block';
        this.syntaxKeyword.focus();
    }

    closeSyntaxLearnPanel() {
        this.syntaxLearnPanel.style.display = 'none';
        this.syntaxKeyword.value = '';
    }

    async learnSyntax() {
        const language = this.syntaxLanguage.value;
        const keyword = this.syntaxKeyword.value.trim();

        if (!keyword) {
            alert('请输入语法关键词');
            return;
        }

        this.syntaxLearnBtn.disabled = true;

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
                })
            });

            const data = await response.json();

            if (data.error) {
                alert('学习失败：' + data.error);
            } else {
                this.userInput.value = `请详细讲解${language}语言中的"${keyword}"语法，包括用法、示例和最佳实践。`;
                this.closeSyntaxLearnPanel();
            }
        } catch (error) {
            alert('网络错误，请稍后重试');
        } finally {
            this.syntaxLearnBtn.disabled = false;
        }
    }

    openAlgorithmPanel() {
        this.algorithmPanel.style.display = 'block';
        this.algorithmName.focus();
    }

    closeAlgorithmPanel() {
        this.algorithmPanel.style.display = 'none';
        this.algorithmName.value = '';
    }

    async learnAlgorithm() {
        const type = this.algorithmType.value;
        const name = this.algorithmName.value.trim();

        if (!name) {
            alert('请输入算法名称');
            return;
        }

        this.algorithmLearnBtn.disabled = true;

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
                })
            });

            const data = await response.json();

            if (data.error) {
                alert('讲解失败：' + data.error);
            } else {
                this.userInput.value = `请详细讲解"${name}"算法，包括原理、实现步骤、时间复杂度分析和代码示例。`;
                this.closeAlgorithmPanel();
            }
        } catch (error) {
            alert('网络错误，请稍后重试');
        } finally {
            this.algorithmLearnBtn.disabled = false;
        }
    }

    openErrorDecoderPanel() {
        this.errorDecoderPanel.style.display = 'block';
        this.errorInput.focus();
    }

    closeErrorDecoderPanel() {
        this.errorDecoderPanel.style.display = 'none';
        this.errorInput.value = '';
        this.errorCharCount.textContent = '0 字符';
    }

    async decodeError() {
        const error = this.errorInput.value.trim();
        if (!error) {
            alert('请输入错误信息');
            return;
        }

        const language = this.errorLanguage.value;

        this.decodeErrorBtn.disabled = true;

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
                })
            });

            const data = await response.json();

            if (data.error) {
                alert('解读失败：' + data.error);
            } else {
                this.userInput.value = `请帮我解读这个${language}错误：\n\n${error}`;
                this.closeErrorDecoderPanel();
            }
        } catch (error) {
            alert('网络错误，请稍后重试');
        } finally {
            this.decodeErrorBtn.disabled = false;
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