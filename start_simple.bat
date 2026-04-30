@echo off
cd /d "%~dp0"
npm install
if not exist ".env" (
    echo API_URL=https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions>.env
    echo WS_URL=wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/ch>>.env
    echo EMBEDDING_URL=https://maas-api.cn-huabei-1.xf-yun.com/v2/embeddings>>.env
    echo MODEL_ID=xop35qwen2b>>.env
    echo API_KEY=a87ffea24723ba51b2817406aa6cdf30>>.env
    echo API_SECRET=MjM0MTJmMjFkYTAzYjNiYWEzODA1MjMw>>.env
    echo APP_ID=f3f40af8>>.env
)
node server.js