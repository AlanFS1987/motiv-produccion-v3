-- La columna `lote.resumen_calidad_enviado_at` estaba documentada en
-- 11-esquema-supabase.md como si ya existiera, pero nunca se llegó a
-- crear con una migración real (a diferencia de `fotos_caja` o
-- `verificacion_caja_detalle`, sesión 15/08, que sí la tienen) — solo
-- se detectó al fallar `notificar-telegram-resumen-calidad` en real
-- con "column lote.resumen_calidad_enviado_at does not exist".
-- Sesión 18/08/2026.

alter table lote
  add column if not exists resumen_calidad_enviado_at timestamptz;

comment on column lote.resumen_calidad_enviado_at is
  'Cuándo salió este lote en un digest de "Resúmenes calidad" '
  '(notificar-telegram-resumen-calidad). NULL = pendiente de incluir '
  'en el próximo envío. Se limpia a NULL si el lote se reabre después '
  'de haber salido ya en un digest (ver fn_reabrir_lote_si_finalizado) '
  'para que vuelva a aparecer si se finaliza otra vez.';

-- Se extiende la función de reapertura ya existente (0004_core.sql)
-- para que también limpie esta columna — así un lote reabierto que
-- ya había salido en un digest vuelve a ser candidato al siguiente,
-- en vez de quedar "olvidado" para siempre por haber salido una vez.
create or replace function fn_reabrir_lote_si_finalizado(p_lote_id uuid)
returns void language plpgsql as $$
begin
  update lote
  set estado = 'iniciado',
      resumen_calidad_enviado_at = null
  where id = p_lote_id and estado = 'finalizado';
end;
$$;
