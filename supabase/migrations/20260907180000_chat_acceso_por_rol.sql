-- =============================================================
-- chat_acceso — control de acceso por rol, editable por el admin
-- Sesión 07/09/2026.
--
-- Sustituye el hardcodeo de roles que ya habíamos escrito a mano en:
--  - notificaciones_select_roles_limitados (RLS)
--  - chat_mensajes_select / chat_mensajes_insert (RLS)
--  - el array ["jefe","administrador"] dentro de supabase/functions/
--    ceria/index.ts (próximo paso, fuera de esta migración — Deno no
--    se despliega con `db push`)
--
-- Modelo: "ausencia de fila = denegado" (coalesce a false), así que
-- solo hace falta insertar las combinaciones que SÍ tienen acceso hoy
-- — no las 9 filas de rol_usuario × 7 chats completas.
--
-- puede_escribir solo tiene sentido real para 'general' (los 5
-- automáticos y Ceria no distinguen ver de escribir — nadie escribe
-- a mano en los automáticos, y en Ceria usar = ver = escribir son la
-- misma cosa). Se mantiene la columna en los 7 por uniformidad de
-- esquema, simplemente no se consulta fuera de 'general'.
-- =============================================================

create table if not exists chat_acceso (
  tipo_chat      text not null,
  rol            rol_usuario not null,
  puede_ver      boolean not null default true,
  puede_escribir boolean not null default true,
  primary key (tipo_chat, rol)
);

comment on table chat_acceso is
  'Control de acceso por rol para los 7 "chats" (5 notificaciones + '
  'general + ceria), editable por el admin desde una rejilla en el '
  'frontend. Ausencia de fila = sin acceso (deny-by-default). '
  'puede_escribir solo se consulta para tipo_chat=''general'' — en '
  'el resto, ver y escribir son la misma cosa o no aplica.';

alter table chat_acceso enable row level security;

do $$ begin
  create policy chat_acceso_select on chat_acceso
    for select using (fn_rol_actual() is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy chat_acceso_admin_escribe on chat_acceso
    for all using (fn_rol_actual() = 'administrador')
    with check (fn_rol_actual() = 'administrador');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- Semilla: refleja EXACTAMENTE el acceso que ya existe hoy (sesión
-- 07/09/2026) — esta migración no cambia quién ve qué, solo mueve
-- dónde vive esa decisión.
-- -------------------------------------------------------------
insert into chat_acceso (tipo_chat, rol, puede_ver, puede_escribir)
select tipo_chat, rol::rol_usuario, true, true
from unnest(array[
       'incidencia_calidad', 'incidencia_produccion', 'nuevo_lote',
       'resumen_turno', 'resumen_calidad', 'general'
     ]) as tipo_chat
cross join unnest(array[
       'responsable', 'suplente', 'operario', 'jefe', 'administrador'
     ]) as rol
on conflict (tipo_chat, rol) do nothing;

insert into chat_acceso (tipo_chat, rol, puede_ver, puede_escribir)
values ('ceria', 'jefe', true, true), ('ceria', 'administrador', true, true)
on conflict (tipo_chat, rol) do nothing;

-- -------------------------------------------------------------
-- Función de ayuda para las políticas RLS de notificaciones/
-- chat_mensajes — sql/stable/security definer (igual que fn_rol_actual)
-- para que cualquier rol pueda evaluarla aunque no tenga permiso
-- directo de lectura fila a fila sobre chat_acceso.
-- -------------------------------------------------------------
create or replace function fn_chat_acceso(p_tipo_chat text, p_permiso text default 'ver')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case p_permiso
        when 'escribir' then puede_escribir
        else puede_ver
      end
      from chat_acceso
      where tipo_chat = p_tipo_chat and rol = fn_rol_actual()
    ),
    false
  );
$$;

comment on function fn_chat_acceso is
  'Consulta chat_acceso para el rol actual. p_permiso: ''ver'' '
  '(por defecto) o ''escribir''. Ausencia de fila = false (deny-by-'
  'default). Usada por las políticas RLS de notificaciones y '
  'chat_mensajes, y por la Edge Function de Ceria.';

-- -------------------------------------------------------------
-- Reenganchar notificaciones: la política fija de roles se sustituye
-- por la consulta dinámica a chat_acceso.
-- -------------------------------------------------------------
drop policy if exists notificaciones_select_roles_limitados on notificaciones;

do $$ begin
  create policy notificaciones_select_segun_acceso on notificaciones
    for select using (fn_chat_acceso(tipo, 'ver'));
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- Reenganchar chat_mensajes: mismo cambio, separando ver de escribir.
-- La política de borrado suave (propio + admin) no se toca — no
-- depende de chat_acceso.
-- -------------------------------------------------------------
drop policy if exists chat_mensajes_select on chat_mensajes;
drop policy if exists chat_mensajes_insert on chat_mensajes;

do $$ begin
  create policy chat_mensajes_select_segun_acceso on chat_mensajes
    for select using (fn_chat_acceso('general', 'ver'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy chat_mensajes_insert_segun_acceso on chat_mensajes
    for insert with check (
      usuario_id = auth.uid() and fn_chat_acceso('general', 'escribir')
    );
exception when duplicate_object then null; end $$;
