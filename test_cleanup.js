/**
 * Test de Deep Cleanup - Verificação de Lógica
 * Este script valida se as 5 etapas de limpeza estão funcionando corretamente.
 */
require('dotenv').config();
process.env.DBHOST = '127.0.0.1';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
process.env.REDIS_CACHE_DB = '1';

const fs = require('fs');
const path = require('path');
const { getCacheClient, K } = require('./queues/cache');
const { query } = require('./database/dbpromise');
const { deleteSession } = require('./middlewares/req.js');

const TEST_ID = 'test_cleanup_instance_999';

async function setupTestData() {
  console.log('--- Setting up test data ---');
  
  // 1. Redis
  const redis = getCacheClient();
  await redis.zadd(K.inbox(TEST_ID), 1, 'chat1');
  await redis.lpush(`msgs:${TEST_ID}:chat1`, 'msg1', 'msg2');
  console.log('Redis data injected.');

  // 2. Disco
  const mediaDir = path.join(process.cwd(), 'public', 'media', TEST_ID);
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  fs.writeFileSync(path.join(mediaDir, 'test_file.txt'), 'hello world');
  console.log('Disk data injected.');

  // 3. PostgreSQL
  await query(`INSERT INTO chats (chat_id, instance_id, uid, last_message_at) VALUES (?, ?, ?, NOW()) ON CONFLICT DO NOTHING`, ['chat1', TEST_ID, 'user1']);
  await query(`INSERT INTO messages (msg_id, chat_id, instance_id, uid, message_timestamp) VALUES (?, ?, ?, ?, NOW()) ON CONFLICT DO NOTHING`, ['msg1', 'chat1', TEST_ID, 'user1']);
  console.log('PG data injected.');
}

async function verifyDeletion() {
  console.log('--- Verifying deletion ---');
  const redis = getCacheClient();
  
  // 1. Redis Check
  const inbox = await redis.exists(K.inbox(TEST_ID));
  const msgs = await redis.keys(`msgs:${TEST_ID}:*`);
  console.log('Redis Inbox exists:', !!inbox);
  console.log('Redis Message lists count:', msgs.length);

  // 2. Disk Check
  const mediaDir = path.join(process.cwd(), 'public', 'media', TEST_ID);
  const dirExists = fs.existsSync(mediaDir);
  console.log('Media directory exists:', dirExists);

  // 3. PG Check
  const chatsCount = await query(`SELECT count(*) as count FROM chats WHERE instance_id = ?`, [TEST_ID]);
  const msgsCount = await query(`SELECT count(*) as count FROM messages WHERE instance_id = ?`, [TEST_ID]);
  console.log('PG Chats count:', chatsCount[0].count);
  console.log('PG Messages count:', msgsCount[0].count);

  const success = !inbox && msgs.length === 0 && !dirExists && chatsCount[0].count === "0" && msgsCount[0].count === "0";
  console.log('\n--- RESULT ---');
  if (success) {
    console.log('✅ CLEANUP SUCCESSFUL!');
  } else {
    console.log('❌ CLEANUP FAILED (residue found)');
  }
}

async function run() {
  try {
    await setupTestData();
    console.log('\n--- Running deleteSession ---');
    await deleteSession(TEST_ID);
    console.log('deleteSession finished.\n');
    await verifyDeletion();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    process.exit();
  }
}

run();
