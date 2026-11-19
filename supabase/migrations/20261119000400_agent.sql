-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0004 · Agente de contenido (estructura)
-- Las ejecuciones reales las hace el servidor cuando haya un proveedor de IA
-- configurado. Mientras tanto, cada pedido queda registrado como "not_configured".
-- ════════════════════════════════════════════════════════════════════

create type public.agent_task as enum (
  'research_destination',   -- investigar un destino
  'propose_ideas',          -- proponer ideas de publicaciones
  'write_copy',             -- texto comercial
  'travel_tips',            -- consejos de viaje
  'seasonal_recommendations'-- destinos según temporada
);
create type public.agent_run_status as enum ('queued', 'running', 'succeeded', 'failed', 'not_configured');

create table public.agent_runs (
  id            uuid primary key default gen_random_uuid(),
  task          public.agent_task not null,
  status        public.agent_run_status not null default 'queued',
  input         jsonb not null default '{}'::jsonb,
  output        jsonb,
  sources       jsonb not null default '[]'::jsonb,  -- [{url, title, retrieved_at}]
  error         text,
  provider      text,
  requested_by  uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index agent_runs_created_idx on public.agent_runs (created_at desc);

-- Ideas propuestas (por el agente o cargadas a mano), antes de convertirse en contenido.
create table public.content_ideas (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  destination      text,
  angle            text,                 -- enfoque: gastronomía, aventura, lujo…
  suggested_format public.content_format,
  season           text,
  rationale        text,
  topic_key        text,
  sources          jsonb not null default '[]'::jsonb,
  status           text not null default 'proposed'
                    check (status in ('proposed', 'accepted', 'discarded', 'used')),
  origin           public.content_origin not null default 'manual',
  agent_run_id     uuid references public.agent_runs (id) on delete set null,
  content_id       uuid references public.content_items (id) on delete set null,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
create index content_ideas_topic_idx on public.content_ideas (topic_key);

create or replace function public.content_ideas_guard()
returns trigger
language plpgsql
as $$
begin
  if not public.is_server_context() then
    if tg_op = 'INSERT' then
      new.origin := 'manual';
      new.agent_run_id := null;
      new.created_by := auth.uid();
    else
      new.origin := old.origin;
      new.agent_run_id := old.agent_run_id;
      new.created_by := old.created_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger content_ideas_guard before insert or update on public.content_ideas
  for each row execute function public.content_ideas_guard();

-- Temas usados recientemente (para que el agente evite repeticiones).
create or replace function public.recent_topics(p_days integer default 45)
returns table (topic_key text, destination text, last_used timestamptz, uses bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select topic_key, max(destination), max(coalesce(published_at, scheduled_at, created_at)), count(*)
  from public.content_items
  where topic_key is not null
    and status not in ('rejected')
    and coalesce(published_at, scheduled_at, created_at) > now() - make_interval(days => p_days)
  group by topic_key
  order by 3 desc;
$$;

alter table public.agent_runs enable row level security;
alter table public.content_ideas enable row level security;

create policy "agent_runs: lectura del equipo"
  on public.agent_runs for select to authenticated using (public.is_team_member());
-- agent_runs solo lo escribe el servidor.

create policy "content_ideas: lectura del equipo"
  on public.content_ideas for select to authenticated using (public.is_team_member());
create policy "content_ideas: el equipo agrega"
  on public.content_ideas for insert to authenticated with check (public.is_team_member());
create policy "content_ideas: el equipo actualiza"
  on public.content_ideas for update to authenticated
  using (public.is_team_member()) with check (public.is_team_member());
create policy "content_ideas: el equipo borra"
  on public.content_ideas for delete to authenticated using (public.is_team_member());
