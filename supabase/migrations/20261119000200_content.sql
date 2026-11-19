-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0002 · Contenido, material visual y flujo de aprobación
-- ════════════════════════════════════════════════════════════════════

create type public.content_format as enum ('post_portrait', 'post_square', 'story', 'reel', 'carousel');
create type public.content_status as enum (
  'draft', 'generating', 'pending_approval', 'approved', 'scheduled',
  'publishing', 'published', 'error', 'rejected'
);
create type public.content_origin as enum ('manual', 'agent');
create type public.workflow_actor as enum ('team', 'admin', 'server');

-- ─── Tabla de transiciones permitidas (fuente de verdad del flujo) ──
-- Mantener sincronizada con shared/workflow.ts
create table public.workflow_transitions (
  from_status  public.content_status not null,
  to_status    public.content_status not null,
  actor        public.workflow_actor not null,
  action       text not null,
  primary key (from_status, to_status)
);

insert into public.workflow_transitions (from_status, to_status, actor, action) values
  ('draft',            'pending_approval', 'team',   'submit'),
  ('draft',            'generating',       'server', 'start_generation'),
  ('generating',       'pending_approval', 'server', 'finish_generation'),
  ('generating',       'draft',            'server', 'back_to_draft'),
  ('generating',       'error',            'server', 'mark_error'),
  ('pending_approval', 'approved',         'admin',  'approve'),
  ('pending_approval', 'rejected',         'admin',  'reject'),
  ('pending_approval', 'draft',            'team',   'back_to_draft'),
  ('approved',         'scheduled',        'team',   'schedule'),
  ('approved',         'draft',            'team',   'back_to_draft'),
  ('approved',         'pending_approval', 'team',   'request_reapproval'),
  ('scheduled',        'approved',         'team',   'cancel_schedule'),
  ('scheduled',        'pending_approval', 'team',   'request_reapproval'),
  ('scheduled',        'publishing',       'server', 'start_publishing'),
  ('publishing',       'published',        'server', 'mark_published'),
  ('publishing',       'error',            'server', 'mark_error'),
  ('error',            'draft',            'team',   'back_to_draft'),
  ('error',            'pending_approval', 'team',   'submit'),
  ('rejected',         'draft',            'team',   'reopen');

alter table public.workflow_transitions enable row level security;
create policy "workflow_transitions: lectura del equipo"
  on public.workflow_transitions for select to authenticated using (public.is_team_member());

-- ─── Contenido ─────────────────────────────────────────────────────
create table public.content_items (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (length(btrim(title)) between 1 and 200),
  caption             text not null default '' check (length(caption) <= 2200),
  hashtags            text[] not null default '{}' check (cardinality(hashtags) <= 30),
  format              public.content_format not null,
  status              public.content_status not null default 'draft',
  origin              public.content_origin not null default 'manual',
  destination         text,
  topic_key           text,           -- clave normalizada de tema, para evitar repeticiones
  notes               text,
  scheduled_at        timestamptz,    -- fecha prevista / programada
  published_at        timestamptz,
  -- Precios: solo con fuente verificable
  includes_price      boolean not null default false,
  price_source_url    text,
  price_source_note   text,
  -- Aprobación
  approved_by         uuid references auth.users (id) on delete set null,
  approved_at         timestamptz,
  rejection_reason    text,
  -- Publicación
  error_message       text,
  instagram_media_id  text,
  created_by          uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint price_requires_verifiable_source
    check (not includes_price or coalesce(price_source_url, '') ~* '^https?://[^\s]+\.[^\s]+'),
  constraint approved_states_require_approval
    check (status not in ('approved', 'scheduled', 'publishing', 'published') or approved_at is not null),
  constraint scheduled_requires_date
    check (status not in ('scheduled', 'publishing') or scheduled_at is not null),
  constraint rejected_requires_reason
    check (status <> 'rejected' or length(btrim(coalesce(rejection_reason, ''))) > 0)
);

create index content_items_status_idx on public.content_items (status);
create index content_items_scheduled_idx on public.content_items (scheduled_at);
create index content_items_topic_idx on public.content_items (topic_key);
create index content_items_updated_idx on public.content_items (updated_at desc);

-- ─── Material visual (archivos en Storage) ─────────────────────────
create table public.content_assets (
  id                uuid primary key default gen_random_uuid(),
  content_id        uuid not null references public.content_items (id) on delete cascade,
  storage_path      text not null unique,
  mime_type         text not null check (mime_type ~ '^(image|video)/'),
  width             integer check (width > 0),
  height            integer check (height > 0),
  duration_seconds  numeric(8,2),
  position          integer not null default 0,
  alt_text          text,
  source            text not null default 'upload' check (source in ('upload', 'ai')),
  created_by        uuid references auth.users (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);
create index content_assets_content_idx on public.content_assets (content_id, position);

-- ─── Historial del flujo (línea de tiempo por contenido) ───────────
create table public.content_events (
  id           bigint generated always as identity primary key,
  content_id   uuid not null references public.content_items (id) on delete cascade,
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null,
  from_status  public.content_status,
  to_status    public.content_status,
  comment      text,
  created_at   timestamptz not null default now()
);
create index content_events_content_idx on public.content_events (content_id, created_at desc);

-- Etiquetas en español para mensajes del registro
create or replace function public.status_label(s public.content_status)
returns text
language sql
immutable
as $$
  select case s
    when 'draft' then 'Borrador'
    when 'generating' then 'Generando'
    when 'pending_approval' then 'Pendiente de aprobación'
    when 'approved' then 'Aprobado'
    when 'scheduled' then 'Programado'
    when 'publishing' then 'Publicando'
    when 'published' then 'Publicado'
    when 'error' then 'Error'
    when 'rejected' then 'Rechazado'
  end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- Reglas del flujo (se aplican siempre, sin importar desde dónde llegue el cambio)
-- ════════════════════════════════════════════════════════════════════

create or replace function public.content_items_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_server_context() then
    return new;
  end if;
  -- Desde el panel solo se crean borradores o pendientes de aprobación.
  if new.status not in ('draft', 'pending_approval') then
    raise exception 'Un contenido nuevo solo puede crearse como borrador o pendiente de aprobación'
      using errcode = '42501';
  end if;
  new.origin := 'manual';
  new.created_by := auth.uid();
  new.updated_by := auth.uid();
  new.approved_by := null;
  new.approved_at := null;
  new.published_at := null;
  new.instagram_media_id := null;
  new.error_message := null;
  new.rejection_reason := null;
  return new;
end;
$$;

create trigger content_items_before_insert
  before insert on public.content_items
  for each row execute function public.content_items_before_insert();

create or replace function public.content_items_enforce_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_server   boolean := public.is_server_context();
  v_role     public.app_role := public.current_app_role();
  v_rule     public.workflow_transitions%rowtype;
  v_content_changed boolean;
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  if v_server then
    if new.status is distinct from old.status then
      select * into v_rule from public.workflow_transitions
        where from_status = old.status and to_status = new.status;
      if not found then
        raise exception 'Transición no permitida: % → %', old.status, new.status using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if v_role is null then
    raise exception 'Sin acceso al panel' using errcode = '42501';
  end if;

  -- Campos que solo el servidor o el flujo de aprobación pueden escribir
  new.origin := old.origin;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.published_at := old.published_at;
  new.instagram_media_id := old.instagram_media_id;
  new.error_message := old.error_message;
  new.approved_by := old.approved_by;
  new.approved_at := old.approved_at;

  if old.status in ('generating', 'publishing', 'published') then
    raise exception 'El contenido en estado "%" no puede modificarse desde el panel', old.status
      using errcode = '42501';
  end if;

  v_content_changed :=
       new.title is distinct from old.title
    or new.caption is distinct from old.caption
    or new.hashtags is distinct from old.hashtags
    or new.format is distinct from old.format
    or new.destination is distinct from old.destination
    or new.includes_price is distinct from old.includes_price
    or new.price_source_url is distinct from old.price_source_url;

  -- Editar algo aprobado o programado exige una nueva aprobación.
  if v_content_changed and old.status in ('approved', 'scheduled') and new.status = old.status then
    new.status := 'pending_approval';
    perform set_config('avora.reapproval_cause', 'edit', true);
  end if;

  if new.status is distinct from old.status then
    select * into v_rule from public.workflow_transitions
      where from_status = old.status and to_status = new.status;
    if not found or v_rule.actor = 'server' or (v_rule.actor = 'admin' and v_role <> 'admin') then
      raise exception 'Transición no permitida para tu rol: % → %', old.status, new.status
        using errcode = '42501';
    end if;

    case new.status
      when 'approved' then
        if old.status = 'pending_approval' then
          new.approved_by := auth.uid();
          new.approved_at := now();
        end if;
        new.rejection_reason := null;
      when 'scheduled' then
        if new.scheduled_at is null or new.scheduled_at <= now() then
          raise exception 'Para programar hace falta una fecha futura' using errcode = '23514';
        end if;
      when 'rejected' then
        null; -- el motivo lo exige el constraint rejected_requires_reason
      else
        null;
    end case;

    if new.status in ('draft', 'pending_approval', 'rejected') then
      new.approved_by := null;
      new.approved_at := null;
    end if;
    if new.status in ('draft', 'pending_approval') then
      new.rejection_reason := null;
      new.error_message := null;
    end if;
  elsif new.status = 'scheduled' and new.scheduled_at is distinct from old.scheduled_at then
    -- Reprogramación: se mantiene la aprobación, la fecha debe ser futura.
    if new.scheduled_at is null or new.scheduled_at <= now() then
      raise exception 'La nueva fecha debe ser futura' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger content_items_enforce_workflow
  before update on public.content_items
  for each row execute function public.content_items_enforce_workflow();

-- Historial + registro de actividad
create or replace function public.content_items_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_comment text;
begin
  if tg_op = 'INSERT' then
    insert into public.content_events (content_id, actor_id, action, from_status, to_status)
      values (new.id, auth.uid(), 'created', null, new.status);
    perform public.log_activity('content.created', 'content', new.id::text,
      format('Creó "%s"', new.title), jsonb_build_object('format', new.format, 'status', new.status));
    return new;
  end if;

  if new.status is distinct from old.status then
    select action into v_action from public.workflow_transitions
      where from_status = old.status and to_status = new.status;
    if v_action = 'request_reapproval' and current_setting('avora.reapproval_cause', true) = 'edit' then
      v_action := 'edited_requires_reapproval';
      perform set_config('avora.reapproval_cause', '', true);
    end if;
    v_comment := case when new.status = 'rejected' then new.rejection_reason
                      when new.status = 'error' then new.error_message end;
    insert into public.content_events (content_id, actor_id, action, from_status, to_status, comment)
      values (new.id, auth.uid(), coalesce(v_action, 'status_changed'), old.status, new.status, v_comment);
    perform public.log_activity('content.' || coalesce(v_action, 'status_changed'), 'content', new.id::text,
      format('"%s": %s → %s', new.title, public.status_label(old.status), public.status_label(new.status)),
      jsonb_build_object('from', old.status, 'to', new.status, 'comment', v_comment),
      case when new.status = 'error' then 'error'::public.log_level else 'info'::public.log_level end);
  elsif new.scheduled_at is distinct from old.scheduled_at and new.status = 'scheduled' then
    insert into public.content_events (content_id, actor_id, action, from_status, to_status, comment)
      values (new.id, auth.uid(), 'rescheduled', old.status, new.status,
              to_char(new.scheduled_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'));
    perform public.log_activity('content.rescheduled', 'content', new.id::text,
      format('Reprogramó "%s"', new.title),
      jsonb_build_object('from', old.scheduled_at, 'to', new.scheduled_at));
  elsif row(new.title, new.caption, new.hashtags, new.format, new.destination, new.notes, new.scheduled_at,
            new.includes_price, new.price_source_url, new.price_source_note)
        is distinct from
        row(old.title, old.caption, old.hashtags, old.format, old.destination, old.notes, old.scheduled_at,
            old.includes_price, old.price_source_url, old.price_source_note) then
    insert into public.content_events (content_id, actor_id, action, from_status, to_status)
      values (new.id, auth.uid(), 'edited', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger content_items_after_change
  after insert or update on public.content_items
  for each row execute function public.content_items_after_change();

create or replace function public.content_items_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('content.deleted', 'content', old.id::text,
    format('Eliminó "%s"', old.title), jsonb_build_object('status', old.status), 'warning');
  return old;
end;
$$;

create trigger content_items_after_delete
  after delete on public.content_items
  for each row execute function public.content_items_after_delete();

-- Cambiar el material visual de algo aprobado también exige nueva aprobación.
create or replace function public.content_assets_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content_id uuid := coalesce(new.content_id, old.content_id);
  v_status public.content_status;
begin
  if public.is_server_context() then
    return coalesce(new, old);
  end if;
  select status into v_status from public.content_items where id = v_content_id;
  if v_status is null then
    return coalesce(new, old); -- borrado en cascada del contenido
  end if;
  if v_status in ('generating', 'publishing', 'published') then
    raise exception 'No se puede modificar el material de un contenido en estado "%"', v_status
      using errcode = '42501';
  end if;
  if v_status in ('approved', 'scheduled')
     and (tg_op <> 'UPDATE' or new.storage_path is distinct from old.storage_path) then
    perform set_config('avora.reapproval_cause', 'edit', true);
    update public.content_items set status = 'pending_approval' where id = v_content_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger content_assets_guard
  before insert or update or delete on public.content_assets
  for each row execute function public.content_assets_guard();

-- ─── RLS ───────────────────────────────────────────────────────────
alter table public.content_items enable row level security;
alter table public.content_assets enable row level security;
alter table public.content_events enable row level security;

create policy "content_items: lectura del equipo"
  on public.content_items for select to authenticated using (public.is_team_member());
create policy "content_items: el equipo crea"
  on public.content_items for insert to authenticated with check (public.is_team_member());
create policy "content_items: el equipo edita"
  on public.content_items for update to authenticated
  using (public.is_team_member()) with check (public.is_team_member());
create policy "content_items: solo admin borra, y nunca lo ya publicado"
  on public.content_items for delete to authenticated
  using (public.is_admin() and status not in ('publishing', 'published'));

create policy "content_assets: lectura del equipo"
  on public.content_assets for select to authenticated using (public.is_team_member());
create policy "content_assets: el equipo agrega"
  on public.content_assets for insert to authenticated with check (public.is_team_member());
create policy "content_assets: el equipo edita"
  on public.content_assets for update to authenticated
  using (public.is_team_member()) with check (public.is_team_member());
create policy "content_assets: el equipo quita"
  on public.content_assets for delete to authenticated using (public.is_team_member());

create policy "content_events: lectura del equipo"
  on public.content_events for select to authenticated using (public.is_team_member());
-- content_events se escribe solo desde triggers (security definer).

-- ─── Vista para el dashboard ───────────────────────────────────────
create view public.content_counts
with (security_invoker = on) as
  select status, format, count(*)::int as total
  from public.content_items
  group by status, format;
