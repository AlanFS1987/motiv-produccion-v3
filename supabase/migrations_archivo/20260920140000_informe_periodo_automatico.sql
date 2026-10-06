-- =============================================================
-- Informes por periodo — AUTOMATIZACIÓN. Sesión 20/09/2026.
-- Continúa 20260920130000_informe_periodo.sql (tabla) y la Edge
-- Function generar-informe-periodo (PDF + Telegram).
--
-- Qué hace, por orden:
--
--   1) fn_disparar_informe_periodo(tipo, desde): llama a la Edge
--      Function con enviar=true, por pg_net y con el mismo secreto
--      compartido que usa fn_disparar_resumen_turno.
--
--   2) TRIGGER sobre turno.cerrado_at: cuando se cierra un turno de
--      NOCHE (a mano, o por el cron a las 07:00 de Madrid) se pide el
--      informe DIARIO de esa fecha — el N de la fecha D es el último de
--      los tres turnos de ese día de producción. Si esa fecha D es
--      DOMINGO, se pide además el SEMANAL de la semana que acaba (lunes
--      D-6 … domingo D). Se dispara al instante del cierre, igual que
--      el resumen del propio turno.
--
--   3) CRON DE RESPALDO cada hora en el minuto 30: por si el trigger
--      no llegó a disparar o la Edge Function falló, reintenta los
--      informes cuyo periodo terminó hace poco y siguen sin enviarse.
--      También cubre el día en que no llegó a existir turno de noche
--      (si hay turnos ese día, hay informe).
--
-- Idempotencia: la Edge Function reclama el envío con un UPDATE
-- atómico sobre informe_periodo.enviado_at, así que aunque trigger y
-- cron coincidan, el mensaje sale UNA vez.
--
-- IMPORTANTE — al aplicar esta migración los avisos empiezan a salir
-- solos al grupo definido en TELEGRAM_CHAT_INFORMES (o, si no existe
-- ese secret, TELEGRAM_CHAT_RESUMEN_TURNO). Y la primera pasada del
-- cron enviará el informe diario de AYER si aún no se había enviado
-- (ventana de 30 h), nunca informes más antiguos.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Disparo: una llamada a la Edge Function. security definer
-- porque lee app_secrets (mismo patrón que fn_disparar_resumen_turno).
-- -------------------------------------------------------------
create or replace function fn_disparar_informe_periodo(p_tipo text, p_desde date)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/generar-informe-periodo';
begin
  if p_tipo not in ('diario', 'semanal') then
    raise exception 'tipo de informe no válido: %', p_tipo;
  end if;

  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('tipo', p_tipo, 'desde', p_desde, 'enviar', true),
    -- Generar el PDF (sobre todo el semanal) puede tardar más que los
    -- 5 s por defecto de pg_net.
    timeout_milliseconds := 120000
  );
end;
$$;

-- -------------------------------------------------------------
-- 2) Trigger: cierre de un turno de noche.
-- security definer a propósito: el UPDATE de cerrado_at lo hace el
-- responsable desde la app (rol `authenticated`), y este trigger tiene
-- que poder llamar a fn_disparar_informe_periodo aunque esa función ya
-- NO sea ejecutable por `authenticated` (ver el REVOKE de abajo).
--
-- Un fallo aquí NUNCA debe impedir cerrar el turno: todo va dentro de
-- un bloque con EXCEPTION que solo deja un aviso en el log.
-- -------------------------------------------------------------
create or replace function fn_trigger_informe_periodo_cierre()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.cerrado_at is not null and old.cerrado_at is null and new.tipo = 'N' then
    begin
      perform fn_disparar_informe_periodo('diario', new.fecha);
      -- El N del domingo cierra la semana natural (lunes M … domingo N).
      if extract(isodow from new.fecha) = 7 then
        perform fn_disparar_informe_periodo('semanal', new.fecha - 6);
      end if;
    exception when others then
      raise warning 'No se pudo disparar el informe por periodo del turno %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_turno_informe_periodo_cierre on turno;
create trigger trg_turno_informe_periodo_cierre
after update of cerrado_at on turno
for each row execute function fn_trigger_informe_periodo_cierre();

-- -------------------------------------------------------------
-- 3) Cron de respaldo.
--
-- DIARIO: cualquier fecha D con turnos cuyo día de producción terminó
-- (D+1 a las 06:00 de Madrid) hace más de 1 h 15 min — margen para que
-- el trigger llegue antes que el cron — y hace menos de 30 h, y sin
-- informe enviado. La ventana de 30 h evita reenviar historia antigua.
--
-- SEMANAL: cada domingo S de los últimos 7 días, con turnos en su
-- semana, cuyo periodo terminó (S+1 a las 06:00) hace más de 1 h 15 min
-- y menos de 4 días, sin informe semanal enviado (desde = S-6).
--
-- Horas de Madrid siempre con `at time zone 'Europe/Madrid'`, igual que
-- fn_encolar_resumenes_turno_pendientes — el servidor va en UTC.
-- -------------------------------------------------------------
create or replace function fn_encolar_informes_periodo_pendientes()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r      record;
  v_hoy  date := (now() at time zone 'Europe/Madrid')::date;
begin
  -- Diarios pendientes
  for r in
    select distinct t.fecha
    from turno t
    where (((t.fecha + 1) + time '06:00') at time zone 'Europe/Madrid') + interval '75 minutes' < now()
      and (((t.fecha + 1) + time '06:00') at time zone 'Europe/Madrid') > now() - interval '30 hours'
      and not exists (
        select 1 from informe_periodo i
        where i.tipo = 'diario' and i.desde = t.fecha and i.enviado_at is not null
      )
    order by t.fecha
  loop
    perform fn_disparar_informe_periodo('diario', r.fecha);
  end loop;

  -- Semanales pendientes (domingo S -> semana S-6 … S)
  for r in
    select (v_hoy - g) as domingo
    from generate_series(0, 7) g
    where extract(isodow from (v_hoy - g)) = 7
      and ((((v_hoy - g) + 1) + time '06:00') at time zone 'Europe/Madrid') + interval '75 minutes' < now()
      and ((((v_hoy - g) + 1) + time '06:00') at time zone 'Europe/Madrid') > now() - interval '4 days'
      and exists (
        select 1 from turno t where t.fecha between (v_hoy - g) - 6 and (v_hoy - g)
      )
      and not exists (
        select 1 from informe_periodo i
        where i.tipo = 'semanal' and i.desde = (v_hoy - g) - 6 and i.enviado_at is not null
      )
    order by 1
  loop
    perform fn_disparar_informe_periodo('semanal', r.domingo - 6);
  end loop;
end;
$$;

-- -------------------------------------------------------------
-- Seguridad: estas funciones no deben poder llamarse desde la API
-- (RPC) por anon/authenticated — dispararían informes a Telegram.
-- Las usan el trigger (security definer) y el cron (postgres).
-- -------------------------------------------------------------
revoke execute on function fn_disparar_informe_periodo(text, date) from public, anon, authenticated;
revoke execute on function fn_trigger_informe_periodo_cierre() from public, anon, authenticated;
revoke execute on function fn_encolar_informes_periodo_pendientes() from public, anon, authenticated;

-- -------------------------------------------------------------
-- Cron: minuto 30 de cada hora (UTC == hora en punto + 30 min en
-- Madrid, invierno y verano, por la razón explicada en
-- 20260816233543_ajuste_horario_cron_resumen_turno.sql). La consulta
-- es barata y no hace nada si no hay pendientes.
-- Mismo patrón defensivo que las migraciones de cron anteriores.
-- -------------------------------------------------------------
do $$
begin
  perform cron.schedule(
    'informes-periodo-pendientes',
    '30 * * * *',
    $cron$select fn_encolar_informes_periodo_pendientes();$cron$
  );
exception when others then
  raise notice 'No se pudo programar el cron job de informes por periodo '
               '(pg_cron no disponible en este entorno) — programarlo '
               'manualmente en Supabase (Database > Cron Jobs). El '
               'trigger de cierre de turno sigue disparando los informes '
               'igual, no depende del cron.';
end $$;
