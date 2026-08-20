-- supabase/migrations/20260814150000_usuario_select_operarios_para_responsable.sql
create policy "usuario_select_operarios_para_responsable"
  on public.usuario
  for select
  to authenticated
  using (
    rol = 'operario'
    and fn_rol_actual() in ('responsable', 'suplente')
  );