-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0003 · Configuración e integraciones
-- ════════════════════════════════════════════════════════════════════

-- ─── Configuración por secciones (clave → JSON) ────────────────────
create table public.app_settings (
  key         text primary key check (key in (
                'brand_identity', 'publishing_frequency', 'content_preferences', 'automations')),
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('brand_identity', jsonb_build_object(
     'brand_name', 'AVORA TRAVEL',
     'tagline', '',
     'tone', 'Elegante, cálido y cercano. Inspirador sin exagerar.',
     'voice_rules', jsonb_build_array(
        'Hablar de vos a la audiencia (español rioplatense).',
        'No usar precios sin una fuente verificable.',
        'Evitar superlativos vacíos y clichés de viaje.'),
     'banned_words', jsonb_build_array(),
     'default_hashtags', jsonb_build_array('AvoraTravel'),
     'palette', jsonb_build_object('cream', '#F6F0E6', 'brown', '#3B2A20', 'champagne', '#D8BF8A', 'gold', '#B8955A'))),
  ('publishing_frequency', jsonb_build_object(
     'timezone', 'America/Argentina/Buenos_Aires',
     'per_week', jsonb_build_object('post_portrait', 3, 'post_square', 0, 'carousel', 1, 'story', 5, 'reel', 2),
     'preferred_times', jsonb_build_array('09:30', '13:00', '19:30'))),
  ('content_preferences', jsonb_build_object(
     'focus_destinations', jsonb_build_array(),
     'excluded_destinations', jsonb_build_array(),
     'content_pillars', jsonb_build_array('Destinos', 'Consejos de viaje', 'Experiencias', 'Temporadas'),
     'audience', '',
     'avoid_repeat_days', 45)),
  ('automations', jsonb_build_object(
     'auto_publish_enabled', false,
     'agent_auto_proposals', false,
     'agent_proposals_per_week', 0));

create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ─── Integraciones: estado real, escrito solo por el servidor ──────
create type public.integration_status as enum (
  'not_configured', 'credentials_present', 'connected', 'error', 'disabled');

create table public.integrations (
  key              text primary key check (key in (
                     'ai_text', 'ai_image', 'ai_video', 'instagram', 'n8n', 'travel_providers')),
  status           public.integration_status not null default 'not_configured',
  provider         text,
  last_checked_at  timestamptz,
  last_error       text,
  details          jsonb not null default '{}'::jsonb,   -- nunca contiene secretos
  updated_at       timestamptz not null default now()
);

insert into public.integrations (key) values
  ('ai_text'), ('ai_image'), ('ai_video'), ('instagram'), ('n8n'), ('travel_providers');

create trigger integrations_touch before update on public.integrations
  for each row execute function public.touch_updated_at();

alter table public.integrations enable row level security;
create policy "integrations: lectura del equipo"
  on public.integrations for select to authenticated using (public.is_team_member());
-- Sin políticas de escritura: solo el service role (funciones de servidor) puede modificarla.

-- ─── Guardas de configuración ──────────────────────────────────────
create or replace function public.app_settings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ig public.integration_status;
begin
  if not public.is_server_context() then
    new.updated_by := auth.uid();
  end if;

  if new.key = 'automations' and coalesce((new.value ->> 'auto_publish_enabled')::boolean, false) then
    select status into v_ig from public.integrations where key = 'instagram';
    if v_ig is distinct from 'connected' then
      raise exception 'La publicación automática no puede activarse hasta que Instagram esté conectado y verificado'
        using errcode = '23514';
    end if;
  end if;

  if new.key = 'automations' and coalesce((new.value ->> 'agent_auto_proposals')::boolean, false) then
    if (select status from public.integrations where key = 'ai_text') is distinct from 'connected' then
      raise exception 'Las propuestas automáticas del agente requieren la IA de texto conectada'
        using errcode = '23514';
    end if;
  end if;

  perform public.log_activity('settings.updated', 'settings', new.key,
    format('Actualizó la configuración "%s"', new.key));
  return new;
end;
$$;

create trigger app_settings_guard before update on public.app_settings
  for each row execute function public.app_settings_guard();

-- Si Instagram deja de estar conectado, la publicación automática se apaga sola.
create or replace function public.integrations_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_activity('integration.status', 'integration', new.key,
      format('%s: %s → %s', new.key, old.status, new.status),
      jsonb_build_object('error', new.last_error),
      case when new.status = 'error' then 'error'::public.log_level else 'info'::public.log_level end);
  end if;
  if new.key = 'instagram' and new.status <> 'connected' then
    update public.app_settings
      set value = jsonb_set(value, '{auto_publish_enabled}', 'false'::jsonb)
      where key = 'automations' and coalesce((value ->> 'auto_publish_enabled')::boolean, false);
  end if;
  if new.key = 'ai_text' and new.status <> 'connected' then
    update public.app_settings
      set value = jsonb_set(value, '{agent_auto_proposals}', 'false'::jsonb)
      where key = 'automations' and coalesce((value ->> 'agent_auto_proposals')::boolean, false);
  end if;
  return new;
end;
$$;

create trigger integrations_after_update after update on public.integrations
  for each row execute function public.integrations_after_update();

alter table public.app_settings enable row level security;
create policy "app_settings: lectura del equipo"
  on public.app_settings for select to authenticated using (public.is_team_member());
create policy "app_settings: solo admin modifica"
  on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
