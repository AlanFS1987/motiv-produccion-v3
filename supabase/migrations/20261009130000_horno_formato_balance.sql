-- Alimentación: tabla de hornos por formato + vista del balance horno vs clasificación
-- (memorias/21-alimentacion.md).
--
--  * horno_formato: producción nominal del horno por formato (m²/día), nº de hornos y de
--    líneas habituales. El horno cuece a ritmo constante todo el día: un turno = 1/3 del día.
--    `vigente_desde` permite cambiar la consigna del horno sin falsear el histórico.
--    Lectura por RLS (roles de producción); escritura SOLO por RPC (administrador).
--  * v_balance_horno_turno_formato: por turno y formato, lo clasificado entre TODAS las líneas
--    (piezas y m²). La parte del horno se calcula en el frontend con horno_formato.
--
-- Idempotente. Los objetos nacen cerrados (RLS + revoke en la misma migración).

-- ── Tabla ────────────────────────────────────────────────────────────────
create table if not exists horno_formato (
  formato_id       uuid        not null references formato (id) on delete cascade,
  vigente_desde    date        not null default date '2000-01-01',
  metros_dia_horno numeric     not null,
  hornos           smallint    not null default 1,
  lineas           smallint    not null default 1,
  updated_at       timestamptz not null default now(),
  primary key (formato_id, vigente_desde),
  constraint horno_formato_metros_positivo check (metros_dia_horno > 0),
  constraint horno_formato_hornos_positivo check (hornos >= 1),
  constraint horno_formato_lineas_positivo check (lineas >= 1)
);

comment on table horno_formato is
  'Producción nominal del horno por formato: m²/día por horno, hornos y líneas habituales. Vigente desde una fecha (se toma la fila más reciente con vigente_desde <= fecha del turno). Un turno = 1/3 del día (el horno no varía su ritmo). Lectura por RLS; escritura solo por guardar_horno_formato (administrador).';

alter table horno_formato enable row level security;

drop policy if exists horno_formato_select on horno_formato;
create policy horno_formato_select on horno_formato
  for select to authenticated
  using (coalesce(fn_rol_actual()::text, '') = any (array['jefe', 'responsable', 'produccion', 'administrador']));

revoke all on table horno_formato from anon;
revoke insert, update, delete, truncate, references, trigger, maintain on table horno_formato from authenticated;
grant select on table horno_formato to authenticated;
grant all on table horno_formato to service_role;

-- ── Datos iniciales (solo si la tabla está vacía para ese formato) ───────
-- 12.600 m²/día: 200x1200, 300x1200, 600x1200, 300x600, 600x600. 8.700: 900x900 y 1200x1200.
insert into horno_formato (formato_id, metros_dia_horno, hornos, lineas)
select f.id, v.metros, v.hornos, v.lineas
from (values
  ('200x1200',  12600, 1, 2),
  ('300x1200',  12600, 1, 2),
  ('600x1200',  12600, 2, 3),
  ('300x600',   12600, 1, 1),
  ('600x600',   12600, 1, 1),
  ('900x900',    8700, 1, 1),
  ('1200x1200',  8700, 1, 1)
) as v (nombre, metros, hornos, lineas)
join formato f on f.nombre = v.nombre
on conflict (formato_id, vigente_desde) do nothing;

-- ── RPC de escritura (solo administrador) ────────────────────────────────
create or replace function guardar_horno_formato(
  p_formato_id    uuid,
  p_vigente_desde date,
  p_metros        numeric,
  p_hornos        integer,
  p_lineas        integer
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(fn_rol_actual()::text, '') <> 'administrador' then
    raise exception 'No autorizado';
  end if;
  if p_formato_id is null or not exists (select 1 from formato where id = p_formato_id) then
    raise exception 'El formato no existe';
  end if;
  if p_metros is null or p_metros <= 0 then
    raise exception 'Los m² por día del horno deben ser mayores que 0';
  end if;
  if p_hornos is null or p_hornos < 1 or p_hornos > 10 then
    raise exception 'El número de hornos debe estar entre 1 y 10';
  end if;
  if p_lineas is null or p_lineas < 1 or p_lineas > 10 then
    raise exception 'El número de líneas debe estar entre 1 y 10';
  end if;

  insert into horno_formato (formato_id, vigente_desde, metros_dia_horno, hornos, lineas, updated_at)
  values (p_formato_id, coalesce(p_vigente_desde, date '2000-01-01'), p_metros, p_hornos::smallint, p_lineas::smallint, now())
  on conflict (formato_id, vigente_desde) do update
    set metros_dia_horno = excluded.metros_dia_horno,
        hornos           = excluded.hornos,
        lineas           = excluded.lineas,
        updated_at       = now();
end;
$$;

revoke all on function guardar_horno_formato(uuid, date, numeric, integer, integer) from public;
revoke all on function guardar_horno_formato(uuid, date, numeric, integer, integer) from anon;
grant execute on function guardar_horno_formato(uuid, date, numeric, integer, integer) to authenticated;
grant execute on function guardar_horno_formato(uuid, date, numeric, integer, integer) to service_role;

-- ── Vista: clasificado por turno y formato (todas las líneas) ────────────
create or replace view v_balance_horno_turno_formato as
select
  t.id                                   as turno_id,
  t.fecha,
  t.tipo                                 as tipo_turno,
  f.id                                   as formato_id,
  f.nombre                               as formato,
  f.area_m2,
  count(distinct p.linea_id)             as lineas_con_produccion,
  sum(p.piezas_entradas)                 as piezas_total,
  round(sum(p.piezas_entradas * f.area_m2), 1) as m2_clasificados
from turno t
join parte p    on p.turno_id = t.id and p.vigente = true and p.completado = true
join lote lo    on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f  on f.id = pr.formato_id
group by t.id, t.fecha, t.tipo, f.id, f.nombre, f.area_m2;

comment on view v_balance_horno_turno_formato is
  'Por turno y formato: piezas y m² clasificados entre TODAS las líneas (m² = piezas_entradas × formato.area_m2). Es la parte "clasificación" del balance contra el horno; la parte horno sale de horno_formato (un turno = 1/3 del día). Un turno con varios formatos genera una fila por formato.';

revoke all on table v_balance_horno_turno_formato from anon;
grant select on table v_balance_horno_turno_formato to authenticated;
grant all on table v_balance_horno_turno_formato to service_role;
