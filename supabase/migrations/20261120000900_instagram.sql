-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0009 · Publicación en Instagram (fase 3)
-- Token de Instagram guardado SOLO para el servidor (se renueva solo).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.integration_tokens (
  key          text primary key check (key in ('instagram')),
  token        text not null,
  account_id   text,
  username     text,
  expires_at   timestamptz,
  refreshed_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- Sin políticas y sin permisos para el panel: solo el service role la lee.
alter table public.integration_tokens enable row level security;
revoke all on public.integration_tokens from public, anon, authenticated;
grant all on public.integration_tokens to service_role;

-- Intentos de publicación (para no publicar dos veces y para diagnosticar)
alter table public.content_items add column if not exists publish_attempts integer not null default 0;
alter table public.content_items add column if not exists publish_started_at timestamptz;
