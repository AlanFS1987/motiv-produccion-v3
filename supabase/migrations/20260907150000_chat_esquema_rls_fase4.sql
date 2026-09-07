-- =============================================================
-- Chat — Fase 4: esquema y RLS. Sesión 07/09/2026.
--
-- Decisiones de esta sesión:
--  - Canal único, sin tabla de "canales" (decisión previa).
--  - Texto y fotos (reutiliza Cloudinary, preset nuevo — ver nota al
--    final, es un paso manual fuera de esta migración).
--  - Borrado SUAVE: cada uno borra lo suyo, admin borra cualquiera —
--    se marca `eliminado`, nunca se hace un DELETE real, mismo
--    criterio que el resto del proyecto (nunca borrar de verdad,
--    marcar y conservar, ej. `parte.vigente`).
--  - Alcance: los mismos 4 roles que ya tiene la campana de
--    notificaciones (responsable, suplente, operario, jefe,
--    administrador) — calidad y jefe_rectificado quedan fuera,
--    misma decisión que en notificaciones (sesión 07/09/2026).
-- =============================================================

create table if not exists chat_mensajes (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references usuario(id) on delete cascade,
  texto        text,
  fotos        text[],
  created_at   timestamptz not null default now(),
  eliminado    boolean not null default false,
  borrado_por  uuid references usuario(id),
  borrado_at   timestamptz,
  check (texto is not null or fotos is not null)
);

comment on table chat_mensajes is
  'Canal único de chat, sin reparto en salas. Alcance: responsable, '
  'suplente, operario, jefe, administrador (sesión 07/09/2026, mismo '
  'criterio que notificaciones) — calidad y jefe_rectificado fuera a '
  'propósito. Borrado suave: `eliminado=true` marca el mensaje como '
  '"eliminado" en la UI, nunca se borra la fila de verdad.';

comment on column chat_mensajes.fotos is
  'URLs de Cloudinary — preset unsigned nuevo (motiv_v3_chat), mismo '
  'patrón que el resto de presets del proyecto. Paso manual pendiente '
  'fuera de esta migración: crear el preset en el dashboard de '
  'Cloudinary y añadir VITE_CLOUDINARY_PRESET_CHAT al .env del '
  'frontend.';

create index if not exists idx_chat_mensajes_created_at
  on chat_mensajes (created_at desc);

alter table chat_mensajes enable row level security;

do $$ begin
  create policy chat_mensajes_select on chat_mensajes
    for select using (
      fn_rol_actual() in ('responsable', 'suplente', 'operario', 'jefe', 'administrador')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy chat_mensajes_insert on chat_mensajes
    for insert with check (
      usuario_id = auth.uid()
      and fn_rol_actual() in ('responsable', 'suplente', 'operario', 'jefe', 'administrador')
    );
exception when duplicate_object then null; end $$;

-- Borrado suave vía UPDATE (nunca DELETE): el propio autor o un
-- administrador pueden marcar eliminado=true. No hace falta repetir
-- aquí la restricción de rol de la política de SELECT/INSERT: un
-- usuario de un rol sin acceso nunca puede ser dueño de un mensaje
-- (no pudo insertarlo), así que la condición usuario_id = auth.uid()
-- ya lo cubre por construcción.
do $$ begin
  create policy chat_mensajes_borrado_suave on chat_mensajes
    for update using (
      usuario_id = auth.uid() or fn_rol_actual() = 'administrador'
    )
    with check (
      usuario_id = auth.uid() or fn_rol_actual() = 'administrador'
    );
exception when duplicate_object then null; end $$;

-- Habilita Realtime para que la pantalla de chat (Fase 5) reciba
-- mensajes nuevos sin recargar, sin tocar esquema entonces.
alter publication supabase_realtime add table chat_mensajes;
