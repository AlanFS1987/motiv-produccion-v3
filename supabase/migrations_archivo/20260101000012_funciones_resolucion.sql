-- =============================================================
-- 0012 — Búsqueda por similitud (pg_trgm) para resolución de
-- catálogo tras el OCR (05-modelo-de-datos.md 7.4)
-- =============================================================

create or replace function fn_buscar_modelo_similar(p_nombre_normalizado text)
returns table(id uuid, nombre text, similitud real)
language sql stable as $$
  select id, nombre, similarity(nombre_normalizado, p_nombre_normalizado) as similitud
  from modelo
  order by similitud desc
  limit 5;
$$;

create or replace function fn_buscar_marca_similar(p_nombre_normalizado text)
returns table(id uuid, nombre text, similitud real)
language sql stable as $$
  select id, nombre, similarity(nombre_normalizado, p_nombre_normalizado) as similitud
  from marca
  order by similitud desc
  limit 5;
$$;

comment on function fn_buscar_modelo_similar is
  'Devuelve hasta 5 candidatos ordenados por similitud (pg_trgm) contra '
  'modelo.nombre_normalizado. La Edge Function resolver-catalogo decide '
  'el umbral de corte (05-modelo-de-datos.md 7.4: "coincidencia clara → '
  'se enlaza; sin coincidencia clara → se crea, nunca bloquea").';
