-- 03/10/2026 — confirmar_programacion rechaza una lista vacía.
--
-- `confirmar_programacion` es un REEMPLAZO COMPLETO: lo que no viene en `p_filas` se borra. Con un
-- array de 0 elementos (p. ej. un cliente cuyo diff falló y envía [] ) borraba toda la programación
-- (recuperable con Deshacer, pero sin aviso). Una programación real nunca está vacía: se rechaza con
-- un mensaje claro, ANTES de tocar nada (ni siquiera se guarda el snapshot del historial).
--
-- Cuerpo idéntico al vigente salvo el nuevo `if`. Misma firma, mismos permisos.

create or replace function confirmar_programacion(p_fecha date, p_filas jsonb)
returns table (nuevos integer, eliminados integer, actualizados integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_nuevos integer;
  v_eliminados integer;
  v_actualizados integer;
  v_repetidos text;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'p_filas debe ser un array JSON';
  end if;

  if jsonb_array_length(p_filas) = 0 then
    raise exception 'No se puede confirmar una programación vacía: se borrarían todas las órdenes. Revisa el archivo y vuelve a intentarlo.';
  end if;

  create temporary table tmp_programacion_nueva on commit drop as
  select
    (f->>'horno')::smallint as horno,
    nullif(trim(f->>'numero_orden'), '') as numero_orden,
    f->>'modelo' as modelo,
    nullif(f->>'metros','')::numeric as metros,
    f->>'acabado' as acabado,
    coalesce((f->>'cep')::boolean, false) as cep,
    f->>'caja' as caja,
    (f->>'posicion')::integer as posicion,
    nullif(f->>'tono','') as tono,
    nullif(f->>'calibre','') as calibre
  from jsonb_array_elements(p_filas) as f;

  if exists (select 1 from tmp_programacion_nueva where numero_orden is null or horno is null) then
    raise exception 'Hay filas sin número de orden o sin horno';
  end if;

  select string_agg(numero_orden, ', ' order by numero_orden) into v_repetidos
  from (select numero_orden from tmp_programacion_nueva group by numero_orden having count(*) > 1) d;
  if v_repetidos is not null then
    raise exception 'Números de orden repetidos: %', v_repetidos;
  end if;

  -- Foto del estado actual ANTES de aplicar nada (para poder deshacer).
  insert into programacion_orden_historico (snapshot, creado_por)
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'horno', horno, 'numero_orden', numero_orden, 'modelo', modelo,
      'metros', metros, 'acabado', acabado, 'cep', cep, 'caja', caja,
      'posicion', posicion, 'tono', tono, 'calibre', calibre,
      'fecha_alta', fecha_alta
    )), '[]'::jsonb),
    auth.uid()
  from programacion_orden;

  select count(*) into v_nuevos
  from tmp_programacion_nueva n
  where not exists (select 1 from programacion_orden p where p.numero_orden = n.numero_orden);

  select count(*) into v_eliminados
  from programacion_orden p
  where not exists (select 1 from tmp_programacion_nueva n where n.numero_orden = p.numero_orden);

  select count(*) into v_actualizados
  from tmp_programacion_nueva n
  join programacion_orden p on p.numero_orden = n.numero_orden;

  delete from programacion_orden p
  where not exists (select 1 from tmp_programacion_nueva n where n.numero_orden = p.numero_orden);

  insert into programacion_orden
    (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre, fecha_alta)
  select horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre, p_fecha
  from tmp_programacion_nueva
  on conflict (numero_orden) do update
    set horno = excluded.horno,                       -- una orden puede cambiar de horno
        modelo = excluded.modelo,
        metros = excluded.metros,
        acabado = excluded.acabado,
        cep = excluded.cep,
        caja = excluded.caja,
        posicion = excluded.posicion,
        tono = coalesce(excluded.tono, programacion_orden.tono),
        calibre = coalesce(excluded.calibre, programacion_orden.calibre);
        -- fecha_alta NO se toca en el conflicto

  return query select v_nuevos, v_eliminados, v_actualizados;
end;
$$;

revoke execute on function confirmar_programacion(date, jsonb) from public, anon;
grant execute on function confirmar_programacion(date, jsonb) to authenticated;
