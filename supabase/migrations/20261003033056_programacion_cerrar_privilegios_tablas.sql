-- 03/10/2026 — Cierra los privilegios de las tablas de programación (solo SELECT a authenticated).
--
-- Contexto: la migración 20261002131613 cerró `programacion_orden` (`revoke all` a anon/authenticated +
-- `grant select` a authenticated), pero `programacion_orden_historico` quedó con INSERT/UPDATE/DELETE/
-- TRUNCATE/REFERENCES/TRIGGER para `anon` y `authenticated` (privilegios por defecto de Supabase). La RLS
-- (solo políticas de SELECT, sin escritura) frena INSERT/UPDATE/DELETE por la API, pero los privilegios
-- sobran (y TRUNCATE no pasa por RLS). Las tablas de notas y frases (20261003021449) ya nacieron cerradas;
-- se repite aquí de forma idempotente para que las tres queden con el mismo patrón.
--
-- No afecta a nada: el historial solo lo escriben `confirmar_programacion` y `deshacer_ultima_programacion`
-- (security definer, propietario postgres) y el frontend no lo toca directamente. Las políticas de SELECT
-- siguen vigentes; service_role y postgres conservan sus privilegios.

revoke all on programacion_orden_historico from public, anon, authenticated;
grant select on programacion_orden_historico to authenticated;

revoke all on programacion_nota from public, anon, authenticated;
grant select on programacion_nota to authenticated;

revoke all on programacion_nota_frase from public, anon, authenticated;
grant select on programacion_nota_frase to authenticated;
