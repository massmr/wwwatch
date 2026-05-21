-- Migration 0002 — pipeline tables (editions, articles, raw_items)
-- Run once against production. Idempotent (uses IF NOT EXISTS / DO NOTHING).

-- Une édition = un numéro de journal pour un jour donné.
create table if not exists editions (
  day            date primary key,
  lang           text not null default 'en',
  intro_md       text not null default '',
  status         text not null default 'draft'
    check (status in ('draft', 'published')),
  article_count  integer not null default 0,
  created_at     timestamptz not null default now(),
  published_at   timestamptz
);

create index if not exists editions_status_day_idx on editions (status, day desc);

-- Un article = une page SEO. Rattaché à une édition.
create table if not exists articles (
  id           uuid primary key default gen_random_uuid(),
  day          date not null references editions (day) on delete cascade,
  lang         text not null default 'en',
  slug         text not null,
  title        text not null,
  category     text not null
    check (category in (
      'coding_agent', 'framework', 'infra_api', 'research',
      'tool', 'funding', 'security', 'eval', 'ops'
    )),
  summary      text not null,
  body_md      text not null,
  sources      jsonb not null default '[]',
  fingerprint  text not null,
  score        real not null default 0,
  status       text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at   timestamptz not null default now(),
  unique (day, slug)
);

create index if not exists articles_day_idx on articles (day desc);
create index if not exists articles_category_idx on articles (category);
create index if not exists articles_fingerprint_idx on articles (fingerprint);

-- Items bruts collectés. Gardés ~30j pour audit, scoring, dédup.
create table if not exists raw_items (
  id            text primary key,
  source        text not null,
  title         text not null,
  url           text not null,
  description   text,
  published_at  timestamptz not null,
  upvotes       integer,
  stars         integer,
  comments      integer,
  score         real,
  fingerprint   text not null,
  collected_at  timestamptz not null default now()
);

create index if not exists raw_items_collected_idx on raw_items (collected_at desc);
create index if not exists raw_items_score_idx on raw_items (score desc);
