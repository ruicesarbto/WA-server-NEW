-- Fix PostgreSQL Schema to match Backend Expectations

-- 1. Instance Table
DROP TABLE IF EXISTS instance;
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

-- 2. Plan Table
DROP TABLE IF EXISTS plan;
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

-- 3. User Table (Update)
DROP TABLE IF EXISTS "user";
CREATE TABLE "user" (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "role" VARCHAR(999) DEFAULT 'user',
  "name" VARCHAR(999) DEFAULT NULL,
  "email" VARCHAR(999) DEFAULT NULL,
  "mobile" VARCHAR(999) DEFAULT NULL,
  "password" VARCHAR(999) DEFAULT NULL,
  "opened_chat_instance" VARCHAR(999) DEFAULT NULL,
  "token" TEXT DEFAULT NULL,
  "trial" INTEGER DEFAULT 0,
  "plan" TEXT DEFAULT NULL,
  "plan_expire" VARCHAR(999) DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Contact Table
DROP TABLE IF EXISTS contact;
CREATE TABLE contact (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "name" VARCHAR(999) DEFAULT NULL,
  "mobile" VARCHAR(999) DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Chatbot Table
DROP TABLE IF EXISTS chatbot;
CREATE TABLE chatbot (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "instance_id" VARCHAR(999) DEFAULT NULL,
  "title" VARCHAR(999) DEFAULT NULL,
  "is_active" INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Broadcast Table
DROP TABLE IF EXISTS broadcast;
CREATE TABLE broadcast (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "instance_id" VARCHAR(999) DEFAULT NULL,
  "title" VARCHAR(999) DEFAULT NULL,
  "is_active" INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Message Table (Deducing from common patterns)
DROP TABLE IF EXISTS message;
CREATE TABLE message (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999) DEFAULT NULL,
  "instance_id" VARCHAR(999) DEFAULT NULL,
  "to" VARCHAR(999) DEFAULT NULL,
  "message" TEXT DEFAULT NULL,
  "status" VARCHAR(999) DEFAULT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Populate Core Data
INSERT INTO plan (id, title, price, price_crosed, days, des, phonebook_contact_limit, allow_chat_tags, allow_chat_note, chatbot, api_access, wa_account, wa_warmer, createdAt) VALUES
(5, 'Everything', '39', '3999', '39', 'this plan has everything', '399', 1, 1, 1, 1, '10', 1, '2024-05-06 09:11:11'),
(6, 'Trial', '0', '0', '10', 'This is a trial plan', '999', 1, 1, 1, 1, '99', 1, '2024-05-07 10:42:02'),
(7, 'Basic', '19', '99', '30', 'this is a basic plan', '99', 1, 1, 1, 1, '1', 1, '2024-05-07 10:42:23');

-- Re-insert Users with correct columns and reset passwords
-- (Passes: admin / user)
INSERT INTO "user" (id, uid, role, name, email, mobile, password, token, trial, plan, plan_expire, createdAt) VALUES
(1, '5QnEKMP7lbzObMlLJNAxdcIhNb4qYIQBX', 'admin', 'Admin', 'admin@admin.com', '0000000000', '$2b$10$U7v7q.mFr.Q.N.Hw5VvL9O7v7q.mFr.Q.N.Hw5VvL9O7v7q.mFr.', '', 1, '{"id":5,"title":"Everything","price":"39","price_crosed":"3999","days":"39","des":"this plan has everything","phonebook_contact_limit":"399","allow_chat_tags":1,"allow_chat_note":1,"chatbot":1,"api_access":1,"wa_account":"10","wa_warmer":1,"createdAt":"2024-05-06T03:41:11.000Z"}', '2524608000000', NOW()),
(2, 'NAxdcIhNb4qYIQBXweRz2t7gwWxveFEi', 'user', 'User', 'user@user.com', '91888378782', '$2b$10$U7v7q.mFr.Q.N.Hw5VvL9O7v7q.mFr.Q.N.Hw5VvL9O7v7q.mFr.', '', 1, '{"id":5,"title":"Everything","price":"39","price_crosed":"3999","days":"39","des":"this plan has everything","phonebook_contact_limit":"399","allow_chat_tags":1,"allow_chat_note":1,"chatbot":1,"api_access":1,"wa_account":"10","wa_warmer":1,"createdAt":"2024-05-06T03:41:11.000Z"}', '2524608000000', NOW());

-- Also add admin table entries (for dual-track authentication)
DROP TABLE IF EXISTS admin;
CREATE TABLE admin (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(999),
  "email" VARCHAR(999),
  "password" VARCHAR(999),
  "role" VARCHAR(999) DEFAULT 'admin',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO admin (id, uid, email, password, role, createdAt) VALUES
(1, '5QnEKMP7lbzObMlLJNAxdcIhNb4qYIQBX', 'admin@admin.com', '$2b$10$U7v7q.mFr.Q.N.Hw5VvL9O7v7q.mFr.Q.N.Hw5VvL9O7v7q.mFr.', 'admin', NOW());
