-- =============================================================
-- admin_notas — espacio de trabajo libre del administrador.
-- Sustituye el uso de `configuracion` para esto: `configuracion` es
-- solo para un puñado de constantes globales pequeñas que casi nunca
-- cambian (fecha_inicio_rotacion, objetivo_m2_dia); esto en cambio
-- crece cada día y guarda texto largo, así que se le da tabla propia
-- (mismo criterio ya usado en el proyecto para ceria_documentacion_maquina,
-- engrase_punto, etc. — nunca sobrecargar una tabla de config genérica).
--
-- Dos usos sobre la misma tabla, distinguidos por `tipo`:
--   - 'programacion': el CSV diario de producción. Una fila por
--     fecha (índice único parcial de abajo). El admin lo pega desde
--     la pestaña "Programación".
--   - 'nota': notas sueltas del admin sobre cualquier cosa de la
--     app, sin fecha obligatoria. Pestaña "Notas".
--
-- Solo el rol administrador tiene acceso (ni siquiera SELECT para el
-- resto) — es su propio espacio de trabajo, no un dato operativo que
-- necesite ninguna función ni pantalla de otro rol.
-- =============================================================

create table admin_notas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('programacion', 'nota')),
  fecha       date,               -- obligatoria para 'programacion' (constraint abajo); opcional en 'nota'
  titulo      text,               -- solo se usa en 'nota'
  contenido   text not null,      -- el CSV completo en 'programacion', el texto de la nota en 'nota'
  num_filas   int,                -- informativo, solo 'programacion' (líneas del CSV pegado)
  creado_por  uuid references usuario(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Como mucho una fila de programación por día. Es un índice PARCIAL
-- (where tipo = 'programacion') a propósito: varias notas sí pueden
-- compartir la misma fecha sin conflicto.
create unique index admin_notas_programacion_por_dia
  on admin_notas (fecha)
  where tipo = 'programacion';

-- La 'programacion' siempre necesita fecha; la 'nota' no.
alter table admin_notas
  add constraint admin_notas_programacion_requiere_fecha
  check (tipo <> 'programacion' or fecha is not null);

alter table admin_notas enable row level security;

create policy admin_notas_admin_todo on admin_notas
  for all using (fn_rol_actual() = 'administrador')
  with check (fn_rol_actual() = 'administrador');

comment on table admin_notas is
  'Espacio de trabajo libre del administrador: CSV diario de '
  'Programación (tipo=programacion, una fila por fecha, ver índice '
  'único parcial) y notas sueltas sobre cosas de la app '
  '(tipo=nota, sin fecha obligatoria). Solo el rol administrador '
  'tiene acceso (RLS for all) — no es un dato operativo del resto '
  'de la app, por eso no se reutilizó `configuracion`.';
