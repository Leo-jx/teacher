# 程序员AI辅助助手

一个基于Qwen大模型的全栈编程技术问答助手，支持10大技术领域的专业解答。

## 功能特性

- 🤖 **AI智能问答**: 基于Qwen3.5-2B大模型
- 💻 **10大技术领域**: MySQL、Java、Python、C/C++、微信小程序、uni-app、Coze AI、Vue、Spring
- 🎨 **现代UI界面**: 响应式设计，暗色主题
- 📝 **代码高亮**: 支持SQL、Java、Python、C++、JavaScript等多种语言
- 💾 **历史记录**: 本地存储对话历史
- 🔌 **双模式**: HTTP和WebSocket两种对话模式

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (原生)
- **后端**: Node.js + Express
- **AI模型**: 讯飞星火Qwen3.5-2B
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑.env填入API密钥

# 启动服务
npm start
```

访问 http://localhost:3000

### Docker部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

详细部署说明请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 环境变量

| 变量名 | 说明 |
|--------|------|
| NODE_ENV | 运行环境 (development/production) |
| API_URL | API地址 |
| WS_URL | WebSocket地址 |
| MODEL_ID | 模型ID |
| API_KEY | API密钥 |
| API_SECRET | API密钥 |
| APP_ID | 应用ID |

## 项目结构

```
├── public/              # 前端静态资源
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── server.js            # 后端服务
├── docker-compose.yml   # Docker编排
├── backend.Dockerfile   # 后端镜像
├── nginx/nginx.conf     # Nginx配置
└── DEPLOYMENT.md        # 部署文档
```

## 支持的技术领域

1. MySQL数据库开发与优化
2. Java编程语言及相关框架
3. Python编程及数据分析
4. C语言基础与系统开发
5. C++面向对象编程
6. 微信小程序开发
7. uni-app跨平台应用开发
8. Coze AI助手开发
9. Vue前端框架应用
10. Spring后端框架及生态系统

## License

MIT
