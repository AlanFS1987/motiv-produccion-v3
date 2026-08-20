-- Notificaciones automáticas a Telegram (incidencias calidad/producción)
-- Sesión 15/08/2026

-- 1) Activar la extensión que permite a Postgres hacer peticiones
--    HTTP hacia fuera (llamar a nuestra edge function).
create extension if not exists pg_net with schema extensions;

-- 2) Tabla mínima para guardar el secreto compartido, SIN exponerla
--    a la API pública (ni anon ni authenticated pueden leerla).
--    Es la alternativa "simple" a Vault de la que hablamos.
create table if not exists app_secrets (
  key   text primary key,
  value text not null
);

revoke all on app_secrets from anon, authenticated;

-- El secreto real NO se guarda en este archivo — un secreto en texto
-- plano dentro de una migración queda para siempre en el historial de
-- git en cuanto este repo se suba a algún remoto (GitHub o cualquier
-- otro), aunque hoy solo exista en local. Se deja la fila con un
-- valor placeholder a propósito: mientras no se sustituya a mano, la
-- comparación en la Edge Function (`notificar-telegram/index.ts`,
-- `secretRecibido !== WEBHOOK_SECRET`) falla y las notificaciones
-- simplemente no se envían — falla cerrado, no abierto.
--

insert into app_secrets (key, value)
values ('telegram_webhook_secret', 'CAMBIA_ESTO_A_MANO_VIA_SQL_EDITOR')
on conflict (key) do nothing;

-- 3) La función que dispara el aviso. La marcamos "security definer"
--    para que pueda leer app_secrets aunque quien inserte la
--    incidencia (el responsable) no tenga permiso directo sobre esa
--    tabla.
create or replace function fn_notificar_telegram()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_tipo   text;
  -- OJO: sustituye por tu URL real de la función.
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  if tg_table_name = 'incidencia_calidad' then
    v_tipo := 'incidencia_calidad';
  elsif tg_table_name = 'incidencia_produccion' then
    v_tipo := 'incidencia_produccion';
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

-- 4) Los dos triggers, uno por tabla.
drop trigger if exists trg_notificar_telegram_calidad on incidencia_calidad;
create trigger trg_notificar_telegram_calidad
after insert on incidencia_calidad
for each row execute function fn_notificar_telegram();

drop trigger if exists trg_notificar_telegram_produccion on incidencia_produccion;
create trigger trg_notificar_telegram_produccion
after insert on incidencia_produccion
for each row execute function fn_notificar_telegram();