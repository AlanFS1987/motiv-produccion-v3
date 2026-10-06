-- supabase/migrations/20260814170000_parte_completado.sql
alter table public.parte
  add column completado boolean not null default false;

comment on column public.parte.completado is
  'true una vez capturada la Foto 3 (piezas/tiempos reales) o cerrado explícitamente sin producción. false = pendiente, recién creado tras resolver el lote (Foto 1) con piezas/minutos a 0 provisionalmente.';

create policy "parte_update_responsable_propio_pendiente"
  on public.parte
  for update
  to authenticated
  using (
    responsable_id = auth.uid()
    and completado = false
  )
  with check (
    responsable_id = auth.uid()
  );