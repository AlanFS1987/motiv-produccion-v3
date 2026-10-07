-- Endurecimiento de seguridad (auditoría 06/10/2026).
--
-- 1) app_secrets: RLS activada SIN políticas. Hasta ahora la tabla solo estaba protegida
--    porque anon/authenticated no tienen ningún GRANT sobre ella (defensa de una sola capa).
--    Con RLS activada hay dos capas. Las funciones que la leen (fn_disparar_resumen_turno,
--    fn_disparar_resumen_calidad, fn_disparar_informe_periodo, fn_notificar_telegram) son
--    security definer y pertenecen a postgres, que es el dueño de la tabla y se salta la RLS;
--    service_role también la salta. No cambia el comportamiento de nada que funcione hoy.
alter table public.app_secrets enable row level security;

-- 2) fn_disparar_resumen_turno era ejecutable por cualquier usuario autenticado vía RPC
--    (security definer sin comprobar el rol): cualquiera podía forzar el reenvío de un
--    resumen de turno a Telegram. Solo la llaman el trigger de cierre de turno y el cron.
--
--    ORDEN IMPORTANTE: el trigger trg_turno_resumen_cierre se ejecuta con los permisos de
--    quien cierra el turno (un responsable autenticado). Si se retira el EXECUTE sin más,
--    cerrar un turno falla con "permission denied". Por eso primero el trigger pasa a
--    security definer (se ejecuta como postgres) y solo después se retira el permiso.
--    El cron corre como postgres y no se ve afectado.
alter function public.fn_trigger_resumen_turno_cierre()
  security definer
  set search_path = public, pg_temp;

revoke execute on function public.fn_disparar_resumen_turno(uuid) from public, anon, authenticated;
