-- ════════════════════════════════════════════════════════════════════
-- AVORA AI · 0005 · Almacenamiento privado del material visual
-- ════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media', 'content-media', false,
  104857600, -- 100 MB por archivo (el plan de Supabase puede imponer un límite global menor)
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Bucket privado: el panel accede con URLs firmadas de corta duración.
create policy "content-media: lectura del equipo"
  on storage.objects for select to authenticated
  using (bucket_id = 'content-media' and public.is_team_member());

create policy "content-media: el equipo sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'content-media' and public.is_team_member());

create policy "content-media: el equipo reemplaza"
  on storage.objects for update to authenticated
  using (bucket_id = 'content-media' and public.is_team_member());

create policy "content-media: el equipo borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'content-media' and public.is_team_member());
