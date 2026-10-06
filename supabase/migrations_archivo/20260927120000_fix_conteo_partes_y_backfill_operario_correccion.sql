-- =============================================================
-- Dos correcciones aplicadas manualmente en Supabase (SQL Editor)
-- el 27/09/2026, documentadas aquí a posteriori:
--
-- A) v_partes_operario_ciclo — el "número de partes" del Ranking
--    contaba filas de `parte` (count(*)), lo que inflaba el conteo
--    cuando un mismo turno+línea tenía varios partes por cambios de
--    tono/lote a mitad de turno (no solo por trabajar 2 líneas
--    distintas, como decía el comentario original de
--    20260825190000_conteo_partes_turnos_ranking.sql). Se cambia a
--    contar turno+línea DISTINTOS trabajados. Solo afecta al ciclo
--    en curso y a los que se cierren desde ahora — los ciclos ya
--    cerrados en historial_ciclos NO se recalcularon (decisión: el
--    histórico ya cerrado no se toca).
--
-- B) Backfill puntual del bug de corrección de partes (lib/parte.ts,
--    corregirParte no copiaba operario_id ni las verificaciones del
--    parte original al insertar la corrección). Localizados y
--    corregidos 2 casos reales de septiembre/2026 (parte corregido
--    9c2e8264-05e7-4e5e-83b9-279e0110b5e2 y
--    e3a1c945-ebbc-4b2c-86fb-b8747964c4fd), acotado por id exacto,
--    sin condición genérica. Confirmado tras el UPDATE: 0 filas
--    pendientes en la consulta de revisión (corregido.operario_id
--    is null and original.operario_id is not null).
-- =============================================================

-- -------------------------------------------------------------
-- A) Conteo de partes → turno+línea distintos
-- -------------------------------------------------------------
create or replace view v_partes_operario_ciclo as
select
  p.operario_id,
  fn_ciclo_id(t.fecha)                        as cycle_id,
  count(distinct (p.turno_id, p.linea_id))    as partes_completados
from parte p
join turno t on t.id = p.turno_id
where p.vigente = true and p.completado = true and p.operario_id is not null
group by p.operario_id, fn_ciclo_id(t.fecha);

comment on view v_partes_operario_ciclo is
  'Turno+línea DISTINTOS trabajados por operario+ciclo, para '
  'CUALQUIER cycle_id — base de "partes" en el Ranking y de '
  'partes_completados en historial_ciclos. Corregido 27/09/2026: '
  'antes contaba filas de parte (count(*)), lo que inflaba el '
  'número cuando el mismo turno+línea tenía varios partes por '
  'cambios de tono/lote a mitad de turno, no solo por trabajar 2 '
  'líneas distintas. Los ciclos ya cerrados en historial_ciclos '
  'ANTES de esta fecha conservan el conteo antiguo, a propósito '
  '(decisión: el histórico cerrado no se recalcula).';

-- -------------------------------------------------------------
-- B) Backfill puntual — YA APLICADO manualmente el 27/09/2026.
-- Se deja aquí solo como constancia; NO se re-ejecuta al desplegar
-- esta migración en otro entorno (por eso NO lleva WHERE genérico:
-- si algún día se reconstruye la BD desde cero, este UPDATE no
-- encontrará esos ids y no hará nada, lo cual es correcto — el bug
-- de origen ya está resuelto en el código, así que un entorno nuevo
-- nunca debería producir este caso).
-- -------------------------------------------------------------
update parte corregido
set
  operario_id = original.operario_id,
  fotos_caja = original.fotos_caja,
  verificacion_caja_detalle = original.verificacion_caja_detalle,
  verificacion_codbar_estado = original.verificacion_codbar_estado,
  verificacion_codbar_detalle = original.verificacion_codbar_detalle,
  verificacion_caja_estado_operario = original.verificacion_caja_estado_operario,
  fotos_caja_operario = original.fotos_caja_operario,
  verificacion_caja_detalle_operario = original.verificacion_caja_detalle_operario,
  verificacion_codbar_estado_operario = original.verificacion_codbar_estado_operario,
  verificacion_codbar_detalle_operario = original.verificacion_codbar_detalle_operario
from parte original
where corregido.corrige_a_parte_id = original.id
  and corregido.id in (
    '9c2e8264-05e7-4e5e-83b9-279e0110b5e2',
    'e3a1c945-ebbc-4b2c-86fb-b8747964c4fd'
  );