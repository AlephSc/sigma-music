-- Sigma Music Platform v2 — Initial Schema (Neon Postgres + pgvector)
-- Supports: Bookings, Manual Date Blocks, RAG Knowledge Base, Chat Logs, Settings

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM (
      'pending',
      'booked',
      'in_progress',
      'completed',
      'cancelled'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_date date NOT NULL,
  setup_start time,
  setup_end time,
  package text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  notes text,
  status booking_status NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'web',
  total_price numeric
);

CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON bookings (event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- Manual date blocks (P1: admin marks a date as closed/full for maintenance or holiday)
CREATE TABLE IF NOT EXISTS date_blocks (
  event_date date PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Knowledge documents for AI RAG (P0/P1)
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  mime text NOT NULL DEFAULT 'text/markdown',
  status text NOT NULL DEFAULT 'indexed',
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chunked & embedded knowledge for hybrid search (tsvector + pgvector)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  embedding vector(768),
  section text,
  content_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv ON rag_chunks USING gin (tsv);

-- Chat sessions & messages (audit trail + session context)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now(),
  turn_count int NOT NULL DEFAULT 0,
  ip_hash text
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL,
  chunk_ids bigint[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id, created_at);

-- Application settings
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_knowledge_docs_updated_at ON knowledge_docs;
CREATE TRIGGER trg_knowledge_docs_updated_at
  BEFORE UPDATE ON knowledge_docs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
