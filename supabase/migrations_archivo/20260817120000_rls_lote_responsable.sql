-- Permite a responsable/suplente actualizar `lote` — hacía falta para
-- el botón Finalizar/Reabrir de "Gestión de lotes" (01-rol-
-- responsable.md 3.10), que hasta ahora fallaba en silencio: la
-- política genérica de catálogos (20260101000010_rls.sql) solo
-- permite escritura al rol administrador, y PostgREST no da error
-- cuando un UPDATE no afecta ninguna fila por RLS — mismo patrón ya
-- detectado una vez en `corregirParte` (ver CLAUDE.md).
--
-- Se suma esta política nueva sin tocar la existente
-- (`lote_admin_todo`) — RLS combina políticas permisivas con OR.
-- Deliberadamente amplia (cualquier responsable/suplente puede
-- actualizar cualquier lote, no solo "el suyo") — mismo criterio ya
-- usado para `turno_update_responsable` en
-- 20260101000015_rls_turno_asignacion.sql: un lote no tiene un dueño
-- individual real, lo pueden tocar responsables de turnos distintos.
-- Sesión 17/08/2026.

create policy lote_update_responsable on lote
  for update using (fn_rol_actual() in ('responsable', 'suplente'))
  with check (fn_rol_actual() in ('responsable', 'suplente'));

comment on policy lote_update_responsable on lote is
  'Permite Finalizar/Reabrir desde la pantalla de Gestión de lotes '
  '(01-rol-responsable.md 3.10). Deliberadamente amplia, mismo '
  'criterio que turno_update_responsable.';
