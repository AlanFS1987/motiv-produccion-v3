-- =============================================================
-- Notificaciones in-app — Fase 1: esquema de base de datos
-- Sesión 07/09/2026. Independiente de Telegram, se añade en
-- paralelo — no toca nada de fn_notificar_telegram ni de los
-- triggers/cron ya existentes (05-automatismos.md).
--
-- Decisiones de esta sesión:
--  - Alcance: sin reparto por rol. Feed único y global — cualquier
--    usuario registrado (fn_rol_actual() is not null) ve todas las
--    notificaciones, igual que hoy cualquiera con acceso a Telegram
--    puede entrar en cualquiera de los 5 grupos si le añaden.
--  - Silencio: horario general (mismo rango todos los días, no
--    distingue entre semana/fin de semana) + interruptor por tipo.
--    Afecta SOLO al push (fase 7, futura) — el feed y el contador de
--    no-leídas nunca se filtran por esto.
--  - Historial: sin caducidad. No se borra nada; lo que cambia por
--    usuario es un único timestamp de "hasta dónde ha leído" — mismo
--    modelo que un chat de Telegram, no una fila de leído/no-leído
--    por cada notificación y usuario (eso crecería sin límite).
-- =============================================================

-- -------------------------------------------------------------
-- 1) notificaciones — feed global, una fila por evento.
-- Se alimenta desde el mismo trigger que hoy llama a Telegram
-- (fn_notificar_telegram, ver 20260816214000 y 20260817090000) — la
-- Fase 2 lo extiende para que, además de la llamada HTTP, haga un
-- INSERT aquí. No se toca nada de lo que ya funciona con Telegram.
-- -------------------------------------------------------------
create table if not exists notificaciones (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in (
                  'incidencia_calidad', 'incidencia_produccion',
                  'nuevo_lote', 'resumen_turno', 'resumen_calidad'
                )),
  titulo        text not null,
  cuerpo        text,
  referencia_id uuid,        -- id de la fila origen (incidencia, parte, turno...) para enlazar al detalle
  data          jsonb,
  created_at    timestamptz not null default now()
);

comment on table notificaciones is
  'Feed global de notificaciones in-app — sin reparto por rol ni por '
  'usuario (decisión 07/09/2026: cualquier usuario registrado ve '
  'todo, igual que hoy con los grupos de Telegram). El check de '
  '`tipo` se amplía con ALTER TABLE ... DROP/ADD CONSTRAINT cuando se '
  'añada el 6º tipo (mensaje_chat, fase 6). Solo se inserta desde '
  'funciones security definer (fn_notificar_telegram, fase 2) — sin '
  'política de INSERT para authenticated/anon, igual que app_secrets: '
  'el dueño de la tabla (postgres) salta RLS por defecto, así que la '
  'función lo hace sin necesitar ningún GRANT extra.';

create index if not exists idx_notificaciones_created_at
  on notificaciones (created_at desc);

create index if not exists idx_notificaciones_tipo
  on notificaciones (tipo);

alter table notificaciones enable row level security;

do $$ begin
  create policy notificaciones_select_roles_conocidos on notificaciones
    for select using (fn_rol_actual() is not null);
exception when duplicate_object then null; end $$;

-- Habilita Realtime para que la campana (Fase 3) pueda suscribirse
-- sin tocar esquema entonces.
alter publication supabase_realtime add table notificaciones;

-- -------------------------------------------------------------
-- 2) notificacion_estado_usuario — "hasta dónde he leído", una fila
-- por usuario. Ausencia de fila = nunca ha abierto el panel = todo
-- no-leído (el cliente hace upsert al abrir el panel, no hace falta
-- pre-poblar en el alta de usuario). Por eso el default es now() y
-- no epoch: si algún día se pre-puebla a mano, un usuario recién
-- creado no debería ver como "no leído" todo el histórico previo a
-- su alta.
-- -------------------------------------------------------------
create table if not exists notificacion_estado_usuario (
  usuario_id      uuid primary key references usuario(id) on delete cascade,
  ultima_leida_at timestamptz not null default now()
);

comment on table notificacion_estado_usuario is
  'Un timestamp por usuario, no una fila por notificación — mismo '
  'modelo que un cliente de chat: "no leído" = created_at > '
  'ultima_leida_at en notificaciones. Se actualiza a now() (upsert) '
  'cada vez que el usuario abre el panel de notificaciones.';

alter table notificacion_estado_usuario enable row level security;

do $$ begin
  create policy notif_estado_usuario_propio on notificacion_estado_usuario
    for all using (usuario_id = auth.uid())
    with check (usuario_id = auth.uid());
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- 3) notificacion_preferencias — interruptor por tipo, solo afecta
-- al push (Fase 7, futura). Ausencia de fila para un tipo = activado
-- por defecto (no hace falta pre-poblar 5 filas por usuario en el
-- alta).
-- -------------------------------------------------------------
create table if not exists notificacion_preferencias (
  usuario_id  uuid not null references usuario(id) on delete cascade,
  tipo        text not null,
  push_activo boolean not null default true,
  primary key (usuario_id, tipo)
);

comment on table notificacion_preferencias is
  'Un interruptor por tipo y usuario. Solo gobierna si se manda push '
  '(Fase 7, futura) — nunca oculta nada del feed ni afecta al '
  'contador de no-leídas. Ausencia de fila = activado (el cliente '
  'solo inserta una fila cuando el usuario lo desactiva).';

alter table notificacion_preferencias enable row level security;

do $$ begin
  create policy notif_preferencias_propio on notificacion_preferencias
    for all using (usuario_id = auth.uid())
    with check (usuario_id = auth.uid());
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- 4) notificacion_silencio — horario general (mismo rango todos los
-- días), una fila por usuario. Pensado para cruzar medianoche
-- (ej. 22:00 → 07:00); la comparación "¿estoy en horario de silencio
-- ahora?" se resuelve en hora de Madrid dentro de la Edge Function de
-- envío de push (Fase 7), mismo criterio que ya usan los cron
-- existentes (at time zone 'Europe/Madrid').
-- -------------------------------------------------------------
create table if not exists notificacion_silencio (
  usuario_id  uuid primary key references usuario(id) on delete cascade,
  activo      boolean not null default false,
  hora_inicio time not null default '22:00',
  hora_fin    time not null default '07:00'
);

comment on table notificacion_silencio is
  'Horario general de silencio (no distingue días de la semana, '
  'decisión 07/09/2026). Solo afecta al push (Fase 7, futura). Rango '
  'pensado para cruzar medianoche; ver comentario de la tabla para '
  'dónde se evalúa.';

alter table notificacion_silencio enable row level security;

do $$ begin
  create policy notif_silencio_propio on notificacion_silencio
    for all using (usuario_id = auth.uid())
    with check (usuario_id = auth.uid());
exception when duplicate_object then null; end $$;
