-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0007 · Permisos explícitos para la API de datos
-- Los proyectos nuevos de Supabase no otorgan acceso automático a las tablas
-- creadas por SQL. El acceso real lo siguen limitando las políticas RLS.
-- ════════════════════════════════════════════════════════════════════
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.recent_topics(integer) to authenticated, service_role;
revoke all on all tables in schema public from anon;
