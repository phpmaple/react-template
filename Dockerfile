# 使用官方 Node.js 18 镜像作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package*.json 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production=false

# 复制项目文件
COPY . .

# 构建项目
RUN npm run build

# 暴露端口 (Vite preview 默认使用 4173 端口)
EXPOSE 4173

# 启动预览服务器
CMD ["npm", "run", "preview"]