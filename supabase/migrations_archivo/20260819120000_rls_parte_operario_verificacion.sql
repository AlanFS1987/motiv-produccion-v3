-- =============================================================
-- RLS: permite al operario actualizar `parte` para su propia
-- verificación de caja/códigos de barras ("Mi línea",
-- 03-rol-operario.md 5.X).
--
-- Hasta ahora `parte` solo tenía policies de SELECT (todos los
-- roles) e INSERT (responsable/suplente/administrador) — ver
-- 20260101000010_rls.sql. No existía ningún UPDATE para operario,
-- así que un intento de escribir en
-- verificacion_caja_estado_operario / verificacion_codbar_estado_operario
-- fallaría en silencio (PostgREST no da error cuando un UPDATE no
-- afecta ninguna fila por RLS — mismo patrón ya detectado antes,
-- ver CLAUDE.md).
--
-- Igual que el resto de policies de esta app (ver comentario en
-- turno_update_responsable, 20260101000015), la restricción es a
-- nivel de FILA, no de columna: cualquier operario con
-- operario_id = auth.uid() en esa fila puede hacer un UPDATE, pero
-- la app solo le pide los campos *_operario — no hay blindaje de
-- base de datos contra que el cliente intente tocar piezas/tiempos
-- también. Coherente con el resto de RLS de este proyecto.
--
-- Se SUMA a las policies existentes (RLS combina con OR) — no se
-- toca 20260101000010_rls.sql.
-- =============================================================

create policy parte_update_operario_verificacion on parte
  for update
  using (operario_id = auth.uid())
  with check (operario_id = auth.uid());

comment on policy parte_update_operario_verificacion on parte is
  'Permite a "Mi línea" (03-rol-operario.md 5.X) que el operario '
  'asignado a la línea+turno actualice sus propias columnas de '
  'verificación (*_operario). Restricción por fila (operario_id), no '
  'por columna — mismo criterio que el resto de policies del '
  'proyecto.';
