create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active'
    check (status in ('active', 'unsubscribed', 'bounced')),
  source text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists subscribers_status_idx
  on public.subscribers(status);

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  subject text not null,
  markdown text not null,
  recipient_count int not null default 0
);

