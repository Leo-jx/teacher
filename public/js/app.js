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
        // Toast 堆叠计数器
        this._toastCounter = 0;
        // 确认弹窗实例
        this._confirmDialog = null;
        // 网络状态
        this._isOnline = navigator.onLine;

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
        this.restoreSidebarState();
        this.initNetworkStatus();
    }

    // ============ 自定义 Toast 通知系统 ============

    /** 注入 Toast 所需的 CSS 样式 */
    injectToastStyles() {
        /* CSS 已提取到 style.css */
    }

    /**
     * 显示自定义 Toast 通知
     * @param {string} message - 消息文本
     * @param {'success'|'error'|'warning'|'info'} type - Toast 类型
     * @param {number} duration - 自动消失时间（毫秒），默认 3000
     */
    showToast(message, type = 'info', duration = 3000) {
        // 兼容原有练习模块的 showToast 调用（单参数字符串形式）
        if (typeof type === 'number') {
            duration = type;
            type = 'info';
        }

        let container = document.getElementById('customToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'customToastContainer';
            container.className = 'custom-toast-container';
            document.body.appendChild(container);
        }

        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${iconMap[type] || iconMap.info} toast-icon"></i>
            <span class="toast-message">${this._escapeHtml(message)}</span>
            <button class="toast-close" aria-label="关闭通知"><i class="fas fa-times"></i></button>
            <div class="toast-progress" style="animation-duration:${duration}ms"></div>
        `;

        // 关闭按钮事件
        toast.querySelector('.toast-close').addEventListener('click', () => this._removeToast(toast));

        container.appendChild(toast);
        this._toastCounter++;

        // 自动消失
        const timer = setTimeout(() => this._removeToast(toast), duration);
        toast._autoCloseTimer = timer;

        // 最多同时显示 5 个
        const toasts = container.querySelectorAll('.custom-toast:not(.removing)');
        if (toasts.length > 5) {
            this._removeToast(toasts[0]);
        }
    }

    /** 移除单个 Toast */
    _removeToast(toast) {
        if (toast._removed) return;
        toast._removed = true;
        clearTimeout(toast._autoCloseTimer);
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => {
            toast.remove();
            this._toastCounter = Math.max(0, this._toastCounter - 1);
        });
    }

    /** HTML 转义 */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============ 自定义确认弹窗 ============

    /** 注入确认弹窗 CSS */
    injectConfirmDialogStyles() {
        /* CSS 已提取到 style.css */
    }

    /**
     * 自定义确认弹窗（替换原生 confirm）
     * @param {string} message - 描述文本
     * @param {object} options - 配置项
     * @param {string} options.title - 标题，默认"确认操作"
     * @param {string} options.confirmText - 确认按钮文本，默认"确定"
     * @param {string} options.cancelText - 取消按钮文本，默认"取消"
     * @returns {Promise<boolean>} 用户点击确认返回 true，取消返回 false
     */
    confirmDialog(message, options = {}) {
        const {
            title = '确认操作',
            confirmText = '确定',
            cancelText = '取消'
        } = options;

        return new Promise((resolve) => {
            // 移除已存在的弹窗
            if (this._confirmDialog) {
                this._confirmDialog.remove();
                this._confirmDialog = null;
            }

            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <h3>${this._escapeHtml(title)}</h3>
                    <p>${this._escapeHtml(message)}</p>
                    <div class="confirm-dialog-actions">
                        <button class="confirm-btn-cancel">${this._escapeHtml(cancelText)}</button>
                        <button class="confirm-btn-ok">${this._escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;

            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this._closeConfirmDialog(overlay, false, resolve);
                }
            });

            // 按钮事件
            overlay.querySelector('.confirm-btn-cancel').addEventListener('click', () => {
                this._closeConfirmDialog(overlay, false, resolve);
            });
            overlay.querySelector('.confirm-btn-ok').addEventListener('click', () => {
                this._closeConfirmDialog(overlay, true, resolve);
            });

            document.body.appendChild(overlay);
            this._confirmDialog = overlay;

            // ESC 关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this._closeConfirmDialog(overlay, false, resolve);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    /** 关闭确认弹窗 */
    _closeConfirmDialog(overlay, result, resolve) {
        overlay.classList.add('closing');
        overlay.addEventListener('animationend', () => {
            overlay.remove();
            if (this._confirmDialog === overlay) {
                this._confirmDialog = null;
            }
            resolve(result);
        });
    }

    // ============ 防抖和节流工具 ============

    /**
     * 防抖函数
     * @param {Function} fn - 需要防抖的函数
     * @param {number} delay - 延迟时间（毫秒）
     * @returns {Function}
     */
    debounce(fn, delay) {
        let timer = null;
        return (...args) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                fn.apply(this, args);
                timer = null;
            }, delay);
        };
    }

    /**
     * 节流函数
     * @param {Function} fn - 需要节流的函数
     * @param {number} delay - 间隔时间（毫秒）
     * @returns {Function}
     */
    throttle(fn, delay) {
        let lastTime = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastTime >= delay) {
                lastTime = now;
                fn.apply(this, args);
            }
        };
    }

    // ============ 注入动画相关 CSS ============

    /** 注入所有增强动画 CSS */
    injectAnimationStyles() {
        /* CSS 已提取到 style.css */
    }

    // ============ 网络状态检测 ============

    /** 初始化网络状态监听 */
    initNetworkStatus() {
        // 创建状态栏元素
        const bar = document.createElement('div');
        bar.id = 'networkStatusBar';
        bar.className = 'network-status-bar';
        document.body.appendChild(bar);

        // 初始状态检测
        if (!navigator.onLine) {
            this._showNetworkStatus(false);
        }

        // 监听网络事件
        window.addEventListener('online', () => {
            this._isOnline = true;
            this._showNetworkStatus(true);
            this.showToast('已连接', 'success', 2000);
        });

        window.addEventListener('offline', () => {
            this._isOnline = false;
            this._showNetworkStatus(false);
            this.showToast('网络已断开', 'error', 3000);
        });
    }

    /** 显示/隐藏网络状态栏 */
    _showNetworkStatus(isOnline) {
        const bar = document.getElementById('networkStatusBar');
        if (!bar) return;
        bar.className = `network-status-bar ${isOnline ? 'online' : 'offline'}`;
        bar.textContent = isOnline ? '已连接' : '离线';
        bar.classList.add('visible');
        // 3秒后自动隐藏
        clearTimeout(this._networkStatusTimer);
        if (isOnline) {
            this._networkStatusTimer = setTimeout(() => {
                bar.classList.remove('visible');
            }, 3000);
        }
        // 离线状态持续显示
    }

    // ============ 键盘快捷键 ============

    /** 初始化全局键盘快捷键 */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC 关闭弹窗/面板/全屏练习
            if (e.key === 'Escape') {
                // 关闭确认弹窗（由 confirmDialog 自身处理）
                // 关闭全屏练习
                const fs = document.getElementById('practiceFullscreen');
                if (fs && fs.style.display === 'flex') {
                    // 全屏练习中 ESC 退出确认
                    this._confirmExitChallenge();
                    return;
                }
                // 关闭工具面板
                if (this.codeToolPanels) {
                    this.codeToolPanels.forEach(panel => {
                        if (panel.classList.contains('active')) {
                            const panelId = panel.id;
                            this.closeCodeToolPanel(panelId);
                        }
                    });
                }
            }

            // Ctrl+Enter 发送消息
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    /** ESC 退出全屏练习确认 */
    async _confirmExitChallenge() {
        const confirmed = await this.confirmDialog('退出挑战将保存当前进度，可稍后继续。确认退出？', {
            title: '退出挑战',
            confirmText: '退出',
            cancelText: '继续答题'
        });
        if (confirmed) {
            this.exitChallengeInternal();
        }
    }

    /** 内部退出挑战（不带确认） */
    exitChallengeInternal() {
        this.stopPracticeTimer();
        this.savePracticeSession();
        this.closeFullscreenPractice();
    }

    // ============ 代码块复制功能 ============

    /** 为所有 pre > code 添加复制按钮 */
    addCopyButtonsToCodeBlocks(container) {
        if (!container) return;
        const codeBlocks = container.querySelectorAll('pre > code');
        codeBlocks.forEach(codeEl => {
            const pre = codeEl.parentElement;
            if (pre.classList.contains('code-block-wrapper')) return; // 已处理

            // 包装 pre
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);

            // 创建复制按钮
            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> 复制';
            copyBtn.setAttribute('aria-label', '复制代码');

            copyBtn.addEventListener('click', () => {
                const codeText = codeEl.textContent || codeEl.innerText;
                navigator.clipboard.writeText(codeText).then(() => {
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i> 复制';
                    }, 2000);
                }).catch(() => {
                    this.showToast('复制失败，请手动复制', 'error');
                });
            });

            wrapper.appendChild(copyBtn);
        });
    }

    // ============ 练习模块 ripple 效果 ============

    /** 为元素添加 ripple 效果 */
    _createRipple(e, element) {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        element.appendChild(ripple);

        ripple.addEventListener('animationend', () => ripple.remove());
    }

    // ============ 表单验证工具 ============

    /**
     * 验证单个输入框
     * @param {HTMLElement} inputEl - 输入框元素
     * @param {Function} validator - 验证函数，返回错误消息或空字符串
     */
    _validateInput(inputEl, validator) {
        // 确保输入框后有错误消息容器
        let errorEl = inputEl.parentElement.querySelector('.input-error-msg');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'input-error-msg';
            inputEl.parentElement.appendChild(errorEl);
        }

        const errorMsg = validator(inputEl.value);
        if (errorMsg) {
            inputEl.classList.add('input-error');
            inputEl.classList.remove('input-success');
            errorEl.textContent = errorMsg;
            errorEl.classList.add('visible');
            return false;
        } else {
            inputEl.classList.remove('input-error');
            if (inputEl.value.trim()) {
                inputEl.classList.add('input-success');
            } else {
                inputEl.classList.remove('input-success');
            }
            errorEl.classList.remove('visible');
            return true;
        }
    }

    /** 清除输入框验证状态 */
    _clearInputValidation(inputEl) {
        inputEl.classList.remove('input-error', 'input-success');
        const errorEl = inputEl.parentElement.querySelector('.input-error-msg');
        if (errorEl) {
            errorEl.classList.remove('visible');
        }
    }

    /** 为输入框绑定实时验证 */
    _bindInputValidation(inputEl, validator) {
        inputEl.addEventListener('input', () => {
            if (inputEl.value.trim()) {
                this._validateInput(inputEl, validator);
            } else {
                this._clearInputValidation(inputEl);
            }
        });
    }

    /** 设置按钮 loading 状态 */
    _setBtnLoading(btn, loading, originalHtml) {
        if (loading) {
            btn._originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="send-spinner"></span> 处理中...';
            btn.classList.add('send-btn-loading');
        } else {
            btn.disabled = false;
            btn.innerHTML = originalHtml || btn._originalHtml || btn.innerHTML;
            btn.classList.remove('send-btn-loading');
        }
    }

    // ============ 学习路径 Tab 下划线滑动 ============

    /** 初始化 Tab 下划线指示器 */
    initTabIndicator() {
        const tabsContainer = document.querySelector('.learning-tabs-wrapper');
        if (!tabsContainer) return;

        // 创建指示器
        let indicator = tabsContainer.querySelector('.learning-tab-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'learning-tab-indicator';
            tabsContainer.appendChild(indicator);
        }

        this._updateTabIndicator();

        // 监听 tab 切换更新
        this._tabObserver = new MutationObserver(() => this._updateTabIndicator());
        tabsContainer.querySelectorAll('.learning-tab').forEach(tab => {
            this._tabObserver.observe(tab, { attributes: true, attributeFilter: ['class'] });
        });
    }

    /** 更新 Tab 下划线位置 */
    _updateTabIndicator() {
        const activeTab = document.querySelector('.learning-tab.active');
        const indicator = document.querySelector('.learning-tab-indicator');
        if (!activeTab || !indicator) return;

        const rect = activeTab.getBoundingClientRect();
        const parentRect = activeTab.parentElement.getBoundingClientRect();
        indicator.style.left = (rect.left - parentRect.left) + 'px';
        indicator.style.width = rect.width + 'px';
    }

    // ============ 原有方法（保持功能不变） ============

    initLearningPath() {
        this.selectedLearningPath = null;
        const dateInput = document.getElementById('planStartDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
        this.loadLearningProgress();
        // 初始化 Tab 指示器
        this.initTabIndicator();
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
            console.error('Token验证失败:', e);
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
                    this.username = data.username;
                    this.userId = data.userId;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('auth_username', data.username);
                    localStorage.setItem('auth_userId', data.userId);
                    this.closeAuthModal();
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
                    this.username = data.username;
                    this.userId = data.userId;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('auth_username', data.username);
                    localStorage.setItem('auth_userId', data.userId);
                    this.closeAuthModal();
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
        this.webSearchToggle = document.getElementById('webSearchToggle');

        this.codeToolItems = document.querySelectorAll('.code-tools .tool-item');
        this.codeToolPanels = document.querySelectorAll('.code-tool-panel');
        this.panelCloseBtns = document.querySelectorAll('.tool-panel-close');

        // 为发送按钮添加 spinner 元素
        if (this.sendBtn) {
            const spinner = document.createElement('span');
            spinner.className = 'send-spinner';
            this.sendBtn.appendChild(spinner);
        }

        // 为侧边栏按钮添加 aria-label
        if (this.sidebarClose) {
            this.sidebarClose.setAttribute('aria-label', '关闭侧边栏');
        }
        if (this.sidebarOpen) {
            this.sidebarOpen.setAttribute('aria-label', '打开侧边栏');
        }
    }

    bindEvents() {
        // 键盘快捷键初始化
        this.initKeyboardShortcuts();

        // Enter 发送消息（保留原有逻辑）
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 发送按钮点击（防抖 300ms）
        this.sendBtn.addEventListener('click', this.debounce(() => this.sendMessage(), 300));

        this.newChatBtn.addEventListener('click', () => this.createNewChat());

        this.clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());

        this.sidebarClose.addEventListener('click', () => this.closeSidebar());

        this.sidebarOpen.addEventListener('click', () => this.toggleSidebarCollapse());

        // 输入事件：charCount 节流 100ms
        this.userInput.addEventListener('input', this.throttle(() => {
            this.updateCharCount();
            this.autoResizeTextarea();
        }, 100));

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
                // 不自动关闭侧边栏，用户可自行收起
            });
        });

        // 窗口 resize 节流 200ms
        window.addEventListener('resize', this.throttle(() => {
            if (window.innerWidth <= 768) {
                // 移动端：关闭抽屉式侧边栏
                this.closeSidebar();
                // 同时移除折叠状态（恢复默认移动端行为）
                const container = document.getElementById('appContainer');
                if (container) container.classList.remove('sidebar-collapsed');
            } else if (window.innerWidth <= 1024) {
                // 平板端：自动折叠侧边栏以腾出空间
                const container = document.getElementById('appContainer');
                if (container && !container.classList.contains('sidebar-collapsed')) {
                    container.classList.add('sidebar-collapsed');
                    const btn = this.sidebarOpen;
                    const icon = btn ? btn.querySelector('i') : null;
                    if (icon) icon.className = 'fas fa-indent';
                    if (btn) btn.setAttribute('aria-label', '展开侧边栏');
                }
            }
        }, 200));

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

        // ===== 绑定表单实时验证 =====
        this._bindFormValidations();
    }

    /** 绑定表单实时验证 */
    _bindFormValidations() {
        // 代码纠错输入
        const fixCodeInput = document.getElementById('fixCodeInput');
        if (fixCodeInput) {
            this._bindInputValidation(fixCodeInput, (val) => {
                if (!val.trim()) return '请输入需要纠错的代码';
                return '';
            });
        }
        // 代码分析输入
        const analyzeCodeInput = document.getElementById('analyzeCodeInput');
        if (analyzeCodeInput) {
            this._bindInputValidation(analyzeCodeInput, (val) => {
                if (!val.trim()) return '请输入需要分析的代码';
                return '';
            });
        }
        // 语法关键词
        const syntaxKeywordInput = document.getElementById('syntaxKeywordInput');
        if (syntaxKeywordInput) {
            this._bindInputValidation(syntaxKeywordInput, (val) => {
                if (!val.trim()) return '请输入语法关键词';
                return '';
            });
        }
        // 算法名称
        const algorithmNameInput = document.getElementById('algorithmNameInput');
        if (algorithmNameInput) {
            this._bindInputValidation(algorithmNameInput, (val) => {
                if (!val.trim()) return '请输入算法名称';
                return '';
            });
        }
        // 错误信息输入
        const errorInput = document.getElementById('errorInput');
        if (errorInput) {
            this._bindInputValidation(errorInput, (val) => {
                if (!val.trim()) return '请输入错误信息';
                return '';
            });
        }
        // 学习计划目标
        const planGoalInput = document.getElementById('planGoalInput');
        if (planGoalInput) {
            this._bindInputValidation(planGoalInput, (val) => {
                return '';
            });
        }
    }

    autoResizeTextarea() {
        if (!this.userInput) return;
        this.userInput.style.height = 'auto';
        this.userInput.style.height = Math.min(this.userInput.scrollHeight, 200) + 'px';
    }

    updateCharCount() {
        if (!this.userInput || !this.charCount) return;
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

        // 显示发送按钮 loading 状态
        this._setSendBtnLoading(true);

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

            // 发送按钮弹跳反馈
            this._setSendBtnBounce();
        } catch (error) {
            console.error('发送消息失败:', error);
            this.addMessage('assistant', '抱歉，网络错误，请稍后重试。');
            this.setStatus('ready');
            this.scrollToBottom();
        } finally {
            // 恢复发送按钮状态
            this._setSendBtnLoading(false);
        }
    }

    /** 设置发送按钮 loading */
    _setSendBtnLoading(loading) {
        if (!this.sendBtn) return;
        if (loading) {
            this.sendBtn.classList.add('send-btn-loading');
            this.sendBtn.disabled = true;
        } else {
            this.sendBtn.classList.remove('send-btn-loading');
            this.sendBtn.disabled = false;
        }
    }

    /** 发送按钮弹跳反馈 */
    _setSendBtnBounce() {
        if (!this.sendBtn) return;
        this.sendBtn.classList.add('send-bounce');
        setTimeout(() => this.sendBtn.classList.remove('send-bounce'), 300);
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

                // 打字完成后添加代码复制按钮
                this.addCopyButtonsToCodeBlocks(element);

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

        // 为已渲染的所有消息添加代码复制按钮
        this.addCopyButtonsToCodeBlocks(this.messagesContainer);

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
        // 使用节流版本防止频繁调用（节流 50ms）
        if (!this._throttledScrollToBottom) {
            this._throttledScrollToBottom = this.throttle(() => {
                if (this.messagesContainer) {
                    this.messagesContainer.scrollTo({
                        top: this.messagesContainer.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }, 50);
        }
        this._throttledScrollToBottom();
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
        // 移动端自动关闭侧边栏以腾出空间，桌面端保持打开
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
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
        // 使用自定义确认弹窗替换原生 confirm
        const confirmed = await this.confirmDialog('确定要清除所有聊天记录吗？此操作不可恢复。', {
            title: '清除历史记录',
            confirmText: '清除',
            cancelText: '取消'
        });
        if (!confirmed) return;

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
        this.sidebar.classList.remove('close');
        this.sidebar.classList.add('sidebar-open');
        this.sidebar.classList.remove('sidebar-close');

        // 移动端创建 overlay 遮罩
        if (window.innerWidth <= 768) {
            this._createSidebarOverlay();
        }
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.sidebar.classList.remove('sidebar-open');
        this.sidebar.classList.add('sidebar-close');

        // 移除移动端 overlay 遮罩
        this._removeSidebarOverlay();
    }

    /** 桌面端侧边栏折叠/展开切换 */
    toggleSidebarCollapse() {
        const container = document.getElementById('appContainer');
        const btn = this.sidebarOpen;
        const icon = btn.querySelector('i');
        const isCollapsed = container.classList.toggle('sidebar-collapsed');

        if (isCollapsed) {
            icon.className = 'fas fa-indent';
            btn.setAttribute('aria-label', '展开侧边栏');
        } else {
            icon.className = 'fas fa-bars';
            btn.setAttribute('aria-label', '收起侧边栏');
        }

        // 保存折叠状态
        localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
    }

    /** 恢复侧边栏折叠状态 */
    restoreSidebarState() {
        const container = document.getElementById('appContainer');
        if (!container) return;
        const savedCollapsed = localStorage.getItem('sidebar_collapsed');

        if (window.innerWidth > 768) {
            if (savedCollapsed === '1') {
                container.classList.add('sidebar-collapsed');
            } else if (window.innerWidth <= 1024) {
                // 平板端默认折叠侧边栏
                container.classList.add('sidebar-collapsed');
                localStorage.setItem('sidebar_collapsed', '1');
            }
            const btn = this.sidebarOpen;
            if (btn && container.classList.contains('sidebar-collapsed')) {
                const icon = btn.querySelector('i');
                if (icon) icon.className = 'fas fa-indent';
                btn.setAttribute('aria-label', '展开侧边栏');
            }
        }
    }

    /** 创建侧边栏遮罩层（移动端） */
    _createSidebarOverlay() {
        this._removeSidebarOverlay(); // 先移除已存在的
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebarOverlay';
        overlay.addEventListener('click', () => this.closeSidebar());
        document.body.appendChild(overlay);
    }

    /** 移除侧边栏遮罩层 */
    _removeSidebarOverlay() {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.classList.add('closing');
            overlay.addEventListener('animationend', () => overlay.remove());
        }
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
                panel.classList.remove('panel-slide-out');
                panel.classList.add('panel-slide-in');
            }
        }

        // 移动端自动关闭侧边栏以腾出空间，桌面端保持打开
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
    }

    closeCodeToolPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.remove('panel-slide-in');
            panel.classList.add('panel-slide-out');
            // 等动画完成后移除 active
            setTimeout(() => {
                panel.classList.remove('active', 'panel-slide-out');
            }, 350);
        }
        this.codeToolItems.forEach(item => item.classList.remove('active'));
    }

    closeAllToolPanels() {
        this.codeToolPanels.forEach(panel => {
            panel.classList.remove('active', 'panel-slide-in');
            panel.classList.add('panel-slide-out');
            setTimeout(() => panel.classList.remove('panel-slide-out'), 350);
        });
    }

    async fixCode() {
        const codeInput = document.getElementById('fixCodeInput');
        const code = codeInput?.value?.trim();
        const lang = document.getElementById('fixLangSelect')?.value || 'auto';

        if (!code) {
            // 使用自定义 Toast 替换 alert
            this.showToast('请输入需要纠错的代码', 'warning');
            this._validateInput(codeInput, (val) => !val.trim() ? '请输入需要纠错的代码' : '');
            return;
        }

        // 提交按钮 loading 状态
        const fixBtn = document.getElementById('fixCodeBtn');
        if (fixBtn) this._setBtnLoading(fixBtn, true);

        try {
            this.closeAllToolPanels();
            this.createNewChat(true);

            const prompt = `请帮我检查以下${lang === 'auto' ? '' : lang}代码中的错误并提供修复建议：\n\n${code}`;
            this.userInput.value = prompt;
            await this.sendMessage();
        } finally {
            if (fixBtn) this._setBtnLoading(fixBtn, false, fixBtn._originalHtml);
        }
    }

    async analyzeCode() {
        const codeInput = document.getElementById('analyzeCodeInput');
        const code = codeInput?.value?.trim();
        const lang = document.getElementById('analyzeLangSelect')?.value || 'auto';

        if (!code) {
            this.showToast('请输入需要分析的代码', 'warning');
            this._validateInput(codeInput, (val) => !val.trim() ? '请输入需要分析的代码' : '');
            return;
        }

        const analyzeBtn = document.getElementById('analyzeCodeBtn');
        if (analyzeBtn) this._setBtnLoading(analyzeBtn, true);

        try {
            this.closeAllToolPanels();
            this.createNewChat(true);

            const prompt = `请分析以下${lang === 'auto' ? '' : lang}代码的结构、逻辑和潜在问题：\n\n${code}`;
            this.userInput.value = prompt;
            await this.sendMessage();
        } finally {
            if (analyzeBtn) this._setBtnLoading(analyzeBtn, false, analyzeBtn._originalHtml);
        }
    }

    async learnSyntax() {
        const keywordInput = document.getElementById('syntaxKeywordInput');
        const keyword = keywordInput?.value?.trim();
        const lang = document.getElementById('syntaxLangSelect')?.value || 'java';

        if (!keyword) {
            this.showToast('请输入语法关键词', 'warning');
            this._validateInput(keywordInput, (val) => !val.trim() ? '请输入语法关键词' : '');
            return;
        }

        const syntaxBtn = document.getElementById('learnSyntaxBtn');
        if (syntaxBtn) this._setBtnLoading(syntaxBtn, true);

        try {
            this.closeAllToolPanels();
            this.createNewChat(true);

            const prompt = `请讲解${lang}中"${keyword}"的语法用法`;
            this.userInput.value = prompt;
            await this.sendMessage();
        } finally {
            if (syntaxBtn) this._setBtnLoading(syntaxBtn, false, syntaxBtn._originalHtml);
        }
    }

    async learnAlgorithm() {
        const nameInput = document.getElementById('algorithmNameInput');
        const name = nameInput?.value?.trim();
        const type = document.getElementById('algorithmTypeSelect')?.value || 'sort';

        if (!name) {
            this.showToast('请输入算法名称', 'warning');
            this._validateInput(nameInput, (val) => !val.trim() ? '请输入算法名称' : '');
            return;
        }

        const algoBtn = document.getElementById('learnAlgorithmBtn');
        if (algoBtn) this._setBtnLoading(algoBtn, true);

        try {
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
        } finally {
            if (algoBtn) this._setBtnLoading(algoBtn, false, algoBtn._originalHtml);
        }
    }

    async decodeError() {
        const errorInput = document.getElementById('errorInput');
        const error = errorInput?.value?.trim();
        const lang = document.getElementById('errorLangSelect')?.value || 'auto';

        if (!error) {
            this.showToast('请输入错误信息', 'warning');
            this._validateInput(errorInput, (val) => !val.trim() ? '请输入错误信息' : '');
            return;
        }

        const decodeBtn = document.getElementById('decodeErrorBtn');
        if (decodeBtn) this._setBtnLoading(decodeBtn, true);

        try {
            this.closeAllToolPanels();
            this.createNewChat(true);

            const prompt = `请分析以下${lang === 'auto' ? '' : lang}错误信息的原因和解决方案：\n\n${error}`;
            this.userInput.value = prompt;
            await this.sendMessage();
        } finally {
            if (decodeBtn) this._setBtnLoading(decodeBtn, false, decodeBtn._originalHtml);
        }
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
            const starsHtml = '\u2605\u2605\u2605'.split('').map((s, i) =>
                `<span class="practice-star ${i < state.stars ? 'filled' : ''}">${s}</span>`
            ).join('');
            const lockIcon = state.unlocked ? '' : '<i class="fas fa-lock practice-lock-icon"></i>';
            return `
                <div class="practice-level-card ${state.unlocked ? 'unlocked' : 'locked'} ${this.practiceSelectedLevel === level.id ? 'selected' : ''}"
                     data-level="${level.id}"
                     style="--level-color: ${level.color}">
                    <div class="practice-level-icon"><i class="fas ${level.icon}"></i></div>
                    <div class="practice-level-info">
                        <div class="practice-level-name">\u7B2C ${level.id} \u5173 \u00B7 ${level.name}</div>
                        <div class="practice-level-desc">${level.desc}</div>
                        <div class="practice-level-meta">
                            <span class="practice-level-tag">${level.difficultyLabel}</span>
                            <span class="practice-level-count">${level.count} \u9898</span>
                            <span class="practice-level-threshold">\u901A\u5173 ${level.threshold}%</span>
                        </div>
                        <div class="practice-level-stars">${starsHtml}</div>
                        ${state.attempts > 0 ? `<div class="practice-level-best">\u6700\u4F73 ${state.bestAccuracy}% \u00B7 \u5DF2\u6311\u6218 ${state.attempts} \u6B21</div>` : ''}
                    </div>
                    ${lockIcon}
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.practice-level-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 3D tilt 鼠标跟随效果
                this._handleCardTilt(card, e);

                const levelId = parseInt(card.dataset.level);
                const state = this.practiceData.levels.find(l => l.id === levelId);
                if (!state || !state.unlocked) {
                    this.showToast('该关卡尚未解锁，请先完成前置关卡', 'warning');
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

    /** 关卡卡片 3D tilt 效果 */
    _handleCardTilt(card, e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / centerY * 3;
        const rotateY = (centerX - x) / centerX * 3;

        card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        }, { once: true });
    }

    checkPracticeResume() {
        const session = JSON.parse(localStorage.getItem('practice_session_save') || 'null');
        const hint = document.getElementById('practiceResumeHint');
        if (hint) hint.style.display = session ? 'flex' : 'none';
    }

    async startChallenge() {
        if (!this.practiceSelectedLevel) {
            this.showToast('请先选择一个关卡', 'warning');
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
            this.showToast('未找到可恢复的进度', 'warning');
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
        // 添加 fade + scale 进入动画
        fs.classList.remove('practice-exit');
        fs.classList.add('practice-enter');
        fs.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const level = this.practiceSession.level;
        document.getElementById('practiceFsLevelName').textContent = `\u7B2C ${level.id} \u5173 \u00B7 ${level.name}`;
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

        const prompt = `\u4F60\u662F\u7F16\u7A0B\u6559\u5B66\u51FA\u9898\u4E13\u5BB6\u3002\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u8981\u6C42\u751F\u6210 ${level.count} \u9053${langName}\u7F16\u7A0B\u7EC3\u4E60\u9898\uFF1A
- \u77E5\u8BC6\u70B9\u65B9\u5411\uFF1A${categoryName}
- \u96BE\u5EA6\u7B49\u7EA7\uFF1A${level.difficultyLabel}\uFF08${level.difficulty}\uFF09
- \u9898\u578B\u6DF7\u5408\uFF1A\u5305\u542B\u5355\u9009\u9898(multiple_choice)\u3001\u5224\u65AD\u9898(true_false)\u3001\u586B\u7A7A\u9898(fill_blank)\u3001\u7B80\u7B54\u9898(short_answer)\uFF0C\u7B80\u7B54\u9898\u4E0D\u8D85\u8FC7 1 \u9053
- \u6BCF\u9898\u5FC5\u987B\u72EC\u7ACB\u3001\u975E\u91CD\u590D\uFF0C\u7D27\u6263${categoryName}\u77E5\u8BC6\u70B9

\u8BF7\u4E25\u683C\u8FD4\u56DE JSON \u6570\u7EC4\uFF0C\u6BCF\u9053\u9898\u5B57\u6BB5\u5982\u4E0B\uFF1A
{
  "type": "multiple_choice|true_false|fill_blank|short_answer",
  "question": "\u9898\u5E72\u6587\u672C",
  "options": ["A.\u9009\u98791","B.\u9009\u98792","C.\u9009\u98793","D.\u9009\u98794"],  // \u4EC5 multiple_choice \u9700\u8981
  "answer": "\u6B63\u786E\u7B54\u6848",  // multiple_choice \u586B\u9009\u9879\u5B57\u6BCD\u5982 "A"\uFF1Btrue_false \u586B "true" \u6216 "false"\uFF1Bfill_blank \u586B\u6807\u51C6\u7B54\u6848\u6587\u672C\uFF1Bshort_answer \u586B\u53C2\u8003\u8981\u70B9
  "points": "\u8003\u5BDF\u77E5\u8BC6\u70B9",
  "explanation": "\u8BE6\u7EC6\u89E3\u6790"
}

\u53EA\u8FD4\u56DE JSON \u6570\u7EC4\uFF0C\u4E0D\u8981\u4EFB\u4F55\u989D\u5916\u6587\u5B57\u3001markdown \u4EE3\u7801\u5757\u6807\u8BB0\u6216\u89E3\u91CA\u3002`;

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
            console.error('\u751F\u6210\u9898\u76EE\u5931\u8D25:', error);
            document.getElementById('practiceFsLoading').style.display = 'none';
            document.getElementById('practiceFsQuestion').style.display = 'block';
            document.getElementById('practiceQTitle').innerHTML =
                `<div style="color:#ff7675;text-align:center;padding:40px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:36px;"></i>
                    <p style="margin-top:12px;">\u9898\u76EE\u751F\u6210\u5931\u8D25\uFF1A${error.message}</p>
                    <p style="font-size:13px;opacity:0.7;margin-top:8px;">\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5</p>
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
                const letter = opt.match(/^([A-Z])[.\u3001)]?\s*/)?.[1] || String.fromCharCode(65 + i);
                const text = opt.replace(/^[A-Z][.\u3001)]?\s*/, '');
                const btn = document.createElement('button');
                btn.className = 'practice-option';
                btn.dataset.value = letter;
                btn.innerHTML = `<span class="practice-option-letter">${letter}</span><span class="practice-option-text">${text}</span>`;
                btn.addEventListener('click', (e) => {
                    // ripple 效果
                    this._createRipple(e, btn);
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
                btn.innerHTML = `<span class="practice-option-letter">${val === 'true' ? '\u2713' : '\u2717'}</span><span class="practice-option-text">${val === 'true' ? '\u6B63\u786E' : '\u9519\u8BEF'}</span>`;
                btn.addEventListener('click', (e) => {
                    // ripple 效果
                    this._createRipple(e, btn);
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
                <label class="practice-answer-label">\u8BF7\u586B\u5199\u7B54\u6848\uFF1A</label>
                <input type="text" class="practice-fill-input" id="practiceFillInput"
                       placeholder="\u8BF7\u8F93\u5165\u4F60\u7684\u7B54\u6848" autocomplete="off">
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
                <label class="practice-answer-label">\u8BF7\u8F93\u5165\u4F60\u7684\u89E3\u7B54\uFF1A</label>
                <textarea class="practice-short-textarea" id="practiceShortInput"
                          placeholder="\u8BF7\u8BE6\u7EC6\u4F5C\u7B54..." rows="6"></textarea>
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
                this.showToast('\u65F6\u95F4\u5230\uFF0C\u81EA\u52A8\u63D0\u4EA4', 'warning');
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
            this.showToast('\u8BF7\u5148\u9009\u62E9\u6216\u586B\u5199\u7B54\u6848', 'warning');
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
        return String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[\uFF0C\u3002\u3001\uFF1B\uFF1A\uFF01\uFF1F\u201C\u201D\u2018\u2019\uFF08\uFF09()]/g, '');
    }

    async evaluateShortAnswer(question, userAnswer) {
        const prompt = `\u8BF7\u8BC4\u4F30\u4EE5\u4E0B\u7B80\u7B54\u9898\u4F5C\u7B54\u662F\u5426\u6B63\u786E\u3002

\u9898\u76EE\uFF1A${question.question}
\u53C2\u8003\u7B54\u6848\u8981\u70B9\uFF1A${question.answer}
\u8003\u5BDF\u77E5\u8BC6\u70B9\uFF1A${question.points || ''}
\u5B66\u751F\u4F5C\u7B54\uFF1A${userAnswer}

\u8BF7\u4E25\u683C\u8FD4\u56DE JSON\uFF1A{"correct": true/false, "score": 0-100, "comment": "\u70B9\u8BC4"}
\u5224\u65AD\u6807\u51C6\uFF1A\u6838\u5FC3\u8981\u70B9\u8986\u76D6\u5373\u53EF\u5224\u6B63\u786E\uFF0C\u4E0D\u8981\u6C42\u5B57\u9762\u4E00\u81F4\u3002\u53EA\u8FD4\u56DE JSON\uFF0C\u4E0D\u8981\u4EFB\u4F55\u989D\u5916\u6587\u5B57\u3002`;

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
            console.error('\u7B80\u7B54\u9898\u8BC4\u4F30\u5931\u8D25:', e);
        }
        return { correct: false, score: 0, comment: '\u8BC4\u4F30\u5931\u8D25' };
    }

    showPracticeFeedback(isCorrect, question, userAnswer, aiEvaluation) {
        const feedback = document.getElementById('practiceQFeedback');
        feedback.style.display = 'block';
        feedback.className = 'practice-q-feedback ' + (isCorrect ? 'correct' : 'wrong');

        const correctLabel = isCorrect ? '\u56DE\u7B54\u6B63\u786E' : '\u56DE\u7B54\u9519\u8BEF';
        let html = `
            <div class="practice-feedback-header">
                <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span>${correctLabel}</span>
            </div>
            <div class="practice-feedback-row">
                <span class="practice-feedback-label">\u4F60\u7684\u7B54\u6848\uFF1A</span>
                <span class="practice-feedback-value">${userAnswer || '\uFF08\u672A\u4F5C\u7B54\uFF09'}</span>
            </div>
        `;
        if (!isCorrect) {
            html += `
                <div class="practice-feedback-row">
                    <span class="practice-feedback-label">\u6B63\u786E\u7B54\u6848\uFF1A</span>
                    <span class="practice-feedback-value correct">${question.answer}</span>
                </div>
            `;
        }
        if (aiEvaluation) {
            html += `
                <div class="practice-feedback-row">
                    <span class="practice-feedback-label">AI \u8BC4\u5206\uFF1A</span>
                    <span class="practice-feedback-value">${aiEvaluation.score}</span>
                </div>
                <div class="practice-feedback-row">
                    <span class="practice-feedback-label">AI \u70B9\u8BC4\uFF1A</span>
                    <span class="practice-feedback-value">${aiEvaluation.comment || ''}</span>
                </div>
            `;
        }
        html += `
            <div class="practice-feedback-row">
                <span class="practice-feedback-label">\u8003\u5BDF\u70B9\uFF1A</span>
                <span class="practice-feedback-value">${question.points || ''}</span>
            </div>
            <div class="practice-feedback-explanation">
                <i class="fas fa-lightbulb"></i>
                <div>${question.explanation || '\u6682\u65E0\u89E3\u6790'}</div>
            </div>
        `;
        feedback.innerHTML = html;

        // 高亮选项（带过渡动画）
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

        // 计算星数
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
            document.getElementById('practiceResultTitle').textContent = passed ? '\uD83C\uDF89 \u901A\u5173\u6210\u529F' : '\u6311\u6218\u672A\u901A\u8FC7';
            const iconEl = document.getElementById('practiceResultIcon');
            iconEl.innerHTML = `<i class="fas ${passed ? 'fa-trophy' : 'fa-redo'}"></i>`;
            iconEl.className = 'practice-result-icon ' + (passed ? 'passed' : 'failed');

            const unlockEl = document.getElementById('practiceResultUnlock');
            if (unlockedNext) {
                const nextLevel = this.getPRACTICE_LEVELS().find(l => l.id === level.id + 1);
                unlockEl.style.display = 'flex';
                document.getElementById('practiceResultUnlockText').textContent = `\u5DF2\u89E3\u9501\u7B2C ${nextLevel.id} \u5173 \u00B7 ${nextLevel.name}`;
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

    /** 退出挑战（使用自定义确认弹窗） */
    async exitChallenge() {
        const confirmed = await this.confirmDialog('\u9000\u51FA\u6311\u6218\u5C06\u4FDD\u5B58\u5F53\u524D\u8FDB\u5EA6\uFF0C\u53EF\u7A0D\u540E\u7EE7\u7EED\u3002\u786E\u8BA4\u9000\u51FA\uFF1F', {
            title: '\u9000\u51FA\u6311\u6218',
            confirmText: '\u9000\u51FA',
            cancelText: '\u7EE7\u7EED\u7B54\u9898'
        });
        if (confirmed) {
            this.exitChallengeInternal();
        }
    }

    closeFullscreenPractice() {
        const fs = document.getElementById('practiceFullscreen');
        if (!fs) return;

        // 添加退出动画
        fs.classList.remove('practice-enter');
        fs.classList.add('practice-exit');

        // 等动画完成后隐藏
        setTimeout(() => {
            fs.style.display = 'none';
            fs.classList.remove('practice-exit');
            document.body.style.overflow = '';
            this.stopPracticeTimer();
            this.renderPracticeLobby();
            this.checkPracticeResume();
        }, 300);
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

    /** 兼容原有的 showToast（已被升级版替代，保留向后兼容） */
    showToast(message, type = 'info', duration = 3000) {
        // 兼容原有练习模块的 showToast 调用（单参数字符串形式）
        if (typeof type === 'number') {
            duration = type;
            type = 'info';
        }

        let container = document.getElementById('customToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'customToastContainer';
            container.className = 'custom-toast-container';
            document.body.appendChild(container);
        }

        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${iconMap[type] || iconMap.info} toast-icon"></i>
            <span class="toast-message">${this._escapeHtml(message)}</span>
            <button class="toast-close" aria-label="\u5173\u95ED\u901A\u77E5"><i class="fas fa-times"></i></button>
            <div class="toast-progress" style="animation-duration:${duration}ms"></div>
        `;

        // 关闭按钮事件
        toast.querySelector('.toast-close').addEventListener('click', () => this._removeToast(toast));

        container.appendChild(toast);
        this._toastCounter++;

        // 自动消失
        const timer = setTimeout(() => this._removeToast(toast), duration);
        toast._autoCloseTimer = timer;

        // 最多同时显示 5 个
        const toasts = container.querySelectorAll('.custom-toast:not(.removing)');
        if (toasts.length > 5) {
            this._removeToast(toasts[0]);
        }
    }

    switchLearningTab(tab) {
        document.querySelectorAll('.learning-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.learning-tab[data-tab="${tab}"]`)?.classList.add('active');

        document.getElementById('learningPathsContent').style.display = tab === 'paths' ? 'block' : 'none';
        document.getElementById('learningPlanContent').style.display = tab === 'plan' ? 'block' : 'none';
        document.getElementById('learningProgressContent').style.display = tab === 'progress' ? 'block' : 'none';

        // 更新 Tab 下划线位置
        setTimeout(() => this._updateTabIndicator(), 50);

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
        const selectedCard = document.querySelector(`.learning-path-card[data-path="${path}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
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
                    <p>\u6682\u65E0\u5B66\u4E60\u8BA1\u5212\uFF0C\u5FEB\u521B\u5EFA\u4E00\u4E2A\u5427\uFF01</p>
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
                        <p>\u76EE\u6807: ${plan.goal || '\u672A\u8BBE\u7F6E'} | \u6BCF\u65E5${plan.dailyTime}\u5206\u949F</p>
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
                    <p>\u5F00\u59CB\u5B66\u4E60\u540E\uFF0C\u8FD9\u91CC\u5C06\u663E\u793A\u60A8\u7684\u5B66\u4E60\u8FDB\u5EA6</p>
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
            this.showToast('\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u5B66\u4E60\u8DEF\u5F84', 'warning');
            return;
        }

        const pathData = this.getLearningPathData(selectedPath);
        if (!pathData) return;

        const levelSelect = document.getElementById('learningLevelSelect');
        const level = levelSelect?.value || 'beginner';
        const levelNames = {
            'beginner': '\u5165\u95E8\u9636\u6BB5',
            'intermediate': '\u8FDB\u9636\u9636\u6BB5',
            'advanced': '\u9AD8\u7EA7\u9636\u6BB5'
        };

        this.closeAllToolPanels();
        this.createNewChat(true);

        const prompt = `\u6211\u6B63\u5728\u5B66\u4E60\u3010${pathData.name}\u3011\u5B66\u4E60\u8DEF\u5F84\uFF0C\u5F53\u524D\u5904\u4E8E${levelNames[level]}\u3002

\u8BF7\u4E3A\u6211\u5236\u5B9A\u8BE6\u7EC6\u7684\u5B66\u4E60\u8BA1\u5212\uFF0C\u5305\u62EC\uFF1A

1. **\u5B66\u4E60\u76EE\u6807**\uFF1A\u660E\u786E\u672C\u9636\u6BB5\u9700\u8981\u638C\u63E1\u7684\u6838\u5FC3\u6280\u80FD
2. **\u5B66\u4E60\u6A21\u5757**\uFF1A\u5217\u51FA\u9700\u8981\u5B66\u4E60\u7684\u6A21\u5757\u6E05\u5355
3. **\u5B66\u4E60\u8D44\u6E90\u63A8\u8350**\uFF1A
${pathData.resources.map(r => `   - ${r}`).join('\n')}
4. **\u5B66\u4E60\u5EFA\u8BAE**\uFF1A\u9488\u5BF9${levelNames[level]}\u7684\u5B66\u4E60\u65B9\u6CD5\u548C\u6CE8\u610F\u4E8B\u9879
5. **\u5B9E\u8DF5\u9879\u76EE**\uFF1A\u63A8\u8350\u9002\u5408\u5F53\u524D\u6C34\u5E73\u7684\u7EC3\u4E60\u9879\u76EE
6. **\u65F6\u95F4\u89C4\u5212**\uFF1A\u5EFA\u8BAE\u7684\u5B66\u4E60\u65F6\u95F4\u5B89\u6392

\u5B66\u4E60\u8DEF\u5F84\u5305\u542B\u4EE5\u4E0B\u6A21\u5757\uFF1A
${pathData.modules.map((m, i) => `${i + 1}. ${m}`).join('\n')}

\u8BF7\u7ED9\u51FA\u8BE6\u7EC6\u7684\u5B66\u4E60\u6307\u5BFC\u3002`;

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

    async createLearningPlan() {
        const pathSelect = document.getElementById('planPathSelect');
        const timeSelect = document.getElementById('planTimeSelect');
        const dateInput = document.getElementById('planStartDate');
        const goalInput = document.getElementById('planGoalInput');

        const path = pathSelect?.value;
        const dailyTime = parseInt(timeSelect?.value || '60');
        const startDate = dateInput?.value;
        const goal = goalInput?.value?.trim();

        if (!path) {
            this.showToast('\u8BF7\u9009\u62E9\u5B66\u4E60\u8DEF\u5F84', 'warning');
            return;
        }

        const pathData = this.getLearningPathData(path);
        const plans = JSON.parse(localStorage.getItem('learning_plans') || '[]');

        const newPlan = {
            id: 'plan_' + Date.now(),
            path: path,
            dailyTime: dailyTime,
            startDate: startDate,
            goal: goal || `\u638C\u63E1${pathData?.name || path}`,
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

        // 成功动画反馈
        const formEl = document.getElementById('learningPlanContent');
        if (formEl) {
            formEl.classList.add('plan-form-success');
            setTimeout(() => formEl.classList.remove('plan-form-success'), 600);
        }

        // 使用 Toast 替换 alert
        this.showToast(`\u5B66\u4E60\u8BA1\u5212\u521B\u5EFA\u6210\u529F\uFF01\u8DEF\u5F84: ${pathData?.name}\uFF0C\u6BCF\u65E5\u5B66\u4E60: ${dailyTime}\u5206\u949F`, 'success');
    }

    async deleteLearningPlan(planId) {
        const confirmed = await this.confirmDialog('\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u4E2A\u5B66\u4E60\u8BA1\u5212\u5417\uFF1F', {
            title: '\u5220\u9664\u8BA1\u5212',
            confirmText: '\u5220\u9664',
            cancelText: '\u53D6\u6D88'
        });
        if (!confirmed) return;

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
