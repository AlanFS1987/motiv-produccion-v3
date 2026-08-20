-- =============================================================
-- 0002 — Usuarios
-- Ref. spec: 11-esquema-supabase.md 13.3, 00-vision-general.md 2
-- =============================================================

create type rol_usuario as enum (
  'responsable', 'jefe', 'produccion', 'calidad',
  'operario', 'administrador', 'suplente'
);

create type letra_turno as enum ('A', 'B', 'C', 'D');

-- usuario.id referencia auth.users(id) — Supabase Auth es quien
-- gestiona login/password (06-integraciones.md 8). Esta tabla es
-- el perfil de aplicación 1:1 sobre cada cuenta de auth.
create table usuario (
  id                        uuid primary key references auth.users(id) on delete cascade,
  username                  text not null unique,
  rol                       rol_usuario not null,
  letra                     letra_turno,  -- null para admin/jefe/produccion/calidad/suplente
  generaciones_disponibles  int not null default 0 check (generaciones_disponibles >= 0),
  created_at                timestamptz not null default now()
);

comment on table usuario is
  'Perfil de aplicación. `suplente` no es tabla aparte: es una fila '
  'más con rol=suplente, sin letra, un único registro ficticio '
  '(13.3, 08-pendientes.md).';

-- 'suplente' es un único registro ficticio por diseño (13.3) —
-- se refuerza aquí, no solo por convención de la app.
create unique index uq_usuario_suplente_unico
  on usuario ((rol = 'suplente'))
  where rol = 'suplente';

create index idx_usuario_rol on usuario (rol);
create index idx_usuario_letra on usuario (letra) where letra is not null;
