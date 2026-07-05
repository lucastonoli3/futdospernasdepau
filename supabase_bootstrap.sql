-- ============================================================
--  BALAIO DE GATO FC — BOOTSTRAP COMPLETO DO BANCO
--  Para Supabase novo/vazio. Roda UMA vez no SQL Editor.
--  Cria TODO o schema que o app usa (se já existir, não mexe)
--  + tabelas novas (tesouraria/notícias) + RLS + seed.
--  É idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TABELAS BASE DO APP ----------

-- JOGADORES / SÓCIOS
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text,
  nickname text unique,
  password text,
  photo text,
  position text default 'Linha',
  matches_played integer default 0,
  goals integer default 0,
  assists integer default 0,
  wins integer default 0,
  losses integer default 0,
  best_votes integer default 0,
  worst_votes integer default 0,
  moral_score integer default 100,
  status text default '😐 Normal',
  badges jsonb default '[]'::jsonb,
  high_badges jsonb default '[]'::jsonb,
  thought text,
  debt numeric default 0,
  is_paid boolean default false,
  special_events jsonb default '[]'::jsonb,
  heritage jsonb default '[]'::jsonb,
  invited_by text,
  is_admin boolean default false,
  member_since date,
  ai_dossier text,
  last_ai_update timestamptz,
  created_at timestamptz default now()
);

-- Garante colunas novas mesmo se a tabela players já existir
alter table public.players add column if not exists member_since date;
alter table public.players add column if not exists ai_dossier text;
alter table public.players add column if not exists last_ai_update timestamptz;
alter table public.players add column if not exists high_badges jsonb default '[]'::jsonb;
alter table public.players add column if not exists special_events jsonb default '[]'::jsonb;
alter table public.players add column if not exists heritage jsonb default '[]'::jsonb;
alter table public.players add column if not exists is_admin boolean default false;
alter table public.players add column if not exists thought text;

-- SESSÃO (linha única id=1)
create table if not exists public.sessions (
  id integer primary key,
  status text default 'resenha',
  players_present jsonb default '[]'::jsonb,
  match_day integer default 1,
  manual_voting_status text default 'auto',
  voting_open boolean default false
);

-- CAIXA GLOBAL (linha única id=1)
create table if not exists public.finances (
  id integer primary key,
  total_balance numeric default 0,
  goals jsonb default '[]'::jsonb
);

-- VOTAÇÃO (1 voto por sócio por rodada)
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  voter_nickname text,
  match_id text,
  best_voted_id text,
  worst_voted_id text,
  created_at timestamptz default now(),
  unique (voter_nickname, match_id)
);

-- FEITOS / RESENHA (humilhações = lances da resenha)
create table if not exists public.humiliations (
  id uuid primary key default gen_random_uuid(),
  performer_id text,
  victim_id text,
  "performerNickname" text,
  "victimNickname" text,
  type text,
  description text,
  status text default 'pending',
  badge_id text,
  created_at timestamptz default now()
);

-- MENSAGENS DA RESENHA (chat) — FK p/ embed players(nickname, photo)
create table if not exists public.resenha_messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  text text,
  created_at timestamptz default now()
);

-- CONFIRMAÇÕES (churras mensal etc.)
create table if not exists public.resenha_confirmations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid,
  month_year text,
  created_at timestamptz default now()
);

-- ---------- TABELAS NOVAS (TESOURARIA / NOTÍCIAS) ----------

create table if not exists public.club_settings (
  id integer primary key default 1,
  pix_key text,
  pix_holder text,
  mensalidade_amount numeric default 100,
  updated_at timestamptz default now(),
  constraint club_settings_singleton check (id = 1)
);

create table if not exists public.mensalidades (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete cascade,
  month_ref text not null,
  status text not null default 'pendente',
  amount numeric default 30,
  method text,
  receipt_url text,
  paid_at timestamptz,
  confirmed_by text,
  created_at timestamptz default now(),
  unique (player_id, month_ref)
);
create index if not exists mensalidades_month_idx on public.mensalidades (month_ref);

create table if not exists public.cashflow (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  description text not null,
  amount numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists cashflow_created_idx on public.cashflow (created_at desc);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image text,
  link text,
  pinned boolean default false,
  author_nickname text,
  created_at timestamptz default now()
);
create index if not exists news_created_idx on public.news (created_at desc);

-- ---------- SEED INICIAL ----------
insert into public.sessions (id, status) values (1, 'resenha') on conflict (id) do nothing;
insert into public.finances (id, total_balance, goals) values (1, 0, '[]'::jsonb) on conflict (id) do nothing;
insert into public.club_settings (id, pix_key, pix_holder, mensalidade_amount)
  values (1, '27999359431', 'Diretoria Balaio de Gato FC', 100)
  on conflict (id) do nothing;
-- Se a linha já existia, garante PIX oficial e migra o valor antigo (30) para R$ 100
update public.club_settings
  set pix_key = coalesce(nullif(pix_key, ''), '27999359431'),
      pix_holder = coalesce(nullif(pix_holder, ''), 'Diretoria Balaio de Gato FC'),
      mensalidade_amount = case when mensalidade_amount is null or mensalidade_amount = 30 then 100 else mensalidade_amount end
  where id = 1;

-- ---------- RLS (app usa a chave anônima → liberar acesso) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'players','sessions','finances','votes','humiliations',
    'resenha_messages','resenha_confirmations',
    'club_settings','mensalidades','cashflow','news'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='bgfc_all') then
      execute format('create policy bgfc_all on public.%I for all using (true) with check (true);', t);
    end if;
  end loop;
end $$;
