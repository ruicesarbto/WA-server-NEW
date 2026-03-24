# Correção de Vulnerabilidade JWT - Resumo

## Data: $(date)

## Problema Identificado
A senha (hash) estava sendo armazenada no token JWT, criando uma vulnerabilidade crítica de segurança.

## Arquivos Corrigidos

### 1. middlewares/user.js
- **Antes:** Validação usando `email` e `password` do JWT
- **Depois:** Validação usando apenas `email` e `uid` do JWT + verificação de usuário ativo
- **Query alterada:** `SELECT * FROM user WHERE email = ? AND uid = ? AND active = 1`

### 2. middlewares/admin.js
- **Antes:** Validação usando `email` e `password` do JWT
- **Depois:** Validação usando apenas `email` e `uid` do JWT
- **Query alterada:** `SELECT * FROM admin WHERE email = ? AND uid = ?`

### 3. routes/admin.js (2 lugares)
- **Login admin (linha 44):** Removida `password` do payload do JWT
- **Auto login (linha 611):** Removida `password` do payload do JWT

### 4. routes/user.js (2 lugares)
- **Login user (linha 161):** Removida `password` do payload do JWT
- **Recovery token (linha 1224):** Removida `password` do payload do JWT + adicionado `expiresIn: '1h'`

### 5. routes/api.js
- **returnToken function (linha 537):** Removida `password` do payload do JWT

## Melhorias de Segurança

1. ✅ Senha não é mais exposta no JWT
2. ✅ Validação baseada em `uid` + `email` (mais seguro)
3. ✅ Token de recuperação agora tem expiração de 1 hora
4. ✅ Verificação de usuário ativo no middleware de user

## Impacto

- **Tokens antigos:** Serão invalidados (usuários precisarão fazer login novamente)
- **Sistema de recuperação:** Continua funcionando, mas agora mais seguro
- **Compatibilidade:** Requer que todos os usuários façam novo login

## Backup

Backup dos arquivos originais salvo em: `backup_jwt_fix_20251106_215659/`

## Próximos Passos Recomendados

1. Forçar logout de todos os usuários (invalidar tokens antigos)
2. Notificar usuários para fazerem novo login
3. Considerar adicionar expiração aos tokens JWT regulares
4. Implementar refresh tokens para melhor segurança

