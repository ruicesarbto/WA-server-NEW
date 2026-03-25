-- ============================================================================
-- Migration 001: History Ingestion Engine — Cold Start Tables
-- Motor de Recebimento de Mensagens — Etapa 1
-- ============================================================================
-- IMPORTANTE: Todas as colunas em lowercase conforme diretriz obrigatória.
-- Projetado para suportar:
--   - Cold Start: messaging-history.set (~50k msgs, ~500 contatos)
--   - Hot Path (Etapa 2): Redis + BullMQ para mensagens em tempo real
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABELA: chats
-- ============================================================================
-- Representa uma conversa (1:1 ou grupo) vinculada a uma instância WhatsApp.
-- O índice principal (instance_id, last_message_at DESC) serve a Inbox query.
-- ============================================================================

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;

CREATE TABLE chats (
    -- PK sintética para JOINs internos (não exposta na API)
    id              BIGSERIAL       PRIMARY KEY,

    -- Identificadores de negócio
    chat_id         TEXT            NOT NULL,       -- jid do chat (ex: 5511...@s.whatsapp.net ou ...@g.us)
    instance_id     TEXT            NOT NULL,       -- sessão Baileys que originou
    uid             VARCHAR(64)     NOT NULL,       -- owner/user id

    -- Dados do remetente/chat
    sender_name     TEXT,
    sender_jid      TEXT,
    profile_image   TEXT,
    group_metadata  JSONB,                          -- metadata de grupo (participantes, subject, etc.)

    -- Estado da conversa
    chat_status     VARCHAR(20)     NOT NULL DEFAULT 'open',    -- open | archived | closed
    is_pinned       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_muted        BOOLEAN         NOT NULL DEFAULT FALSE,
    is_read         BOOLEAN         NOT NULL DEFAULT TRUE,
    unread_count    INTEGER         NOT NULL DEFAULT 0,

    -- Snapshot da última mensagem (desnormalizado para Inbox query sem JOIN)
    last_message    TEXT,
    last_message_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_message_type VARCHAR(32),

    -- Metadados operacionais
    chat_note       TEXT,
    chat_tags       TEXT[],                         -- array nativo PG, filtragem por tag

    -- Controle de resposta (janela de 24h do WhatsApp)
    can_reply       BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraint de unicidade: um chat por instância
    CONSTRAINT uq_chats_instance_chat UNIQUE (instance_id, chat_id)
);

-- Índice principal da Inbox: lista chats de uma instância ordenados pela última mensagem
CREATE INDEX idx_chats_inbox
    ON chats (instance_id, last_message_at DESC);

-- Filtro por status (open/archived) na Inbox
CREATE INDEX idx_chats_inbox_status
    ON chats (instance_id, chat_status, last_message_at DESC);

-- Busca por uid (admin vê todos os chats de um user)
CREATE INDEX idx_chats_uid
    ON chats (uid);

-- Lookup direto por chat_id (usado no Hot Path para upsert rápido)
CREATE INDEX idx_chats_chat_id
    ON chats (chat_id);


-- ============================================================================
-- 2. TABELA: messages
-- ============================================================================
-- Armazena cada mensagem individual.
-- Particionamento por range de timestamp pode ser adicionado na Etapa 3.
-- ============================================================================

CREATE TABLE messages (
    -- PK sintética
    id              BIGSERIAL       PRIMARY KEY,

    -- Identificadores
    msg_id          TEXT            NOT NULL,       -- ID único da mensagem (Baileys key.id)
    chat_id         TEXT            NOT NULL,       -- jid do chat (FK lógica, sem constraint para throughput)
    instance_id     TEXT            NOT NULL,       -- sessão Baileys
    uid             VARCHAR(64)     NOT NULL,       -- owner/user id

    -- Dados do remetente
    sender_jid      TEXT,
    sender_name     TEXT,
    from_me         BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Conteúdo
    msg_type        VARCHAR(32)     NOT NULL DEFAULT 'text',  -- text | image | video | audio | document | sticker | poll | reaction | ...
    msg_body        TEXT,                           -- texto ou caption
    msg_data        JSONB,                          -- payload completo para tipos complexos (poll, buttons, etc.)
    media_url       TEXT,                           -- URL do arquivo de mídia (após download)

    -- Threading / Reply
    quoted_msg_id   TEXT,                           -- msg_id da mensagem citada
    quoted_sender   TEXT,

    -- Status de entrega
    status          VARCHAR(16)     NOT NULL DEFAULT 'sent',   -- sent | delivered | read | played | error
    route           VARCHAR(10)     NOT NULL DEFAULT 'incoming', -- incoming | outgoing

    -- Reações e marcações
    reaction        TEXT,
    is_starred      BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Timestamp da mensagem (epoch do WhatsApp, convertido)
    message_timestamp TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- Timestamps de controle
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Dedup: uma mensagem por instância
    CONSTRAINT uq_messages_instance_msg UNIQUE (instance_id, msg_id)
);

-- Paginação de mensagens dentro de um chat (query principal do chat aberto)
CREATE INDEX idx_messages_chat_timeline
    ON messages (instance_id, chat_id, message_timestamp DESC);

-- Lookup por msg_id (para updates de status, reações, quotes)
CREATE INDEX idx_messages_msg_id
    ON messages (instance_id, msg_id);

-- Filtro por uid
CREATE INDEX idx_messages_uid
    ON messages (uid);

-- Filtro por tipo (útil para busca de mídia)
CREATE INDEX idx_messages_type
    ON messages (instance_id, chat_id, msg_type)
    WHERE msg_type != 'text';

COMMIT;
