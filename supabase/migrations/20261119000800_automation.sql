-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0008 · Automatización (fase 2)
-- Planificación semanal del agente, banco de fotos real (Pexels) y fuentes
-- por contenido. Todo lo que genera el agente queda pendiente de aprobación.
-- ════════════════════════════════════════════════════════════════════

alter type public.agent_task add value if not exists 'plan_week';

-- Banco de fotos y videos
alter table public.integrations drop constraint if exists integrations_key_check;
alter table public.integrations add constraint integrations_key_check check (key in (
  'ai_text', 'ai_image', 'ai_video', 'stock_media', 'instagram', 'n8n', 'travel_providers'));
insert into public.integrations (key) values ('stock_media') on conflict (key) do nothing;

-- Material de banco con crédito al autor
alter table public.content_assets drop constraint if exists content_assets_source_check;
alter table public.content_assets add constraint content_assets_source_check
  check (source in ('upload', 'ai', 'stock'));
alter table public.content_assets add column if not exists credit jsonb;  -- {provider, provider_id, author, author_url, page_url}

-- Fuentes consultadas y ejecución del agente que generó el contenido
alter table public.content_items add column if not exists sources jsonb not null default '[]'::jsonb;
alter table public.content_items add column if not exists agent_run_id uuid references public.agent_runs (id) on delete set null;

-- Desde el panel no se pueden falsear el crédito ni el origen del material.
create or replace function public.content_assets_protect_origin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_server_context() then
    if tg_op = 'INSERT' then
      new.source := 'upload';
      new.credit := null;
    else
      new.source := old.source;
      new.credit := old.credit;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.content_assets_protect_origin() from public, anon, authenticated;

drop trigger if exists content_assets_protect_origin on public.content_assets;
create trigger content_assets_protect_origin before insert or update on public.content_assets
  for each row execute function public.content_assets_protect_origin();

-- Lo mismo para las columnas del agente en el contenido.
create or replace function public.content_items_protect_agent_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_server_context() then
    if tg_op = 'INSERT' then
      new.agent_run_id := null;
    else
      new.agent_run_id := old.agent_run_id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.content_items_protect_agent_fields() from public, anon, authenticated;

drop trigger if exists content_items_protect_agent_fields on public.content_items;
create trigger content_items_protect_agent_fields before insert or update on public.content_items
  for each row execute function public.content_items_protect_agent_fields();
