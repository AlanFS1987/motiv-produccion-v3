-- supabase/migrations/20260814180000_parte_completado_at_y_correccion.sql
alter table public.parte
  add column completado_at timestamptz null;

comment on column public.parte.completado_at is
  'Cuándo se cerró el parte (Foto 4 confirmada, o cierre sin producción). Base para la ventana de corrección de 1h del responsable, ver 04-rol-administrador.md 6.3.';

create policy "parte_update_vigente_responsable_ventana"
  on public.parte
  for update
  to authenticated
  using (
    responsable_id = auth.uid()
    and completado = true
    and vigente = true
    and completado_at > now() - interval '1 hour'
  )
  with check (
    responsable_id = auth.uid()
  );