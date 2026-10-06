-- =============================================================
-- Siembra de checklist_items — faltaba desde
-- 20260101000007_gamificacion_catalogos.sql: esa migración crea la
-- tabla pero nunca inserta los 6 ítems fijos descritos en
-- 03-rol-operario.md 5.9 (a diferencia de puntos_rendimiento/
-- puntos_metros, que sí traían su INSERT en la misma migración).
--
-- Efecto real detectado en sesión 19/08/2026: la pantalla Limpieza
-- del operario se queda en blanco al desplegar cualquier línea,
-- porque no hay ningún checklist_items.activo=true que listar.
--
-- Idempotente (WHERE NOT EXISTS) — segura de ejecutar aunque ya se
-- hubieran insertado a mano algunos de estos ítems.
-- =============================================================

insert into checklist_items (nombre, puntos, activo)
select v.nombre, 1, true
from (values
  ('Limpiar cristales cualitrón'),
  ('Limpiar bancada línea'),
  ('Limpiar apiladores'),
  ('Limpiar empaquetadora'),
  ('Limpiar transporte'),
  ('Limpiar paletizador')
) as v(nombre)
where not exists (
  select 1 from checklist_items existente where existente.nombre = v.nombre
);
