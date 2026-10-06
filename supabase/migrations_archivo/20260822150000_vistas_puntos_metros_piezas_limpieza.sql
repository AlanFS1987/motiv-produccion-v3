-- =============================================================
-- Gamificación — 3 vistas pendientes de la sección 7 del resumen
-- de sesión 22/08/2026: metros (responsable), piezas (operario) y
-- limpieza (operario). Cierran el diseño de puntos que faltaba por
-- construir; solo queda rendimiento (ya en BD desde 0009_vistas.sql).
-- =============================================================

-- -------------------------------------------------------------
-- 1) METROS — responsable, por turno completo
--
-- Mismo patrón que v_rendimiento_responsable_por_turno
-- (20260101000009_vistas.sql): se agrega directamente sobre `parte`
-- agrupando por responsable_id+cycle_id+turno_id, con el MISMO
-- filtro que esa vista (solo vigente=true, sin completado=true) —
-- se replica adrede, no se "corrige" aquí, para que metros y
-- rendimiento sigan contando exactamente el mismo conjunto de partes
-- cuando se sumen como "total del responsable" (sección 4 del
-- resumen). Si algún día se decide añadir completado=true al cálculo
-- del responsable, debe tocarse a la vez en las dos vistas, nunca
-- solo en una — si no, "metros + rendimiento" dejaría de ser
-- comparable turno a turno.
--
-- m² = piezas_entradas × formato.area_m2, sumado parte a parte
-- (mismo patrón que v_produccion_turno/v_calidad_turno: un turno
-- puede tener varias líneas con formatos distintos, así que no vale
-- un único area_m2 para todo el turno).
-- -------------------------------------------------------------
create or replace view v_metros_responsable_por_turno as
select
  p.responsable_id,
  fn_ciclo_id(t.fecha)                    as cycle_id,
  p.turno_id,
  sum(p.piezas_entradas * f.area_m2)      as m2_total
from parte p
join turno t on t.id = p.turno_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
where p.vigente = true
group by p.responsable_id, fn_ciclo_id(t.fecha), p.turno_id;

comment on view v_metros_responsable_por_turno is
  'm² totales del turno (todas las líneas) agrupados por responsable. '
  'Mismo filtro (solo vigente=true) que v_rendimiento_responsable_'
  'por_turno a propósito — ver cabecera de la migración.';

-- -------------------------------------------------------------
-- v_puntos_metros_responsable_por_turno — el m2_total de arriba
-- resuelto al tramo de puntos_metros. m2_max nulo = sin límite
-- superior (solo el último tramo, 21000+).
-- -------------------------------------------------------------
create or replace view v_puntos_metros_responsable_por_turno as
select
  v.responsable_id,
  v.cycle_id,
  v.turno_id,
  v.m2_total,
  pm.puntos as puntos_metros_turno
from v_metros_responsable_por_turno v
join puntos_metros pm
  on v.m2_total >= pm.m2_min
  and (pm.m2_max is null or v.m2_total <= pm.m2_max);

comment on view v_puntos_metros_responsable_por_turno is
  'Puntos de metros del responsable por turno completo (sección 4: '
  'Total del responsable = metros + rendimiento). Para el ciclo, '
  'sumar puntos_metros_turno agrupando por responsable_id+cycle_id — '
  'no se crea aquí la vista "_ciclo" porque nada la consume todavía '
  '(sin pantalla ni cerrar-ciclo construidos, ver sección 8).';

-- -------------------------------------------------------------
-- 2) PIEZAS — operario, por línea+turno+formato, con el MISMO
-- reparto igualitario que rendimiento (sección 3 del resumen). Se
-- replica la misma cadena de 3 pasos que ya existe para rendimiento
-- (v_rendimiento_linea_turno → v_puntos_rendimiento_linea_turno →
-- v_puntos_rendimiento_operario_por_turno), con un paso intermedio
-- extra porque aquí hay que agrupar también por formato antes de
-- resolver el tramo (cada formato tiene su propia tabla de tramos) y
-- sumar entre formatos ANTES de repartir entre operarios — si cambia
-- el formato a mitad de turno, cada uno se puntúa aparte y la suma ya
-- resuelta es la que se reparte, no cada formato por separado.
--
-- Mismo filtro que v_rendimiento_linea_turno/v_operarios_linea_turno
-- ya vigente hoy: vigente=true AND completado=true (07-pendientes.md
-- #2 — evita contar un parte recién creado, piezas todavía a 0).
-- -------------------------------------------------------------
create or replace view v_piezas_formato_linea_turno as
select
  p.turno_id,
  fn_ciclo_id(t.fecha)     as cycle_id,
  p.linea_id,
  f.nombre                 as formato,
  sum(p.piezas_entradas)   as piezas_formato
from parte p
join turno t on t.id = p.turno_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
where p.vigente = true
  and p.completado = true
group by p.turno_id, fn_ciclo_id(t.fecha), p.linea_id, f.nombre;

comment on view v_piezas_formato_linea_turno is
  'Piezas (piezas_entradas) agregadas por línea+turno+formato, SIN '
  'distinguir operario todavía — un turno puede tener más de un '
  'formato en la misma línea si el lote cambió a mitad. Base para '
  'v_puntos_piezas_linea_turno.';

-- -------------------------------------------------------------
-- v_puntos_piezas_linea_turno — cada formato resuelto a su tramo de
-- puntos_piezas (tabla propia por formato) y sumados entre formatos
-- por línea+turno — todavía sin repartir entre operarios.
-- -------------------------------------------------------------
create or replace view v_puntos_piezas_linea_turno as
select
  v.turno_id,
  v.cycle_id,
  v.linea_id,
  sum(pp.puntos) as puntos_linea_turno
from v_piezas_formato_linea_turno v
join puntos_piezas pp
  on pp.formato = v.formato
  and v.piezas_formato >= pp.min
  and (pp.max is null or v.piezas_formato <= pp.max)
group by v.turno_id, v.cycle_id, v.linea_id;

comment on view v_puntos_piezas_linea_turno is
  'Puntos de piezas de la línea+turno, ya sumados entre todos los '
  'formatos que hubo (si cambió el formato a mitad de turno) — '
  'todavía sin repartir entre operarios distintos de esa línea+turno.';

-- -------------------------------------------------------------
-- v_puntos_piezas_operario_por_linea_turno — reparto igualitario,
-- MISMA lógica que v_puntos_rendimiento_operario_por_turno: se
-- divide entre el número de operario_id distintos que aparecen en
-- esa línea+turno (v_operarios_linea_turno, ya existente).
-- -------------------------------------------------------------
create or replace view v_puntos_piezas_operario_por_linea_turno as
select
  op.operario_id,
  plt.cycle_id,
  plt.turno_id,
  plt.linea_id,
  plt.puntos_linea_turno::numeric
    / count(*) over (partition by plt.turno_id, plt.linea_id) as puntos_operario
from v_puntos_piezas_linea_turno plt
join v_operarios_linea_turno op
  on op.turno_id = plt.turno_id and op.linea_id = plt.linea_id;

comment on view v_puntos_piezas_operario_por_linea_turno is
  'Puntos de piezas de cada línea+turno (ya sumados entre formatos) '
  'repartidos a partes iguales entre los operarios que tuvieron parte '
  'ahí — mismo criterio que rendimiento (sección 3 del resumen). '
  'puntos_operario es numeric, puede salir con decimales.';

-- -------------------------------------------------------------
-- 3) LIMPIEZA — operario, por turno completo (sin línea). Suma
-- directa de checklist_items.puntos (no siempre 1 — cada ítem tiene
-- su propio valor) de lo que marcó ese operario, agrupado por
-- operario+turno. Sin reparto: la limpieza se atribuye a quien marcó
-- el ítem, sin relación con la asignación de línea (sección 3).
-- -------------------------------------------------------------
create or replace view v_puntos_limpieza_operario_por_turno as
select
  oc.operario_id,
  oc.turno_id,
  fn_ciclo_id(t.fecha)   as cycle_id,
  sum(ci.puntos)         as puntos_limpieza_turno
from operario_checklist oc
join checklist_items ci on ci.id = oc.checklist_item_id
join turno t on t.id = oc.turno_id
group by oc.operario_id, oc.turno_id, fn_ciclo_id(t.fecha);

comment on view v_puntos_limpieza_operario_por_turno is
  'Puntos de limpieza del operario, sumados por turno completo (sin '
  'línea, un operario puede limpiar varias). Sección 4 del resumen: '
  'solo aparece en el historial si el total es > 0 — ese filtro lo '
  'aplica quien consuma esta vista, no la vista en sí (una fila con '
  '0 puntos no es incorrecta, solo no se muestra).';
