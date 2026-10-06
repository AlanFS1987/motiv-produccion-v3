-- =============================================================
-- Gamificación — logros 100% por consulta (sesión 22/08/2026)
-- Ref.: gamificacion-resumen-sesion-22-08-2026.md, secciones 6 y 9
--
-- Con "Ciclo Legendario" sustituyendo a "Turno Legendario", los 19
-- logros de operario dejan de necesitar cualquier motor que escriba
-- nada: se calculan siempre al vuelo (sum/count sobre
-- historial_ciclos + ciclo en vivo). Consecuencia directa: la tabla
-- operario_logro (progreso guardado por usuario+logro, con
-- primera_vez_at/ultima_vez_at) se queda sin función — nadie la
-- escribiría ni la leería — y se elimina entera, no solo sus
-- columnas de fecha.
-- =============================================================

-- -------------------------------------------------------------
-- 1) historial_ciclos — faltan 3 columnas de m² por categoría para
--    poder calcular "Montaña de escombros" / "Demasiado material
--    pulido" / "De primerísima calidad". cerrar-ciclo (aún sin
--    construir) tendrá que rellenarlas igual que rellena m2_total.
-- -------------------------------------------------------------
alter table historial_ciclos
  add column if not exists m2_contenedor numeric default 0,
  add column if not exists m2_com        numeric default 0,
  add column if not exists m2_std        numeric default 0;

comment on column historial_ciclos.m2_contenedor is
  'm² de piezas_contenedor del ciclo, para el logro de tramo '
  '"Montaña de escombros". Rellenado por cerrar-ciclo.';
comment on column historial_ciclos.m2_com is
  'm² de piezas_comercial del ciclo, para el logro de tramo '
  '"Demasiado material pulido". Rellenado por cerrar-ciclo.';
comment on column historial_ciclos.m2_std is
  'm² de piezas_1a (estándar) del ciclo, para el logro de tramo '
  '"De primerísima calidad". Rellenado por cerrar-ciclo.';

-- -------------------------------------------------------------
-- 2) logros_definicion — 3 cambios de esquema respecto a la
--    migración 0007 original, necesarios para el CSV real de los 19
--    logros:
--    - rol: hoy todo es operario; deja preparado el terreno para la
--      fase 2 de logros de responsable sin tocar el esquema otra vez.
--    - formato_nombre: solo lo usan los logros de piezas_por_formato
--      (7 de los 16 de tramo).
--    - condicion_valor pasa a nullable: "Rey de Reyes" no tiene un
--      umbral numérico, se resuelve comparando puntos_ciclo entre
--      operarios del mismo cycle_id.
-- -------------------------------------------------------------
alter table logros_definicion
  add column if not exists rol text not null default 'operario',
  add column if not exists formato_nombre text;

alter table logros_definicion
  alter column condicion_valor drop not null;

comment on table logros_definicion is
  'Catálogo de logros — 100% por consulta desde la sesión '
  '22/08/2026: sin tabla de progreso asociada. condicion_tipo agrupa '
  'en la práctica en 2 familias (no 3 — "turno" ya no existe): '
  '"tramo" (sum(columna)/condicion_valor, redondeo hacia abajo, '
  'contra historial_ciclos + ciclo en vivo) y "ciclo" '
  '(count(*) de historial_ciclos que cumplen la condición, o para '
  'Rey de Reyes, comparación de puntos_ciclo agrupada por cycle_id '
  'sin condicion_valor numérico).';

-- -------------------------------------------------------------
-- 3) operario_logro — sin función tras el cambio de arriba (ver
--    cabecera). Tabla vacía, nada construido encima todavía
--    (sin pantalla de logros, ver 08-pendientes.md).
-- -------------------------------------------------------------
drop table if exists operario_logro;
