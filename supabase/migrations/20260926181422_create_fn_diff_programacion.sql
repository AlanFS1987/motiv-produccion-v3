create or replace function diff_programacion(p_fecha date)
returns table (
  cambio text,           -- 'nuevo' | 'eliminado' | 'sin_cambios' | 'reordenado'
  horno smallint,
  numero_orden text,
  modelo text,
  metros numeric,
  acabado text,
  cep boolean,
  caja text,
  posicion_actual integer,   -- null si es nuevo
  posicion_nueva integer     -- null si se elimina
)
language sql
stable
as $$
  with nuevo as (
    select * from parse_programacion(p_fecha)
  ),
  actual as (
    select horno, numero_orden, modelo, metros, acabado, cep, caja, posicion
    from programacion_orden
  )
  select
    case
      when a.numero_orden is null then 'nuevo'
      when n.numero_orden is null then 'eliminado'
      when a.posicion is distinct from n.posicion then 'reordenado'
      else 'sin_cambios'
    end as cambio,
    coalesce(n.horno, a.horno) as horno,
    coalesce(n.numero_orden, a.numero_orden) as numero_orden,
    coalesce(n.modelo, a.modelo) as modelo,
    coalesce(n.metros, a.metros) as metros,
    coalesce(n.acabado, a.acabado) as acabado,
    coalesce(n.cep, a.cep) as cep,
    coalesce(n.caja, a.caja) as caja,
    a.posicion as posicion_actual,
    n.posicion as posicion_nueva
  from nuevo n
  full outer join actual a
    on a.horno = n.horno and a.numero_orden = n.numero_orden
  order by
    coalesce(n.horno, a.horno),
    coalesce(n.posicion, a.posicion);
$$;

comment on function diff_programacion(date) is 'Compara el CSV de una fecha (vía parse_programacion) contra el estado actual de programacion_orden. No modifica nada: solo lectura, para mostrar el diff editable al jefe antes de confirmar.';

-- Nota de rescate (27/09/2026): esta PRIMERA versión (SQL puro, sin
-- security definer) queda reemplazada por completo en
-- 20260926183848_fix_parse_diff_programacion_plpgsql.sql. Se
-- conserva tal cual, así ocurrió el historial real.
