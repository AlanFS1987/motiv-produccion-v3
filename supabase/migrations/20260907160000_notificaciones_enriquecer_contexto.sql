-- =============================================================
-- Notificaciones in-app — enriquecer contexto (línea/turno)
-- Sesión 07/09/2026. Detectado en prueba real: el mensaje de
-- Telegram para incidencia_produccion incluye línea, turno,
-- responsable y operario (notificar-telegram/index.ts,
-- manejarIncidenciaProduccion) — la Fase 2 solo puso `descripcion`
-- en el cuerpo, dejando el feed in-app con menos contexto que el
-- canal que pretende sustituir. Se corrige aquí.
--
-- No se replica responsable/operario (exigiría más joins y no fue lo
-- que se echó en falta en la prueba) — solo línea y turno, que es lo
-- que de verdad cambia según el evento y cabe bien en un título.
-- =============================================================

create or replace function fn_notificar_telegram()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret       text;
  v_tipo         text;
  v_titulo       text;
  v_cuerpo       text;
  v_url          text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram';
  v_linea_nombre text;
  v_turno_tipo   tipo_turno;
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  if tg_table_name = 'incidencia_calidad' then
    v_tipo := 'incidencia_calidad';
    select l.nombre, t.tipo
      into v_linea_nombre, v_turno_tipo
    from parte p
    left join linea l on l.id = p.linea_id
    left join turno t on t.id = p.turno_id
    where p.id = new.parte_id;

    v_titulo := 'Incidencia de calidad — ' ||
      coalesce(v_linea_nombre, 'línea desconocida') ||
      case when v_turno_tipo is not null then ' · Turno ' || v_turno_tipo::text else '' end;
    v_cuerpo := new.descripcion;

  elsif tg_table_name = 'incidencia_produccion' then
    v_tipo := 'incidencia_produccion';
    if new.linea_id is not null then
      select l.nombre into v_linea_nombre from linea l where l.id = new.linea_id;
    else
      v_linea_nombre := 'Todo el turno'; -- mismo texto que ya usa Telegram para este caso
    end if;
    select t.tipo into v_turno_tipo from turno t where t.id = new.turno_id;

    v_titulo := 'Incidencia de producción — ' ||
      coalesce(v_linea_nombre, 'línea desconocida') ||
      case when v_turno_tipo is not null then ' · Turno ' || v_turno_tipo::text else '' end;
    v_cuerpo := new.descripcion;

  elsif tg_table_name = 'parte' then
    v_tipo := 'nuevo_lote';
    select l.nombre into v_linea_nombre from linea l where l.id = new.linea_id;

    v_titulo := 'Nuevo lote verificado — ' || coalesce(v_linea_nombre, 'línea desconocida');
    v_cuerpo := 'Verificación de caja: ' || case new.verificacion_caja_estado
      when 'correcto'          then 'OCR correcto'
      when 'incorrecto'        then 'OCR incorrecto'
      when 'no_verificable'    then 'No verificable'
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
