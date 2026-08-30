-- =============================================================
-- v_lote_pendiente — cuánto queda por producir de cada lote, en m²
-- y en piezas. Pedido por el responsable para la pestaña "Lotes" y
-- para la Vista de Relevo (ver el lote abierto que deja el turno
-- anterior con su pendiente, no solo su tono/calibre).
--
-- pendiente = objetivo_m2 (editable a mano en el paso "hoja" de la
-- Foto 1, ver 02-responsable.md) MENOS lo ya producido — sumando
-- piezas_entradas de TODOS los partes vigentes y completados de ese
-- lote, en cualquier línea/turno (un lote puede estar en varias
-- líneas a la vez, 01-dominio.md). LEFT JOIN a propósito (no el
-- mismo patrón que v_calidad_lote, que es INNER): aquí interesan
-- también los lotes recién creados sin ningún parte completado
-- todavía — su pendiente es simplemente el objetivo completo.
--
-- objetivo_m2 es NULLABLE (algunas hojas no lo traen claro) — el
-- pendiente sale NULL en ese caso, nunca 0: 0 significa "ya
-- completado", NULL significa "no hay objetivo capturado con el que
-- comparar". Clampado a 0 por abajo si se ha producido más que el
-- objetivo (no se muestra un pendiente negativo).
--
-- piezas_objetivo/piezas_pendiente se derivan de objetivo_m2 /
-- area_m2 del formato — mismo criterio que el resto del proyecto
-- para pasar de m² a piezas (formato.area_m2, ver
-- 20260820180000_formato_area_m2.sql).
--
-- Sin RLS propia: hereda de las tablas base, todas ya legibles por
-- cualquier rol autenticado (lote/producto/modelo/marca/formato son
-- catálogos de SELECT abierto, 20260101000010_rls.sql; parte tiene
-- parte_select_todos con responsable/suplente incluidos).
-- =============================================================

create or replace view v_lote_pendiente as
select
  lo.id                                        as lote_id,
  lo.numero_orden,
  lo.estado                                    as lote_estado,
  lo.objetivo_m2,
  m.nombre                                     as modelo_nombre,
  ma.nombre                                    as marca_nombre,
  f.nombre                                     as formato_nombre,
  f.area_m2,

  coalesce(prod.piezas_producidas, 0)          as piezas_producidas,
  coalesce(prod.piezas_producidas, 0) * f.area_m2 as m2_producido,

  case when lo.objetivo_m2 is null then null
       else round(lo.objetivo_m2 / f.area_m2)
  end                                           as piezas_objetivo,

  case when lo.objetivo_m2 is null then null
       else greatest(lo.objetivo_m2 - coalesce(prod.piezas_producidas, 0) * f.area_m2, 0)
  end                                           as m2_pendiente,

  case when lo.objetivo_m2 is null then null
       else greatest(round(lo.objetivo_m2 / f.area_m2) - coalesce(prod.piezas_producidas, 0), 0)
  end                                           as piezas_pendiente

from lote lo
join producto pr on pr.id = lo.producto_id
join modelo m on m.id = pr.modelo_id
join marca ma on ma.id = pr.marca_id
join formato f on f.id = pr.formato_id
left join (
  select lote_id, sum(piezas_entradas) as piezas_producidas
  from parte
  where vigente = true and completado = true
  group by lote_id
) prod on prod.lote_id = lo.id;

comment on view v_lote_pendiente is
  'Pendiente de producir por lote: objetivo_m2 menos lo ya producido '
  '(piezas_entradas de todos los partes vigentes+completados del '
  'lote, cualquier línea/turno). NULL (no 0) sin objetivo_m2 '
  'capturado — 0 significa "ya completado", NULL significa "no hay '
  'con qué comparar". Clampado a 0 si se produjo de más. Usado por '
  'lib/lote.ts (pestaña Lotes) y lib/relevo.ts (Vista de Relevo).';
