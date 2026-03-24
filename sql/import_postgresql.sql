-- PostgreSQL Schema Migration

-- Drop existing tables if they exist (Clean start)
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
DROP TABLE IF EXISTS "instance" CASCADE;
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

-- admin
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

-- broadcast
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

-- broadcast_log
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

-- chatbot
CREATE TABLE chatbot (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "title" VARCHAR(999),
  "for_all" INTEGER DEFAULT 1,
  "prevent_book_id" VARCHAR(999),
  "flow" VARCHAR(999),
  "active" INTEGER DEFAULT 1,
  "instance_id" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- chats
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

-- contact
CREATE TABLE contact (
  "id" SERIAL PRIMARY KEY,
  "phonebook_id" VARCHAR(999),
  "uid" VARCHAR(999),
  "name" VARCHAR(999),
  "mobile" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- contact_form
CREATE TABLE contact_form (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(999),
  "name" VARCHAR(999),
  "mobile" VARCHAR(999),
  "content" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- faq
CREATE TABLE faq (
  "id" SERIAL PRIMARY KEY,
  "question" TEXT,
  "answer" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- flow
CREATE TABLE flow (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "flow_id" VARCHAR(999),
  "title" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- instance
CREATE TABLE instance (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(999),
  "instance_key" TEXT,
  "uid" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- messages
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

-- orders
CREATE TABLE orders (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "payment_mode" VARCHAR(999),
  "amount" VARCHAR(999),
  "data" TEXT,
  "s_token" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- page
CREATE TABLE page (
  "id" SERIAL PRIMARY KEY,
  "slug" VARCHAR(999),
  "title" VARCHAR(999),
  "image" TEXT,
  "content" TEXT,
  "permanent" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- partners
CREATE TABLE partners (
  "id" SERIAL PRIMARY KEY,
  "filename" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- phonebook
CREATE TABLE phonebook (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(999),
  "uid" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- plan
CREATE TABLE plan (
  "id" SERIAL PRIMARY KEY,
  "price" VARCHAR(999),
  "name" VARCHAR(999),
  "instance_limit" VARCHAR(999),
  "chatbot_limit" VARCHAR(999),
  "broadcast_limit" VARCHAR(999),
  "days" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- rooms
CREATE TABLE rooms (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "socket_id" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- smtp
CREATE TABLE smtp (
  "id" SERIAL PRIMARY KEY,
  "host" VARCHAR(999),
  "port" VARCHAR(999),
  "email" VARCHAR(999),
  "password" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- testimonial
CREATE TABLE testimonial (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(999),
  "description" TEXT,
  "reviewer_name" VARCHAR(999),
  "reviewer_position" VARCHAR(999),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- user
CREATE TABLE "user" (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "name" VARCHAR(999),
  "email" VARCHAR(999),
  "password" VARCHAR(999),
  "mobile" VARCHAR(999),
  "role" VARCHAR(999) DEFAULT 'user',
  "plan" VARCHAR(999) DEFAULT '0',
  "plan_expire" VARCHAR(999),
  "trial" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- warmer_script
CREATE TABLE warmer_script (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "message" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- warmers
CREATE TABLE warmers (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "delay_from" VARCHAR(999),
  "delay_to" VARCHAR(999),
  "is_active" INTEGER DEFAULT 0,
  "instances" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- web_private
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

-- web_public
CREATE TABLE web_public (
  "id" SERIAL PRIMARY KEY,
  "logo" TEXT,
  "app_name" VARCHAR(999),
  "custom_home" TEXT,
  "is_custom_home" INTEGER DEFAULT 0,
  "meta_description" TEXT,
  "currency_code" VARCHAR(999) DEFAULT 'USD',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
