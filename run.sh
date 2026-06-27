#!/bin/bash
# 抖音云 FaaS 运行时会执行 /opt/application/run.sh 作为启动入口。
cd /opt/application || exit 1
node index.js
