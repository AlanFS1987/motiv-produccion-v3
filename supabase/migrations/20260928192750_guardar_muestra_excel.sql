-- Archivo recuperado el 01/10/2026: esta migración se aplicó en remoto el
-- 28/09/2026 (version 20260928192750) sin guardar el archivo en local. El
-- contenido de abajo es el SQL EXACTO que Supabase guardó en
-- supabase_migrations.schema_migrations.statements para esa versión.
-- NO hay que volver a aplicarla: solo existe para que local y remoto coincidan.

-- Guarda un volcado JSON de un Excel de muestra (programacion) en admin_notas
-- como tipo 'nota' (ya permitido por admin_notas_tipo_check). Existe para que
-- 'jefe' pueda subirlo, ya que la RLS de admin_notas solo deja escribir a
-- 'administrador'. Solo se usa para inspeccionar la estructura real del Excel
-- antes de escribir el importador.
create or replace function guardar_muestra_excel(p_titulo text, p_contenido text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if coalesce(trim(p_titulo), '') = '' or coalesce(trim(p_contenido), '') = '' then
    raise exception 'La muestra está vacía';
  end if;

  if length(p_contenido) > 2000000 then
    raise exception 'La muestra es demasiado grande (máx. 2 MB de texto)';
  end if;

  insert into admin_notas (tipo, titulo, contenido, creado_por)
  values ('nota', 'muestra_excel: ' || trim(p_titulo), p_contenido, auth.uid());
end;
$$;

revoke all on function guardar_muestra_excel(text, text) from public, anon;
grant execute on function guardar_muestra_excel(text, text) to authenticated;
