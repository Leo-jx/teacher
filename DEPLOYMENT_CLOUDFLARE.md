# Cloudflare Pages 部署指南

## 系统架构概述

### 核心组件
```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                      │
│  ┌─────────────────┐  ┌──────────────────────────────┐ │
│  │   前端界面      │  │      Cloudflare Workers       │ │
│  │  (HTML/CSS/JS) │  │  (_worker.js - API & Auth)   │ │
│  └────────┬────────┘  └───────────────┬──────────────┘ │
│           │                           │                 │
│           └───────────┬───────────────┘                 │
│                       │                                 │
│              ┌────────▼─────────┐                      │
│              │  Cloudflare D1   │                      │
│              │   (SQLite DB)    │                      │
│              └──────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### 用户数据流

#### 未登录用户流程
```
用户访问 → 直接加载应用 → 发送消息 → 调用AI API → 返回响应
                                          ↓
                                    (数据不持久化)
```

#### 已登录用户流程
```
用户访问 → 直接加载应用 → 点击登录/注册 → JWT认证
                                          ↓
发送消息 → 调用AI API → 保存对话到D1数据库 → 多设备同步
```

## 部署步骤

### 前置要求
- Cloudflare 账户
- Wrangler CLI (安装: `npm install -g wrangler`)

### 1. 克隆仓库
```bash
git clone <your-repo-url>
cd chat
```

### 2. 登录 Cloudflare
```bash
wrangler login
```

### 3. 创建 D1 数据库
```bash
wrangler d1 create ai-assistant-db
```
记下输出中的 `database_id`，更新 `wrangler.toml` 中的配置。

### 4. 初始化数据库表
```bash
wrangler d1 execute ai-assistant-db --file=./schema.sql
```

### 5. 配置环境变量
编辑 `wrangler.toml`，设置以下变量：
- `API_URL` - AI API 地址
- `MODEL_ID` - 模型名称
- `API_KEY` - API 密钥
- `API_SECRET` - API 密钥密码
- `JWT_SECRET` - 生产环境请使用强密钥

### 6. 本地开发测试
```bash
# 先确保 public 目录存在且有文件
npm start
```

访问 `http://localhost:3000` 测试功能。

### 7. 部署到 Cloudflare Pages
```bash
wrangler pages deploy public --project-name=ai-assistant
```

或者通过 Cloudflare Dashboard：
1. 进入 Cloudflare Dashboard → Pages
2. 创建新项目 → 连接到 Git 仓库
3. 配置构建设置：
   - 构建命令：留空
   - 构建输出目录：`public`
4. 配置环境变量和 D1 数据库绑定

### 8. 配置生产环境变量
在 Cloudflare Dashboard → Pages → 你的项目 → Settings → Environment variables
添加生产环境变量（确保设置 `JWT_SECRET` 为强密钥）

## 安全特性

### 1. 密码安全
- **加盐哈希**：每个密码使用唯一的 16 字节盐值
- **SHA-256**：使用 SHA-256 算法加密
- **盐值存储**：盐值与哈希值一起存储（格式：`salt:hash`）

### 2. JWT 认证
- **7 天有效期**：Token 自动过期
- **HS256 签名**：使用强密钥签名
- **无状态认证**：无需服务器存储会话

### 3. 输入验证
- **用户名验证**：2-20字符，只允许字母、数字、下划线、中文
- **邮箱验证**：标准邮箱格式检查
- **输入清理**：自动修剪并限制长度
- **SQL 注入防护**：使用参数化查询

### 4. 安全头
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Content-Security-Policy**: 严格资源限制
- **Referrer-Policy**: strict-origin-when-cross-origin

### 5. 数据隔离
- 未登录用户数据不存入数据库
- 已登录用户数据通过 `user_id` 严格隔离
- 每个用户只能访问自己的对话历史

## 数据库结构

### Users 表
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

### Conversations 表
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Messages 表
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

## API 端点

### 认证端点
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 对话端点
- `GET /api/conversations` - 获取对话列表（需认证）
- `POST /api/conversations` - 创建新对话（需认证）
- `GET /api/conversations/:id` - 获取对话详情（需认证）
- `DELETE /api/conversations/:id` - 删除对话（需认证）

### 功能端点
- `POST /api/chat` - 发送聊天消息（可选认证）
- `GET /api/config` - 获取配置信息

## 性能优化

### Cloudflare 边缘优势
1. **全球 CDN**：静态资源全球分发
2. **边缘计算**：API 响应在边缘节点处理
3. **D1 数据库**：SQLite 优化的边缘数据库
4. **自动扩缩**：无需管理服务器

### 前端优化
- 使用 CDN 加载 Font Awesome 和 Highlight.js
- 响应式设计，支持移动设备
- 本地存储作为未登录用户的备选方案

## 故障排除

### 常见问题
1. **数据库连接错误**：确认 `wrangler.toml` 中 D1 配置正确
2. **API 密钥错误**：检查环境变量配置
3. **部署失败**：确保 `public` 目录是正确的构建输出
4. **权限问题**：确保 Cloudflare 账户有足够权限

### 日志查看
```bash
# 查看 Workers 日志
wrangler pages deployment tail --project-name=ai-assistant
```

## 维护建议

1. **定期更新**：更新依赖和安全补丁
2. **密钥轮换**：定期更换 `JWT_SECRET`
3. **数据库备份**：定期导出 D1 数据库
4. **监控访问**：通过 Cloudflare Analytics 监控使用情况

## 支持

如有问题，请参考：
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers)
