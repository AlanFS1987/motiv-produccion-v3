-- Aviso automático a Telegram del grupo "Nuevos lotes"
-- (06-integraciones.md, grupo 4).
-- Dispara cada vez que `parte.verificacion_caja_estado` pasa a tener
-- un valor (o cambia de valor) — NUNCA en el INSERT inicial del
-- parte, que se crea con este campo en null (ver ciclo de vida en
-- 11-esquema-supabase.md 13.2), así no se dispara antes de que se
-- verifique la caja de verdad.
-- Sesión 17/08/2026

-- 1) Extiende fn_notificar_telegram (ya existente, creada en
--    20260816214000_notificaciones_telegram.sql) para reconocer la
--    tabla `parte` como origen del aviso, sin tocar el
--    comportamiento ya probado de incidencia_calidad/produccion.
create or replace function fn_notificar_telegram()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_tipo   text;
  -- OJO: misma URL base que el resto de triggers de este archivo.
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  if tg_table_name = 'incidencia_calidad' then
    v_tipo := 'incidencia_calidad';
  elsif tg_table_name = 'incidencia_produccion' then
    v_tipo := 'incidencia_produccion';
  elsif tg_table_name = 'parte' then
    v_tipo := 'nuevo_lote';
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('tipo', v_tipo, 'id', NEW.id)
  );

  return NEW;
end;
$$;

-- 2) El trigger sobre `parte`. `WHEN` filtra en el propio motor,
--    antes de llamar a la función, para no gastar una llamada HTTP
--    en cada UPDATE de `parte` que no toque este campo (piezas,
--    minutos, etc. se actualizan bastante más a menudo).
drop trigger if exists trg_notificar_telegram_nuevo_lote on parte;
create trigger trg_notificar_telegram_nuevo_lote
after update of verificacion_caja_estado on parte
for each row
when (
  new.verificacion_caja_estado is not null
  and new.verificacion_caja_estado is distinct from old.verificacion_caja_estado
)
execute function fn_notificar_telegram();
