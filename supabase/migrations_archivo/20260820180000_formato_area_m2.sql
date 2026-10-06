-- =============================================================
-- Añade formato.area_m2 — superficie de una pieza en m², derivada
-- del nombre del formato (medidas en mm, ej. "600x1200" -> 0,72 m²).
--
-- Hasta ahora esta fórmula solo vivía en TypeScript
-- (frontend/src/lib/formato.ts, areaM2DeFormato/m2DePiezas), usada
-- por el informe de cierre de turno. Con el dashboard del jefe y
-- Ceria necesitando el mismo cálculo directamente en SQL (para que
-- las sumas de m² las haga siempre Postgres, nunca el cliente ni un
-- modelo de IA), se evita duplicar la regex en dos sitios: `formato`
-- tiene solo 7 filas fijas (catálogo cerrado, 0003_catalogos.sql),
-- así que se calcula una vez aquí y queda como fuente única de
-- verdad. El frontend puede seguir usando su función local para no
-- depender de una consulta extra, siempre que ambas se mantengan
-- iguales — o migrar a leer esta columna, a decidir aparte.
--
-- Fórmula: area_m2 = (ancho_mm * alto_mm) / 1.000.000, extrayendo
-- ambos números del nombre "NNNxNNN" con split_part (no hace falta
-- regex: el catálogo es cerrado y siempre tiene esa forma).
-- =============================================================

alter table formato add column if not exists area_m2 numeric;

update formato
set area_m2 = (
  split_part(nombre, 'x', 1)::numeric * split_part(nombre, 'x', 2)::numeric
) / 1000000
where area_m2 is null;

-- NOT NULL + check una vez poblado — mismo patrón que otras columnas
-- derivadas del proyecto (calibre_std_pct, etc.). Re-ejecutar esta
-- migración no falla: set not null sobre una columna ya not null no
-- da error, y el UPDATE de arriba no toca filas ya pobladas.
alter table formato alter column area_m2 set not null;

do $$
begin
  alter table formato add constraint formato_area_m2_positivo check (area_m2 > 0);
exception when duplicate_object then
  null; -- ya existe, migración re-ejecutada sin problema
end $$;

comment on column formato.area_m2 is
  'Superficie de una pieza en m², derivada del nombre (mm x mm). '
  'Fuente única de verdad para el cálculo de m² en SQL (vistas de '
  'Ceria, dashboard del jefe) — evita repetir la conversión piezas->m² '
  'en cada consulta. Ver también frontend/src/lib/formato.ts para el '
  'equivalente en TypeScript (informe de cierre de turno).';