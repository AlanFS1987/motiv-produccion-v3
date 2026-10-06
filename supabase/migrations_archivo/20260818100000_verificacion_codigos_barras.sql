-- Verificación de códigos de barras por escaneo en vivo (3.8).
-- Extiende el mismo patrón de verificacion_caja_estado/detalle
-- (verificación de caja, 3.5), pero aquí no existe el estado
-- "incorrecto": un código escaneado o coincide exactamente con uno
-- de los 4 valores esperados del lote (codbar_caja/codbar_pieza/
-- cod_upec/codbar_saso), o no coincide con ninguno y se ignora en
-- silencio (ver 01-rol-responsable.md 3.8) — la propia pantalla ya
-- muestra "Código leído" en vivo para que el responsable note si algo
-- no cuadra, sin que la base de datos tenga que modelar esa
-- ambigüedad.
-- Sesión 18/08/2026.

alter table parte
  add column if not exists verificacion_codbar_estado text
    check (verificacion_codbar_estado in ('completo', 'parcial', 'manual', 'no_realizada')),
  add column if not exists verificacion_codbar_detalle jsonb;

comment on column parte.verificacion_codbar_estado is
  'completo = los 4 campos con valor esperado quedaron verificados por '
  'escáner; parcial = alguno sí, alguno no; manual = botón "Confirmar '
  'a mano" (mismo criterio que verificado_manual en '
  'verificacion_caja_estado, distinto de un match real por escáner); '
  'no_realizada = el lote no tiene ningún código de barras esperado, '
  'o el responsable no llegó a intentar nada.';

comment on column parte.verificacion_codbar_detalle is
  'jsonb: array de los campos con valor esperado en el lote '
  '(codbar_caja/codbar_pieza/cod_upec/codbar_saso), cada uno con '
  '{campo, etiqueta, valorEsperado, verificado} — mismo propósito '
  'de auditoría futura que verificacion_caja_detalle. No guarda '
  'códigos leídos que no encajaron con ningún campo esperado, esos '
  'son solo feedback visual efímero en pantalla, no se persisten.';

notify pgrst, 'reload schema';
