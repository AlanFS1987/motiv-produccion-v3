-- =============================================================
-- 0003 — Catálogos: modelo, marca, formato, producto
-- Ref. spec: 04-rol-administrador.md 6.1, 11-esquema-supabase.md 13.1
-- =============================================================

-- Función compartida de normalización (mayúsculas, espacios
-- colapsados/recortados) — usada por modelo y marca para reducir
-- duplicados de catálogo por variaciones tontas de lectura OCR.
create or replace function fn_normalizar_texto(p_texto text)
returns text
language sql immutable as $$
  select trim(regexp_replace(upper(p_texto), '\s+', ' ', 'g'));
$$;

-- -------------------------------------------------------------
-- modelo — auto-creado la primera vez que aparece (6.1)
-- -------------------------------------------------------------
create table modelo (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,               -- tal cual lo lee el OCR
  nombre_normalizado  text not null,                -- para pg_trgm
  created_at          timestamptz not null default now()
);

create index idx_modelo_trgm on modelo using gin (nombre_normalizado gin_trgm_ops);

create or replace function fn_set_nombre_normalizado_modelo()
returns trigger language plpgsql as $$
begin
  new.nombre_normalizado := fn_normalizar_texto(new.nombre);
  return new;
end;
$$;

create trigger trg_modelo_normalizar
  before insert or update of nombre on modelo
  for each row execute function fn_set_nombre_normalizado_modelo();

-- -------------------------------------------------------------
-- marca — auto-creada, mismo patrón que modelo
-- -------------------------------------------------------------
create table marca (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_normalizado  text not null,
  created_at          timestamptz not null default now()
);

create index idx_marca_trgm on marca using gin (nombre_normalizado gin_trgm_ops);

create or replace function fn_set_nombre_normalizado_marca()
returns trigger language plpgsql as $$
begin
  new.nombre_normalizado := fn_normalizar_texto(new.nombre);
  return new;
end;
$$;

create trigger trg_marca_normalizar
  before insert or update of nombre on marca
  for each row execute function fn_set_nombre_normalizado_marca();

-- -------------------------------------------------------------
-- formato — catálogo CERRADO, 7 filas fijas, no se auto-crea (6.1)
-- -------------------------------------------------------------
create table formato (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique
);

insert into formato (nombre) values
  ('200x1200'), ('300x1200'), ('600x1200'),
  ('1200x1200'), ('300x600'), ('600x600'), ('900x900');

-- -------------------------------------------------------------
-- producto — auto-creado como combinación modelo+marca+formato
-- -------------------------------------------------------------
create table producto (
  id           uuid primary key default gen_random_uuid(),
  modelo_id    uuid not null references modelo(id),
  marca_id     uuid not null references marca(id),
  formato_id   uuid not null references formato(id),
  created_at   timestamptz not null default now(),
  unique (modelo_id, marca_id, formato_id)
);

create index idx_producto_modelo on producto (modelo_id);
create index idx_producto_marca on producto (marca_id);
