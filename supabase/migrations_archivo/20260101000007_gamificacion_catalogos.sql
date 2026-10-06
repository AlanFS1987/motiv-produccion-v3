-- =============================================================
-- 0007 — Gamificación: catálogos
-- Ref. spec: 03-rol-operario.md 5.6/5.7/5.9/5.11,
--            02-rol-jefe-planta.md 4.6, 11-esquema-supabase.md 13.5
-- =============================================================

-- -------------------------------------------------------------
-- niveles — 9 niveles del operario (umbral sobre puntos totales)
-- -------------------------------------------------------------
create table niveles (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,          -- Aprendiz...Leyenda
  umbral_min    int not null,
  umbral_max    int,                    -- null en el último nivel
  color_marco   text not null,          -- hex
  estrellas     int not null,
  efecto_aura   text,
  prompt_base   text,
  prompt_imagen text,
  orden         int not null unique
);

-- -------------------------------------------------------------
-- niveles_responsable — reutiliza catálogo visual/prompts de
-- `niveles`, con umbrales propios (×2 del operario, cerrado)
-- -------------------------------------------------------------
create table niveles_responsable (
  id          uuid primary key default gen_random_uuid(),
  nivel_id    uuid not null references niveles(id),
  umbral_min  int not null,
  umbral_max  int
);

-- -------------------------------------------------------------
-- checklist_items — 6 ítems fijos de limpieza
-- -------------------------------------------------------------
create table checklist_items (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  puntos  int not null default 1,
  activo  boolean not null default true
);

-- -------------------------------------------------------------
-- logros_definicion — catálogo extensible de logros/medallas
-- -------------------------------------------------------------
create table logros_definicion (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  descripcion      text,
  icono            text,
  condicion_tipo   text not null,   -- debe existir en el motor de comprobación
  condicion_valor  numeric not null,
  activo           boolean not null default true
);

-- -------------------------------------------------------------
-- puntos_piezas — operario, 7 formatos × 5 tramos
-- -------------------------------------------------------------
create table puntos_piezas (
  id       uuid primary key default gen_random_uuid(),
  formato  text not null,
  min      int not null,
  max      int not null,
  puntos   int not null,
  check (max >= min)
);

-- -------------------------------------------------------------
-- puntos_rendimiento — operario, tramos por % (denom. = 480 min)
-- -------------------------------------------------------------
create table puntos_rendimiento (
  id       uuid primary key default gen_random_uuid(),
  pct_min  numeric not null,
  pct_max  numeric not null,
  puntos   int not null,
  check (pct_max >= pct_min)
);

-- -------------------------------------------------------------
-- puntos_rendimiento_responsable — mismos tramos %, denom = 2880 min
-- -------------------------------------------------------------
create table puntos_rendimiento_responsable (
  id       uuid primary key default gen_random_uuid(),
  pct_min  numeric not null,
  pct_max  numeric not null,
  puntos   int not null,
  check (pct_max >= pct_min)
);

-- 08-pendientes.md es explícito: "una única tabla de tramos por
-- porcentaje, compartida por ambos roles (cada uno contra su propio
-- denominador, 480 operario / 2880 responsable)". Se mantienen dos
-- tablas físicas (como en 11-esquema-supabase.md 13.5) por claridad
-- de origen de datos, pero con el MISMO contenido de tramos — los 10
-- tramos completos, no solo los primeros 5.
insert into puntos_rendimiento (pct_min, pct_max, puntos) values
  (0.00, 20.80, 2), (20.83, 29.13, 5), (29.17, 37.47, 8),
  (37.50, 45.80, 12), (45.83, 58.30, 16), (58.33, 66.63, 21),
  (66.67, 74.97, 26), (75.00, 83.30, 32), (83.33, 91.63, 38),
  (91.67, 100.00, 45);

insert into puntos_rendimiento_responsable (pct_min, pct_max, puntos) values
  (0.00, 20.80, 2), (20.83, 29.13, 5), (29.17, 37.47, 8),
  (37.50, 45.80, 12), (45.83, 58.30, 16), (58.33, 66.63, 21),
  (66.67, 74.97, 26), (75.00, 83.30, 32), (83.33, 91.63, 38),
  (91.67, 100.00, 45);

-- -------------------------------------------------------------
-- puntos_metros — responsable, m² absolutos agregados del turno
-- -------------------------------------------------------------
create table puntos_metros (
  id      uuid primary key default gen_random_uuid(),
  m2_min  int not null,
  m2_max  int,   -- null = sin límite (último tramo)
  puntos  int not null
);

insert into puntos_metros (m2_min, m2_max, puntos) values
  (0, 4999, 2), (5000, 6999, 5), (7000, 8999, 8),
  (9000, 10999, 12), (11000, 12999, 16), (13000, 14999, 21),
  (15000, 16999, 26), (17000, 18999, 32), (19000, 20999, 38),
  (21000, null, 45);

comment on table niveles_responsable is
  'umbral_min/umbral_max deben poblarse como ×2 de los umbrales de '
  '`niveles` una vez esa tabla esté poblada con los 9 niveles reales '
  '(02-rol-jefe-planta.md 4.6). No se auto-generan aquí porque '
  '`niveles` se puebla con el contenido real (nombres/colores/prompts) '
  'fuera de esta migración.';
