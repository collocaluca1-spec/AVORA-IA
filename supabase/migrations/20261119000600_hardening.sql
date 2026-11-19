-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0006 · Endurecimiento (recomendaciones del Security Advisor)
-- ════════════════════════════════════════════════════════════════════

-- search_path fijo en todas las funciones
alter function public.is_server_context() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.status_label(public.content_status) set search_path = public;
alter function public.content_ideas_guard() set search_path = public;

-- Las funciones de trigger no deben poder llamarse por la API (/rest/v1/rpc/...).
-- Los triggers siguen funcionando: dispararlos no requiere EXECUTE.
revoke execute on function
  public.handle_new_user(),
  public.profiles_guard_role(),
  public.content_items_before_insert(),
  public.content_items_enforce_workflow(),
  public.content_items_after_change(),
  public.content_items_after_delete(),
  public.content_assets_guard(),
  public.app_settings_guard(),
  public.integrations_after_update(),
  public.content_ideas_guard(),
  public.touch_updated_at()
from public, anon, authenticated;

-- Los helpers de RLS solo los necesitan usuarios autenticados.
revoke execute on function public.is_team_member(), public.is_admin(), public.current_app_role() from public, anon;
grant execute on function public.is_team_member(), public.is_admin(), public.current_app_role() to authenticated;
