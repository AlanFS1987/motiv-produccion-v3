-- Detalle completo de la verificación de caja (los 4 campos:
-- marca/modelo/tono/calibre, con su estado y valores leído/esperado).
-- Sesión 15/08 tarde — ver 01-rol-responsable.md 3.5.
--
-- Se guarda tal cual lo genera evaluarVerificacionCaja() en el
-- cliente (array de 4 objetos, forma fija). jsonb en vez de tabla
-- aparte: la forma nunca cambia, y jsonb permite consultar igualmente
-- si hace falta (ej. contar fallos de un campo concreto) sin mantener
-- una tabla más para un dato de estructura fija.

alter table parte
  add column if not exists verificacion_caja_detalle jsonb;