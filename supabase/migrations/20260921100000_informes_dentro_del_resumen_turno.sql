-- =============================================================
-- Informes diario/semanal DENTRO del resumen de turno. 21/09/2026.
--
-- Hasta ahora, al cerrarse un turno de noche salían DOS cosas por
-- separado: el resumen de turno (generar-resumen-turno) y, por el
-- trigger trg_turno_informe_periodo_cierre, un mensaje aparte con el
-- informe diario (y el semanal los domingos). Decisión: van juntos.
-- generar-resumen-turno pide ahora esos informes a
-- generar-informe-periodo (enviar:false) cuando el turno cerrado es el
-- de noche y añade sus enlaces al final del mismo mensaje.
--
-- Por eso se ELIMINA el trigger de cierre: si siguiera activo mandaría
-- el informe suelto a la vez, duplicado.
--
-- NO se toca el cron de respaldo (informes-periodo-pendientes /
-- fn_encolar_informes_periodo_pendientes): sigue siendo la red de
-- seguridad. Si el resumen de turno no llegó a incluir un informe (falló
-- o tardó demasiado) o el turno de noche no existió, el cron lo manda
-- como mensaje suelto a partir de 75 min después de acabar el periodo.
-- Los informes que sí fueron dentro del resumen quedan marcados con
-- informe_periodo.enviado_at (lo hace generar-resumen-turno), así que el
-- cron no los repite.
-- =============================================================

drop trigger if exists trg_turno_informe_periodo_cierre on turno;
drop function if exists fn_trigger_informe_periodo_cierre();

comment on function fn_encolar_informes_periodo_pendientes() is
  'Red de seguridad de los informes diario/semanal: reintenta, como '
  'mensaje suelto, los que no se enviaron dentro del resumen de turno '
  '(periodo terminado hace >75 min y <30 h el diario / <4 días el '
  'semanal). Ver 19-informes-periodo.md.';
