require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fileUpload = require("express-fileupload");
const { initializeSocket } = require("./socket.js");
const path = require("path");
const { init, cleanup } = require("./middlewares/req.js");
const nodeCleanup = require("node-cleanup");

// ✅ HELMET - Proteção de Headers HTTP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            frameSrc: ["https://js.stripe.com"],
            connectSrc: ["'self'", "https:", "wss:", "ws:", "https://m.stripe.com"],
            mediaSrc: ["'self'", "data:", "blob:"],
            objectSrc: ["'none'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            upgradeInsecureRequests: null,
        },
    },
    hsts: false,
    frameguard: {
        action: 'deny'
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// ✅ RATE LIMITING - Proteção contra DDoS e Brute Force
// Rate limit geral para todas as rotas API
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX) || 10000, // 10000 requisições por IP
    message: {
        success: false,
        msg: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
    },
    standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
    legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
    skip: (req) => {
        // Pular rate limit para requisições de arquivos estáticos e localhost
        return req.path.startsWith('/media/') ||
               req.path.startsWith('/static/') ||
               req.ip === '127.0.0.1' ||
               req.ip === '::1' ||
               req.ip === 'localhost';
    }
});

// Rate limit mais restritivo para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 10, // 10 tentativas de login
    message: {
        success: false,
        msg: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Não contar tentativas bem-sucedidas
    skipFailedRequests: false
});

// Rate limit para API pública (mais permissivo)
const publicApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: parseInt(process.env.RATE_LIMIT_PUBLIC_API_MAX) || 500, // 500 requisições por minuto
    message: {
        success: false,
        msg: 'Limite de requisições da API pública excedido. Tente novamente em 1 minuto.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());

// Aplicar rate limiting geral em todas as rotas API
app.use('/api', generalLimiter);

// ✅ CORS HÍBRIDO - Configuração por tipo de rota
// API Pública: CORS aberto para permitir clientes externos
const publicApiCors = cors({
    origin: '*',  // Permite qualquer origem para API pública
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'instance', 'msg', 'jid'],
    credentials: false,  // Não precisa de cookies para API pública
    maxAge: 86400  // Cache de 24 horas
});

// Rotas Privadas: CORS aberto para uso local
const privateApiCors = cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
});

// Aplicar CORS específico ANTES das rotas
// ✅ API Pública: CORS aberto + Rate Limit específico (clientes externos podem usar)
const apiRoute = require("./routes/api");
app.use("/api/v1", publicApiCors, publicApiLimiter, apiRoute);

// 🔒 Rotas Privadas: CORS restrito (apenas frontend autorizado)
const adminRoute = require("./routes/admin");
// Aplicar rate limiting específico para login de admin
app.use("/api/admin/login", loginLimiter);
app.use("/api/admin", privateApiCors, adminRoute);

const userRoute = require("./routes/user");
// Aplicar rate limiting específico para login de usuário
app.use("/api/user/login", loginLimiter);
app.use("/api/user", privateApiCors, userRoute);

const webRoute = require("./routes/web");
app.use("/api/web", privateApiCors, webRoute);

const sessionRoute = require("./routes/session");
app.use("/api/session", privateApiCors, sessionRoute);

const inboxRoute = require("./routes/inbox");
app.use("/api/inbox", privateApiCors, inboxRoute);

const flowRoute = require("./routes/flow");
app.use("/api/flow", privateApiCors, flowRoute);

const chatbotRoute = require("./routes/chatbot");
app.use("/api/chatbot", privateApiCors, chatbotRoute);

const templetRoute = require("./routes/templet");
app.use("/api/templet", privateApiCors, templetRoute);

const broadcastRoute = require("./routes/broadcast");
app.use("/api/broadcast", privateApiCors, broadcastRoute);

const planRoute = require("./routes/plan");
app.use("/api/plan", privateApiCors, planRoute);

const { warmerLoopInit } = require("./loops/warmerLoop.js");
const { broadcastLoopInit } = require("./loops/broadcastLoop.js");
const { startAllWorkers, stopAllWorkers } = require("./queues/workers.js");

// ✅ Frontend agora é servido pelo Next.js (porta 3000)
// ❌ Removido: express.static genérico - Backend apenas serve APIs
// ✅ Re-habilitado: express.static APENAS para /media/ (mídias do WhatsApp baixadas pelo MediaWorker)
app.use('/media', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, 'public', 'media'), {
    maxAge: '7d',           // Cache de 7 dias (mídias WhatsApp são imutáveis)
    etag: true,
    lastModified: true,
}));

// ✅ Health check para Docker
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ✅ API base check
app.get("/api", (req, res) => {
  res.json({
    message: "API Backend rodando",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      web: "/api/web/*",
      user: "/api/user/*",
      admin: "/api/admin/*",
      broadcast: "/api/broadcast/*",
      plan: "/api/plan/*"
    }
  });
});

const server = app.listen(process.env.PORT || 8001, '0.0.0.0', () => {
  init();
  startAllWorkers();
  setTimeout(() => {
    // broadcastLoopInit(); // Desabilitado por enquanto (tem recursão infinita)
    // warmerLoopInit(); // Desabilitado por enquanto (tem recursão infinita)
  }, 2000);
  console.log(`Whatsham server is runnin gon port ${process.env.PORT}`);
});

// Initialize Socket.IO and export it
const io = initializeSocket(server);

module.exports = io;

nodeCleanup((exitCode, signal) => {
  cleanup(exitCode, signal);
  stopAllWorkers().catch(() => {});
  require('./queues/cache').closeCacheClient().catch(() => {});
});
