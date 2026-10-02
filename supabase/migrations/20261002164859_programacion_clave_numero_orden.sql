-- M2 (02/10/2026): la clave de programacion_orden pasa a ser numero_orden.
-- El horno es un dato de la orden. Incluye fecha_alta, estado cambia_horno en el diff,
-- rechazo de repetidos en confirmar y comprobación de rol a prueba de nulos
-- (fn_rol_actual() null no debe saltarse la guarda: NULL NOT IN (...) es NULL, no true).

-- 0. Red de seguridad: abortar si hubiera repetidos (al planificar había 0).
do $$
begin
  if exists (select 1 from programacion_orden group by numero_orden having count(*) > 1) then
    raise exception 'Hay numero_orden repetidos en programacion_orden; resolver antes de migrar';
  end if;
end $$;

-- 1. Unicidad: sustituir (horno, numero_orden) por (numero_orden).
alter table programacion_orden drop constraint programacion_orden_horno_numero_orden_key;
alter table programacion_orden add constraint programacion_orden_numero_orden_key unique (numero_orden);

-- 2. Fecha de alta (null en las existentes: la UI mostrará "—").
alter table programacion_orden add column if not exists fecha_alta date;
comment on column programacion_orden.fecha_alta is
  'Fecha en que la orden se insertó por primera vez. null = anterior a esta columna. confirmar_programacion solo la fija al insertar.';

-- 3. Vista: fecha_alta AL FINAL (create or replace no permite reordenar) y se
--    mantiene el filtro por rol de M1.
create or replace view programacion_con_estado as
select
  p.id, p.horno, p.posicion, p.numero_orden, p.modelo, p.metros, p.acabado,
  p.cep, p.caja, p.tono, p.calibre,
  coalesce(l.estado::text, 'pendiente') as estado,
  p.created_at, p.updated_at,
  p.fecha_alta
from programacion_orden p
left join lote l on l.numero_orden = p.numero_orden
where fn_rol_actual() in ('jefe','responsable','produccion','administrador')
order by p.horno, p.posicion;

revoke all on programacion_con_estado from anon;
grant select on programacion_con_estado to authenticated;

-- 4. diff_programacion: join por numero_orden; estado cambia_horno; horno_actual /
--    horno_nuevo; bandera repetida (un repetido del CSV no multiplica filas).
--    Cambia el RETURNS TABLE => drop + create.
drop function if exists diff_programacion(date);

create function diff_programacion(p_fecha date)
returns table (
  cambio text,
  horno smallint,
  numero_orden text,
  modelo text,
  metros numeric,
  acabado text,
  cep boolean,
  caja text,
  posicion_actual integer,
  posicion_nueva integer,
  horno_actual smallint,
  horno_nuevo smallint,
  repetida boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return query
  with parseado as (
    select p.*, count(*) over (partition by p.numero_orden) as apariciones
    from parse_programacion(p_fecha) p
  ),
  nuevo as (
    -- una sola fila por numero_orden (la primera del CSV); los repetidos se
    -- señalan con la bandera y no multiplican el join
    select distinct on (numero_orden) *
    from parseado
    order by numero_orden, horno, posicion
  ),
  actual as (
    select po.horno, po.numero_orden, po.modelo, po.metros, po.acabado, po.cep, po.caja, po.posicion
    from programacion_orden po
  )
  select
    case
      when a.numero_orden is null then 'nuevo'
      when n.numero_orden is null then 'eliminado'
      when a.horno <> n.horno then 'cambia_horno'   -- antes que reordenado: la posición no es comparable entre hornos
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
    n.posicion as posicion_nueva,
    a.horno as horno_actual,
    n.horno as horno_nuevo,
    coalesce(n.apariciones, 0) > 1 as repetida
  from nuevo n
  full outer join actual a on a.numero_orden = n.numero_orden
  order by
    coalesce(n.horno, a.horno),
    coalesce(n.posicion, a.posicion);
end;
$$;

revoke execute on function diff_programacion(date) from public, anon;
grant execute on function diff_programacion(date) to authenticated;

-- 5. confirmar_programacion: clave numero_orden, rechazo de repetidos y de filas
--    inválidas, fecha_alta solo al insertar, snapshot con fecha_alta.
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

-- 6. deshacer_ultima_programacion: restaura también horno y fecha_alta (los snapshots
--    anteriores a esta migración no traen fecha_alta => null).
create or replace function deshacer_ultima_programacion()
returns table (filas_restauradas integer, snapshot_de timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_snapshot jsonb;
  v_creado_en timestamptz;
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  select id, snapshot, creado_en into v_id, v_snapshot, v_creado_en
  from programacion_orden_historico
  order by creado_en desc
  limit 1;

  if v_id is null then
    raise exception 'No hay ningún historial que deshacer';
  end if;

  delete from programacion_orden where true;

  insert into programacion_orden
    (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre, fecha_alta)
  select
    (f->>'horno')::smallint, f->>'numero_orden', f->>'modelo',
    nullif(f->>'metros','')::numeric, f->>'acabado',
    coalesce((f->>'cep')::boolean, false), f->>'caja',
    (f->>'posicion')::integer, nullif(f->>'tono',''), nullif(f->>'calibre',''),
    nullif(f->>'fecha_alta','')::date
  from jsonb_array_elements(v_snapshot) as f;

  get diagnostics v_filas = row_count;

  delete from programacion_orden_historico where id = v_id;

  return query select v_filas, v_creado_en;
end;
$$;

revoke execute on function deshacer_ultima_programacion() from public, anon;
grant execute on function deshacer_ultima_programacion() to authenticated;

-- Nota de rescate: esta migración sustituye por completo a diff_programacion
-- (20260927002941), confirmar_programacion (20260927004728) y
-- deshacer_ultima_programacion (20260927094859).
