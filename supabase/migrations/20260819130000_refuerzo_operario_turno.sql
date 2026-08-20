-- =============================================================
-- Operarios de refuerzo (sesión 19/08/2026) — resuelve dos problemas
-- relacionados detectados al construir el rol operario:
--
-- 1. Un operario que cubre/cambia de turno (mucho más habitual que un
--    responsable haciéndolo) no tenía forma de que la app supiera que
--    "pertenece" a un turno que no es el de su letra habitual.
-- 2. Un operario que viene solo a ayudar con la limpieza, SIN estar
--    asignado a ninguna línea, tampoco tenía ningún registro que lo
--    vinculara al turno.
--
-- Diseño acordado: 2 caminos de pertenencia a un turno, nada más —
-- "es su letra" o "está de refuerzo". Para poder asignarlo a una
-- línea sin ser de su letra, el responsable debe darlo de alta aquí
-- PRIMERO (así el desplegable de asignación de línea deja de listar
-- "todos los demás" sin más, y pasa a listar solo su grupo + quien ya
-- esté marcado de refuerzo).
-- =============================================================

create table refuerzo_operario_turno (
  id              uuid primary key default gen_random_uuid(),
  turno_id        uuid not null references turno(id),
  operario_id     uuid not null references usuario(id),
  habilitado_por  uuid not null references usuario(id),
  created_at      timestamptz not null default now(),
  unique (turno_id, operario_id)
);

create index idx_refuerzo_operario_turno on refuerzo_operario_turno (operario_id);

comment on table refuerzo_operario_turno is
  'Presencia excepcional de un operario en un turno que no es el de '
  'su letra habitual — ver comentario de cabecera de esta migración. '
  'No implica trabajo en una línea (eso sigue siendo '
  'asignacion_operario_linea); solo marca "está aquí hoy".';

alter table refuerzo_operario_turno enable row level security;

-- SELECT abierto a cualquier rol autenticado — mismo criterio que
-- asignacion_operario_linea (catálogo operativo del día, no dato
-- sensible).
create policy refuerzo_operario_turno_select on refuerzo_operario_turno
  for select using (auth.role() = 'authenticated');

-- Solo responsable/suplente/administrador dan de alta o quitan
-- refuerzo — mismo patrón que asignacion_operario_linea
-- (20260101000015_rls_turno_asignacion.sql).
create policy refuerzo_operario_turno_insert on refuerzo_operario_turno
  for insert with check (
    habilitado_por = auth.uid()
    and fn_rol_actual() in ('responsable', 'suplente', 'administrador')
  );

create policy refuerzo_operario_turno_delete on refuerzo_operario_turno
  for delete using (
    fn_rol_actual() in ('responsable', 'suplente', 'administrador')
  );
