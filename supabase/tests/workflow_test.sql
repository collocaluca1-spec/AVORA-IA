-- Pruebas de reglas de negocio y RLS. Ejecutar sobre una base con stubs + migraciones.
-- Cada bloque falla con una excepción si algo no se comporta como se espera.
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@avora.test'),
  ('00000000-0000-0000-0000-00000000000e', 'editor@avora.test'),
  ('00000000-0000-0000-0000-00000000000f', 'extrano@avora.test');
update public.profiles set role = 'admin'  where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-00000000000e';

create schema tst;
create or replace function tst.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function tst.as_server() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
end $$;
create or replace function tst.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'OK (rechazado como se esperaba): % → %', label, sqlerrm;
    return;
  end;
  raise exception 'FALLO: debía rechazarse: %', label;
end $$;
create or replace function tst.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALLO: %', label; end if;
  raise notice 'OK: %', label;
end $$;
grant usage on schema tst to authenticated; grant execute on all functions in schema tst to authenticated;

-- 1) Un usuario sin rol no ve ni crea nada
select tst.as_user('00000000-0000-0000-0000-00000000000f');
select tst.expect_fail($$insert into content_items (title, format) values ('x', 'reel')$$, 'usuario sin rol no crea');
select tst.check((select count(*) from integrations) = 0, 'usuario sin rol no ve integraciones');

-- 2) Editor crea borrador; no puede crearlo aprobado
select tst.as_user('00000000-0000-0000-0000-00000000000e');
select tst.expect_fail($$insert into content_items (title, format, status) values ('x', 'reel', 'approved')$$, 'no se crea aprobado');
insert into content_items (id, title, caption, format, hashtags)
  values ('11111111-1111-1111-1111-111111111111', 'Bariloche en invierno', 'Texto', 'post_portrait', '{Bariloche}');
select tst.check((select created_by from content_items where id = '11111111-1111-1111-1111-111111111111') = '00000000-0000-0000-0000-00000000000e', 'created_by forzado');

-- 3) Precio sin fuente verificable
select tst.expect_fail($$update content_items set includes_price = true where id = '11111111-1111-1111-1111-111111111111'$$, 'precio sin fuente');
select tst.expect_fail($$update content_items set includes_price = true, price_source_url = 'proveedor' where id = '11111111-1111-1111-1111-111111111111'$$, 'fuente no URL');

-- 4) Editor no puede saltar a programado ni aprobar
select tst.expect_fail($$update content_items set status = 'scheduled', scheduled_at = now() + interval '1 day' where id = '11111111-1111-1111-1111-111111111111'$$, 'borrador→programado');
update content_items set status = 'pending_approval' where id = '11111111-1111-1111-1111-111111111111';
select tst.expect_fail($$update content_items set status = 'approved' where id = '11111111-1111-1111-1111-111111111111'$$, 'editor no aprueba');
update content_items set approved_at = now(), approved_by = auth.uid() where id = '11111111-1111-1111-1111-111111111111';
select tst.check((select approved_at is null from content_items where id = '11111111-1111-1111-1111-111111111111'), 'approved_at sigue vacío');

-- 5) Admin rechaza sin motivo (falla) y aprueba
select tst.as_user('00000000-0000-0000-0000-00000000000a');
select tst.expect_fail($$update content_items set status = 'rejected' where id = '11111111-1111-1111-1111-111111111111'$$, 'rechazo sin motivo');
update content_items set status = 'approved' where id = '11111111-1111-1111-1111-111111111111';
select tst.check((select approved_by from content_items where id = '11111111-1111-1111-1111-111111111111') = '00000000-0000-0000-0000-00000000000a', 'approved_by registrado');

-- 6) Programar exige fecha futura; reprogramar mantiene aprobación
select tst.as_user('00000000-0000-0000-0000-00000000000e');
select tst.expect_fail($$update content_items set status = 'scheduled', scheduled_at = now() - interval '1 hour' where id = '11111111-1111-1111-1111-111111111111'$$, 'programar en el pasado');
update content_items set status = 'scheduled', scheduled_at = now() + interval '2 days' where id = '11111111-1111-1111-1111-111111111111';
update content_items set scheduled_at = now() + interval '3 days' where id = '11111111-1111-1111-1111-111111111111';
select tst.check((select status = 'scheduled' and approved_at is not null from content_items where id = '11111111-1111-1111-1111-111111111111'), 'reprogramado sigue aprobado');

-- 7) Editar el texto de algo programado exige nueva aprobación
update content_items set caption = 'Texto cambiado' where id = '11111111-1111-1111-1111-111111111111';
select tst.check((select status = 'pending_approval' and approved_at is null from content_items where id = '11111111-1111-1111-1111-111111111111'), 'edición → pendiente de aprobación');
select tst.check((select action from content_events where content_id = '11111111-1111-1111-1111-111111111111' order by id desc limit 1) = 'edited_requires_reapproval', 'evento de reaprobación');

-- 8) Agregar material a algo aprobado también exige nueva aprobación
select tst.as_user('00000000-0000-0000-0000-00000000000a');
update content_items set status = 'approved' where id = '11111111-1111-1111-1111-111111111111';
select tst.as_user('00000000-0000-0000-0000-00000000000e');
insert into content_assets (content_id, storage_path, mime_type) values ('11111111-1111-1111-1111-111111111111', 'a/b.jpg', 'image/jpeg');
select tst.check((select status = 'pending_approval' from content_items where id = '11111111-1111-1111-1111-111111111111'), 'material nuevo → pendiente');

-- 9) El panel no puede pasar a publicando/publicado; el servidor sí, solo por el flujo
select tst.as_user('00000000-0000-0000-0000-00000000000a');
update content_items set status = 'approved' where id = '11111111-1111-1111-1111-111111111111';
update content_items set status = 'scheduled', scheduled_at = now() + interval '1 day' where id = '11111111-1111-1111-1111-111111111111';
select tst.expect_fail($$update content_items set status = 'publishing' where id = '11111111-1111-1111-1111-111111111111'$$, 'panel no publica');
select tst.as_server();
select tst.expect_fail($$update content_items set status = 'published' where id = '11111111-1111-1111-1111-111111111111'$$, 'servidor no salta publicando');
update content_items set status = 'publishing' where id = '11111111-1111-1111-1111-111111111111';
update content_items set status = 'published', published_at = now() where id = '11111111-1111-1111-1111-111111111111';
select tst.as_user('00000000-0000-0000-0000-00000000000a');
select tst.expect_fail($$update content_items set caption = 'x' where id = '11111111-1111-1111-1111-111111111111'$$, 'publicado no editable');
delete from content_items where id = '11111111-1111-1111-1111-111111111111';
select tst.check((select count(*) from content_items where id = '11111111-1111-1111-1111-111111111111') = 1, 'publicado no se borra');

-- 10) Integraciones y publicación automática
update integrations set status = 'connected' where key = 'instagram';
select tst.check((select status from integrations where key = 'instagram') = 'not_configured', 'instagram sigue no configurado');
select tst.expect_fail($$update app_settings set value = jsonb_set(value, '{auto_publish_enabled}', 'true') where key = 'automations'$$, 'auto-publicación sin Instagram');
select tst.as_user('00000000-0000-0000-0000-00000000000e');
update app_settings set value = jsonb_set(value, '{tone}', '"x"') where key = 'brand_identity';
select tst.check((select value->>'tone' from app_settings where key = 'brand_identity') <> 'x', 'editor no cambia configuración');
select tst.expect_fail($$update profiles set role = 'admin' where id = auth.uid()$$, 'editor no se hace admin');

-- 11) Registro de actividad: no se puede falsificar ni borrar
select tst.expect_fail($$insert into activity_log (actor_id, action) values ('00000000-0000-0000-0000-00000000000a', 'x')$$, 'log a nombre de otro');
insert into activity_log (actor_id, level, action, message) values (auth.uid(), 'error', 'ui.error', 'prueba');
delete from activity_log;
select tst.check((select count(*) from activity_log) > 5, 'log no se borra');

-- 12) Ideas: el panel no puede hacerse pasar por el agente
insert into content_ideas (title, origin) values ('Idea', 'agent');
select tst.check((select origin from content_ideas limit 1) = 'manual', 'origen forzado a manual');

select tst.as_server();
\echo '✔ Todas las pruebas de base de datos pasaron'
