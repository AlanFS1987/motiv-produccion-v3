-- =============================================================
-- Notificaciones — rediseño a canales por tipo (esquema)
-- Sesión 07/09/2026.
--
-- El comportamiento buscado es el de los grupos de Telegram: 5
-- canales (uno por tipo), cada uno con su propio historial
-- scrolleable, con el mensaje COMPLETO (línea, turno, responsable,
-- operario, texto) — no un feed único plano con snippets.
--
-- Dos cambios:
--
-- 1) notificacion_estado_usuario pasa de "un timestamp por usuario"
--    a "un timestamp por usuario Y POR TIPO" — la campana ahora
--    necesita saber cuántas no-leídas hay en CADA canal, no solo un
--    total global.
--
-- 2) Se revierte la parte de la Fase 2 (20260907130000) que insertaba
--    en `notificaciones` desde SQL, y también la Fase de "enriquecer
--    contexto" (20260907160000) que intentó arreglarlo ahí mismo.
--    El contenido completo estilo Telegram YA se construye en las
--    Edge Functions (notificar-telegram, generar-resumen-turno,
--    notificar-telegram-resumen-calidad) — mantenerlo también en
--    plpgsql duplicaba la lógica en dos sitios que ya vimos que se
--    desincronizan (la línea que faltó en la prueba real). Las 3
--    funciones SQL vuelven a ser SOLO el disparo HTTP; el INSERT en
--    `notificaciones` se hace desde las Edge Functions en el próximo
--    paso, con el mismo texto exacto que ya arman para Telegram.
-- =============================================================

drop table if exists notificacion_estado_usuario;

create table notificacion_estado_usuario (
  usuario_id      uuid not null references usuario(id) on delete cascade,
  tipo            text not null,
  ultima_leida_at timestamptz not null default now(),
  primary key (usuario_id, tipo)
);

comment on table notificacion_estado_usuario is
  'Timestamp de "último leído" por usuario Y POR TIPO (antes era uno '
  'solo por usuario, sesión 07/09/2026) — un canal por tipo, cada uno '
  'con su propio contador de no-leídas. Ausencia de fila para un tipo '
  '= nunca abierto ese canal = todo no-leído en él.';

alter table notificacion_estado_usuario enable row level security;

do $$ begin
  create policy notif_estado_usuario_propio on notificacion_estado_usuario
    for all using (usuario_id = auth.uid())
    with check (usuario_id = auth.uid());
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- Revertir las 3 funciones a solo disparar el HTTP — sin INSERT
-- en notificaciones (eso lo hará cada Edge Function, próximo paso).
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
    body    := jsonb_build_object('tipo', v_tipo, 'id', new.id)
  );

  return new;
end;
$$;

create or replace function fn_disparar_resumen_turno(p_turno_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
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

create or replace function fn_disparar_resumen_calidad()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
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
