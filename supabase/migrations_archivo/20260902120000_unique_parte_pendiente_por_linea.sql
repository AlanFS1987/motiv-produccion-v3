-- =============================================================
-- Evita que una línea+turno tenga más de un `parte` pendiente
-- (completado=false, vigente=true) a la vez.
--
-- Bug real detectado en sesión 02/09/2026: Foto 1 (hoja de partida)
-- ya crea el parte en el momento de confirmar los datos leídos —
-- si el responsable le da "atrás" después de eso (sin cerrar el
-- parte) y luego entra por "Continuar" o "Nuevo tono/calibre", se
-- crea un SEGUNDO parte pendiente para la misma línea+turno. El
-- primero queda huérfano y reaparece más tarde al volver a esa
-- línea, tapando el que sí se completó.
--
-- Este índice hace que la base de datos rechace ese segundo INSERT
-- directamente, sea cual sea la causa (bug de la app, doble
-- pulsación, titular+suplente a la vez) — capa de seguridad real,
-- no solo una comprobación en el cliente.
-- =============================================================

create unique index uq_parte_pendiente_por_linea_turno
on parte (turno_id, linea_id)
where vigente = true and completado = false;

comment on index uq_parte_pendiente_por_linea_turno is
  'Solo puede haber UN parte pendiente (completado=false, vigente '
  'true) por línea+turno. Ver sesión 02/09/2026 — bug de partes '
  'duplicados al volver atrás tras la Foto 1.';