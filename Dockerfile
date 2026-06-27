# 抖音云服务托管（容器）部署用。监听端口需与服务配置一致，默认 8000。
FROM node:18-slim

WORKDIR /app

# 先拷依赖清单，利用构建缓存
COPY package.json ./
RUN npm install --production

# 拷贝服务端源码
COPY . ./

# 容器对外端口（与 index.js 监听端口、服务「容器端口」配置保持一致）
EXPOSE 8000

CMD ["npm", "start"]
