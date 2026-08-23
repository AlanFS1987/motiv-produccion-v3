-- =============================================================
-- Reyes del formato (sesión de diseño 23/08/2026) — dos rankings:
--
-- - HISTÓRICO: récord absoluto de piezas de un formato en un solo
--   parte (un operario, un turno, una línea). Empates: se muestran
--   TODOS los que igualan el máximo (decisión de sesión — "es muy
--   difícil que queden exactamente igual").
-- - ACTUAL: el operario que más piezas de ese formato lleva
--   acumuladas en el ciclo en curso, sumando todas sus líneas y
--   turnos — ya resuelto por v_piezas_operario_formato_ciclo
--   (existente), solo falta el MAX por formato.
--
-- El problema a resolver era de rendimiento: el histórico no debe
-- necesitar escanear parte entera. Solución: denormalizar formato_id
-- en parte (se copia solo una vez al crear el parte, nunca cambia
-- después) + índice compuesto — con eso, el máximo por formato es
-- una búsqueda indexada por cada uno de los 7 formatos, no un escaneo
-- completo. Mismo patrón que calibre_com_pct: un valor derivado que
-- se guarda en vez de recalcularse por joins cada vez.
-- =============================================================

alter table parte add column if not exists formato_id uuid references formato(id);

comment on column parte.formato_id is
  'Denormalizado desde producto.formato_id (vía lote) en el momento '
  'de crear el parte — nunca se actualiza después (el formato de un '
  'parte no cambia una vez creado). Existe solo para poder indexar '
  'directamente sobre parte sin pasar por lote/producto en cada '
  'consulta de "Reyes del formato".';

create or replace function fn_parte_set_formato_id()
returns trigger
language plpgsql
as $$
begin
  select pr.formato_id into new.formato_id
  from lote lo
  join producto pr on pr.id = lo.producto_id
  where lo.id = new.lote_id;
  return new;
end;
$$;

create trigger trg_parte_set_formato_id
  before insert on parte
  for each row execute function fn_parte_set_formato_id();

comment on trigger trg_parte_set_formato_id on parte is
  'Rellena parte.formato_id automáticamente al crear el parte, desde '
  'lote->producto->formato. Solo BEFORE INSERT (no UPDATE): el lote '
  'de un parte no cambia después de creado.';

-- Backfill para partes ya existentes antes de esta migración.
update parte p
set formato_id = pr.formato_id
from lote lo
join producto pr on pr.id = lo.producto_id
where lo.id = p.lote_id
  and p.formato_id is null;

-- Índice compuesto — la clave de que el récord histórico sea barato:
-- Postgres puede resolver "MAX(piezas_entradas) para este formato"
-- tocando un puñado de filas del índice, no la tabla entera.
create index idx_parte_formato_record
  on parte (formato_id, vigente, completado, piezas_entradas desc);

-- -------------------------------------------------------------
-- v_rey_formato_historico — récord absoluto por formato (un solo
-- parte). Empates: se incluyen TODAS las filas que igualan el
-- máximo, no solo una.
-- -------------------------------------------------------------
create or replace view v_rey_formato_historico as
with maximos as (
  select formato_id, max(piezas_entradas) as piezas_record
  from parte
  where vigente = true and completado = true and formato_id is not null
  group by formato_id
)
select
  f.nombre         as formato,
  p.operario_id,
  u.username       as operario_username,
  p.piezas_entradas,
  t.fecha,
  t.tipo           as turno_tipo,
  l.nombre         as linea_nombre
from parte p
join maximos m on m.formato_id = p.formato_id and m.piezas_record = p.piezas_entradas
join formato f on f.id = p.formato_id
join turno t on t.id = p.turno_id
join linea l on l.id = p.linea_id
left join usuario u on u.id = p.operario_id
where p.vigente = true and p.completado = true;

comment on view v_rey_formato_historico is
  'Récord histórico de piezas de un formato en un solo parte, con '
  'TODOS los empates si los hay. Apoyada en idx_parte_formato_record '
  '— resuelve el MAX por formato sin escanear parte entera.';

-- -------------------------------------------------------------
-- v_rey_formato_actual — más piezas de un formato acumuladas en el
-- ciclo EN CURSO, sumando todas las líneas/turnos del operario (ya
-- resuelto por v_piezas_operario_formato_ciclo, que agrupa por
-- operario+cycle_id+formato). Empates: mismo criterio.
-- -------------------------------------------------------------
create or replace view v_rey_formato_actual as
with ciclo_actual as (
  select * from v_piezas_operario_formato_ciclo
  where cycle_id = fn_ciclo_id(current_date)
),
maximos as (
  select formato, max(piezas_formato) as piezas_record
  from ciclo_actual
  group by formato
)
select
  c.formato,
  c.operario_id,
  u.username as operario_username,
  c.piezas_formato
from ciclo_actual c
join maximos m on m.formato = c.formato and m.piezas_record = c.piezas_formato
left join usuario u on u.id = c.operario_id;

comment on view v_rey_formato_actual is
  'Operario con más piezas de cada formato en el ciclo actual — '
  'agregado pequeño (pocos operarios × 7 formatos), sin problema de '
  'rendimiento. Empates: mismo criterio que v_rey_formato_historico.';

-- -------------------------------------------------------------
-- v_mi_mejor_parte_por_formato — apoyo para que el operario vea "tu
-- mejor parte" en cada formato del Ranking, aunque no sea el rey.
-- Mismo índice que el histórico, filtrado a un operario_id concreto
-- desde el cliente.
-- -------------------------------------------------------------
create or replace view v_mi_mejor_parte_por_formato as
select
  p.operario_id,
  f.nombre as formato,
  max(p.piezas_entradas) as mejor_parte
from parte p
join formato f on f.id = p.formato_id
where p.vigente = true and p.completado = true and p.operario_id is not null
group by p.operario_id, f.nombre;

comment on view v_mi_mejor_parte_por_formato is
  'Mejor parte histórico (piezas de un solo parte) de CADA operario '
  'en cada formato — para que el Ranking muestre "tu mejor parte" '
  'junto a los dos reyes, aunque el operario no sea ninguno de ellos.';
