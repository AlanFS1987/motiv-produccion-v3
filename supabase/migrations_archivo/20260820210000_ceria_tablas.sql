-- =============================================================
-- Tablas base de CERIA (asistente del jefe). No existían en v3 —
-- en v2 vivían con estos mismos nombres y propósito, se traen tal
-- cual porque el diseño ya está probado en real.
--
-- ceria_prompts: el texto de interpretación de cada herramienta vive
-- en BD, no en el código de la Edge Function — así se puede afinar
-- cómo Ceria explica "calidad oficial" o el suelo de 480 min sin
-- redesplegar nada.
--
-- ceria_conversaciones / ceria_mensajes: historial por jefe, para que
-- Ceria pueda reutilizar datos ya consultados en la misma conversación
-- (get_datos_historial) sin repetir queries.
--
-- Solo el rol `jefe` (y `administrador`) puede ver/usar esto — nadie
-- más tiene la pantalla ni la necesita.
-- =============================================================

create table if not exists ceria_prompts (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null unique,  -- nombre de la herramienta, ej. 'get_produccion_turno'
  contenido   text not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table ceria_prompts is
  'Prompt de interpretación por herramienta de Ceria — editable sin '
  'redesplegar la Edge Function. `clave` = nombre de la tool.';

create table if not exists ceria_conversaciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references usuario(id),
  titulo      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ceria_conversaciones_user on ceria_conversaciones (user_id);

create table if not exists ceria_mensajes (
  id                uuid primary key default gen_random_uuid(),
  conversacion_id   uuid not null references ceria_conversaciones(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  contenido         text not null,
  tool_usada        text,
  datos             jsonb,  -- datos crudos del assistant, para reutilizar en get_datos_historial
  created_at        timestamptz not null default now()
);

create index if not exists idx_ceria_mensajes_conversacion on ceria_mensajes (conversacion_id, created_at);

-- -------------------------------------------------------------
-- RLS — cada jefe/administrador ve solo sus propias conversaciones.
-- -------------------------------------------------------------
alter table ceria_prompts enable row level security;
alter table ceria_conversaciones enable row level security;
alter table ceria_mensajes enable row level security;

do $$
begin
  create policy ceria_prompts_select on ceria_prompts
    for select using (fn_rol_actual() in ('jefe', 'administrador'));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy ceria_prompts_admin_todo on ceria_prompts
    for all using (fn_rol_actual() = 'administrador')
    with check (fn_rol_actual() = 'administrador');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy ceria_conversaciones_propia on ceria_conversaciones
    for all using (user_id = auth.uid() or fn_rol_actual() = 'administrador')
    with check (user_id = auth.uid() or fn_rol_actual() = 'administrador');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy ceria_mensajes_propia on ceria_mensajes
    for all using (
      exists (
        select 1 from ceria_conversaciones c
        where c.id = ceria_mensajes.conversacion_id
          and (c.user_id = auth.uid() or fn_rol_actual() = 'administrador')
      )
    )
    with check (
      exists (
        select 1 from ceria_conversaciones c
        where c.id = ceria_mensajes.conversacion_id
          and (c.user_id = auth.uid() or fn_rol_actual() = 'administrador')
      )
    );
exception when duplicate_object then null;
end $$;