-- =============================================================
-- Envío automático del resumen de turno.
--
-- Diseño: un turno puede cerrarse de 2 formas (manual o automático
-- por reloj) — en vez de dos mecanismos de disparo distintos, se
-- generaliza a UN solo evento (`turno.cerrado_at` pasando de null a
-- una fecha) del que cuelga UN solo trigger. Lo único que cambia
-- entre los dos caminos es CÓMO se detecta ese evento:
--   - Manual: el propio UPDATE que hace la app al pulsar "Cerrar
--     turno" (lib/turno.ts -> cerrarTurnoManualmente).
--   - Automático: no hay ningún evento del que colgarse (nada
--     cambia en la fila solo porque pase el tiempo) — así que un
--     cron fijo, 3 veces al día (justo después del fin de cada
--     franja), es el que ESCRIBE `cerrado_at` cuando corresponde. Ese
--     UPDATE, en sí mismo, ya dispara el mismo trigger — el cron no
--     llama a nada directamente para este caso.
--
-- `como_cerro` es solo metadato informativo (para poder distinguir
-- después, en el propio informe o en auditoría, si cerró alguien a
-- mano o solo pasó la hora) — no participa en si se dispara o no.
--
-- Sustituye a `cerrado_manualmente_at` como señal de "¿está cerrado?"
-- (ese único caso ya no basta: ahora también hay cierre automático).
-- La app todavía no está en producción y esa columna no tiene datos
-- reales que preservar, así que se elimina directamente en vez de
-- dejarla sin usar — ver más abajo.
--
-- Ref. 01-rol-responsable.md 3.9b, 06-integraciones.md.
-- =============================================================

-- -------------------------------------------------------------
-- Columnas nuevas — y fuera la vieja, que ya no hace falta
-- -------------------------------------------------------------
alter table turno
  add column if not exists cerrado_at timestamptz,
  add column if not exists como_cerro text check (como_cerro in ('manual', 'automatico')),
  add column if not exists resumen_enviado_at timestamptz;

comment on column turno.cerrado_at is
  'Cuándo se cerró el turno, sea manual o automático. NULL = sigue '
  'abierto/en revisión.';
comment on column turno.como_cerro is
  '''manual'' (botón "Cerrar turno") o ''automatico'' (detectado por '
  'el cron al pasar la franja + 1h de revisión sin que nadie lo '
  'cerrara). Metadato informativo, no dispara nada por sí solo.';
comment on column turno.resumen_enviado_at is
  'Cuándo se envió con éxito el informe de cierre de turno a '
  'Telegram (lo marca la Edge Function generar-resumen-turno tras un '
  'envío OK). NULL = pendiente, o el intento anterior falló.';

alter table turno
  drop column if exists cerrado_manualmente_at;

-- -------------------------------------------------------------
-- Dispara el envío para un turno concreto, vía la Edge Function
-- generar-resumen-turno — pg_net.http_post con el mismo secreto
-- compartido que ya usa fn_notificar_telegram.
-- -------------------------------------------------------------
create or replace function fn_disparar_resumen_turno(p_turno_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  -- OJO: misma URL base que fn_notificar_telegram — sustituye si tu
  -- proyecto tiene otra ref.
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/generar-resumen-turno';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('turno_id', p_turno_id)
  );
end;
$$;

-- -------------------------------------------------------------
-- EL trigger único: cualquier UPDATE que ponga `cerrado_at` (venga de
-- donde venga — botón manual o cron automático) dispara el envío al
-- instante. No necesita ser `security definer` — el trabajo real
-- (leer app_secrets) lo hace fn_disparar_resumen_turno, que sí lo es.
-- -------------------------------------------------------------
create or replace function fn_trigger_resumen_turno_cierre()
returns trigger
language plpgsql
as $$
begin
  if new.cerrado_at is not null and old.cerrado_at is null then
    perform fn_disparar_resumen_turno(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_turno_resumen_cierre on turno;
create trigger trg_turno_resumen_cierre
after update of cerrado_at on turno
for each row execute function fn_trigger_resumen_turno_cierre();

-- -------------------------------------------------------------
-- Cron fijo, 3 veces al día. Dos trabajos separados y con propósitos
-- distintos — no se mezclan en el mismo paso:
--
--   1) DETECTAR cierres automáticos: un simple UPDATE que marca
--      `cerrado_at`/`como_cerro='automatico'` en turnos cuya franja +
--      1h de revisión ya pasó de sobra y nadie cerró a mano. Ese
--      UPDATE por sí solo ya dispara el trigger de arriba — aquí NO
--      se llama a fn_disparar_resumen_turno directamente.
--
--   2) RED DE SEGURIDAD de reintento: por si el trigger disparó pero
--      la llamada a la Edge Function falló (Telegram caído, etc.),
--      reintenta cualquier turno ya cerrado (por cualquier vía) cuyo
--      envío no se confirmó, con 5 min de margen por si el intento
--      original todavía está en curso.
--
-- IMPORTANTE — huso horario: `turno.fecha` es un `date` sin hora, y
-- las franjas (M 06-14 / T 14-22 / N 22-06) son horas LOCALES de la
-- fábrica (Europa/Madrid), igual que las calcula el navegador en
-- `lib/rotacion.ts`. `at time zone 'Europe/Madrid'` interpreta la
-- hora local y la convierte a instante real para poder comparar
-- contra `now()` — sin esto, el servidor (normalmente en UTC)
-- dispararía el cierre automático 1-2h desfasado según la época del
-- año. Mismo cuidado que ya se tuvo con el cruce de medianoche del
-- turno de noche (01-rol-responsable.md 3.1).
-- -------------------------------------------------------------
create or replace function fn_encolar_resumenes_turno_pendientes()
returns void
language plpgsql
as $$
declare
  r record;
begin
  -- 1) Detectar y marcar cierres automáticos.
  update turno
  set cerrado_at = now(),
      como_cerro = 'automatico'
  where cerrado_at is null
    and (
      (
        case tipo
          when 'M' then (fecha + time '14:00')
          when 'T' then (fecha + time '22:00')
          when 'N' then ((fecha + 1) + time '06:00')
        end
      ) at time zone 'Europe/Madrid'
    ) + interval '1 hour' < now();

  -- 2) Reintento de envíos que quedaron sin confirmar.
  for r in
    select id from turno
    where cerrado_at is not null
      and resumen_enviado_at is null
      and cerrado_at < now() - interval '5 minutes'
  loop
    perform fn_disparar_resumen_turno(r.id);
  end loop;
end;
$$;

-- Horario fijo, 3 veces al día — coincide con el fin de cada franja +
-- 1h de margen (M 15:00 / T 23:00 / N 07:00, hora de fábrica). No
-- hace falta sondear cada pocos minutos: las 3 franjas siempre
-- terminan a la misma hora, así que basta con disparar justo después.
--
-- Las horas de abajo están en UTC (pg_cron en Supabase programa en
-- UTC, no en hora de Madrid) — se dejó un margen amplio (~1-2h según
-- la época del año) por encima de la hora real de fábrica, para que
-- funcione igual en horario de invierno (Madrid = UTC+1) y de verano
-- (Madrid = UTC+2) sin tener que tocar esta migración dos veces al
-- año. Es seguro por diseño: la consulta de dentro de la función
-- (`fn_encolar_resumenes_turno_pendientes`) ya compara la hora real
-- con `at time zone 'Europe/Madrid'`, así que si el cron dispara
-- "pronto" simplemente no encuentra nada que cerrar todavía (nunca
-- cierra antes de tiempo) — el único efecto de que dispare "tarde"
-- es que el aviso llega con algo más de margen, nunca con datos mal
-- calculados.
--
-- Mismo patrón defensivo que 0001_extensiones_config.sql: si pg_cron
-- no está disponible en este entorno, avisa sin romper el resto del
-- despliegue — programar a mano desde Supabase antes de confiar en
-- el envío automático.
do $$
begin
  perform cron.schedule(
    'resumenes-turno-pendientes',
    '0 7,15,23 * * *',
    $cron$select fn_encolar_resumenes_turno_pendientes();$cron$
  );
exception when others then
  raise notice 'No se pudo programar el cron job de resumen de turno '
               '(pg_cron no disponible en este entorno) — programarlo '
               'manualmente en Supabase (Database > Cron Jobs) antes de '
               'confiar en el envío automático. El cierre manual sigue '
               'disparando el envío igual (trigger, no depende del cron).';
end $$;