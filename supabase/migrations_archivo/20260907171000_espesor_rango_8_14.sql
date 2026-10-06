-- =============================================================
-- Amplía lote.espesor: antes solo '9mm'/'11mm' exactos, ahora
-- cualquier valor entre 8 y 12mm (hasta un decimal) — hojas reales
-- confirmadas con 9,5mm y 10,5mm. Ref. sesión 07/09/2026.
-- =============================================================

alter table lote drop constraint lote_espesor_check;

alter table lote add constraint lote_espesor_check
  check (
    espesor ~ '^\d{1,2}(\.\d)?mm$'
    and split_part(espesor, 'mm', 1)::numeric between 8 and 12
  );