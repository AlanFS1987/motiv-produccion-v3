-- =============================================================
-- Ajuste final del horario del cron de resumen de turno.
--
-- Contexto: 20260816230000_resumen_turno_automatico.sql lo dejó en
-- '*/15 * * * *' y 20260816230001_resumen_turno_automatico.sql lo
-- cambió a '0 7,15,23 * * *' (3 veces al día, con margen de 1-2h por
-- el cambio de horario de verano/invierno). Después de eso se afinó
-- dos veces más DIRECTAMENTE en el SQL Editor (sin migración de por
-- medio): primero a '*/5 * * * *', y finalmente al valor real de
-- abajo — así que ninguno de los dos archivos anteriores refleja ya
-- el horario que de verdad tiene el cron en producción.
--
-- Esta migración no cambia ningún archivo histórico (no se edita una
-- migración ya aplicada) — solo dispara de nuevo `cron.schedule` con
-- el valor final acordado, para que el historial completo de
-- migraciones, ejecutado desde cero en cualquier entorno nuevo,
-- termine exactamente en el mismo sitio donde está esta base de datos
-- ahora mismo. `cron.schedule` con un nombre de job que ya existe
-- actualiza ese job en su sitio (no crea uno duplicado).
--
-- Por qué cada hora en punto basta, sin ventanas ni horas UTC
-- memorizadas a mano: España nunca tiene un desfase de horas y media
-- contra UTC, siempre es +1 (invierno) o +2 (verano) — un número
-- ENTERO de horas. Cualquier hora en punto en Madrid coincide siempre
-- con una hora en punto en UTC (con otro número), así que un cron que
-- dispara en cada hora en punto de UTC coincide siempre con los 3
-- cierres reales (15:00 / 23:00 / 07:00 de Madrid), sin importar la
-- estación. La corrección de fondo la sigue dando por completo
-- `fn_encolar_resumenes_turno_pendientes` (comparando con
-- `at time zone 'Europe/Madrid'`) — este archivo no toca esa función,
-- solo el horario de disparo.
--
-- Ref. 01-rol-responsable.md 3.9b, 06-integraciones.md.
-- =============================================================

-- Mismo patrón defensivo que 0001_extensiones_config.sql: si pg_cron
-- no está disponible en este entorno (ej. reconstrucción desde cero
-- en un proyecto nuevo donde 0001 no pudo activarlo), avisa sin
-- romper el resto del despliegue.
do $$
begin
  perform cron.schedule(
    'resumenes-turno-pendientes',
    '0 * * * *',
    $cron$select fn_encolar_resumenes_turno_pendientes();$cron$
  );
exception when others then
  raise notice 'No se pudo actualizar el horario del cron de resumen '
               'de turno (pg_cron no disponible en este entorno) — '
               'programarlo manualmente en Supabase (Database > Cron '
               'Jobs) antes de confiar en el envío automático.';
end $$;
