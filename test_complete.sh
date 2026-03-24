#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TESTE COMPLETO DO SISTEMA - ScoreChat              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo "1️⃣  TESTANDO BACKEND HEALTH..."
HEALTH=$(curl -s http://localhost:8001/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "   Status: $HEALTH"
echo ""

echo "2️⃣  TESTANDO DATABASE..."
TABLES=$(docker exec chat_score_postgres psql -U chat_score -d chat_score_pg -c "SELECT COUNT(*) FROM \"user\" WHERE email = 'admin@admin.com';" 2>/dev/null | tail -1 | xargs)
echo "   Usuário admin@admin.com encontrado: $TABLES"
echo ""

echo "3️⃣  TESTANDO LOGIN (admin@admin.com / 123)..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "   ✅ LOGIN SUCESSO!"
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 | head -c 50)
  echo "   Token (primeiros 50 chars): $TOKEN..."
else
  echo "   ❌ LOGIN FALHOU"
  echo "   Resposta: $LOGIN_RESPONSE"
fi
echo ""

echo "4️⃣  TESTANDO FRONTEND..."
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login)
echo "   Status HTTP: $FRONTEND"
if [ "$FRONTEND" == "200" ]; then
  echo "   ✅ Frontend acessível"
fi
echo ""

echo "5️⃣  STATUS DOS CONTAINERS..."
docker ps --format "{{.Names}}: {{.Status}}"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    ✅ TESTE CONCLUÍDO                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
