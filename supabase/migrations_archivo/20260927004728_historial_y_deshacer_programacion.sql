-- =============================================================
-- Historial de programacion_orden para poder deshacer una
-- confirmación equivocada (ej. el jefe pegó y confirmó el CSV de
-- otro día por error). confirmar_programacion guarda una "foto" del
-- estado ANTES de aplicar los cambios; deshacer_ultima_programacion
-- restaura la foto más reciente (pila: al restaurar se consume esa
-- entrada, así que pulsar deshacer varias veces sigue retrocediendo).
-- =============================================================

create table programacion_orden_historico (
  id uuid primary key default gen_random_uuid(),
  snapshot jsonb not null,       -- filas de programacion_orden justo antes de ese confirmar_programacion
  creado_en timestamptz not null default now(),
  creado_por uuid references usuario(id)
);

comment on table programacion_orden_historico is
  'Foto de programacion_orden justo antes de cada confirmar_programacion. '
  'Permite deshacer_ultima_programacion() si el jefe confirma un CSV '
  'equivocado. Solo lectura/escritura vía funciones security definer.';

alter table programacion_orden_historico enable row level security;

create policy programacion_orden_historico_select on programacion_orden_historico
  for select using (fn_rol_actual() in ('jefe', 'administrador'));

-- Sin políticas de insert/update/delete directas: solo escriben las
-- funciones security definer de abajo.

-- -------------------------------------------------------------
-- confirmar_programacion: ahora guarda snapshot antes de tocar nada.
-- -------------------------------------------------------------
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
begin
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  -- Foto del estado actual ANTES de aplicar nada (para poder deshacer).
  insert into programacion_orden_historico (snapshot, creado_por)
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'horno', horno, 'numero_orden', numero_orden, 'modelo', modelo,
      'metros', metros, 'acabado', acabado, 'cep', cep, 'caja', caja,
      'posicion', posicion, 'tono', tono, 'calibre', calibre
    )), '[]'::jsonb),
    auth.uid()
  from programacion_orden;

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

-- -------------------------------------------------------------
-- Deshacer: restaura la foto más reciente (pila) y la consume.
-- -------------------------------------------------------------
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
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  select id, snapshot, creado_en
  into v_id, v_snapshot, v_creado_en
  from programacion_orden_historico
  order by creado_en desc
  limit 1;

  if v_id is null then
    raise exception 'No hay ningún historial que deshacer';
  end if;

  delete from programacion_orden;

  insert into programacion_orden (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre)
  select
    (f->>'horno')::smallint, f->>'numero_orden', f->>'modelo',
    nullif(f->>'metros','')::numeric, f->>'acabado',
    coalesce((f->>'cep')::boolean, false), f->>'caja',
    (f->>'posicion')::integer, nullif(f->>'tono',''), nullif(f->>'calibre','')
  from jsonb_array_elements(v_snapshot) as f;

  get diagnostics v_filas = row_count;

  -- se consume: al pulsar deshacer otra vez, retrocede un paso más
  delete from programacion_orden_historico where id = v_id;

  return query select v_filas, v_creado_en;
end;
$$;

revoke execute on function confirmar_programacion(date, jsonb) from public, anon;
grant execute on function confirmar_programacion(date, jsonb) to authenticated;
revoke execute on function deshacer_ultima_programacion() from public, anon;
grant execute on function deshacer_ultima_programacion() to authenticated;

comment on function deshacer_ultima_programacion() is
  'Restaura programacion_orden a como estaba justo antes de la última '
  'confirmar_programacion (pila: cada uso retrocede un paso más). '
  'security definer, solo jefe/administrador.';

-- Nota de rescate (27/09/2026): esta versión de
-- deshacer_ultima_programacion() tiene un `delete from
-- programacion_orden;` sin condición, que choca con la protección
-- "safe-update" del proyecto (DELETE requires a WHERE clause) — la
-- corrige por completo la siguiente migración,
-- 20260927094859_fix_delete_sin_where_deshacer_programacion.sql. Se
-- conserva aquí tal cual, así ocurrió el paso real intermedio.
