-- supabase/migrations/20260814140000_turno_insert_responsable_suplente.sql
create policy "turno_insert_responsable_suplente"
  on public.turno
  for insert
  to authenticated
  with check (
    case fn_rol_actual()
      when 'responsable' then
        tipo = fn_turno_de_letra(fecha, (select letra from usuario where id = auth.uid()))
      when 'suplente' then
        true
      else
        false
    end
  );