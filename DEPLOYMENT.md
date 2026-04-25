# 程序员AI辅助助手 - Docker部署文档

## 目录结构

```
project/
├── public/                 # 前端静态资源
│   ├── index.html
│   ├── css/
│   └── js/
├── server.js              # 后端服务入口
├── package.json           # Node.js依赖配置
├── backend.Dockerfile     # 后端Docker镜像构建文件
├── docker-compose.yml     # Docker编排配置
├── nginx/
│   └── nginx.conf         # Nginx反向代理配置
├── .env.example           # 环境变量模板
├── .dockerignore          # Docker构建忽略文件
└── DEPLOYMENT.md          # 本文档
```

## 一、环境要求

### 服务器要求
- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+ / Debian 10+)
- **内存**: 最低 1GB，推荐 2GB+
- **CPU**: 最低 1核，推荐 2核+
- **磁盘**: 最低 10GB 可用空间
- **网络**: 公网IP或域名，开放80/443端口

### 软件要求
- Docker 20.10+
- Docker Compose 2.0+

### 安装Docker和Docker Compose

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

## 二、部署步骤

### 1. 克隆/上传项目

```bash
# 方式一：Git克隆
git clone <repository-url> /opt/dev-assistant
cd /opt/dev-assistant

# 方式二：上传压缩包
scp dev-assistant.tar.gz user@server:/opt/
ssh user@server
cd /opt && tar -xzf dev-assistant.tar.gz
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量（填入真实的API密钥）
vim .env
```

**环境变量说明：**

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | production |
| HTTP_PORT | HTTP端口 | 80 |
| API_URL | API地址 | https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions |
| WS_URL | WebSocket地址 | wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/ch |
| MODEL_ID | 模型ID | xop35qwen2b |
| API_KEY | API密钥 | your_api_key |
| API_SECRET | API密钥 | your_api_secret |
| APP_ID | 应用ID | your_app_id |

### 3. 构建和启动服务

```bash
# 构建镜像
docker-compose build

# 启动服务（后台运行）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 验证部署

```bash
# 检查服务健康状态
curl http://localhost/health

# 检查API配置
curl http://localhost/api/config

# 检查前端页面
curl -I http://localhost/
```

## 三、常用运维命令

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重启单个服务
docker-compose restart backend
docker-compose restart nginx

# 查看服务状态
docker-compose ps

# 查看资源使用
docker stats
```

### 日志查看

```bash
# 查看所有日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看最近100行日志
docker-compose logs --tail=100

# 查看特定服务日志
docker-compose logs backend
docker-compose logs nginx
```

### 镜像更新

```bash
# 拉取最新代码后重新构建
git pull
docker-compose build --no-cache
docker-compose up -d

# 清理旧镜像
docker image prune -f
```

## 四、安全配置

### 1. 防火墙配置

```bash
# Ubuntu UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# CentOS firewalld
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### 2. 镜像安全扫描

```bash
# 使用Trivy扫描镜像
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy:latest image dev-assistant_backend:latest

# 使用Docker Scout
docker scout quickview
```

### 3. 安全特性说明

- ✅ **非root用户运行**: 容器以nodejs用户(UID 1001)运行
- ✅ **只读文件系统**: 后端容器文件系统只读
- ✅ **资源限制**: CPU和内存使用限制
- ✅ **no-new-privileges**: 禁止权限提升
- ✅ **API限流**: Nginx配置请求频率限制

## 五、HTTPS配置（推荐）

### 使用Let's Encrypt免费证书

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

### 修改Nginx配置支持HTTPS

在 `nginx/nginx.conf` 中添加：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # ... 其他配置同上
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 六、监控与告警

### 1. 健康检查

```bash
# 创建健康检查脚本
cat > /opt/healthcheck.sh << 'EOF'
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)
if [ "$RESPONSE" != "200" ]; then
    echo "Health check failed: $RESPONSE"
    docker-compose restart
    exit 1
fi
echo "Health check passed"
EOF
chmod +x /opt/healthcheck.sh

# 添加到crontab（每5分钟检查）
*/5 * * * * /opt/healthcheck.sh >> /var/log/healthcheck.log 2>&1
```

### 2. 日志轮转

Docker日志已配置自动轮转（10MB×3文件），如需调整：

```yaml
# docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

### 3. 资源监控

```bash
# 安装cAdvisor（可选）
docker run -d --name=cadvisor \
    --volume=/:/rootfs:ro \
    --volume=/var/run:/var/run:ro \
    --volume=/sys:/sys:ro \
    --volume=/var/lib/docker/:/var/lib/docker:ro \
    --publish=8080:8080 \
    google/cadvisor:latest
```

## 七、故障排查

### 常见问题

**1. 容器无法启动**
```bash
# 查看详细错误
docker-compose logs backend

# 检查端口占用
netstat -tlnp | grep :80

# 检查环境变量
docker-compose config
```

**2. API请求失败**
```bash
# 检查后端健康状态
curl http://localhost:3000/api/config

# 检查Nginx代理
docker-compose exec nginx nginx -t

# 查看Nginx错误日志
docker-compose exec nginx cat /var/log/nginx/error.log
```

**3. WebSocket连接失败**
```bash
# 检查WebSocket路由
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
    http://localhost/ws/chat
```

**4. 内存不足**
```bash
# 查看容器资源使用
docker stats

# 调整内存限制
# 编辑docker-compose.yml中的deploy.resources
```

## 八、备份与恢复

### 备份

```bash
# 创建备份目录
mkdir -p /backup/$(date +%Y%m%d)

# 备份配置文件
tar -czf /backup/$(date +%Y%m%d)/config.tar.gz \
    .env docker-compose.yml nginx/

# 备份日志
docker-compose exec backend tar -czf - /app/logs > /backup/$(date +%Y%m%d)/logs.tar.gz
```

### 恢复

```bash
# 恢复配置
tar -xzf /backup/20240101/config.tar.gz

# 重新部署
docker-compose up -d
```

## 九、性能优化

### 1. Nginx优化

- 启用gzip压缩
- 配置静态资源缓存
- 连接复用(keepalive)
- 请求限流保护

### 2. Node.js优化

- 生产环境运行
- 合理的内存限制
- 健康检查机制

### 3. Docker优化

- 多阶段构建减小镜像体积
- Alpine基础镜像
- 层缓存优化

## 十、联系与支持

如遇问题，请检查：
1. Docker服务状态: `systemctl status docker`
2. 容器日志: `docker-compose logs`
3. 系统资源: `df -h && free -m`
4. 网络连接: `curl -v http://localhost/health`
