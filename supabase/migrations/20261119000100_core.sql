-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0001 · Núcleo: tipos, perfiles, roles y registro de actividad
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'editor');
create type public.log_level as enum ('info', 'warning', 'error');

-- ─── Perfiles ──────────────────────────────────────────────────────
-- Un perfil por usuario de Supabase Auth. role = null significa "sin acceso":
-- crear una cuenta NO da acceso al panel; un admin debe asignar el rol.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        public.app_role,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Helpers de autorización (usados por todas las políticas RLS) ───
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role is not null);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- true cuando la operación la ejecuta el servidor (service role) o una conexión
-- directa a la base (SQL editor / migraciones), nunca un usuario del panel.
create or replace function public.is_server_context()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', 'service_role') = 'service_role';
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Un usuario no puede cambiarse el rol a sí mismo; solo un admin (o el servidor).
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_server_context() and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and old.id = auth.uid() and old.role = 'admin' then
    raise exception 'Un administrador no puede quitarse su propio rol' using errcode = '42501';
  end if;
  new.email := old.email; -- el email lo gestiona Supabase Auth
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard_role();

alter table public.profiles enable row level security;

create policy "profiles: cada usuario ve su perfil y el equipo ve al equipo"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_team_member());

create policy "profiles: editar el propio nombre o, si es admin, cualquiera"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ─── Registro de actividad y errores ────────────────────────────────
-- Solo inserción: nadie desde el panel puede modificar ni borrar registros.
create table public.activity_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  actor_id     uuid references auth.users (id) on delete set null,
  level        public.log_level not null default 'info',
  action       text not null,
  entity_type  text,
  entity_id    text,
  message      text,
  details      jsonb not null default '{}'::jsonb
);

create index activity_log_created_at_idx on public.activity_log (created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_level_idx on public.activity_log (level) where level <> 'info';

alter table public.activity_log enable row level security;

create policy "activity_log: el equipo lee"
  on public.activity_log for select to authenticated
  using (public.is_team_member());

create policy "activity_log: el equipo registra a su nombre"
  on public.activity_log for insert to authenticated
  with check (public.is_team_member() and actor_id = auth.uid());

-- Función interna para que los triggers registren acciones.
create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_message text,
  p_details jsonb default '{}'::jsonb,
  p_level public.log_level default 'info'
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_log (actor_id, level, action, entity_type, entity_id, message, details)
  values (auth.uid(), p_level, p_action, p_entity_type, p_entity_id, p_message, coalesce(p_details, '{}'::jsonb));
$$;

revoke execute on function public.log_activity(text, text, text, text, jsonb, public.log_level) from public, anon, authenticated;
