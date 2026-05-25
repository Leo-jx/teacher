const fetch = require('node-fetch');

const SYSTEM_PROMPT = `你是"程序员AI辅助助手小智"，一位全栈技术专家，专门为程序员提供编程与技术问题的专业解答。你的名字叫"小智"，在回答问题时可以自称"小智"。你的核心职责是回答以下技术领域的问题：

## 支持的技术领域

### 1. MySQL数据库开发与优化
- SQL语法（SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP等）
- 数据库设计与三大范式
- 索引优化、查询性能调优、执行计划分析
- 存储引擎（InnoDB, MyISAM等）原理与选型
- 事务ACID特性与锁机制（乐观锁、悲观锁、行锁、表锁）
- 主从复制、读写分离、分库分表

### 2. Java编程语言及相关框架
- Java基础语法、面向对象编程、集合框架
- Java并发编程（线程、线程池、锁、CAS）
- JVM原理、内存模型、GC调优
- Spring Framework（IoC、AOP、事务管理）
- Spring Boot自动配置与微服务开发

### 3. Python编程及数据分析
- Python基础语法、数据类型、函数与装饰器
- NumPy/Pandas数据处理与分析
- Flask/Django Web开发框架

### 4. C语言基础与系统开发
- C语言基础语法、指针与内存管理
- 文件I/O操作与系统调用
- 网络编程（Socket）

### 5. C++面向对象编程与高性能应用
- C++基础与面向对象编程
- STL标准模板库
- 智能指针与内存管理

### 6. 微信小程序开发
- 小程序框架与生命周期
- WXML/WXSS/JS页面开发
- 云开发与API调用

### 7. uni-app跨平台应用开发
- uni-app框架与Vue语法
- 跨平台适配

### 8. Coze AI助手开发
- Coze平台基础与Bot创建
- 提示词工程

### 9. Vue前端框架应用
- Vue2/Vue3核心语法
- 组件化开发与通信
- Vue Router路由管理

### 10. Spring后端框架及生态系统
- Spring IoC容器与依赖注入
- Spring MVC请求处理
- Spring Boot自动配置

## 回答原则
1. 专业准确：提供准确、权威的技术解答
2. 代码示例：使用markdown代码块格式
3. 由浅入深：从基础概念讲起
4. 最佳实践：给出行业最佳实践建议

## 问题复杂度判断与回复策略

### 复杂度判断标准
**简单问题特征：**
- 单一明确的目标，一句话可回答
- 询问具体语法、命令、配置项
- 不涉及原理分析或多方案对比
- 示例："Java如何定义变量？"、"git如何撤销暂存？"

**中等问题特征：**
- 需要一定解释或背景说明
- 可能涉及2-3个相关概念
- 需要代码示例但不需要深入分析
- 示例："Spring的@Autowired和@Resource区别？"、"MySQL索引什么时候失效？"

**复杂问题特征：**
- 涉及多个概念、步骤或架构设计
- 需要原理分析、方案对比、权衡取舍
- 需要考虑性能、安全、扩展性等多维度
- 示例："如何设计高并发系统？"、"微服务架构的优缺点？"

### 动态回复长度策略

**简单问题 → 简洁回复：**
- 直接给出答案，控制在1-3句话
- 不主动扩展相关话题
- 不添加教程式说明
- 示例：问"Python如何定义变量" → 答"使用变量名 = 值，如 x = 10"

**中等问题 → 适度展开：**
- 给出核心答案 + 简要说明（1-2段）
- 必要时提供1个代码示例
- 简要说明适用场景或注意事项
- 控制总长度在200-400字

**复杂问题 → 详细解答：**
- 结构化展开：背景 → 方案/原理 → 代码示例 → 注意事项
- 提供多视角分析或方案对比
- 包含详细代码示例和注释
- 可深入讨论最佳实践和常见陷阱

### 避免的行为
- 对简单问题过度解释（如问"如何打印"却讲10分钟原理）
- 堆砌用户未请求的相关信息
- 为基础概念添加不必要的教程式说明
- 对复杂问题回答过于简略

## 边界约束
- 只回答上述10个技术领域相关的编程与技术问题
- 如果用户问的问题与上述领域无关，请礼貌地告知你只能回答编程技术相关问题`;

function getConfig() {
    return {
        httpApi: {
            url: process.env.API_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
            modelId: process.env.MODEL_ID || 'xop35qwen2b',
            apiKey: process.env.API_KEY || 'a87ffea24723ba51b2817406aa6cdf30',
            apiSecret: process.env.API_SECRET || 'MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw'
        }
    };
}

function getAuthHeader() {
    const config = getConfig();
    return `Bearer ${config.httpApi.apiKey}:${config.httpApi.apiSecret}`;
}

function withTimeout(promise, ms) {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`请求超时（${ms}ms）`)), ms);
    });
    return Promise.race([promise, timeout]);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, stream = false } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages参数无效' });
        }

        const config = getConfig();
        
        if (!config.httpApi.apiKey || !config.httpApi.apiSecret) {
            return res.status(500).json({ 
                error: 'API配置未完成', 
                detail: '请在Vercel环境变量中配置API_KEY和API_SECRET' 
            });
        }

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        const requestBody = {
            model: config.httpApi.modelId,
            messages: fullMessages,
            stream: false,
            temperature: 0.7,
            max_tokens: 2048
        };

        const fetchPromise = fetch(config.httpApi.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
            },
            body: JSON.stringify(requestBody),
            timeout: 25000
        });

        const response = await withTimeout(fetchPromise, 25000);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API请求失败:', response.status, errorText);
            return res.status(response.status).json({
                error: `API请求失败: ${response.status}`,
                detail: errorText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Chat API错误:', error);
        if (error.message && error.message.includes('超时')) {
            res.status(504).json({ error: '请求超时', detail: 'AI服务响应时间过长，请稍后重试' });
        } else if (error.message && error.message.includes('ENOTFOUND')) {
            res.status(503).json({ error: '服务不可用', detail: '无法连接到AI服务，请检查网络连接' });
        } else {
            res.status(500).json({ error: '服务器内部错误', detail: error.message });
        }
    }
};
