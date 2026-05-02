create extension if not exists vector;

create table if not exists user_vector_documents (
  id uuid primary key,
  user_id text not null,
  safe_address text not null,
  namespace text not null,
  document_type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  content_sha256 text not null,
  embedding vector(1536) not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_vector_documents_owner_ns
  on user_vector_documents (user_id, safe_address, namespace);

create index if not exists idx_user_vector_documents_embedding
  on user_vector_documents using hnsw (embedding vector_cosine_ops);

create table if not exists user_rlhf_feedback (
  id uuid primary key,
  user_id text not null,
  safe_address text not null,
  run_id text,
  protocol_slug text,
  feedback_text text not null,
  reward_signal double precision not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists published_cli_sessions (
  session_id text primary key,
  safe_address text not null,
  signer_address text not null,
  rpc_url text not null,
  mode text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  challenge text not null,
  signature text not null,
  verified_owner boolean not null,
  published_at timestamptz not null default now()
);
