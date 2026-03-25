# 🏗️ MULTI-STAGE BUILD - Otimizado para produção

# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Runtime
FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app

# Copiar apenas node_modules do builder
COPY --from=builder /app/node_modules ./node_modules

# Copiar código necessário (tudo menos node_modules e runtime)
COPY *.js ./
COPY package.json ./
COPY routes/ ./routes/
COPY middlewares/ ./middlewares/
COPY database/ ./database/
COPY queues/ ./queues/
COPY loops/ ./loops/
COPY functions/ ./functions/
COPY emails/ ./emails/
COPY sql/ ./sql/

# Criar diretórios para runtime
RUN mkdir -p public/media sessions contacts conversations flow-json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 8001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
