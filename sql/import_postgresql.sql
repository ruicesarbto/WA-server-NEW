-- ============================================================
-- PostgreSQL Schema — Gerado por auditoria Backend vs DB
-- 100% compatível com todo o código Node.js do backend
-- ============================================================

-- Drop all tables (clean start)
DROP TABLE IF EXISTS baileys_auth CASCADE;
DROP TABLE IF EXISTS chat_pinned CASCADE;
DROP TABLE IF EXISTS chat_tag CASCADE;
DROP TABLE IF EXISTS chat_note CASCADE;
DROP TABLE IF EXISTS poll_votes CASCADE;
DROP TABLE IF EXISTS templet CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS warmer_script CASCADE;
DROP TABLE IF EXISTS warmers CASCADE;
DROP TABLE IF EXISTS contact CASCADE;
DROP TABLE IF EXISTS phonebook CASCADE;
DROP TABLE IF EXISTS chatbot CASCADE;
DROP TABLE IF EXISTS flow CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS broadcast_log CASCADE;
DROP TABLE IF EXISTS broadcast CASCADE;
DROP TABLE IF EXISTS admin CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS instance CASCADE;
DROP TABLE IF EXISTS plan CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS faq CASCADE;
DROP TABLE IF EXISTS page CASCADE;
DROP TABLE IF EXISTS contact_form CASCADE;
DROP TABLE IF EXISTS web_private CASCADE;
DROP TABLE IF EXISTS web_public CASCADE;
DROP TABLE IF EXISTS smtp CASCADE;
DROP TABLE IF EXISTS testimonial CASCADE;

-- ─── admin ───────────────────────────────────────────────────
CREATE TABLE admin (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "email" VARCHAR(999),
  "role" VARCHAR(999) DEFAULT 'admin',
  "password" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin ("id", "uid", "email", "role", "password", "createdAt") VALUES
(1, '5QnEKMP7lbzObMlLJNAxdcIhNb4qYIQBX', 'admin@admin.com', 'admin', '$2b$10$OUmfMxfNYQOw4yGtYWzQV./vpMHKYDXzkn6q2FK58hO8uzYuqdFcq', '2024-05-05 08:46:13');

-- ─── user ────────────────────────────────────────────────────
CREATE TABLE "user" (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "name" VARCHAR(999),
  "email" VARCHAR(999),
  "password" VARCHAR(999),
  "mobile" VARCHAR(999),
  "role" VARCHAR(999) DEFAULT 'user',
  "plan" TEXT DEFAULT '0',
  "plan_expire" VARCHAR(999),
  "trial" INTEGER DEFAULT 0,
  "opened_chat_instance" VARCHAR(999) DEFAULT NULL,
  "token" TEXT DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── instance ────────────────────────────────────────────────
CREATE TABLE instance (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "instance_id" TEXT DEFAULT NULL,
  "title" VARCHAR(999) DEFAULT NULL,
  "qr" TEXT DEFAULT NULL,
  "status" VARCHAR(999) DEFAULT NULL,
  "webhook" VARCHAR(999) DEFAULT NULL,
  "userData" TEXT DEFAULT NULL,
  "jid" VARCHAR(999) DEFAULT NULL,
  "a_status" VARCHAR(999) DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── plan ────────────────────────────────────────────────────
CREATE TABLE plan (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(999) DEFAULT NULL,
  "price" VARCHAR(999) DEFAULT NULL,
  "price_crosed" VARCHAR(999) DEFAULT NULL,
  "days" VARCHAR(999) DEFAULT NULL,
  "des" TEXT DEFAULT NULL,
  "phonebook_contact_limit" VARCHAR(999) DEFAULT NULL,
  "allow_chat_tags" INTEGER DEFAULT 1,
  "allow_chat_note" INTEGER DEFAULT 1,
  "chatbot" INTEGER DEFAULT 1,
  "api_access" INTEGER DEFAULT 1,
  "wa_account" VARCHAR(999) DEFAULT NULL,
  "wa_warmer" INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO plan (id, title, price, price_crosed, days, des, phonebook_contact_limit, allow_chat_tags, allow_chat_note, chatbot, api_access, wa_account, wa_warmer) VALUES
(5, 'Everything', '39', '3999', '39', 'this plan has everything', '399', 1, 1, 1, 1, '10', 1),
(6, 'Trial', '0', '0', '10', 'This is a trial plan', '999', 1, 1, 1, 1, '99', 1),
(7, 'Basic', '19', '99', '30', 'this is a basic plan', '99', 1, 1, 1, 1, '1', 1);
SELECT setval('plan_id_seq', (SELECT MAX(id) FROM plan));

-- ─── broadcast ───────────────────────────────────────────────
CREATE TABLE broadcast (
  "id" SERIAL PRIMARY KEY,
  "broadcast_id" VARCHAR(999),
  "uid" VARCHAR(999),
  "title" VARCHAR(999),
  "templet" TEXT,
  "phonebook" VARCHAR(999),
  "status" VARCHAR(999),
  "schedule" TIMESTAMP,
  "timezone" VARCHAR(999),
  "instance_id" TEXT,
  "delay_from" VARCHAR(999),
  "delay_to" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── broadcast_log ───────────────────────────────────────────
CREATE TABLE broadcast_log (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "broadcast_id" VARCHAR(999),
  "templet_name" VARCHAR(999),
  "is_read" INTEGER DEFAULT 0,
  "msg_id" VARCHAR(999),
  "send_to" VARCHAR(999),
  "delivery_status" VARCHAR(999) DEFAULT 'PENDING',
  "delivery_time" VARCHAR(999),
  "err" TEXT,
  "contact" TEXT,
  "instance_id" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── chatbot ─────────────────────────────────────────────────
CREATE TABLE chatbot (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "title" VARCHAR(999),
  "for_all" INTEGER DEFAULT 1,
  "prevent_book_id" VARCHAR(999),
  "flow" VARCHAR(999),
  "active" INTEGER DEFAULT 1,
  "instance_id" VARCHAR(999),
  "group_reply" INTEGER DEFAULT 0,
  "prevent_reply" TEXT DEFAULT NULL,
  "ai_chatbot" INTEGER DEFAULT 0,
  "ai_bot" TEXT DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── chats (legacy columns + new migration columns) ─────────
-- NOTE: migration_001_history_engine.sql will DROP and recreate
-- this table with the optimized schema. These legacy columns
-- exist for compatibility with functions/x.js code path.
CREATE TABLE chats (
  "id" SERIAL PRIMARY KEY,
  "chat_id" TEXT,
  "uid" VARCHAR(999),
  "last_message_came" TEXT,
  "chat_note" TEXT,
  "chat_tags" TEXT,
  "sender_name" VARCHAR(999),
  "sender_mobile" VARCHAR(999),
  "sender_jid" VARCHAR(999),
  "chat_status" VARCHAR(999) DEFAULT 'open',
  "is_opened" INTEGER DEFAULT 0,
  "last_message" TEXT,
  "instance_id" TEXT,
  "profile_image" VARCHAR(999),
  "group_data" TEXT,
  "can_reply" INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── contact ─────────────────────────────────────────────────
CREATE TABLE contact (
  "id" SERIAL PRIMARY KEY,
  "phonebook_id" VARCHAR(999),
  "uid" VARCHAR(999),
  "name" VARCHAR(999),
  "mobile" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── contact_form ────────────────────────────────────────────
CREATE TABLE contact_form (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(999),
  "name" VARCHAR(999),
  "mobile" VARCHAR(999),
  "content" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── faq ─────────────────────────────────────────────────────
CREATE TABLE faq (
  "id" SERIAL PRIMARY KEY,
  "question" TEXT,
  "answer" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── flow ────────────────────────────────────────────────────
CREATE TABLE flow (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "flow_id" VARCHAR(999),
  "title" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── messages (legacy — overridden by migration) ─────────────
CREATE TABLE messages (
  "id" SERIAL PRIMARY KEY,
  "chat_id" TEXT,
  "uid" VARCHAR(999),
  "msg_id" TEXT,
  "timestamp" VARCHAR(999),
  "sender_name" VARCHAR(999),
  "sender_mobile" VARCHAR(999),
  "sender_jid" VARCHAR(999),
  "type" VARCHAR(999),
  "msg_context" TEXT,
  "reaction" TEXT,
  "star" INTEGER DEFAULT 0,
  "route" VARCHAR(999) DEFAULT 'incoming',
  "context" TEXT,
  "status" VARCHAR(999) DEFAULT 'sent',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── orders ──────────────────────────────────────────────────
CREATE TABLE orders (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "payment_mode" VARCHAR(999),
  "amount" VARCHAR(999),
  "data" TEXT,
  "s_token" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── page ────────────────────────────────────────────────────
CREATE TABLE page (
  "id" SERIAL PRIMARY KEY,
  "slug" VARCHAR(999),
  "title" VARCHAR(999),
  "image" TEXT,
  "content" TEXT,
  "permanent" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── partners ────────────────────────────────────────────────
CREATE TABLE partners (
  "id" SERIAL PRIMARY KEY,
  "filename" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── phonebook ───────────────────────────────────────────────
CREATE TABLE phonebook (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(999),
  "uid" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── rooms ───────────────────────────────────────────────────
CREATE TABLE rooms (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "socket_id" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── smtp ────────────────────────────────────────────────────
CREATE TABLE smtp (
  "id" SERIAL PRIMARY KEY,
  "host" VARCHAR(999),
  "port" VARCHAR(999),
  "email" VARCHAR(999),
  "password" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── testimonial ─────────────────────────────────────────────
CREATE TABLE testimonial (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(999),
  "description" TEXT,
  "reviewer_name" VARCHAR(999),
  "reviewer_position" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── warmer_script ───────────────────────────────────────────
CREATE TABLE warmer_script (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "message" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── warmers ─────────────────────────────────────────────────
CREATE TABLE warmers (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "delay_from" VARCHAR(999),
  "delay_to" VARCHAR(999),
  "is_active" INTEGER DEFAULT 0,
  "instances" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── web_private ─────────────────────────────────────────────
CREATE TABLE web_private (
  "id" SERIAL PRIMARY KEY,
  "pay_offline_id" VARCHAR(999),
  "pay_offline_key" TEXT,
  "offline_active" INTEGER DEFAULT 0,
  "pay_stripe_id" VARCHAR(999),
  "pay_stripe_key" TEXT,
  "stripe_active" INTEGER DEFAULT 0,
  "pay_paystack_id" VARCHAR(999),
  "pay_paystack_key" TEXT,
  "paystack_active" INTEGER DEFAULT 0,
  "rz_active" INTEGER DEFAULT 0,
  "rz_id" VARCHAR(999),
  "rz_key" TEXT,
  "zarnipal" VARCHAR(999),
  "zarnipal_active" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── web_public ──────────────────────────────────────────────
CREATE TABLE web_public (
  "id" SERIAL PRIMARY KEY,
  "logo" TEXT,
  "app_name" VARCHAR(999),
  "custom_home" TEXT,
  "is_custom_home" INTEGER DEFAULT 0,
  "meta_description" TEXT,
  "currency_code" VARCHAR(999) DEFAULT 'USD',
  "currency_symbol" VARCHAR(999) DEFAULT NULL,
  "home_page_tutorial" TEXT DEFAULT NULL,
  "chatbot_screen_tutorial" TEXT DEFAULT NULL,
  "broadcast_screen_tutorial" TEXT DEFAULT NULL,
  "login_header_footer" TEXT DEFAULT NULL,
  "welcome_email_html" TEXT DEFAULT NULL,
  "auto_trial_active" INTEGER DEFAULT 0,
  "exchange_rate" VARCHAR(999) DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── templet ─────────────────────────────────────────────────
CREATE TABLE templet (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "title" VARCHAR(999) DEFAULT NULL,
  "type" VARCHAR(999) DEFAULT NULL,
  "content" TEXT DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── poll_votes ──────────────────────────────────────────────
CREATE TABLE poll_votes (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "msg_id" VARCHAR(999) DEFAULT NULL,
  "vote_option" VARCHAR(999) DEFAULT NULL,
  "voter" VARCHAR(999) DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── chat_tag ────────────────────────────────────────────────
CREATE TABLE chat_tag (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "chat_id" TEXT DEFAULT NULL,
  "tag" VARCHAR(999) DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── chat_note ───────────────────────────────────────────────
CREATE TABLE chat_note (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "chat_id" TEXT DEFAULT NULL,
  "note" TEXT DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── chat_pinned ─────────────────────────────────────────────
CREATE TABLE chat_pinned (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "instance_id" TEXT,
  "chat_id" TEXT,
  "sender_jid" TEXT,
  "display_name" TEXT,
  "position" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_pinned_lookup ON chat_pinned (uid, instance_id);

-- ─── baileys_auth ────────────────────────────────────────────
CREATE TABLE baileys_auth (
  "session_id" TEXT NOT NULL,
  "key_type" TEXT NOT NULL,
  "key_id" TEXT NOT NULL,
  "value" JSONB,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, key_type, key_id)
);
CREATE INDEX IF NOT EXISTS idx_baileys_auth_session ON baileys_auth (session_id);
