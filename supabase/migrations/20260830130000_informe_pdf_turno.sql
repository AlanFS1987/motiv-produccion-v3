-- =============================================================
-- Informe de turno en PDF (evolución del resumen de texto).
--
-- Diseño acordado: el PDF SOLO se genera al cerrar el turno (dentro
-- de `generar-resumen-turno`, el mismo disparo que ya existe para
-- Telegram — manual o por cron, nunca lo llama el frontend
-- directamente). Se guarda su URL para que:
--   - El propio mensaje de Telegram lleve el enlace al final.
--   - El botón "Copiar" de ResumenScreen (pestaña Resumen) pueda
--     añadir esa misma línea al texto SOLO si el turno ya está
--     cerrado y existe informe_pdf_url — si el responsable copia
--     el resumen con el turno todavía abierto, no hay enlace,
--     porque el PDF todavía no existe.
--
-- Ref. conversación "Informe PDF de turno", sesión 30/08/2026.
-- =============================================================

alter table turno
  add column if not exists informe_pdf_url text;

comment on column turno.informe_pdf_url is
  'URL pública (Cloudinary) del PDF del informe de turno, generado '
  'por generar-resumen-turno SOLO al cerrar el turno. NULL mientras '
  'el turno sigue abierto/en revisión, o si la generación del PDF '
  'falló (no bloquea el envío del resumen a Telegram, ver comentario '
  'en la Edge Function).';
