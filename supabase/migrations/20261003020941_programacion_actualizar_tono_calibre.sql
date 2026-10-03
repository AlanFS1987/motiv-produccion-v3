-- 03/10/2026 — Programación, fase A1: edición directa de tono y calibre.
--
-- Hasta ahora tono y calibre solo se escribían dentro de `confirmar_programacion`. Esta RPC
-- permite editarlos desde Consultar sin pasar por el flujo de confirmar. Identifica la fila
-- por `numero_orden` (clave de negocio): los `id` cambian al deshacer. Texto vacío = null.
-- Sin validación de formato (reglas de tono/calibre sin confirmar, ver 22).
-- Aditiva: no cambia ninguna firma existente.

create or replace function actualizar_tono_calibre(
  p_numero_orden text,
  p_tono         text,
  p_calibre      text
)
returns table (numero_orden text, tono text, calibre text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_num     text := trim(coalesce(p_numero_orden, ''));
  v_tono    text := nullif(trim(coalesce(p_tono, '')), '');
  v_calibre text := nullif(trim(coalesce(p_calibre, '')), '');
  v_filas   integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if v_num = '' then
    raise exception 'Falta el número de orden';
  end if;
  if length(v_tono) > 20 then
    raise exception 'El tono admite como máximo 20 caracteres';
  end if;
  if length(v_calibre) > 20 then
    raise exception 'El calibre admite como máximo 20 caracteres';
  end if;

  update programacion_orden po
     set tono = v_tono,
         calibre = v_calibre
   where po.numero_orden = v_num;
  get diagnostics v_filas = row_count;

  if v_filas = 0 then
    raise exception 'La orden % no está en la programación', v_num;
  end if;

  return query
    select po.numero_orden, po.tono, po.calibre
    from programacion_orden po
    where po.numero_orden = v_num;
end;
$$;

revoke execute on function actualizar_tono_calibre(text, text, text) from public, anon;
grant execute on function actualizar_tono_calibre(text, text, text) to authenticated;
