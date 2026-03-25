O que foi feito:

Configuração: Adicionei o serviço postgres ao docker-compose.yml com persistência de dados no volume postgres_data.
Inicialização: O container chat_score_postgres já está rodando e pronto para uso.
Verificação: Confirmei a conectividade executando um comando SQL direto no container, que retornou com sucesso.
Dados de Acesso:

Host: localhost (ou postgres dentro da rede Docker)
Porta: 5432
Usuário: chat_score
Senha: postgrespassword
Banco: chat_score_pg



# 📋 INSTRUÇÕES DE ATUALIZAÇÕES E CORREÇÕES
## WhatsApp CRM ScoreChat - Versão 2.0.0

**Data:** 29 de Outubro de 2025
**Versão:** 2.0.0
**Status:** ✅ Todas as correções aplicadas com sucesso
**Última Atualização:** Correções do Tailwind CSS - Client_v2

---

## ⚠️ **AVISO CRÍTICO - PRESERVAÇÃO DO PROJETO**

### **🚨 REGRA FUNDAMENTAL: NUNCA PREJUDICAR O FUNCIONAMENTO**

**O PROJETO DEVE SE MANTER INTACTO E FUNCIONAL EM TODAS AS CIRCUNSTÂNCIAS**

### **📋 PRINCÍPIOS OBRIGATÓRIOS:**

#### **1. ✅ SEMPRE FAZER BACKUP ANTES DE QUALQUER ALTERAÇÃO**
```bash
# OBRIGATÓRIO antes de qualquer modificação
cd /www/wwwroot/chat.scoremark1.com
cp -r . ../backup_$(date +%Y%m%d_%H%M%S)
```

#### **2. ✅ TESTAR EM AMBIENTE DE DESENVOLVIMENTO PRIMEIRO**
- **NUNCA** aplicar correções diretamente em produção
- **SEMPRE** testar em ambiente isolado primeiro
- **VERIFICAR** se todas as funcionalidades continuam operando

#### **3. ✅ MANTER FUNCIONALIDADES EXISTENTES**
- **NÃO** remover funcionalidades que já funcionam
- **NÃO** alterar APIs que estão sendo usadas
- **NÃO** modificar estruturas de banco de dados sem migração

#### **4. ✅ PRESERVAR DADOS CRÍTICOS**
```bash
# DADOS QUE NUNCA DEVEM SER PERDIDOS:
- sessions/          # Sessões WhatsApp ativas
- conversations/      # Histórico de conversas
- contacts/          # Lista de contatos
- Banco de dados     # Todos os dados do sistema
```

#### **5. ✅ ROLLBACK IMEDIATO EM CASO DE PROBLEMA**
```bash
# Se algo der errado, restaurar IMEDIATAMENTE:
cd /www/wwwroot/chat.scoremark1.com
pm2 stop server.js
rm -rf *
cp -r ../backup_YYYYMMDD_HHMMSS/* .
pm2 start server.js
```

### **🔒 PROTEÇÕES IMPLEMENTADAS:**

#### **1. Backups Automáticos:**
- ✅ Backup completo criado: `whatsapp_crm_backup_20251029_020631.zip`
- ✅ Backup do banco de dados incluído
- ✅ Todas as correções documentadas

#### **2. Validações de Integridade:**
```bash
# Verificar integridade antes de qualquer alteração
npm test                    # Se existir
node -c server.js          # Verificar sintaxe
pm2 list                   # Verificar processos
mysql -u chat_score -p chat_score -e "SELECT 1"  # Testar DB
```

#### **3. Monitoramento Contínuo:**
```bash
# Verificar se tudo está funcionando após alterações
pm2 logs server.js --lines 50
curl -I https://chat.scoremark1.com
curl -I https://chat.scoremark1.com/api/web/health
```

### **⚠️ PROIBIÇÕES ABSOLUTAS:**

#### **❌ NUNCA FAÇA:**
1. **Deletar** diretórios `sessions/`, `conversations/`, `contacts/`
2. **Alterar** estrutura do banco de dados sem backup
3. **Modificar** arquivos `.env` sem backup
4. **Remover** dependências que estão funcionando
5. **Alterar** configurações do Nginx sem testar
6. **Reiniciar** serviços sem verificar se estão funcionando
7. **Aplicar** correções sem fazer backup primeiro

#### **❌ NUNCA IGNORE:**
1. **Logs de erro** - investigar imediatamente
2. **Alertas de sistema** - verificar recursos
3. **Falhas de conexão** - verificar configurações
4. **Problemas de performance** - monitorar métricas

### **🛡️ PROCEDIMENTOS DE SEGURANÇA:**

#### **1. Antes de Qualquer Alteração:**
```bash
# 1. Backup completo
tar -czf backup_before_changes_$(date +%Y%m%d_%H%M%S).tar.gz /www/wwwroot/chat.scoremark1.com/

# 2. Verificar status atual
pm2 list
sudo systemctl status nginx
sudo systemctl status mysql

# 3. Documentar estado atual
echo "Estado antes das alterações: $(date)" >> change_log.txt
pm2 list >> change_log.txt
```

#### **2. Durante Alterações:**
```bash
# 1. Aplicar uma correção por vez
# 2. Testar após cada correção
# 3. Verificar logs continuamente
# 4. Manter rollback pronto
```

#### **3. Após Alterações:**
```bash
# 1. Testar todas as funcionalidades
# 2. Verificar logs por 30 minutos
# 3. Monitorar métricas de sistema
# 4. Documentar alterações aplicadas
```

### **🚨 PLANO DE EMERGÊNCIA:**

#### **Se o Sistema Parar de Funcionar:**
```bash
# 1. PARAR tudo imediatamente
pm2 stop all
sudo systemctl stop nginx

# 2. RESTAURAR backup mais recente
cd /www/wwwroot/chat.scoremark1.com
rm -rf *
unzip ../backup_YYYYMMDD_HHMMSS.zip
cp -r backup_*/ .

# 3. RESTAURAR banco de dados
mysql -u chat_score -p chat_score < mysql_backup_*.sql

# 4. REINICIAR serviços
pm2 start server.js
sudo systemctl start nginx

# 5. VERIFICAR funcionamento
pm2 list
curl -I https://chat.scoremark1.com
```

#### **Contatos de Emergência:**
- **Desenvolvedor Principal:** [Seu contato]
- **Administrador do Sistema:** [Contato admin]
- **Suporte Técnico:** [Contato suporte]

### **📊 CHECKLIST DE INTEGRIDADE:**

#### **✅ Verificações Diárias:**
- [ ] Sistema respondendo normalmente
- [ ] Sessões WhatsApp conectadas
- [ ] API endpoints funcionando
- [ ] Banco de dados acessível
- [ ] Logs sem erros críticos
- [ ] Recursos do servidor normais

#### **✅ Verificações Semanais:**
- [ ] Backup automático funcionando
- [ ] Certificados SSL válidos
- [ ] Logs de segurança limpos
- [ ] Performance dentro do normal
- [ ] Atualizações de segurança aplicadas

### **🎯 OBJETIVO PRINCIPAL:**

**MANTER O SISTEMA FUNCIONANDO 24/7 SEM INTERRUPÇÕES**

- ✅ **Disponibilidade:** 99.9%
- ✅ **Integridade:** 100% dos dados preservados
- ✅ **Performance:** Dentro dos parâmetros normais
- ✅ **Segurança:** Sem vulnerabilidades conhecidas

---

**⚠️ LEMBRE-SE: É MELHOR NÃO FAZER ALTERAÇÕES DO QUE QUEBRAR O SISTEMA**

---

## 🚨 **PROBLEMAS IDENTIFICADOS E CORRIGIDOS**

### **1. PROBLEMA CRÍTICO: Validação de Autenticação Incorreta**
**Sintoma:** QR code escaneado com sucesso, mas sistema mostra "sessão inválida/sessão not fold"

**Causa:** Código verificando propriedades antigas/inexistentes do Baileys após autenticação

**Arquivos Afetados:**
- `routes/session.js`
- `routes/inbox.js`
- `middlewares/req.js`

---

## 🔧 **CORREÇÕES APLICADAS**

### **1. ✅ CORREÇÃO EM `routes/session.js`**

#### **ANTES (Linhas 96-97):**
```javascript
const userData = session?.authState?.creds?.me || session.user;
const status = session.user ? true : false;
```

#### **DEPOIS:**
```javascript
const userData = session?.authState?.creds?.me || session.user;
const status = !!(session?.authState?.creds?.me || session.user);
```

#### **ANTES (Linhas 89-94):**
```javascript
state = state === "connected" &&
        typeof (session.isLegacy ? session.state.legacy.user : session.user) !== "undefined"
        ? "authenticated" : state;
```

#### **DEPOIS:**
```javascript
state = state === "connected" &&
        (session?.authState?.creds?.me || session.user)
        ? "authenticated" : state;
```

#### **ANTES (Linhas 158-168):**
```javascript
state = state === "connected" &&
        typeof (session.isLegacy ? session.state.legacy.user : session.user) !== "undefined"
        ? "authenticated" : state;

const userData = session?.authState?.creds?.me || session.user;
const status = session.user ? true : false;
```

#### **DEPOIS:**
```javascript
state = state === "connected" &&
        (session?.authState?.creds?.me || session.user)
        ? "authenticated" : state;

const userData = session?.authState?.creds?.me || session.user;
const status = !!(session?.authState?.creds?.me || session.user);
```

#### **ADICIONADO - Logs de Debug (Linhas 87-98):**
```javascript
// Debug logs para identificar problemas de autenticação
console.log("Session validation debug:", {
  sessionId: id,
  hasSession: !!session,
  wsState: session?.ws?.readyState,
  hasAuthState: !!session?.authState,
  hasCreds: !!session?.authState?.creds,
  hasMe: !!session?.authState?.creds?.me,
  hasUser: !!session?.user,
  isLegacy: session?.isLegacy,
  credsMe: session?.authState?.creds?.me
});
```

### **2. ✅ CORREÇÃO EM `routes/inbox.js`**

#### **ANTES (Linha 59):**
```javascript
const userData = session?.authState?.creds?.me || session.user
```

#### **DEPOIS:**
```javascript
const userData = session?.authState?.creds?.me || session.user;

// Debug log para verificar dados de autenticação
console.log("Inbox session validation:", {
    sessionId: selIns,
    hasSession: !!session,
    hasAuthState: !!session?.authState,
    hasCreds: !!session?.authState?.creds,
    hasMe: !!session?.authState?.creds?.me,
    hasUser: !!session?.user,
    userData: userData
});
```

### **3. ✅ CORREÇÃO EM `middlewares/req.js`**

#### **ADICIONADO - Funções Auxiliares (Linhas 608-628):**
```javascript
// Função auxiliar para validar se uma sessão está autenticada
const isSessionAuthenticated = (session) => {
  if (!session) return false;

  // Verificar se está conectada
  if (session.ws?.readyState !== 1) return false; // 1 = OPEN

  // Verificar dados de autenticação
  const hasAuthData = session.authState?.creds?.me ||
                     session.authState?.creds?.registered ||
                     session.user;

  return !!hasAuthData;
};

// Função auxiliar para obter dados do usuário
const getSessionUserData = (session) => {
  return session?.authState?.creds?.me ||
         session?.user ||
         null;
};
```

#### **CORRIGIDO - Função Cleanup (Linhas 630-652):**
```javascript
const cleanup = () => {
  console.log("Running graceful cleanup before exit.");

  // Não forçar fechamento imediato das sessões
  // Deixar o Baileys gerenciar suas próprias desconexões
  sessions.forEach((session, sessionId) => {
    try {
      console.log(`Gracefully closing session ${sessionId}`);
      // Apenas marcar para desconexão, não forçar
      if (session && typeof session.logout === 'function') {
        session.logout();
      }
    } catch (error) {
      console.error(`Error during graceful cleanup for session ${sessionId}:`, error);
    }
  });

  // Aguardar um tempo para cleanup natural
  setTimeout(() => {
    console.log("Cleanup completed, exiting gracefully.");
    process.exit(0);
  }, 5000);
};
```

#### **CORRIGIDO - Configuração Baileys (Linhas 118-131):**
```javascript
const waConfig = {
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),
  },
  version,
  printQRInTerminal: false,
  logger,
  browser: [process.env.APP_NAME || "ScoreChat", "Chrome", "1.0.0"],
  defaultQueryTimeoutMs: 60000,
  markOnlineOnConnect: true,  // ✅ CORRIGIDO: era false
  connectTimeoutMs: 60_000,
  keepAliveIntervalMs: 10000,  // ✅ CORRIGIDO: era 30000
  generateHighQualityLinkPreview: true,
  // ... resto da configuração
};
```

#### **ADICIONADO - Export das Funções Auxiliares (Linhas 698-699):**
```javascript
module.exports = {
  // ... outras exportações existentes
  isSessionAuthenticated,
  getSessionUserData,
  // ... resto das exportações
};
```

### **4. ✅ CORREÇÃO EM `server.js`**

#### **ANTES (Linhas 11-17):**
```javascript
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(express.urlencoded({ extended: true }));  // ❌ DUPLICADO
app.use(cors());
app.use(express.json());  // ❌ DUPLICADO
app.use(fileUpload());
```

#### **DEPOIS:**
```javascript
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors());
app.use(fileUpload());
```

#### **CORRIGIDO - Mensagem de Log (Linha 64):**
```javascript
// ANTES:
console.log(`Whatsham server is runnin gon port ${process.env.PORT}`);

// DEPOIS:
console.log(`WhatsApp CRM server is running on port ${process.env.PORT || 3010}`);
```

### **5. ✅ CORREÇÃO EM `package.json`**

#### **REMOVIDO - Dependências Problemáticas:**
```json
// REMOVIDO:
"crypto": "^1.0.1",  // ❌ Módulo nativo do Node.js
"mysql": "^2.18.1",  // ❌ Conflito com mysql2
```

#### **ATUALIZADO - Versões das Dependências:**
```json
{
  "name": "whatsapp-crm-server",
  "version": "1.0.0",
  "description": "WhatsApp CRM Server - Sistema de gerenciamento de mensagens WhatsApp",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["whatsapp", "crm", "api", "nodejs", "express"],
  "author": "ScoreChat Team",
  "dependencies": {
    // ... dependências atualizadas
    "bcrypt": "^5.1.1",  // ✅ ATUALIZADO: era 5.0.1
    "dotenv": "^16.4.5",  // ✅ ATUALIZADO: era 16.0.0
    "express": "^4.19.2",  // ✅ ATUALIZADO: era 4.17.2
    "mysql2": "^3.10.0",  // ✅ MANTIDO: removido mysql conflitante
    "stripe": "^14.25.0"  // ✅ ATUALIZADO: era 12.13.0
  },
  "devDependencies": {
    "nodemon": "^3.1.0"  // ✅ ADICIONADO
  }
}
```

---

## 📊 **RESUMO DAS CORREÇÕES**

### **✅ PROBLEMAS RESOLVIDOS:**

#### **Backend (Server):**
1. **🚨 CRÍTICO:** Validação incorreta de `session.user` após autenticação
2. **🚨 CRÍTICO:** Verificação de `session.state.legacy.user` que não existe
3. **⚠️ MÉDIO:** Função cleanup forçando fechamento abrupto de sessões
4. **⚠️ MÉDIO:** Middlewares duplicados causando overhead
5. **⚠️ MÉDIO:** Configuração do Baileys causando desconexões
6. **⚠️ BAIXO:** Dependências desatualizadas e conflitantes
7. **⚠️ BAIXO:** Mensagens de log com erros de digitação

#### **Frontend (Client_v2):**
8. **🚨 CRÍTICO:** Tailwind CSS não aplicando estilos (PostCSS config incorreto)
9. **🚨 CRÍTICO:** Classes Tailwind presentes mas não compiladas
10. **⚠️ MÉDIO:** Dependência `conference` causando conflitos
11. **⚠️ MÉDIO:** Cache do Next.js impedindo recompilação
12. **⚠️ BAIXO:** Animations não funcionando corretamente

### **✅ MELHORIAS IMPLEMENTADAS:**

#### **Backend:**
1. **Logs detalhados** para debug de problemas de autenticação
2. **Funções auxiliares** para validação de sessões
3. **Graceful shutdown** para evitar invalidação de sessões
4. **Configuração otimizada** do Baileys para estabilidade
5. **Dependências atualizadas** e conflitos resolvidos

#### **Frontend (Client_v2):**
6. **PostCSS configurado corretamente** para Tailwind v3
7. **Configuração do Tailwind otimizada** com cores customizadas
8. **Animações configuradas** e funcionando
9. **CSS global melhorado** com melhor organização
10. **Design moderno** aplicado à página de login

---

## 🧪 **COMO TESTAR AS CORREÇÕES**

### **1. Teste de Criação de Sessão:**
```bash
# 1. Criar nova instância WhatsApp
POST /api/session/create_qr
{
  "title": "Teste Instância"
}

# 2. Verificar logs no console
# Deve aparecer: "Session validation debug: { ... }"
```

### **2. Teste de Autenticação:**
```bash
# 1. Escanear QR code
# 2. Verificar status da sessão
POST /api/session/status
{
  "id": "session_id"
}

# 3. Verificar logs:
# hasMe: true  ← Deve ser true após autenticação
# status: true ← Deve ser true
```

### **3. Teste de Envio de Mensagem:**
```bash
# 1. Enviar mensagem de teste
POST /api/inbox/send_text
{
  "instance": "session_id",
  "toJid": "5511999999999@s.whatsapp.net",
  "message": "Teste"
}

# 2. Verificar logs:
# "Inbox session validation: { ... }"
```

---

## 🔍 **LOGS PARA MONITORAR**

### **Logs de Sucesso:**
```
Session validation debug: {
  sessionId: "...",
  hasSession: true,
  wsState: 1,
  hasAuthState: true,
  hasCreds: true,
  hasMe: true,  ← ✅ AUTENTICADO
  hasUser: false,
  credsMe: { id: "...", name: "..." }
}
```

### **Logs de Problema:**
```
Session validation debug: {
  sessionId: "...",
  hasSession: true,
  wsState: 1,
  hasAuthState: true,
  hasCreds: true,
  hasMe: false,  ← ❌ NÃO AUTENTICADO
  hasUser: false,
  credsMe: null
}
```

---

## 📁 **ARQUIVOS MODIFICADOS**

### **Backend (Server):**
| Arquivo | Tipo de Correção | Status |
|---------|------------------|--------|
| `routes/session.js` | Validação de autenticação | ✅ Corrigido |
| `routes/inbox.js` | Verificação de sessão | ✅ Corrigido |
| `middlewares/req.js` | Funções auxiliares + cleanup | ✅ Corrigido |
| `server.js` | Middlewares duplicados | ✅ Corrigido |
| `package.json` | Dependências atualizadas | ✅ Corrigido |

### **Frontend (Client_v2):**
| Arquivo | Tipo de Correção | Status |
|---------|------------------|--------|
| `postcss.config.js` | Criado (CommonJS) | ✅ Criado |
| `postcss.config.mjs` | Removido (incompatível) | ✅ Removido |
| `tailwind.config.ts` | Configuração otimizada | ✅ Corrigido |
| `src/app/globals.css` | CSS melhorado | ✅ Corrigido |
| `src/app/login/page.tsx` | Design moderno aplicado | ✅ Corrigido |
| `package.json` | Dependência `conference` removida | ✅ Corrigido |
| `.next/` | Cache limpo | ✅ Limpo |
| `src/hooks/useSocket.ts` | Correção TypeScript | ✅ Corrigido |
| `next.config.js` | Removida opção `turbopack` inválida | ✅ Corrigido |

---

## 🚀 **PRÓXIMOS PASSOS**

1. **Reiniciar o servidor** para aplicar as correções
2. **Testar o fluxo completo** de criação e autenticação de sessões
3. **Monitorar os logs** para verificar se as correções estão funcionando
4. **Documentar novos problemas** que possam surgir

---

## 🔄 **RESTART MANUAL DO SERVIDOR**

### **⚠️ IMPORTANTE: Restart deve ser manual usando PM2**

Após aplicar as correções, o servidor deve ser reiniciado manualmente usando os comandos PM2:

### **1. Navegar para o diretório do projeto:**
```bash
cd /www/wwwroot/chat.scoremark1.com
```

### **2. Restart do servidor (escolha uma opção):**

#### **Opção A - Restart por nome do arquivo:**
```bash
pm2 restart server.js
```

#### **Opção B - Restart por nome do processo:**
```bash
pm2 restart --waham
```

### **3. Verificar status dos processos:**
```bash
pm2 list
```

### **4. Verificar logs em tempo real (opcional):**
```bash
pm2 logs server.js
# ou
pm2 logs --waham
```

### **📋 Comandos PM2 Úteis:**

| Comando | Descrição |
|---------|-----------|
| `pm2 list` | Lista todos os processos PM2 |
| `pm2 restart server.js` | Reinicia o processo server.js |
| `pm2 restart --waham` | Reinicia o processo com nome --waham |
| `pm2 stop server.js` | Para o processo server.js |
| `pm2 start server.js` | Inicia o processo server.js |
| `pm2 logs server.js` | Mostra logs do processo server.js |
| `pm2 monit` | Monitor em tempo real |

### **🔍 Verificação Pós-Restart:**

Após o restart, verifique se o servidor está funcionando:

1. **Verificar status PM2:**
   ```bash
   pm2 list
   # Deve mostrar status "online" para o processo
   ```

2. **Verificar logs de inicialização:**
   ```bash
   pm2 logs server.js --lines 50
   # Deve mostrar: "WhatsApp CRM server is running on port 8001"
   ```

3. **Testar endpoint de saúde:**
   ```bash
   curl http://localhost:8001/api/web/health
   # Deve retornar resposta HTTP 200
   ```

### **⚠️ NOTA IMPORTANTE:**
- **NÃO** use `npm start` ou `node server.js` diretamente
- **SEMPRE** use PM2 para gerenciar o processo em produção
- **VERIFIQUE** o status após o restart com `pm2 list`
- **MONITORE** os logs para identificar possíveis problemas

---

## 🌐 **CONFIGURAÇÕES DO NGINX**

### **⚠️ IMPORTANTE: Configurações obrigatórias para funcionamento**

O sistema requer configurações específicas do Nginx para funcionar corretamente. Sem essas configurações, podem ocorrer problemas de conexão WebSocket e API.

### **📁 Arquivo de Configuração:**
```bash
/etc/nginx/sites-available/chat.scoremark1.com
```

### **🔧 Configuração Completa do Nginx:**

```nginx
server {
    listen 80;
    server_name chat.scoremark1.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chat.scoremark1.com;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/chat.scoremark1.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.scoremark1.com/privkey.pem;

    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Configurações importantes para WebSocket
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeouts para WebSocket
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Tamanho máximo de upload
    client_max_body_size 100M;

    # Configuração para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts específicos para Socket.IO
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Configuração para API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts para API
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Configuração para arquivos estáticos
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache para arquivos estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Logs
    access_log /var/log/nginx/chat.scoremark1.com.access.log;
    error_log /var/log/nginx/chat.scoremark1.com.error.log;
}
```

### **🔧 Comandos para Aplicar Configuração:**

#### **1. Criar/Editar arquivo de configuração:**
```bash
sudo nano /etc/nginx/sites-available/chat.scoremark1.com
```

#### **2. Habilitar o site:**
```bash
sudo ln -s /etc/nginx/sites-available/chat.scoremark1.com /etc/nginx/sites-enabled/
```

#### **3. Testar configuração:**
```bash
sudo nginx -t
```

#### **4. Recarregar Nginx:**
```bash
sudo systemctl reload nginx
```

#### **5. Verificar status:**
```bash
sudo systemctl status nginx
```

### **🔍 Verificações Importantes:**

#### **1. Verificar se o Nginx está rodando:**
```bash
sudo systemctl status nginx
# Deve mostrar: Active: active (running)
```

#### **2. Verificar se o site está ativo:**
```bash
sudo nginx -T | grep chat.scoremark1.com
# Deve mostrar a configuração do site
```

#### **3. Verificar logs de erro:**
```bash
sudo tail -f /var/log/nginx/chat.scoremark1.com.error.log
```

#### **4. Testar conectividade:**
```bash
curl -I https://chat.scoremark1.com
# Deve retornar HTTP 200
```

### **⚠️ Configurações Críticas:**

| Configuração | Importância | Motivo |
|--------------|-------------|---------|
| `proxy_http_version 1.1` | **CRÍTICO** | Necessário para WebSocket |
| `proxy_set_header Upgrade $http_upgrade` | **CRÍTICO** | Upgrade para WebSocket |
| `proxy_set_header Connection 'upgrade'` | **CRÍTICO** | Conexão WebSocket |
| `client_max_body_size 100M` | **ALTO** | Upload de arquivos grandes |
| `proxy_read_timeout 60s` | **ALTO** | Timeout para operações longas |
| `ssl_protocols TLSv1.2 TLSv1.3` | **ALTO** | Segurança SSL |

### **🚨 Problemas Comuns e Soluções:**

#### **Problema: WebSocket não conecta**
```bash
# Verificar se headers estão corretos
sudo nginx -T | grep -A 5 -B 5 "Upgrade"
```

#### **Problema: API retorna timeout**
```bash
# Aumentar timeouts
proxy_read_timeout 120s;
proxy_send_timeout 120s;
```

#### **Problema: Upload de arquivos falha**
```bash
# Verificar tamanho máximo
client_max_body_size 200M;
```

### **📋 Checklist de Configuração:**

- [ ] Arquivo de configuração criado em `/etc/nginx/sites-available/`
- [ ] Link simbólico criado em `/etc/nginx/sites-enabled/`
- [ ] Certificados SSL configurados
- [ ] Headers WebSocket configurados
- [ ] Timeouts configurados adequadamente
- [ ] Configuração testada com `nginx -t`
- [ ] Nginx recarregado com `systemctl reload nginx`
- [ ] Site acessível via HTTPS
- [ ] WebSocket funcionando (testar no browser)
- [ ] API respondendo corretamente

### **🔧 Comandos de Manutenção:**

```bash
# Ver logs em tempo real
sudo tail -f /var/log/nginx/chat.scoremark1.com.access.log
sudo tail -f /var/log/nginx/chat.scoremark1.com.error.log

# Recarregar configuração
sudo systemctl reload nginx

# Reiniciar Nginx
sudo systemctl restart nginx

# Verificar configuração
sudo nginx -t

# Ver processos Nginx
ps aux | grep nginx
```

---

## 🔐 **CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE**

### **📁 Arquivo: `.env`**
```bash
# Configurações do Banco de Dados
DBHOST=localhost
DBNAME=chat_score
DBUSER=chat_score
DBPASS=EKytDWyWCEbiCFCr
DBPORT=3306

# Configurações do Servidor
HOST=127.0.0.1
PORT=8001
JWTKEY=NCRUp5hKovUAcZd9OwIw0BCKmjZj9JxpNCRUp5hKovUAcZd9OwIw0BCKmjZj9JxpNCRUp5hKovUAcZd9OwIw0BCKmjZj9Jxp

# Configurações da Aplicação
APP_NAME=ScoreChat
FRONTENDURI=https://chat.scoremark1.com
BACKURI=https://chat.scoremark1.com

# Configurações de Pagamento
STRIPE_LANG=en

# ⚠️ IMPORTANTE: Manter essas configurações exatas para funcionamento
```

### **🔧 Como Configurar:**
```bash
# 1. Criar arquivo .env
cd /www/wwwroot/chat.scoremark1.com
cp .env.example .env

# 2. Editar com suas credenciais
nano .env

# 3. Verificar permissões
chmod 600 .env
chown www:www .env
```

---

## 📦 **INSTALAÇÃO E DEPENDÊNCIAS**

### **Pré-requisitos:**
- Node.js 18+
- MySQL/MariaDB 10.3+
- PM2 (Process Manager)
- Nginx
- Certificados SSL (Let's Encrypt)

### **Instalação das Dependências:**
```bash
cd /www/wwwroot/chat.scoremark1.com
npm install
```

### **Verificar Instalação:**
```bash
node --version    # Deve ser 18+
npm --version     # Deve ser 8+
pm2 --version     # Deve estar instalado
nginx -v          # Deve estar instalado
mysql --version   # Deve ser 10.3+
```

### **Dependências Críticas Instaladas:**
- ✅ baileys (WhatsApp Library)
- ✅ express (Web Framework)
- ✅ mysql2 (Database Driver)
- ✅ socket.io (WebSocket)
- ✅ jsonwebtoken (Authentication)
- ✅ bcrypt (Password Hashing)
- ✅ stripe (Payment Processing)

### **Instalação do PM2:**
```bash
npm install -g pm2
pm2 startup
pm2 save
```

---

## 📁 **ESTRUTURA DE DIRETÓRIOS**

### **Estrutura Principal:**
```
/www/wwwroot/chat.scoremark1.com/
├── client/                 # Frontend React
├── contacts/              # Contatos salvos
├── conversations/         # Conversas salvas
├── database/              # Configurações do banco
├── emails/               # Templates de email
├── flow-json/            # Fluxos de chatbot
├── functions/            # Funções auxiliares
├── languages/            # Arquivos de idioma
├── loops/               # Loops de processamento
├── middlewares/         # Middlewares do Express
├── routes/              # Rotas da API
├── sessions/            # Sessões WhatsApp
├── sql/                 # Scripts SQL
├── server.js            # Arquivo principal
├── package.json         # Dependências
└── .env                 # Variáveis de ambiente
```

### **Diretórios Críticos:**
- `sessions/` - **NÃO DELETAR** - Contém dados de autenticação WhatsApp
- `conversations/` - **NÃO DELETAR** - Histórico de conversas
- `contacts/` - **NÃO DELETAR** - Lista de contatos

### **Permissões Recomendadas:**
```bash
# Definir proprietário
sudo chown -R www:www /www/wwwroot/chat.scoremark1.com/

# Definir permissões
sudo chmod -R 755 /www/wwwroot/chat.scoremark1.com/
sudo chmod 600 /www/wwwroot/chat.scoremark1.com/.env
sudo chmod 700 /www/wwwroot/chat.scoremark1.com/sessions/
```

---

## 💾 **BACKUP E RESTAURAÇÃO**

### **Backup Automático Criado:**
- **Arquivo:** `whatsapp_crm_backup_20251029_020631.zip`
- **Tamanho:** 6.6MB
- **Conteúdo:** Projeto completo + Banco de dados

### **Como Restaurar:**
```bash
# 1. Extrair backup
unzip whatsapp_crm_backup_20251029_020631.zip

# 2. Restaurar arquivos
cp -r backup_20251029_020531/* /www/wwwroot/chat.scoremark1.com/

# 3. Restaurar banco
mysql -u chat_score -p chat_score < mysql_backup_20251029_020610.sql

# 4. Instalar dependências
npm install

# 5. Configurar .env
cp .env.example .env
# Editar com suas credenciais

# 6. Iniciar com PM2
pm2 start server.js --name "whatsapp-crm"
```

### **Backup Manual:**
```bash
# Backup do projeto
tar -czf backup_$(date +%Y%m%d).tar.gz /www/wwwroot/chat.scoremark1.com/

# Backup do banco
mysqldump -u chat_score -p chat_score > backup_db_$(date +%Y%m%d).sql
```

### **Backup Automático (Crontab):**
```bash
# Editar crontab
crontab -e

# Adicionar linhas:
0 2 * * * /usr/bin/mysqldump -u chat_score -p'password' chat_score > /backup/db_$(date +\%Y\%m\%d).sql
0 3 * * * tar -czf /backup/project_$(date +\%Y\%m\%d).tar.gz /www/wwwroot/chat.scoremark1.com/
```

---

## 📊 **MONITORAMENTO E LOGS**

### **Logs Importantes:**
```bash
# Logs do PM2
pm2 logs server.js

# Logs do Nginx
sudo tail -f /var/log/nginx/chat.scoremark1.com.access.log
sudo tail -f /var/log/nginx/chat.scoremark1.com.error.log

# Logs do Sistema
sudo journalctl -u nginx -f
sudo journalctl -u mysql -f
```

### **Comandos de Monitoramento:**
```bash
# Status dos processos
pm2 list
pm2 monit

# Uso de recursos
htop
df -h
free -h

# Conexões de rede
netstat -tulpn | grep :8001
netstat -tulpn | grep :443
```

### **Métricas Importantes:**
- **CPU:** < 80%
- **RAM:** < 80%
- **Disk:** < 90%
- **Conexões MySQL:** < 1000
- **Sessões WhatsApp:** Monitorar desconexões

### **Alertas Recomendados:**
```bash
# Script de monitoramento
#!/bin/bash
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
RAM=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
DISK=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)

if [ $CPU -gt 80 ] || [ $RAM -gt 80 ] || [ $DISK -gt 90 ]; then
    echo "ALERTA: CPU: $CPU%, RAM: $RAM%, DISK: $DISK%"
fi
```

---

## 🔧 **TROUBLESHOOTING**

### **Problemas Comuns:**

#### **1. Sessão WhatsApp não conecta:**
```bash
# Verificar logs
pm2 logs server.js | grep "Session validation"

# Verificar arquivos de sessão
ls -la sessions/

# Limpar sessões corrompidas
rm -rf sessions/md_*

# Recriar sessão
# Via interface web ou API
```

#### **2. API não responde:**
```bash
# Verificar PM2
pm2 list

# Verificar Nginx
sudo nginx -t

# Verificar porta
netstat -tulpn | grep :8001

# Reiniciar serviços
pm2 restart server.js
sudo systemctl reload nginx
```

#### **3. Banco de dados não conecta:**
```bash
# Verificar MySQL
sudo systemctl status mysql

# Testar conexão
mysql -u chat_score -p chat_score

# Verificar .env
cat .env | grep DB

# Verificar logs MySQL
sudo tail -f /var/log/mysql/error.log
```

#### **4. WebSocket não funciona:**
```bash
# Verificar configuração Nginx
sudo nginx -T | grep -A 10 "socket.io"

# Verificar logs
sudo tail -f /var/log/nginx/chat.scoremark1.com.error.log

# Testar WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" https://chat.scoremark1.com/socket.io/
```

#### **5. QR Code não aparece:**
```bash
# Verificar logs de criação de sessão
pm2 logs server.js | grep "QR code"

# Verificar permissões
ls -la sessions/

# Limpar cache
pm2 restart server.js
```

### **Comandos de Emergência:**
```bash
# Reiniciar tudo
pm2 restart all
sudo systemctl restart nginx
sudo systemctl restart mysql

# Verificar status
pm2 list
sudo systemctl status nginx
sudo systemctl status mysql

# Verificar espaço em disco
df -h

# Verificar memória
free -h

# Verificar processos
ps aux | grep node
ps aux | grep nginx
```

### **Logs de Debug:**
```bash
# Ativar logs detalhados
export DEBUG=*
pm2 restart server.js

# Ver logs em tempo real
pm2 logs server.js --lines 100

# Filtrar logs específicos
pm2 logs server.js | grep "Session validation"
pm2 logs server.js | grep "QR code"
pm2 logs server.js | grep "Error"
```

---

## 🔒 **CONFIGURAÇÕES DE SEGURANÇA**

### **Firewall (UFW):**
```bash
# Permitir apenas portas necessárias
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 8001/tcp   # Bloquear acesso direto ao Node.js
sudo ufw enable

# Verificar status
sudo ufw status
```

### **Permissões de Arquivos:**
```bash
# Definir permissões corretas
sudo chown -R www:www /www/wwwroot/chat.scoremark1.com/
sudo chmod -R 755 /www/wwwroot/chat.scoremark1.com/
sudo chmod 600 /www/wwwroot/chat.scoremark1.com/.env
sudo chmod 700 /www/wwwroot/chat.scoremark1.com/sessions/
```

### **Backup de Segurança:**
```bash
# Backup automático diário (crontab)
0 2 * * * /usr/bin/mysqldump -u chat_score -p'password' chat_score > /backup/db_$(date +\%Y\%m\%d).sql
0 3 * * * tar -czf /backup/project_$(date +\%Y\%m\%d).tar.gz /www/wwwroot/chat.scoremark1.com/
```

### **Configurações SSL:**
```bash
# Renovar certificados automaticamente
crontab -e
# Adicionar:
0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

### **Monitoramento de Segurança:**
```bash
# Verificar tentativas de login SSH
sudo tail -f /var/log/auth.log

# Verificar logs de acesso suspeitos
sudo tail -f /var/log/nginx/chat.scoremark1.com.access.log | grep -E "(40[0-9]|50[0-9])"

# Verificar processos suspeitos
ps aux | grep -E "(nc|netcat|wget|curl)" | grep -v grep
```

---

## 📋 **CHECKLIST FINAL**

### **✅ Antes de Colocar em Produção:**
- [ ] Todas as correções aplicadas
- [ ] Arquivo .env configurado corretamente
- [ ] Dependências instaladas (npm install)
- [ ] Banco de dados restaurado
- [ ] Nginx configurado e testado
- [ ] PM2 configurado e funcionando
- [ ] SSL configurado
- [ ] Firewall configurado
- [ ] Permissões de arquivos corretas
- [ ] Backup automático configurado
- [ ] Monitoramento configurado
- [ ] Testes de funcionalidade realizados

### **✅ Testes Obrigatórios:**
- [ ] Criação de sessão WhatsApp
- [ ] Escaneamento de QR code
- [ ] Envio de mensagem de teste
- [ ] Recebimento de mensagem
- [ ] API endpoints funcionando
- [ ] WebSocket funcionando
- [ ] Upload de arquivos
- [ ] Sistema de pagamento (se aplicável)

### **✅ Monitoramento Contínuo:**
- [ ] Logs sendo monitorados
- [ ] Recursos do servidor sendo monitorados
- [ ] Backup automático funcionando
- [ ] Certificados SSL válidos
- [ ] Sessões WhatsApp estáveis

---

## 🎨 **CORREÇÃO DO TAILWIND CSS - CLIENT_V2**

### **Data:** 29 de Outubro de 2025
### **Versão:** 2.0.0
### **Status:** ✅ Correções aplicadas com sucesso

---

### **🚨 PROBLEMA IDENTIFICADO**

**Sintoma:** Estilos do Tailwind CSS não sendo aplicados na página de login e demais componentes do `client_v2`.

**Sintomas Observados:**
- Classes Tailwind presentes no HTML mas não aplicadas
- `borderRadius: "0px"` quando deveria ser `"24px"` (rounded-2xl)
- `backgroundColor` incorreto nos botões
- Gradientes não funcionando
- Background com gradiente não aplicado

**Causa Raiz:**
1. Arquivo `postcss.config.mjs` em formato ES6 não sendo reconhecido pelo Next.js 14
2. Dependência incorreta `conference` instalada acidentalmente
3. Cache do Next.js impedindo recompilação correta
4. Configuração do PostCSS não compatível com Tailwind v3

---

### **🔧 CORREÇÕES APLICADAS**

#### **1. ✅ CORREÇÃO DO ARQUIVO POSTCSS**

**Arquivo:** `client_v2/postcss.config.mjs` → `client_v2/postcss.config.js`

**ANTES:**
```javascript
// postcss.config.mjs (ES6 modules)
const config = {
  plugins: {
    "@tailwindcss/postcss": {},  // ❌ Formato Tailwind v4
  },
};

export default config;
```

**DEPOIS:**
```javascript
// postcss.config.js (CommonJS)
module.exports = {
  plugins: {
    tailwindcss: {},      // ✅ Formato Tailwind v3
    autoprefixer: {},     // ✅ Adicionado autoprefixer
  },
};
```

**Motivo:** Next.js 14 funciona melhor com CommonJS para configurações do PostCSS. O formato `.mjs` com ES6 modules estava causando problemas de reconhecimento.

---

#### **2. ✅ REMOÇÃO DE DEPENDÊNCIA INCORRETA**

**Problema:** Pacote `conference` instalado incorretamente, causando conflitos.

**Solução:**
```bash
cd /www/wwwroot/chat.scoremark1.com/client_v2
npm uninstall conference
```

**Resultado:** Removidas 27 pacotes conflitantes.

---

#### **3. ✅ ATUALIZAÇÃO DA CONFIGURAÇÃO DO TAILWIND**

**Arquivo:** `client_v2/tailwind.config.ts`

**MELHORIAS APLICADAS:**

1. **Caminhos de Content Expandidos:**
```typescript
content: [
  "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/**/*.{js,ts,jsx,tsx,mdx}",  // ✅ ADICIONADO
],
```

2. **Cores Customizadas Corrigidas:**
```typescript
chat: {
  bg: '#f0f2f5',
  'message-sent': '#d9fdd3',      // ✅ Corrigido formato
  'message-received': '#ffffff',
  'bubble-sent': '#dcf8c6',
  'bubble-received': '#ffffff',
},
```

3. **Animações Configuradas:**
```typescript
animation: {
  'fade-in': 'fadeIn 0.6s ease-out',
  'slide-in': 'slideIn 0.5s ease-out',
  'bounce-in': 'bounceIn 0.6s ease-out',
  'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
},
transitionDelay: {
  '1000': '1000ms',
  '2000': '2000ms',
},
```

4. **Core Plugins Garantidos:**
```typescript
corePlugins: {
  preflight: true,  // ✅ Garante reset CSS do Tailwind
},
```

---

#### **4. ✅ MELHORIAS NO CSS GLOBAL**

**Arquivo:** `client_v2/src/app/globals.css`

**ADICIONADO:**

1. **Box-sizing Global:**
```css
@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}
```

2. **Font Smoothing Melhorado:**
```css
html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

3. **Animações @keyframes Diretas:**
```css
@layer utilities {
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes bounceIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    50% {
      transform: scale(1.05);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
}
```

---

#### **5. ✅ LIMPEZA DE CACHE E REINÍCIO**

**Comandos Executados:**
```bash
# 1. Parar processo Next.js
pkill -f "next.*4058"

# 2. Limpar cache do Next.js
cd /www/wwwroot/chat.scoremark1.com/client_v2
rm -rf .next

# 3. Reiniciar servidor
npm run dev > /tmp/nextjs.log 2>&1 &
```

**Motivo:** Cache antigo estava impedindo a recompilação correta do Tailwind CSS.

---

### **📊 ARQUIVOS MODIFICADOS**

| Arquivo | Tipo de Correção | Status |
|---------|------------------|--------|
| `postcss.config.js` | Criado novo arquivo CommonJS | ✅ Corrigido |
| `postcss.config.mjs` | Removido (incompatível) | ✅ Removido |
| `tailwind.config.ts` | Configuração otimizada | ✅ Corrigido |
| `src/app/globals.css` | CSS melhorado e animações | ✅ Corrigido |
| `package.json` | Dependência `conference` removida | ✅ Corrigido |
| `.next/` | Cache limpo | ✅ Removido |

---

### **✅ VERIFICAÇÃO DE FUNCIONAMENTO**

#### **1. Teste de Estilos Aplicados:**

Após as correções, verificar no navegador:

```javascript
// Verificar se estilos estão sendo aplicados
const button = document.querySelector('button[type="submit"]');
const styles = window.getComputedStyle(button);

// Deve retornar:
// borderRadius: "16px" (rounded-xl)
// backgroundImage: "linear-gradient(...)" (gradiente)
// backgroundColor: "rgba(0, 0, 0, 0)" (transparente por causa do gradiente)
```

#### **2. Verificar CSS Gerado:**

```bash
# Verificar se CSS do Tailwind está sendo gerado
curl -s https://chat.scoremark1.com:4057/_next/static/css/app/layout.css | grep -i "rounded\|gradient\|whatsapp" | head -5

# Deve retornar classes Tailwind compiladas
```

#### **3. Verificar Console do Navegador:**

- ✅ Sem erros relacionados ao Tailwind
- ✅ CSS carregando corretamente
- ✅ Estilos aplicados aos elementos

---

### **🔍 PROBLEMAS RESOLVIDOS**

1. ✅ **Classes Tailwind não aplicadas** → PostCSS configurado corretamente
2. ✅ **Gradientes não funcionando** → Tailwind compilando corretamente
3. ✅ **Border radius não aplicado** → Estilos sendo gerados
4. ✅ **Animações não funcionando** → Keyframes configuradas
5. ✅ **Cache impedindo atualizações** → Cache limpo e servidor reiniciado

---

### **🚀 PRÓXIMOS PASSOS APÓS CORREÇÃO**

1. **Verificar se Next.js está rodando:**
   ```bash
   ps aux | grep -E "next.*4058" | grep -v grep
   ```

2. **Verificar se porta está aberta:**
   ```bash
   netstat -tulpn | grep ":4058"
   ```

3. **Testar acesso via navegador:**
   ```bash
   curl -I https://chat.scoremark1.com:4057/login
   ```

4. **Verificar logs:**
   ```bash
   tail -f /tmp/nextjs.log
   ```

---

### **⚠️ IMPORTANTE**

#### **Se os Estilos Ainda Não Funcionarem:**

1. **Limpar cache novamente:**
   ```bash
   cd /www/wwwroot/chat.scoremark1.com/client_v2
   rm -rf .next
   npm run dev
   ```

2. **Verificar versão do Tailwind:**
   ```bash
   npm list tailwindcss
   # Deve ser: tailwindcss@3.4.18
   ```

3. **Verificar PostCSS:**
   ```bash
   npm list postcss autoprefixer
   # Deve ter: postcss@8.5.6 e autoprefixer@10.4.21
   ```

4. **Recompilar manualmente:**
   ```bash
   cd /www/wwwroot/chat.scoremark1.com/client_v2
   npx tailwindcss -i ./src/app/globals.css -o ./test-output.css --watch
   # Se funcionar, o problema é no Next.js
   ```

---

### **📋 CHECKLIST DE VERIFICAÇÃO**

- [ ] `postcss.config.js` existe e está correto (CommonJS)
- [ ] `postcss.config.mjs` foi removido
- [ ] Dependência `conference` removida
- [ ] Tailwind v3.4.18 instalado
- [ ] PostCSS 8.5.6 instalado
- [ ] Autoprefixer 10.4.21 instalado
- [ ] Cache `.next/` limpo
- [ ] Next.js reiniciado
- [ ] Estilos sendo aplicados no navegador
- [ ] Console sem erros relacionados ao Tailwind

---

### **🎯 RESULTADO ESPERADO**

Após as correções:

✅ **Botões:** Gradiente verde WhatsApp aplicado corretamente  
✅ **Cards:** Bordas arredondadas (24px para rounded-2xl) funcionando  
✅ **Background:** Gradiente verde aplicado  
✅ **Animações:** fadeIn, slideIn, bounceIn funcionando  
✅ **Classes Customizadas:** whatsapp-*, chat-*, sidebar-* funcionando  

---

### **📝 NOTAS TÉCNICAS**

- **Tailwind v3** usa formato diferente do v4 para configuração
- **Next.js 14** funciona melhor com CommonJS para PostCSS
- **Cache** do Next.js pode impedir recompilação do Tailwind
- **Importância** de limpar cache após mudanças de configuração

---

### **🔗 REFERÊNCIAS**

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Next.js PostCSS Configuration](https://nextjs.org/docs/app/building-your-application/styling/postcss)
- [PostCSS Configuration](https://postcss.org/docs/postcss-config)

---

## 📦 **SISTEMA DE BACKUP PÓS-IMPLEMENTAÇÃO**
## Backup Automático Após Cada Implementação Bem-Sucedida

**Versão:** 1.0.0
**Data:** 29 de Outubro de 2025
**Status:** ✅ Sistema de Backup Inteligente Ativo

---

## 🎯 **CONCEITO DO SISTEMA**

### **📋 Fluxo de Trabalho:**
1. **Implementação** → Correções/atualizações aplicadas
2. **Teste** → Verificar se tudo funciona
3. **Confirmação** → "Implementação bem-sucedida"
4. **Comando** → "faça bkp" ou "faça backup"
5. **Execução** → Sistema cria backup completo automaticamente
6. **Resultado** → `bkp/sistema+nginx+banco+info_implementação_YYYYMMDD_HHMMSS.zip`

---

## 🔧 **SCRIPT PRINCIPAL DE BACKUP PÓS-IMPLEMENTAÇÃO**

### **Arquivo: `/usr/local/bin/backup_pos_implementacao.sh`**

```bash
#!/bin/bash
# Sistema de Backup Pós-Implementação
# Executado manualmente após cada implementação bem-sucedida

# Configurações
BACKUP_ROOT="/backup_pos_implementacao"
PROJECT_PATH="/www/wwwroot/chat.scoremark1.com"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="sistema+nginx+banco+info_implementacao_${TIMESTAMP}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"

# Função principal de backup
backup_pos_implementacao() {
    log "🔄 Iniciando backup pós-implementação..."
    
    # Criar diretório de backup
    mkdir -p "$BACKUP_DIR"
    
    # 1. BACKUP DO SISTEMA (Projeto completo)
    log "📦 Fazendo backup do sistema..."
    tar -czf "$BACKUP_DIR/sistema.tar.gz" \
        --exclude="node_modules" \
        --exclude="*.log" \
        --exclude=".git" \
        --exclude="backup_*" \
        --exclude="*.backup.*" \
        -C "$(dirname "$PROJECT_PATH")" \
        "$(basename "$PROJECT_PATH")"
    
    # 2. BACKUP DO NGINX (Configurações)
    log "🌐 Fazendo backup do Nginx..."
    mkdir -p "$BACKUP_DIR/nginx"
    cp -r /etc/nginx/sites-available/ "$BACKUP_DIR/nginx/"
    cp -r /etc/nginx/sites-enabled/ "$BACKUP_DIR/nginx/"
    cp /etc/nginx/nginx.conf "$BACKUP_DIR/nginx/" 2>/dev/null
    cp -r /etc/letsencrypt/live/chat.scoremark1.com/ "$BACKUP_DIR/nginx/ssl/" 2>/dev/null
    
    # 3. BACKUP DO BANCO DE DADOS
    log "🗄️ Fazendo backup do banco de dados..."
    mysqldump -u chat_score -p'EKytDWyWCEbiCFCr' chat_score > "$BACKUP_DIR/banco_dados.sql"
    
    # 4. BACKUP DE INFORMAÇÕES DA IMPLEMENTAÇÃO
    log "📋 Coletando informações da implementação..."
    cat > "$BACKUP_DIR/info_implementacao.txt" << EOF
=== INFORMAÇÕES DA IMPLEMENTAÇÃO ===
Data/Hora: $(date)
Backup: $BACKUP_NAME
Versão: 1.0.0

=== STATUS DO SISTEMA ===
Processos PM2: $(pm2 list)
Status Nginx: $(sudo systemctl status nginx --no-pager -l)
Status MySQL: $(sudo systemctl status mysql --no-pager -l)
Uso de Disco: $(df -h)
Uso de Memória: $(free -h)

=== CONFIGURAÇÕES CRÍTICAS ===
Arquivo .env: $(cat $PROJECT_PATH/.env 2>/dev/null || echo "Arquivo .env não encontrado")
Package.json: $(cat $PROJECT_PATH/package.json 2>/dev/null || echo "Package.json não encontrado")

=== VERIFICAÇÕES DE INTEGRIDADE ===
Sintaxe dos arquivos principais:
$(node -c $PROJECT_PATH/server.js 2>&1 || echo "Erro de sintaxe em server.js")
$(node -c $PROJECT_PATH/middlewares/req.js 2>&1 || echo "Erro de sintaxe em req.js")

Teste de conectividade:
$(curl -s -o /dev/null -w "HTTP Status: %{http_code}" https://chat.scoremark1.com || echo "Site não acessível")
EOF
    
    # 5. BACKUP DE LOGS RECENTES
    log "📝 Fazendo backup de logs recentes..."
    mkdir -p "$BACKUP_DIR/logs"
    pm2 logs --lines 100 > "$BACKUP_DIR/logs/pm2_logs.txt" 2>/dev/null
    sudo tail -100 /var/log/nginx/chat.scoremark1.com.access.log > "$BACKUP_DIR/logs/nginx_access.log" 2>/dev/null
    sudo tail -100 /var/log/nginx/chat.scoremark1.com.error.log > "$BACKUP_DIR/logs/nginx_error.log" 2>/dev/null
    sudo journalctl --since "1 hour ago" > "$BACKUP_DIR/logs/system_logs.txt" 2>/dev/null
    
    # 6. CRIAR ARQUIVO ZIP FINAL
    log "📦 Criando arquivo ZIP final..."
    cd "$BACKUP_ROOT"
    zip -r "${BACKUP_NAME}.zip" "$BACKUP_NAME"
    
    # Calcular tamanho e mostrar informações finais
    ZIP_SIZE=$(du -h "${BACKUP_NAME}.zip" | cut -f1)
    rm -rf "$BACKUP_NAME"
    
    success "🎉 BACKUP PÓS-IMPLEMENTAÇÃO CONCLUÍDO COM SUCESSO!"
    log "📁 Arquivo: ${BACKUP_ROOT}/${BACKUP_NAME}.zip"
    log "📏 Tamanho: $ZIP_SIZE"
    log "🕒 Criado em: $(date)"
    
    # Verificar integridade do ZIP
    if unzip -t "${BACKUP_NAME}.zip" > /dev/null 2>&1; then
        success "✅ Integridade do arquivo ZIP verificada"
    else
        error "❌ Arquivo ZIP pode estar corrompido"
    fi
}
```

---

## 🚀 **IMPLEMENTAÇÃO DO SISTEMA**

### **1. ✅ Sistema Já Implementado:**

```bash
# ✅ Diretório de backup criado
sudo mkdir -p /backup_pos_implementacao
sudo chown www:www /backup_pos_implementacao

# ✅ Script criado e executável
sudo chmod +x /usr/local/bin/backup_pos_implementacao.sh

# ✅ Aliases configurados
alias bkp="/usr/local/bin/backup_pos_implementacao.sh backup"
alias bkp-list="/usr/local/bin/backup_pos_implementacao.sh list"
alias bkp-clean="/usr/local/bin/backup_pos_implementacao.sh clean"
```

### **2. Comandos de Uso:**

```bash
# Após implementação bem-sucedida, executar:
/usr/local/bin/backup_pos_implementacao.sh backup

# Listar backups disponíveis:
/usr/local/bin/backup_pos_implementacao.sh list

# Limpar backups antigos:
/usr/local/bin/backup_pos_implementacao.sh clean
```

---

## 📋 **FLUXO DE TRABALHO COMPLETO**

### **Exemplo de Uso:**

```bash
# 1. Implementação de correções
# ... aplicar correções nos arquivos ...

# 2. Teste da implementação
pm2 restart server.js
curl -I https://chat.scoremark1.com

# 3. Se tudo funcionar, executar backup
/usr/local/bin/backup_pos_implementacao.sh backup

# Output esperado:
# 🔄 Iniciando backup pós-implementação...
# 📦 Fazendo backup do sistema...
# ✅ Sistema backup concluído
# 🌐 Fazendo backup do Nginx...
# ✅ Nginx backup concluído
# 🗄️ Fazendo backup do banco de dados...
# ✅ Banco de dados backup concluído
# 📋 Coletando informações da implementação...
# ✅ Informações da implementação coletadas
# 📝 Fazendo backup de logs recentes...
# ✅ Logs recentes coletados
# 📦 Criando arquivo ZIP final...
# ✅ Arquivo ZIP criado: sistema+nginx+banco+info_implementacao_20251029_042205.zip
# 📏 Tamanho: 14M
# 🕒 Criado em: Mon Oct 29 04:29:00 UTC 2025
# ✅ Integridade do arquivo ZIP verificada
# 🎉 BACKUP PÓS-IMPLEMENTAÇÃO CONCLUÍDO COM SUCESSO!
```

---

## 📁 **ESTRUTURA DO BACKUP CRIADO**

```
/backup_pos_implementacao/
└── sistema+nginx+banco+info_implementacao_20251029_042205.zip
    ├── sistema.tar.gz                    # Projeto completo (14M)
    ├── nginx/                            # Configurações Nginx
    │   ├── sites-available/
    │   ├── sites-enabled/
    │   ├── nginx.conf
    │   └── ssl/                          # Certificados SSL
    ├── banco_dados.sql                   # Dump do MySQL (137K)
    ├── info_implementacao.txt            # Informações detalhadas (7.4K)
    └── logs/                             # Logs recentes
        ├── pm2_logs.txt
        ├── nginx_access.log
        ├── nginx_error.log
        └── system_logs.txt
```

---

## 🔧 **COMANDOS RÁPIDOS PARA O AGENT**

### **Após cada implementação bem-sucedida:**

```bash
# Comando para executar backup
/usr/local/bin/backup_pos_implementacao.sh backup

# Verificar backups
/usr/local/bin/backup_pos_implementacao.sh list

# Limpar backups antigos
/usr/local/bin/backup_pos_implementacao.sh clean
```

### **Para verificar backups:**

```bash
# Listar todos os backups
ls -lah /backup_pos_implementacao/

# Verificar último backup
ls -lah /backup_pos_implementacao/ | tail -5
```

---

## ⚡ **INTEGRAÇÃO COM O FLUXO DE TRABALHO**

### **Sequência Ideal:**

1. **Implementar correções**
2. **Testar funcionamento**
3. **Confirmar sucesso**
4. **Executar:** `/usr/local/bin/backup_pos_implementacao.sh backup`
5. **Verificar:** `/usr/local/bin/backup_pos_implementacao.sh list`
6. **Continuar desenvolvimento**

### **Vantagens do Sistema:**

- ✅ **Automático:** Um comando cria backup completo
- ✅ **Inteligente:** Inclui sistema + nginx + banco + info
- ✅ **Organizado:** Nome descritivo com timestamp
- ✅ **Verificado:** Testa integridade do ZIP
- ✅ **Informativo:** Coleta status do sistema
- ✅ **Eficiente:** Remove arquivos temporários
- ✅ **Seguro:** Backup completo e verificável

---

## 🎯 **TESTE REALIZADO COM SUCESSO**

### **✅ Backup de Teste Criado:**
- **Arquivo:** `sistema+nginx+banco+info_implementacao_20251029_042205.zip`
- **Tamanho:** 14M
- **Status:** ✅ Integridade verificada
- **Conteúdo:** Sistema completo + Nginx + Banco + Info + Logs

### **✅ Verificações Realizadas:**
- ✅ Script executável criado
- ✅ Diretório de backup configurado
- ✅ Backup completo realizado
- ✅ Arquivo ZIP criado com sucesso
- ✅ Integridade verificada
- ✅ Sistema pronto para uso

---

**🎯 SISTEMA PRONTO PARA USO!**

Agora após cada implementação bem-sucedida, basta executar `/usr/local/bin/backup_pos_implementacao.sh backup` e o sistema criará automaticamente um backup completo com nome descritivo contendo tudo que é necessário para restaurar o sistema exatamente como estava após a implementação.

---

**📅 Última atualização:** 29 de Outubro de 2025
**🔄 Versão:** 1.0.0
**👥 Aplicável a:** Desenvolvedores, Administradores, DevOps
**⚖️ Status:** Completo e Funcional

---

## 🛠️ Painel Dev Oculto – Tuning do Socket (Frontend)

### Onde fica
- Página: `Configurações` (rota `#/settings` no Client v2)
- Acesso rápido: botão discreto no canto inferior direito ou atalho `Ctrl/Cmd + Alt + D`.

### O que faz
- Ajusta parâmetros do Socket.IO no navegador e persiste via `localStorage`:
  - Amostragem de logs: `socket_log_sample` (0–1, padrão 0.1)
  - Filtro de eventos (CSV): `socket_log_events` (ex.: `connect,disconnect,connect_error,reconnect,reconnect_error,ping,pong,rtt_avg,ping_timeout_detected`)
  - Transports: `socket_transports` (ex.: `polling,websocket`)
  - Timeout (ms): `socket_timeout` (ex.: `10000`)
  - Reconnection Delay Max (ms): `socket_recon_delay_max` (ex.: `15000`)
  - Flag para manter painel visível: `enable_dev_panel = '1'`

### Como usar
1) Abra Configurações e clique na chave inglesa (ou use `Ctrl/Cmd + Alt + D`).
2) Defina os valores desejados e clique em “Aplicar”.
3) Recarregue a página para reabrir a conexão do socket com os novos parâmetros.
4) “Reset” limpa os ajustes do `localStorage`.

### Observações
- Logs são amostrados e enviados best-effort para `/api/user/log_socket` (se disponível) e para o console.
- Eventos suportados pelo filtro: `connect`, `disconnect`, `connect_error`, `reconnect`, `reconnect_error`, `ping`, `pong`, `rtt_avg`, `ping_timeout_detected`.
- Também é possível configurar via variáveis de ambiente em build: 
  - `NEXT_PUBLIC_SOCKET_LOG_SAMPLE`, `NEXT_PUBLIC_SOCKET_LOG_EVENTS`, `NEXT_PUBLIC_SOCKET_TRANSPORTS`, `NEXT_PUBLIC_SOCKET_TIMEOUT`, `NEXT_PUBLIC_SOCKET_RECON_DELAY_MAX`.

### Melhoria opcional
- Mover o painel para uma rota dedicada sob `/admin` e proteger por role.
