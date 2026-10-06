create or replace function confirmar_programacion(p_fecha date, p_filas jsonb)
returns table (nuevos integer, eliminados integer, actualizados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevos integer;
  v_eliminados integer;
  v_actualizados integer;
begin
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  create temporary table tmp_programacion_nueva on commit drop as
  select
    (f->>'horno')::smallint as horno,
    f->>'numero_orden' as numero_orden,
    f->>'modelo' as modelo,
    nullif(f->>'metros','')::numeric as metros,
    f->>'acabado' as acabado,
    coalesce((f->>'cep')::boolean, false) as cep,
    f->>'caja' as caja,
    (f->>'posicion')::integer as posicion,
    nullif(f->>'tono','') as tono,
    nullif(f->>'calibre','') as calibre
  from jsonb_array_elements(p_filas) as f;

  select count(*) into v_nuevos
  from tmp_programacion_nueva n
  where not exists (
    select 1 from programacion_orden p
    where p.horno = n.horno and p.numero_orden = n.numero_orden
  );

  select count(*) into v_eliminados
  from programacion_orden p
  where not exists (
    select 1 from tmp_programacion_nueva n
    where n.horno = p.horno and n.numero_orden = p.numero_orden
  );

  select count(*) into v_actualizados
  from tmp_programacion_nueva n
  join programacion_orden p
    on p.horno = n.horno and p.numero_orden = n.numero_orden;

  delete from programacion_orden p
  where not exists (
    select 1 from tmp_programacion_nueva n
    where n.horno = p.horno and n.numero_orden = p.numero_orden
  );

  insert into programacion_orden (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre)
  select horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre
  from tmp_programacion_nueva
  on conflict (horno, numero_orden) do update
    set modelo = excluded.modelo,
        metros = excluded.metros,
        acabado = excluded.acabado,
        cep = excluded.cep,
        caja = excluded.caja,
        posicion = excluded.posicion,
        tono = coalesce(excluded.tono, programacion_orden.tono),
        calibre = coalesce(excluded.calibre, programacion_orden.calibre);

  return query select v_nuevos, v_eliminados, v_actualizados;
end;
$$;

revoke execute on function confirmar_programacion(date, jsonb) from public, anon;
grant execute on function confirmar_programacion(date, jsonb) to authenticated;

comment on function confirmar_programacion(date, jsonb) is
  'Escritura real sobre programacion_orden. security definer, solo '
  'jefe/administrador. Recibe el estado final YA REVISADO/EDITADO por '
  'el jefe (no confía en el parser a ciegas) y hace un reemplazo '
  'completo: upsert de lo que viene, delete de lo que falta. '
  'tono/calibre solo se sobrescriben si el cliente manda un valor no '
  'vacío, para no borrar por accidente lo ya rellenado.';

-- Nota de rescate (27/09/2026): esta PRIMERA versión de la función
-- (sin snapshot de historial) queda reemplazada por completo en
-- 20260927004728_historial_y_deshacer_programacion.sql, que añade
-- el guardado de la "foto" antes de aplicar cambios. Se conserva
-- aquí tal cual, así ocurrió el historial real.
