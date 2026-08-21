-- =============================================================
-- Elimina fn_es_responsable_de_turno: función no usada por ninguna
-- policy (confirmado contra pg_policies en la BD real, 21/08/2026).
-- Tenía además un bug de diseño (el "or fn_rol_actual() in
-- ('responsable','suplente')" final anulaba la comprobación real de
-- exists(...) contra p_turno_id, devolviendo true para cualquier
-- responsable/suplente sin importar el turno) — se retira en vez de
-- arreglar, al no tener ningún uso real que preservar.
-- =============================================================

drop function if exists fn_es_responsable_de_turno(uuid);