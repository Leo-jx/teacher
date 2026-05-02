class DevAssistant {
    constructor() {
        this.messages = [];
        this.chatHistory = [];
        this.currentChatId = null;
        this.currentToolType = null;
        this.isTyping = false;
        this.typingQueue = [];
        this.typingSpeed = 15;

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
        this.toolCodeFix = document.getElementById('toolCodeFix');
        this.toolCodeAnalysis = document.getElementById('toolCodeAnalysis');
        this.codeToolPanel = document.getElementById('codeToolPanel');
        this.toolPanelClose = document.getElementById('toolPanelClose');
        this.codeInput = document.getElementById('codeInput');
        this.codeFileInput = document.getElementById('codeFileInput');
        this.clearCodeBtn = document.getElementById('clearCodeBtn');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.toolSyntaxLearn = document.getElementById('toolSyntaxLearn');
        this.toolAlgorithm = document.getElementById('toolAlgorithm');
        this.toolErrorDecoder = document.getElementById('toolErrorDecoder');
        this.syntaxLearnPanel = document.getElementById('syntaxLearnPanel');
        this.algorithmPanel = document.getElementById('algorithmPanel');
        this.errorDecoderPanel = document.getElementById('errorDecoderPanel');
        this.syntaxPanelClose = document.getElementById('syntaxPanelClose');
        this.algorithmPanelClose = document.getElementById('algorithmPanelClose');
        this.errorDecoderPanelClose = document.getElementById('errorDecoderPanelClose');
        this.syntaxLearnBtn = document.getElementById('syntaxLearnBtn');
        this.algorithmLearnBtn = document.getElementById('algorithmLearnBtn');
        this.decodeErrorBtn = document.getElementById('decodeErrorBtn');
        this.syntaxLanguage = document.getElementById('syntaxLanguage');
        this.syntaxKeyword = document.getElementById('syntaxKeyword');
        this.algorithmType = document.getElementById('algorithmType');
        this.algorithmName = document.getElementById('algorithmName');
        this.errorInput = document.getElementById('errorInput');
        this.errorLanguage = document.getElementById('errorLanguage');
        this.clearErrorBtn = document.getElementById('clearErrorBtn');
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

        this.toolSyntaxLearn.addEventListener('click', () => this.openSyntaxLearn());
        this.syntaxPanelClose.addEventListener('click', () => this.closeSyntaxLearn());
        this.syntaxLearnBtn.addEventListener('click', () => this.learnSyntax());
        this.syntaxKeyword.addEventListener('input', () => this.updateSyntaxCharCount());

        this.toolAlgorithm.addEventListener('click', () => this.openAlgorithmPanel());
        this.algorithmPanelClose.addEventListener('click', () => this.closeAlgorithmPanel());
        this.algorithmLearnBtn.addEventListener('click', () => this.learnAlgorithm());

        this.toolErrorDecoder.addEventListener('click', () => this.openErrorDecoder());
        this.errorDecoderPanelClose.addEventListener('click', () => this.closeErrorDecoder());
        this.decodeErrorBtn.addEventListener('click', () => this.decodeError());
        this.clearErrorBtn.addEventListener('click', () => {
            this.errorInput.value = '';
            this.updateErrorCharCount();
        });
        this.errorInput.addEventListener('input', () => this.updateErrorCharCount());

        document.querySelectorAll('.syntax-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.syntaxKeyword.value = btn.dataset.keyword;
            });
        });

        document.querySelectorAll('.algorithm-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.algorithmType.value = btn.dataset.type;
                this.algorithmName.value = btn.dataset.name;
            });
        });

        document.querySelectorAll('.error-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const errorType = btn.dataset.error;
                this.errorInput.value = `${errorType}\n\n请分析这个错误的原因和解决方案。`;
                this.updateErrorCharCount();
            });
        });
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

    setStatus(status, text) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }

    async sendMessage() {
        const content = this.userInput.value.trim();
        if (!content) return;
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

        this.sendBtn.disabled = true;
        this.setStatus('loading', '思考中...');

        const aiMessageEl = this.appendMessage('assistant', '', true);

        try {
            await this.sendViaHTTP(aiMessageEl);
            await this.waitForTypingComplete();
        } catch (error) {
            console.error('发送消息失败:', error);
            await this.typeWriterEffect(aiMessageEl, `抱歉，发生了错误：${error.message}。请稍后重试。`);
            this.setStatus('error', '请求失败');
        } finally {
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

        let response;
        try {
            response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    stream: false
                })
            });
        } catch (networkError) {
            console.error('网络请求失败:', networkError);
            const mockResponse = this.generateMockResponse(apiMessages);
            this.messages.push({ role: 'assistant', content: mockResponse });
            await this.typeWriterEffect(aiMessageEl, mockResponse);
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API请求失败:', errorData);
            const mockResponse = this.generateMockResponse(apiMessages);
            this.messages.push({ role: 'assistant', content: mockResponse });
            await this.typeWriterEffect(aiMessageEl, mockResponse);
            return;
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
        await this.typeWriterEffect(aiMessageEl, aiContent);
    }

    generateMockResponse(messages) {
        const lastMessage = messages[messages.length - 1]?.content || '';
        
        if (lastMessage.includes('MySQL') || lastMessage.includes('mysql')) {
            return `## MySQL数据库基础介绍

MySQL是一种开源的关系型数据库管理系统（RDBMS），被广泛应用于Web开发领域。

### 核心特点
- **开源免费**：采用GPL许可证，可免费使用和修改
- **跨平台**：支持Windows、Linux、macOS等多种操作系统
- **高性能**：优化的查询引擎，支持大规模数据处理
- **高可用**：支持主从复制、读写分离等架构

### 基本SQL语句

**查询数据：**
\`\`\`sql
SELECT column1, column2 FROM table_name WHERE condition;
\`\`\`

**插入数据：**
\`\`\`sql
INSERT INTO table_name (column1, column2) VALUES (value1, value2);
\`\`\`

**更新数据：**
\`\`\`sql
UPDATE table_name SET column1 = value1 WHERE condition;
\`\`\`

**删除数据：**
\`\`\`sql
DELETE FROM table_name WHERE condition;
\`\`\`

### 索引优化建议
1. 为经常用于WHERE条件的列创建索引
2. 避免在索引列上使用函数
3. 合理使用复合索引
4. 定期分析和优化表

> 提示：当前为离线模式，以上为模拟回答。在线模式下将提供更精确的解答。`;
        }

        if (lastMessage.includes('Java') || lastMessage.includes('java')) {
            return `## Java编程语言介绍

Java是一种跨平台的面向对象编程语言，由Sun Microsystems于1995年发布。

### 核心特性
- **跨平台**：一次编写，处处运行（Write Once, Run Anywhere）
- **面向对象**：支持封装、继承、多态
- **自动内存管理**：垃圾回收机制
- **强类型语言**：编译时类型检查

### 基本语法示例

**Hello World：**
\`\`\`java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
\`\`\`

**类与对象：**
\`\`\`java
public class Person {
    private String name;
    private int age;
    
    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }
    
    public void sayHello() {
        System.out.println("Hello, my name is " + name);
    }
}
\`\`\`

### Java生态
- **JDK**：Java Development Kit（开发工具包）
- **JRE**：Java Runtime Environment（运行时环境）
- **JVM**：Java Virtual Machine（虚拟机）

> 提示：当前为离线模式，以上为模拟回答。在线模式下将提供更精确的解答。`;
        }

        if (lastMessage.includes('Python') || lastMessage.includes('python')) {
            return `## Python编程语言介绍

Python是一种高级通用编程语言，以简洁的语法和强大的功能著称。

### 核心特点
- **简洁优雅**：语法简洁，代码可读性强
- **动态类型**：无需声明变量类型
- **丰富的库**：拥有大量第三方库
- **跨平台**：支持多种操作系统

### 基本语法示例

**Hello World：**
\`\`\`python
print("Hello, World!")
\`\`\`

**函数定义：**
\`\`\`python
def greet(name):
    return f"Hello, {name}!"

result = greet("Alice")
print(result)
\`\`\`

**列表推导式：**
\`\`\`python
numbers = [1, 2, 3, 4, 5]
squares = [x ** 2 for x in numbers]
print(squares)  # 输出: [1, 4, 9, 16, 25]
\`\`\`

### 常用库
- **NumPy**：数值计算
- **Pandas**：数据分析
- **Flask/Django**：Web开发
- **TensorFlow/PyTorch**：机器学习

> 提示：当前为离线模式，以上为模拟回答。在线模式下将提供更精确的解答。`;
        }

        return `## 技术问题解答

感谢您的提问！

### 问题分析
根据您的问题，我理解您想了解相关技术知识。

### 专业建议
由于当前服务暂时不可用，我为您提供一些通用的技术建议：

1. **明确问题范围**：请确认您的问题属于以下技术领域：
   - MySQL数据库开发与优化
   - Java编程语言及相关框架
   - Python编程及数据分析
   - C/C++编程语言
   - 微信小程序/uni-app开发
   - Vue/Spring框架

2. **提供更多上下文**：如果您能提供更多背景信息，我可以给出更精准的解答。

3. **代码示例**：如果涉及代码问题，建议提供完整的代码片段。

### 学习建议
- 从官方文档入手，了解基础知识
- 实践项目驱动学习
- 参考优秀的开源项目
- 加入技术社区交流

> 提示：当前为离线模式，以上为模拟回答。在线模式下将提供更精确的解答。`;
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

    async typeWriterEffect(contentEl, fullContent) {
        this.isTyping = true;
        let displayedContent = '';
        let charIndex = 0;
        
        contentEl.classList.add('typing');
        
        const typeNextChunk = () => {
            return new Promise(resolve => {
                const typeChunk = () => {
                    if (charIndex >= fullContent.length) {
                        this.isTyping = false;
                        contentEl.classList.remove('typing');
                        resolve();
                        return;
                    }
                    
                    const chunkSize = Math.min(3, fullContent.length - charIndex);
                    displayedContent += fullContent.substring(charIndex, charIndex + chunkSize);
                    charIndex += chunkSize;
                    
                    contentEl.innerHTML = this.renderMarkdown(displayedContent);
                    this.scrollToBottom();
                    
                    if (charIndex < fullContent.length) {
                        setTimeout(typeChunk, this.typingSpeed);
                    } else {
                        this.isTyping = false;
                        contentEl.classList.remove('typing');
                        resolve();
                    }
                };
                
                typeChunk();
            });
        };
        
        await typeNextChunk();
    }

    waitForTypingComplete() {
        return new Promise(resolve => {
            const checkTyping = () => {
                if (!this.isTyping) {
                    resolve();
                } else {
                    setTimeout(checkTyping, 100);
                }
            };
            checkTyping();
        });
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

    openCodeTool(toolType) {
        const panel = document.getElementById('codeToolPanel');
        const title = document.getElementById('toolPanelTitle');
        const btnText = document.getElementById('analyzeBtnText');
        const codeInput = document.getElementById('codeInput');

        this.closeSyntaxLearn();
        this.closeAlgorithmPanel();
        this.closeErrorDecoder();

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

        this.sendBtn.disabled = true;
        document.getElementById('analyzeBtn').disabled = true;
        this.setStatus('loading', '分析中...');

        const aiMessageEl = this.appendMessage('assistant', '', true);

        try {
            await this.sendViaHTTP(aiMessageEl);
            await this.waitForTypingComplete();
        } catch (error) {
            console.error('代码分析失败:', error);
            await this.typeWriterEffect(aiMessageEl, `抱歉，代码分析失败：${error.message}。请稍后重试。`);
            this.setStatus('error', '分析失败');
        } finally {
            this.sendBtn.disabled = false;
            document.getElementById('analyzeBtn').disabled = false;
            this.setStatus('ready', '就绪');
            this.saveCurrentChat();
        }
    }

    openSyntaxLearn() {
        this.closeCodeTool();
        this.closeAlgorithmPanel();
        this.closeErrorDecoder();
        document.getElementById('toolSyntaxLearn').classList.add('active');
        this.syntaxLearnPanel.classList.add('active');
        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';
    }

    closeSyntaxLearn() {
        this.syntaxLearnPanel.classList.remove('active');
        document.getElementById('toolSyntaxLearn').classList.remove('active');
    }

    updateSyntaxCharCount() {
        const count = this.syntaxKeyword.value.length;
    }

    async learnSyntax() {
        const language = this.syntaxLanguage.value;
        const keyword = this.syntaxKeyword.value.trim();

        if (!keyword) {
            alert('请输入要学习的语法关键词');
            return;
        }

        if (this.messages.length === 0) {
            this.createNewChat(true);
        }

        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';

        const langLabel = this.syntaxLanguage.selectedOptions[0].text;

        const prompt = `请详细讲解${langLabel}编程语言中的"${keyword}"语法知识，要求包含以下内容：

## ${langLabel}语法讲解：${keyword}

### 1. 基本概念
- ${keyword}的定义和作用
- 适用场景

### 2. 语法格式
- 完整的语法格式说明
- 参数详解（如果有）

### 3. 使用示例
请提供3-5个由浅入深的代码示例：
- 示例1：最基础用法
- 示例2：常见用法
- 示例3：进阶用法
- 示例4：实际应用场景（如果适用）

### 4. 注意事项
- 常见错误和陷阱
- 最佳实践建议

### 5. 相关语法
- 与${keyword}相关的其他语法知识`;

        this.messages.push({ role: 'user', content: prompt });
        this.appendMessage('user', prompt);

        this.sendBtn.disabled = true;
        this.syntaxLearnBtn.disabled = true;
        this.setStatus('loading', '讲解中...');

        const aiMessageEl = this.appendMessage('assistant', '', true);

        try {
            await this.sendViaHTTP(aiMessageEl);
            await this.waitForTypingComplete();
        } catch (error) {
            console.error('语法讲解失败:', error);
            await this.typeWriterEffect(aiMessageEl, `抱歉，语法讲解失败：${error.message}。请稍后重试。`);
            this.setStatus('error', '讲解失败');
        } finally {
            this.sendBtn.disabled = false;
            this.syntaxLearnBtn.disabled = false;
            this.setStatus('ready', '就绪');
            this.saveCurrentChat();
        }
    }

    openAlgorithmPanel() {
        this.closeCodeTool();
        this.closeSyntaxLearn();
        this.closeErrorDecoder();
        document.getElementById('toolAlgorithm').classList.add('active');
        this.algorithmPanel.classList.add('active');
        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';
    }

    closeAlgorithmPanel() {
        this.algorithmPanel.classList.remove('active');
        document.getElementById('toolAlgorithm').classList.remove('active');
    }

    async learnAlgorithm() {
        const algorithmType = this.algorithmType.value;
        const algorithmName = this.algorithmName.value.trim();

        if (!algorithmName) {
            alert('请输入要学习的算法名称');
            return;
        }

        if (this.messages.length === 0) {
            this.createNewChat(true);
        }

        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';

        const typeLabels = {
            'sorting': '排序算法',
            'searching': '查找算法',
            'tree': '树结构',
            'graph': '图算法',
            'dp': '动态规划',
            'greedy': '贪心算法',
            'divide': '分治算法',
            'backtracking': '回溯算法',
            'other': '其他算法'
        };

        const typeLabel = typeLabels[algorithmType] || '算法';

        const prompt = `请详细讲解${typeLabel}中的"${algorithmName}"，要求包含以下内容：

## 算法讲解：${algorithmName}

### 1. 算法简介
- 算法的基本概念和定义
- 算法的历史背景和发明者（如果有）
- 算法的主要应用场景

### 2. 核心思想
- 用通俗易懂的语言解释算法的核心思想
- 算法的关键步骤和流程

### 3. 分步骤可视化讲解
请用文字描述的方式，逐步展示算法的执行过程

### 4. 代码实现
请提供Java和Python的实现，代码中要有详细的注释

### 5. 复杂度分析
- 时间复杂度：最好情况、最坏情况、平均情况
- 空间复杂度：详细说明空间消耗

### 6. 算法优化
- 常见的优化方法
- 变体算法介绍`;

        this.messages.push({ role: 'user', content: prompt });
        this.appendMessage('user', prompt);

        this.sendBtn.disabled = true;
        this.algorithmLearnBtn.disabled = true;
        this.setStatus('loading', '讲解中...');

        const aiMessageEl = this.appendMessage('assistant', '', true);

        try {
            await this.sendViaHTTP(aiMessageEl);
            await this.waitForTypingComplete();
        } catch (error) {
            console.error('算法讲解失败:', error);
            await this.typeWriterEffect(aiMessageEl, `抱歉，算法讲解失败：${error.message}。请稍后重试。`);
            this.setStatus('error', '讲解失败');
        } finally {
            this.sendBtn.disabled = false;
            this.algorithmLearnBtn.disabled = false;
            this.setStatus('ready', '就绪');
            this.saveCurrentChat();
        }
    }

    openErrorDecoder() {
        this.closeCodeTool();
        this.closeSyntaxLearn();
        this.closeAlgorithmPanel();
        document.getElementById('toolErrorDecoder').classList.add('active');
        this.errorDecoderPanel.classList.add('active');
        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';
    }

    closeErrorDecoder() {
        this.errorDecoderPanel.classList.remove('active');
        document.getElementById('toolErrorDecoder').classList.remove('active');
    }

    updateErrorCharCount() {
        const count = this.errorInput.value.length;
        document.getElementById('errorCharCount').textContent = `${count} 字符`;
    }

    async decodeError() {
        const errorMessage = this.errorInput.value.trim();
        const language = this.errorLanguage.value;

        if (!errorMessage) {
            alert('请粘贴错误信息');
            return;
        }

        if (this.messages.length === 0) {
            this.createNewChat(true);
        }

        this.welcomeScreen.style.display = 'none';
        this.messagesDiv.style.display = 'flex';

        const langLabel = this.errorLanguage.selectedOptions[0].text;

        const prompt = `请帮我分析以下${langLabel !== '自动识别' ? langLabel : ''}错误信息，并提供详细的解决方案：

## 错误信息

\`\`\`
${errorMessage}
\`\`\`

请按以下格式进行分析：

### 1. 错误类型识别
- 识别这是什么类型的错误
- 错误的严重程度

### 2. 错误原因分析
- 详细解释导致这个错误的根本原因
- 分析错误发生的上下文环境

### 3. 解决方案
- 提供具体的修复步骤
- 给出修正后的代码示例（如果适用）

### 4. 预防措施
- 如何避免类似错误再次发生
- 最佳实践建议`;

        this.messages.push({ role: 'user', content: prompt });
        this.appendMessage('user', prompt);

        this.sendBtn.disabled = true;
        this.decodeErrorBtn.disabled = true;
        this.setStatus('loading', '解读中...');

        const aiMessageEl = this.appendMessage('assistant', '', true);

        try {
            await this.sendViaHTTP(aiMessageEl);
            await this.waitForTypingComplete();
        } catch (error) {
            console.error('错误解读失败:', error);
            await this.typeWriterEffect(aiMessageEl, `抱歉，错误解读失败：${error.message}。请稍后重试。`);
            this.setStatus('error', '解读失败');
        } finally {
            this.sendBtn.disabled = false;
            this.decodeErrorBtn.disabled = false;
            this.setStatus('ready', '就绪');
            this.saveCurrentChat();
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new DevAssistant();
});
