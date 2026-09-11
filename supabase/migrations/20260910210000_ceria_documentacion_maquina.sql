-- Documentación de referencia por máquina/submáquina para Ceria.
-- Mismo patrón de acceso que ceria_prompts (jefe+administrador leen,
-- administrador escribe) — no hay UI de edición todavía, se rellena
-- por migración a mano, igual que ceria_prompts. NO incluye "cómo
-- resolver" de alarmas (eso es diagnostico-sintomas.md, sin capturar
-- todavía — tabla/herramienta aparte cuando llegue ese momento).
create table ceria_documentacion_maquina (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  maquina text not null,
  submaquina text,
  tipo text not null check (tipo in (
    'proceso', 'parametro', 'sensor', 'actuador', 'pieza',
    'alarma', 'mantenimiento', 'configuracion_inicial'
  )),
  nombre text not null,
  contenido text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ceria_documentacion_maquina enable row level security;

create policy ceria_documentacion_maquina_select on ceria_documentacion_maquina
  for select using (fn_rol_actual() = any (array['jefe','administrador']::rol_usuario[]));

create policy ceria_documentacion_maquina_admin_todo on ceria_documentacion_maquina
  for all using (fn_rol_actual() = 'administrador'::rol_usuario)
  with check (fn_rol_actual() = 'administrador'::rol_usuario);

create index ceria_documentacion_maquina_maquina_idx
  on ceria_documentacion_maquina (maquina, submaquina, tipo);