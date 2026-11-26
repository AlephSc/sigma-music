export type BookingStatus = 'pending' | 'booked' | 'in_progress' | 'completed' | 'cancelled';

export type DayAvailabilityStatus = 'free' | 'pending' | 'busy' | 'in_progress' | 'closed';

export interface Env {
  DATABASE_URL: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_KEYS?: string;
  GEMINI_API_KEY?: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_FALLBACK_MODEL?: string;
  GEMINI_EMBED_MODEL?: string;
  WA_NUMBER?: string;
  HOME_SERVER_WEBHOOK_URL?: string;
  WEBHOOK_SECRET?: string;
  SYNC_API_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
  AI?: {
    run: (
      model: string,
      input: unknown
    ) => Promise<{
      data?: number[][];
      response?: string;
      choices?: Array<{ message?: { content?: string } }>;
    }>;
  };
}

export interface BookingRow {
  id: string;
  created_at: string;
  updated_at: string;
  event_date: string;
  setup_start: string | null;
  setup_end: string | null;
  package: string;
  items: unknown[];
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  notes: string | null;
  status: BookingStatus;
  source: string;
  total_price: number | null;
  same_date_count?: number;
}

export interface DateBlockRow {
  event_date: string;
  reason: string | null;
  created_at: string;
}

export interface KnowledgeDocRow {
  id: string;
  title: string;
  content: string;
  mime: string;
  status: string;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
  chunk_count?: number;
}

export interface RagChunkRow {
  id: number;
  document_id: string;
  document_title?: string;
  chunk_index: number;
  content: string;
  section: string | null;
  score?: number;
}

export interface ChatMessageRow {
  id: number;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  chunk_ids: number[] | null;
  created_at: string;
}
