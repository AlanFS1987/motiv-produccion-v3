-- =============================================================
-- Amplía el SELECT de programacion_orden_historico a responsable y
-- producción — hoy solo lo podían leer jefe/administrador
-- (20260927004728_historial_y_deshacer_programacion.sql), pero
-- programacion_orden (la tabla en vivo) ya es legible por jefe,
-- responsable, produccion y administrador desde su propio diseño
-- original (ver memorias/20-programacion.md, "RLS de
-- programacion_orden"). El histórico es un dato de apoyo de la misma
-- funcionalidad — no tiene sentido que estos dos roles vean la
-- programación en vivo pero no puedan saber cuándo se confirmó por
-- última vez (bug A5: la hoja de impresión no puede mostrarles la
-- fecha real del último snapshot y cae a "hoy" en silencio).
--
-- Política nueva, aditiva — no se toca la ya existente
-- (programacion_orden_historico_select, jefe/administrador), RLS
-- combina con OR, mismo criterio de siempre en este proyecto.
-- =============================================================

do $$
begin
  create policy programacion_orden_historico_select_ampliada
    on programacion_orden_historico
    for select using (fn_rol_actual() in ('responsable', 'produccion'));
exception when duplicate_object then null;
end $$;

comment on table programacion_orden_historico is
  'Foto de programacion_orden justo antes de cada confirmar_programacion. '
  'Permite deshacer_ultima_programacion() si el jefe confirma un CSV '
  'equivocado. Lectura: jefe, administrador (política original) y, '
  'desde el 27/09/2026, también responsable y producción (mismo '
  'alcance que programacion_orden en vivo) — para poder mostrar la '
  'fecha del último snapshot en la hoja de impresión (bug A5). '
  'Escritura solo vía funciones security definer.';
