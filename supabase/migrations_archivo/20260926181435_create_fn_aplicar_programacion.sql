create or replace function aplicar_programacion(p_fecha date)
returns table (nuevos integer, eliminados integer, reordenados integer, sin_cambios integer)
language plpgsql
as $$
declare
  v_nuevos integer;
  v_eliminados integer;
  v_reordenados integer;
  v_sin_cambios integer;
begin
  select count(*) filter (where cambio = 'nuevo'),
         count(*) filter (where cambio = 'eliminado'),
         count(*) filter (where cambio = 'reordenado'),
         count(*) filter (where cambio = 'sin_cambios')
  into v_nuevos, v_eliminados, v_reordenados, v_sin_cambios
  from diff_programacion(p_fecha);

  -- eliminar los que ya no están
  delete from programacion_orden p
  using diff_programacion(p_fecha) d
  where d.cambio = 'eliminado'
    and p.horno = d.horno
    and p.numero_orden = d.numero_orden;

  -- upsert de nuevos y reordenados (actualiza posicion y campos del CSV; conserva tono/calibre existentes)
  insert into programacion_orden (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion)
  select n.horno, n.numero_orden, n.modelo, n.metros, n.acabado, n.cep, n.caja, n.posicion
  from parse_programacion(p_fecha) n
  on conflict (horno, numero_orden) do update
    set modelo = excluded.modelo,
        metros = excluded.metros,
        acabado = excluded.acabado,
        cep = excluded.cep,
        caja = excluded.caja,
        posicion = excluded.posicion;

  return query select v_nuevos, v_eliminados, v_reordenados, v_sin_cambios;
end;
$$;

comment on function aplicar_programacion(date) is 'Ejecuta de verdad el upsert/delete sobre programacion_orden para la fecha dada. Se llama solo tras confirmar el diff. tono/calibre no se tocan aquí: al ser columnas nuevas en el upsert (no incluidas), Postgres las deja como estaban para filas existentes, y quedan NULL para filas nuevas.';

-- Nota de rescate (27/09/2026): esta función quedó reemplazada por
-- confirmar_programacion (ver 20260926183901_create_confirmar_
-- programacion.sql) pocas horas después, el mismo día. Sigue
-- existiendo en la base de datos real pero ningún componente del
-- frontend la llama — candidata a revisar/eliminar en la limpieza
-- grande de migraciones (código muerto, sin uso confirmado).
