-- supabase/migrations/20260814160000_parte_hora_captura_texto_crudo.sql
alter table public.parte
  add column hora_captura_pantalla_texto_crudo text null;

comment on column public.parte.hora_captura_pantalla_texto_crudo is
  'Texto crudo del OCR para la hora de pantalla (Foto 3), tal cual lo leyó Claude, antes de cualquier intento de parseo a timestamptz. Útil para auditar por qué falló el parseo automático cuando hora_captura_pantalla queda en null. Ver 01-rol-responsable.md 3.2.';