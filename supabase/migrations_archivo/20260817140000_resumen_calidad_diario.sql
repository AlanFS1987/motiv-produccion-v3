-- Grupo "Resúmenes calidad" (06-integraciones.md, grupo 2).
-- Digest 3 veces al día (7:00 / 15:00 / 23:00, hora de Madrid — mismas
-- franjas que los cambios de turno) de todos los lotes marcados
-- `finalizado` desde el último envío. Cambiado de "1 vez a las 8:00"
-- a "3 veces, en cada cambio de turno" — así el digest llega poco
-- después de cerrar cada turno, con los lotes de ese turno concreto,
-- en vez de un único resumen mezclado del día anterior. Sesión
-- 17/08/2026.
--
-- Mismo patrón anti-cambio-de-hora que el cron de turnos
-- (20260816233543_ajuste_horario_cron_resumen_turno.sql): dispara
-- CADA HORA en punto (UTC), y es la condición de dentro la que
-- compara contra la hora real de Madrid — así nunca hace falta tocar
-- nada a mano por el cambio de horario verano/invierno. El resto de
-- las 21 veces al día que dispara sin ser 7/15/23, no hace nada (no
-- llama ni siquiera a la Edge Function). Si en alguna de esas 3
-- franjas no hay ningún lote finalizado, la Edge Function no manda
-- mensaje (mismo criterio ya cerrado en 06-integraciones.md).

-- Dispara la Edge Function — mismo patrón que fn_disparar_resumen_turno.
create or replace function fn_disparar_resumen_calidad()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  -- OJO: misma URL base que el resto de funciones de este archivo.
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram-resumen-calidad';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Mismo patrón defensivo que el resto de crons de este proyecto: si
-- pg_cron no está disponible en este entorno, avisa sin romper el
-- resto del despliegue.
do $$
begin
  perform cron.schedule(
    'resumen-calidad-diario',
    '0 * * * *',
    $cron$
      select fn_disparar_resumen_calidad()
      where extract(hour from (now() at time zone 'Europe/Madrid')) in (7, 15, 23);
    $cron$
  );
exception when others then
  raise notice 'No se pudo programar el cron job de resumen de calidad '
               '(pg_cron no disponible en este entorno) — programarlo '
               'manualmente en Supabase (Database > Cron Jobs) antes de '
               'confiar en el envío automático.';
end $$;
