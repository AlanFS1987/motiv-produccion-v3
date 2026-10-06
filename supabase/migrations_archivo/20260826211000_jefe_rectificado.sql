-- =============================================================
-- jefe_rectificado — rol de la sección de rectificado (anterior a
-- clasificación), NO es una variante de "jefe": ve datos reducidos
-- de la propia `parte` (misma tabla, sin tablas nuevas). Sin
-- incidencias, sin Ceria, sin gamificación, sin operario/responsable
-- (esa sección no tiene esos roles dentro de esta app todavía).
--
-- Vistas nuevas y propias (no reutiliza v_produccion_turno/
-- v_calidad_turno del jefe a secas) porque el desglose de tiempos es
-- distinto (3 bloques en vez de 5) y la calidad usa
-- calibre_com_pct/calibre_std_pct, no 1ª/comercial/eco/contenedor.
-- =============================================================

-- -------------------------------------------------------------
-- RLS: jefe_rectificado necesita SELECT en `parte` (hoy excluido de
-- parte_select_todos, ver 20260101000010_rls.sql). Política ADITIVA
-- (RLS combina con OR) — no se toca la política existente.
-- turno/linea/configuracion/usuario ya son legibles por "cualquier
-- autenticado" o "cualquier rol conocido", así que no hace falta
-- tocarlos.
-- -------------------------------------------------------------
create policy parte_select_jefe_rectificado on parte
  for select using (
    fn_rol_actual() = 'jefe_rectificado'
  );

comment on policy parte_select_jefe_rectificado on parte is
  'Rol de rectificado: solo lectura, vía las vistas v_rectificado_*. '
  'Sin INSERT/UPDATE/DELETE — no gestiona ningún dato, solo consulta.';

-- -------------------------------------------------------------
-- v_rectificado_turno — Vista Rápida: por turno+línea.
-- Mismo criterio de suelo que el resto del proyecto: 480 min/línea
-- (greatest(480, minutos_total)); si se agrega el turno completo en
-- el cliente, el suelo de 2880 se calcula allí sumando denominadores,
-- igual que hace el jefe a secas.
-- -------------------------------------------------------------
create or replace view v_rectificado_turno as
select
  t.id                                                   as turno_id,
  t.fecha,
  t.tipo                                                 as tipo_turno,
  p.linea_id,
  l.nombre                                               as linea_nombre,

  sum(p.piezas_entradas)                                 as piezas_total,
  sum(p.piezas_entradas * f.area_m2)                     as m2_total,

  sum(p.minutos_total)                                   as minutos_total,
  greatest(480, sum(p.minutos_total))                    as denominador_rendimiento,

  -- 3 bloques (en vez de los 5 de v_produccion_turno):
  sum(p.minutos_plena)                                   as minutos_pleno_rendimiento,
  sum(p.minutos_no_alimentada)                            as minutos_paradas_propias,
  sum(p.minutos_saturacion + p.minutos_maquina + p.minutos_banco)
                                                          as minutos_paradas_ajenas,

  round(
    100.0 * sum(p.minutos_plena + p.minutos_no_alimentada)
    / greatest(480, sum(p.minutos_total))
  , 2)                                                    as pct_rendimiento,

  round(
    sum(p.piezas_entradas)::numeric / nullif(sum(p.minutos_plena), 0)
  , 2)                                                    as piezas_minuto,

  -- Calidad: cuadre de calibre, agregado (nunca promediar % ya
  -- redondeados — se recalcula sum/sum aquí).
  sum(p.piezas_descuadre_com)                             as piezas_descuadre_com,
  round(
    100.0 * sum(p.piezas_descuadre_com) / nullif(sum(p.piezas_entradas), 0)
  , 2)                                                    as pct_calibre_com,
  round(
    100.0 - (100.0 * sum(p.piezas_descuadre_com) / nullif(sum(p.piezas_entradas), 0))
  , 2)                                                    as pct_calibre_std,
  sum(p.piezas_descuadre_com * f.area_m2)                 as m2_calibre_com,
  sum((p.piezas_entradas - p.piezas_descuadre_com) * f.area_m2)
                                                          as m2_calibre_std

from turno t
join parte p on p.turno_id = t.id
  and p.vigente = true
  and p.completado = true
join linea l on l.id = p.linea_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
group by t.id, t.fecha, t.tipo, p.linea_id, l.nombre;

comment on view v_rectificado_turno is
  'Vista Rápida de jefe_rectificado: por turno+línea. Tiempos en 3 '
  'bloques (pleno / paradas propias = no_alimentada / paradas ajenas '
  '= saturación+máquina+banco). Calidad = cuadre/descuadre de '
  'calibre (piezas_descuadre_com), no 1ª/comercial/eco/contenedor. '
  'Rige el mismo criterio de suelo (480/línea) que el resto del '
  'proyecto — agregar varias líneas de un turno completo (suelo '
  '2880) se hace en el cliente sumando denominador_rendimiento.';

-- -------------------------------------------------------------
-- v_rectificado_modelo — Vista Detallada: añade el desglose por
-- modelo (además de turno+línea, que ya sale del acordeón sobre
-- parte/v_rectificado_turno) para la calidad de calibre.
-- -------------------------------------------------------------
create or replace view v_rectificado_modelo as
select
  t.id                                                   as turno_id,
  t.fecha,
  t.tipo                                                 as tipo_turno,
  p.linea_id,
  l.nombre                                               as linea_nombre,
  m.nombre                                                as modelo_nombre,

  sum(p.piezas_entradas)                                 as piezas_total,
  sum(p.piezas_entradas * f.area_m2)                     as m2_total,
  sum(p.piezas_descuadre_com)                             as piezas_descuadre_com,

  round(
    100.0 * sum(p.piezas_descuadre_com) / nullif(sum(p.piezas_entradas), 0)
  , 2)                                                    as pct_calibre_com,
  round(
    100.0 - (100.0 * sum(p.piezas_descuadre_com) / nullif(sum(p.piezas_entradas), 0))
  , 2)                                                    as pct_calibre_std

from turno t
join parte p on p.turno_id = t.id
  and p.vigente = true
  and p.completado = true
join linea l on l.id = p.linea_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join modelo m on m.id = pr.modelo_id
join formato f on f.id = pr.formato_id
group by t.id, t.fecha, t.tipo, p.linea_id, l.nombre, m.nombre;

comment on view v_rectificado_modelo is
  'Vista Detallada de jefe_rectificado: añade desglose por modelo a '
  'la calidad de calibre, para el acordeón turno→línea→modelo/parte.';