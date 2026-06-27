# 抖音云服务托管（容器）部署。
# 关键契约：代码须落在 /opt/application；启动入口为 /opt/application/run.sh（需可执行）；
# 只能监听 8000 端口；需实现 GET /v1/ping 健康检查。
FROM node:18-slim

# 抖音云 FaaS 运行时固定执行 /opt/application/run.sh，故工作目录用 /opt/application
WORKDIR /opt/application

# 先拷依赖清单，利用构建缓存
COPY package.json ./
RUN npm install --production

# 拷贝服务端源码（含 run.sh）
COPY . ./

# 启动脚本需可执行权限（git 上传可能丢失 +x，这里强制补上）
RUN chmod +x run.sh

EXPOSE 8000

CMD ["./run.sh"]
