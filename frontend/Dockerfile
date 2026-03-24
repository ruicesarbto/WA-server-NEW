# 🏗️ NEXT.JS DOCKERFILE - Desenvolvimento

FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
# Rodar em modo dev para agora (próximo: consertar pages/)
CMD ["npm", "run", "dev"]
