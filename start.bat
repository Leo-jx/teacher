@echo off
chcp 65001 >nul
echo ==============================================
echo          程序员AI辅助助手 - 启动脚本
echo ==============================================
echo.

cd /d "%~dp0"

echo 1. 检查Node.js版本...
node --version
if %errorlevel% neq 0 (
    echo 错误: Node.js 未安装或未添加到环境变量
    pause
    exit /b 1
)

echo.
echo 2. 安装/更新依赖...
npm install

echo.
echo 3. 创建环境变量文件...
if not exist ".env" (
    echo API_URL=https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions >> .env
    echo WS_URL=wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/ch >> .env
    echo EMBEDDING_URL=https://maas-api.cn-huabei-1.xf-yun.com/v2/embeddings >> .env
    echo MODEL_ID=xop35qwen2b >> .env
    echo API_KEY=a87ffea24723ba51b2817406aa6cdf30 >> .env
    echo API_SECRET=MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw >> .env
    echo APP_ID=f3f40af8 >> .env
    echo 已创建 .env 文件
) else (
    echo .env 文件已存在，跳过创建
)

echo.
echo 4. 启动服务器...
echo ==============================================
echo 服务器启动后，请打开浏览器访问:
echo http://localhost:3000
echo ==============================================
echo.
node server.js

pause