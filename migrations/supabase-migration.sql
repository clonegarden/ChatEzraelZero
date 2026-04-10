-- ChatEzraelZero — Supabase Migration
-- Run once in Supabase SQL editor before deploying.
-- All tables use the ezrael_ prefix to share a Supabase project safely.

-- Auth users (replaces in-memory array in auth.js)
create table if not exists ezrael_auth_users (
  id text primary key,
  username text unique not null,
  password text not null, -- SHA-256 hashed
  created_at timestamptz not null default now()
);

-- Recognition profiles (replaces Replit DB user:* keys)
create table if not exists ezrael_recognition_profiles (
  user_id text primary key,
  fingerprints text[] not null default '{}',
  ips text[] not null default '{}',
  ip_prefixes text[] not null default '{}',
  username text,
  visit_count int not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  profile_data jsonb not null default '{}'  -- nome, temperamento, modal_trace, etc.
);

create index if not exists idx_recog_fingerprints on ezrael_recognition_profiles using gin(fingerprints);
create index if not exists idx_recog_ip_prefixes on ezrael_recognition_profiles using gin(ip_prefixes);
create index if not exists idx_recog_username on ezrael_recognition_profiles(username);

-- Behavioral patterns per user
create table if not exists ezrael_behavioral_patterns (
  user_id text primary key references ezrael_recognition_profiles(user_id) on delete cascade,
  patterns text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Sessions
create table if not exists ezrael_sessions (
  id text primary key,
  user_id text references ezrael_recognition_profiles(user_id) on delete set null,
  personality text not null default 'default',
  planetary_hour text,
  emotional_state text,
  seed text,
  history jsonb not null default '[]',
  voice text not null default 'pt-BR-Wavenet-A',
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);

create index if not exists idx_sessions_user_id on ezrael_sessions(user_id);
create index if not exists idx_sessions_last_active on ezrael_sessions(last_active desc);

-- Individual messages — data flywheel for Ezrael's knowledge base
-- noetikos_state is populated after Phase 1 (Interceptor integration)
create table if not exists ezrael_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text references ezrael_sessions(id) on delete cascade,
  user_id text,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  planetary_hour text,
  emotional_state text,
  noetikos_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_session_id on ezrael_messages(session_id);
create index if not exists idx_messages_user_id on ezrael_messages(user_id);
create index if not exists idx_messages_created_at on ezrael_messages(created_at desc);
