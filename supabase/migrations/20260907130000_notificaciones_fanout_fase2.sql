-- =============================================================
-- Notificaciones in-app — Fase 2: fanout desde las 3 funciones que
-- hoy llaman a Telegram. Sesión 07/09/2026.
--
-- Se extienden fn_notificar_telegram, fn_disparar_resumen_turno y
-- fn_disparar_resumen_calidad (las 3 funciones "llamadas desde la
-- BD", memorias/05-automatismos.md) para que, además de la llamada
-- HTTP a Telegram que ya funciona, hagan un INSERT en `notificaciones`
-- (Fase 1, 20260907120000). No se toca el envío a Telegram en
-- absoluto — se suma, no se sustituye.
--
-- El INSERT es independiente de si la llamada a Telegram tiene éxito:
-- pg_net.http_post es fire-and-forget (perform, sin comprobar
-- resultado), así que el feed in-app queda siempre alimentado aunque
-- Telegram esté caído o el bot falle — más fiable que el canal que
-- sustituye, no menos.
-- =============================================================

-- -------------------------------------------------------------
-- 1) fn_notificar_telegram — cubre incidencia_calidad,
-- incidencia_produccion y nuevo_lote (trigger sobre `parte`).
-- Título/cuerpo pensados para que la campana sea legible sin tener
-- que abrir el detalle; el texto de verificación de caja replica
-- literalmente el mapeo ya usado en notificar-telegram/index.ts
-- (TEXTO_VERIFICACION) para no inventar una redacción nueva.
-- -------------------------------------------------------------
create or replace function fn_notificar_telegram()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_tipo   text;
  v_titulo text;
  v_cuerpo text;
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  if tg_table_name = 'incidencia_calidad' then
    v_tipo   := 'incidencia_calidad';
    v_titulo := 'Nueva incidencia de calidad';
    v_cuerpo := new.descripcion;
  elsif tg_table_name = 'incidencia_produccion' then
    v_tipo   := 'incidencia_produccion';
    v_titulo := 'Nueva incidencia de producción';
    v_cuerpo := new.descripcion;
  elsif tg_table_name = 'parte' then
    v_tipo   := 'nuevo_lote';
    v_titulo := 'Nuevo lote verificado';
    v_cuerpo := 'Verificación de caja: ' || case new.verificacion_caja_estado
      when 'correcto'         then 'OCR correcto'
      when 'incorrecto'       then 'OCR incorrecto'
      when 'no_verificable'   then 'No verificable'
      when 'verificado_manual' then 'Verificado a mano'
      else coalesce(new.verificacion_caja_estado, 'sin dato')
    end;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('tipo', v_tipo, 'id', new.id)
  );

  insert into notificaciones (tipo, titulo, cuerpo, referencia_id)
  values (v_tipo, v_titulo, v_cuerpo, new.id);

  return new;
end;
$$;

-- Los 3 triggers ya existentes (trg_notificar_telegram_calidad,
-- trg_notificar_telegram_produccion, trg_notificar_telegram_nuevo_lote)
-- apuntan a esta función por nombre — heredan el comportamiento nuevo
-- sin tocarlos.

-- -------------------------------------------------------------
-- 2) fn_disparar_resumen_turno — siempre manda resumen (no es un
-- digest condicional como el de calidad), así que el INSERT es
-- incondicional. Se aprovecha para leer fecha/tipo del propio turno
-- y dar un título legible en vez de solo "Resumen de turno".
-- -------------------------------------------------------------
create or replace function fn_disparar_resumen_turno(p_turno_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/generar-resumen-turno';
  v_fecha  date;
  v_tipo   tipo_turno;
  v_titulo text;
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

  select fecha, tipo into v_fecha, v_tipo from turno where id = p_turno_id;

  v_titulo := 'Resumen de turno — ' ||
    case v_tipo when 'M' then 'Mañana' when 'T' then 'Tarde' when 'N' then 'Noche' else v_tipo::text end ||
    ' ' || to_char(v_fecha, 'DD/MM');

  insert into notificaciones (tipo, titulo, referencia_id)
  values ('resumen_turno', v_titulo, p_turno_id);
end;
$$;

-- Sigue disparándola el mismo trigger (trg_turno_resumen_cierre, sobre
-- cerrado_at) y el mismo cron de reintento
-- (fn_encolar_resumenes_turno_pendientes) — nada que tocar ahí.

-- -------------------------------------------------------------
-- 3) fn_disparar_resumen_calidad — a diferencia de resumen_turno,
-- este SÍ es condicional: si no hay lotes finalizados pendientes de
-- incluir, la Edge Function no manda nada a Telegram
-- (notificar-telegram-resumen-calidad/index.ts, buscarLotesPendientes).
-- Se replica AQUÍ el mismo criterio exacto
-- (estado='finalizado' and resumen_calidad_enviado_at is null) para
-- que el feed in-app no meta una notificación vacía las 3 veces al
-- día que el cron dispara sin haber nada que reportar.
-- -------------------------------------------------------------
create or replace function fn_disparar_resumen_calidad()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret     text;
  v_url        text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram-resumen-calidad';
  v_pendientes int;
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

  select count(*) into v_pendientes
  from lote
  where estado = 'finalizado' and resumen_calidad_enviado_at is null;

  if v_pendientes > 0 then
    insert into notificaciones (tipo, titulo, cuerpo)
    values (
      'resumen_calidad',
      'Resumen de calidad',
      v_pendientes || ' lote' || case when v_pendientes = 1 then '' else 's' end
        || ' finalizado' || case when v_pendientes = 1 then '' else 's' end
    );
  end if;
end;
$$;

-- Sigue disparándola solo el cron 'resumen-calidad-diario' (7/15/23h
-- Madrid) — nada que tocar ahí tampoco.
