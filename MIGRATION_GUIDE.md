# 📚 GUIA DE MIGRAÇÃO: MySQL → PostgreSQL

**Data:** 24 de Março de 2026
**Status:** ✅ Pronto para executar

---

## 🎯 O que foi alterado

### ✅ Feito:
- [x] Removido MySQL do docker-compose.yml
- [x] Removidas dependências `mysql` e `mysql2` do package.json
- [x] Docker-compose atualizado com PostgreSQL
- [x] Dockerfile otimizado (multi-stage build)
- [x] Frontend Next.js integrado
- [x] Server.js atualizado (sem servir frontend estático)
- [x] Variáveis de ambiente atualizadas
- [x] .gitignore melhorado

### ⏳ Próximos passos:

---

## 📋 CHECKLIST DE EXECUÇÃO

### **PASSO 1: Limpar dependências locais** (5 min)
```bash
cd C:\Users\rui\Desktop\chat.scoremark1.com
rm -rf node_modules
npm install
```

### **PASSO 2: Limpar dados antigos** (CUIDADO!)
```bash
# Se quer manter dados MySQL antigos, faça backup primeiro!
# Se não: deletar postgres_data volume no Docker
docker volume rm chat_score_postgres  # Remove dados antigos
```

### **PASSO 3: Rodar com Docker Compose** (10 min)
```bash
docker-compose build
docker-compose up -d
```

### **PASSO 4: Criar tabelas no PostgreSQL** (Importante!)

Conecte ao banco:
```bash
docker exec -it chat_score_postgres psql -U chat_score -d chat_score_pg
```

Crie as tabelas (copie de `sql/import.sql` ou rode seu script):
```sql
-- Exemplo:
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ... Adicione outras tabelas conforme necessário
```

Ou importe um arquivo SQL:
```bash
# Copie seu arquivo SQL para o container
docker cp ./sql/import.sql chat_score_postgres:/tmp/

# Execute dentro do container
docker exec -it chat_score_postgres psql -U chat_score -d chat_score_pg -f /tmp/import.sql
```

### **PASSO 5: Verificar serviços** (5 min)
```bash
# Backend
curl http://localhost:8001/api
# Deve retornar JSON com endpoints

# Frontend
http://localhost:3000
# Deve carregar a página Next.js

# Banco de dados
docker exec -it chat_score_postgres psql -U chat_score -d chat_score_pg -c "\dt"
# Lista todas as tabelas
```

---

## 🔄 MIGRAÇÃO DE DADOS (Se tem dados no MySQL antigo)

### **Se tem backup MySQL:**
```bash
# 1. Exportar de MySQL
mysqldump -u chat_score -p chat_score > backup.sql

# 2. Converter SQL (MySQL → PostgreSQL)
# Ferramentas: pgloader, etl, ou editar manualmente
pgloader mysql://chat_score:pass@localhost/chat_score postgresql://chat_score:pass@postgres/chat_score_pg

# 3. Importar em PostgreSQL
psql -U chat_score -d chat_score_pg < backup_converted.sql
```

### **Se não tem dados importantes:**
Deixe em branco. O app criará as tabelas conforme usar.

---

## 🔐 SEGURANÇA - Próximos passos

### ⚠️ ALTERAR SENHAS:

**Antes de produção:**

```bash
# Gere uma senha forte para PostgreSQL
openssl rand -base64 32
# Copie o resultado e altere em .env

# Gere um JWT Key forte
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copie e altere em .env

# Atualize docker-compose.yml com novos valores
```

### ✅ Após alterar:
```bash
docker-compose down
docker volume rm chat_score_postgres  # Remove dados antigos
docker-compose up -d  # Inicia com novas credenciais
```

---

## 🚨 TROUBLESHOOTING

### **Erro: "connection refused"**
```bash
# Verifique se PostgreSQL está pronto
docker exec chat_score_postgres pg_isready -U chat_score
# Deve dizer: "accepting connections"

# Se falhar, veja logs:
docker logs chat_score_postgres
```

### **Erro: "table does not exist"**
```bash
# Verifique se tabelas foram criadas
docker exec -it chat_score_postgres psql -U chat_score -d chat_score_pg -c "\dt"

# Se vazio, importe o SQL:
docker exec chat_score_postgres psql -U chat_score -d chat_score_pg -f /docker-entrypoint-initdb.d/import.sql
```

### **Erro: "unknown driver pg"**
```bash
# Reinstale dependências
rm -rf node_modules package-lock.json
npm install
docker-compose down
docker-compose build --no-cache
docker-compose up
```

---

## 📊 VERIFICAÇÃO FINAL

Depois de tudo pronto:
```bash
# 1. Backend está respondendo
curl http://localhost:8001/health
# {"status":"ok","timestamp":"2026-03-24T..."}

# 2. Frontend carrega
curl http://localhost:3000 | grep -o "<title>.*</title>"

# 3. Banco está conectado
curl http://localhost:8001/api
# Mostra endpoints disponíveis

# 4. Banco tem dados
docker exec -it chat_score_postgres psql -U chat_score -d chat_score_pg -c "SELECT version();"
```

---

## 🎉 SUCESSO!

Se tudo funciona, você agora tem:
- ✅ PostgreSQL como banco de dados
- ✅ Express backend otimizado na porta 8001
- ✅ Next.js frontend na porta 3000
- ✅ Docker Compose orquestrando tudo
- ✅ Arquitetura escalável e moderna

---

**Precisa de ajuda?** Consulte `ANALISE_INFRA_COMPLETA.md` para mais detalhes!
