-- =============================================================
-- ceria_modelo_activo — habilitar/deshabilitar modelos de Fase 3 de
-- Ceria desde el admin. Sesión 07/09/2026.
--
-- Convención OPUESTA a chat_acceso a propósito: aquí el catálogo de
-- 7 modelos ya está fijo en el código (MODELOS_FASE3 en modelos.ts),
-- así que el comportamiento de hoy es "todos activos" — ausencia de
-- fila = ACTIVO (no deshabilitado). Solo se inserta una fila cuando
-- el admin apaga alguno en concreto. Esto significa que aplicar esta
-- migración no cambia nada por sí sola: los 7 siguen disponibles
-- hasta que el admin apague el primero.
-- =============================================================

create table if not exists ceria_modelo_activo (
  modelo_id text primary key,
  activo    boolean not null default true
);

comment on table ceria_modelo_activo is
  'Ausencia de fila = modelo activo (opuesto a chat_acceso a '
  'propósito — aquí el catálogo ya viene fijo en código, el caso '
  'base es "todo encendido"). Solo se inserta fila cuando el admin '
  'apaga un modelo concreto. Consultada por el selector de Ceria en '
  'el frontend y por resolverModeloFase3 en la Edge Function (para '
  'que apagar un modelo también bloquee su uso vía API directa, no '
  'solo lo oculte del desplegable).';

alter table ceria_modelo_activo enable row level security;

do $$ begin
  create policy ceria_modelo_activo_select on ceria_modelo_activo
    for select using (fn_rol_actual() is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy ceria_modelo_activo_admin_escribe on ceria_modelo_activo
    for all using (fn_rol_actual() = 'administrador')
    with check (fn_rol_actual() = 'administrador');
exception when duplicate_object then null; end $$;
