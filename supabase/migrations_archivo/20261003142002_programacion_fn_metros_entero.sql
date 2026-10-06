-- 03/10/2026 — Regla única para leer METROS: fn_metros_entero.
--
-- Hasta ahora `parse_programacion` convertía METROS con `replace(.., '.', '')::numeric`: con un valor
-- como `5,5` o ` - ` lanzaba `invalid input syntax for type numeric` y el diff entero fallaba (Revisar no
-- podía ni mostrar la pantalla). Los metros de esta tabla son siempre enteros (m²) y el separador de miles
-- puede llegar como punto (`5.500`) o coma (`5,500`), así que la regla es: se quita todo lo que no sea un
-- dígito. Vive en UN solo sitio, `fn_metros_entero`, y la usan `parse_programacion` y `validar_programacion`.
--
--   '5500' -> 5500   '5.500' -> 5500   '5,500' -> 5500   '15.000' -> 15000   '15,000' -> 15000
--   '5,5'  -> 55 (documentado: un decimal se lee como entero)   ''/' - '/'sin dígitos'/null -> null
--
-- Nunca lanza excepción: sin dígitos -> null, y más de 18 dígitos (absurdo para unos metros) -> null.
-- Función pura e inmutable. Solo la llaman funciones security definer (propietario postgres), por eso se
-- revoca execute a public, anon y authenticated.
--
-- Cambios en las dos funciones: SOLO la expresión de METROS.
--   * parse_programacion: misma firma (8 columnas y tipos), #variable_conflict, guarda de rol con
--     coalesce y grants idénticos. `nullif(replace(metros_raw,'.',''),'')::numeric` -> fn_metros_entero(metros_raw).
--   * validar_programacion: `metros_num` usa fn_metros_entero (antes: regex ^[0-9][0-9.]*$ + replace). La
--     heurística de «descartada» (¿esa línea parece una orden?) acepta ahora también la coma de miles en METROS.
-- Si cambia el formato de las líneas hay que cambiarlo en las DOS: validar_programacion reimplementa la
-- lectura de líneas de parse_programacion.

create or replace function fn_metros_entero(p_texto text)
returns numeric
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case
           when length(d) between 1 and 18 then d::numeric
           else null
         end
  from (select regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g') as d) x
$$;

revoke execute on function fn_metros_entero(text) from public, anon, authenticated;

comment on function fn_metros_entero(text) is
  'Metros enteros desde texto: quita todo lo que no sea un dígito (5.500, 5,500 y 5500 = 5500; 5,5 = 55). Sin dígitos o más de 18 -> null. Nunca lanza excepción. Regla única de parse_programacion y validar_programacion.';

-- -------------------------------------------------------------
-- parse_programacion (cuerpo de 20261002183413; solo cambia la expresión de METROS)
-- -------------------------------------------------------------
create or replace function parse_programacion(p_fecha date)
returns table (
  horno smallint,
  posicion integer,
  numero_orden text,
  modelo text,
  metros numeric,
  acabado text,
  cep boolean,
  caja text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return query
  with lineas as (
    select line, ordinality
    from admin_notas,
         unnest(string_to_array(contenido, E'\n')) with ordinality as t(line, ordinality)
    where tipo = 'programacion' and fecha = p_fecha
  ),
  marcadas as (
    select *, (line ilike '%Nº ORDEN%' and line ilike '%MODELO%') as es_header
    from lineas
  ),
  con_horno as (
    select *,
      sum(case when es_header then 1 else 0 end) over (order by ordinality) as h
    from marcadas
  ),
  campos as (
    select
      h, ordinality,
      trim(split_part(line, ';', 2)) as numero_orden,
      trim(split_part(line, ';', 3)) as modelo,
      trim(split_part(line, ';', 4)) as metros_raw,
      trim(split_part(line, ';', 9)) as acabado,
      trim(split_part(line, ';', 11)) as cep_raw,
      trim(split_part(line, ';', 12)) as caja
    from con_horno
    where not es_header
  ),
  filtrado as (
    select *,
      row_number() over (partition by h order by ordinality) as pos
    from campos
    where numero_orden ~ '^[0-9]{6,8}$'
  )
  select
    f.h::smallint,
    f.pos::integer,
    f.numero_orden,
    f.modelo,
    fn_metros_entero(f.metros_raw),
    f.acabado,
    (f.cep_raw = 'X'),
    nullif(f.caja, '')
  from filtrado f
  order by f.h, f.pos;
end;
$$;

revoke execute on function parse_programacion(date) from public, anon;
grant execute on function parse_programacion(date) to authenticated;

-- -------------------------------------------------------------
-- validar_programacion (cuerpo de 20261003021650; solo cambia METROS)
-- -------------------------------------------------------------
create or replace function validar_programacion(p_fecha date)
returns table (
  tipo         text,
  numero_orden text,
  linea        integer,
  horno        smallint,
  posicion     integer,
  modelo       text,
  metros       text,
  acabado      text,
  cep          text,
  caja         text,
  falta        text[],
  linea_cruda  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return query
  with lineas as (
    select replace(t.line, E'\r', '') as ln, t.ordinality::integer as ord
    from admin_notas n,
         unnest(string_to_array(n.contenido, E'\n')) with ordinality as t(line, ordinality)
    where n.tipo = 'programacion' and n.fecha = p_fecha
  ),
  marcadas as (
    select *, (ln ilike '%Nº ORDEN%' and ln ilike '%MODELO%') as es_header
    from lineas
  ),
  con_horno as (
    select *, sum(case when es_header then 1 else 0 end) over (order by ord) as h
    from marcadas
  ),
  campos as (
    select
      h, ord, ln,
      trim(split_part(ln, ';', 2))  as numero_orden,
      trim(split_part(ln, ';', 3))  as modelo,
      trim(split_part(ln, ';', 4))  as metros,
      trim(split_part(ln, ';', 9))  as acabado,
      trim(split_part(ln, ';', 11)) as cep,
      trim(split_part(ln, ';', 12)) as caja
    from con_horno
    where not es_header
  ),
  validas as (
    select *,
      row_number() over (partition by h order by ord) as pos,
      -- METROS: regla única en fn_metros_entero (quita todo lo que no sea un dígito)
      fn_metros_entero(metros) as metros_num
    from campos
    where numero_orden ~ '^[0-9]{6,8}$'
  ),
  repetidos as (
    select v.numero_orden from validas v group by v.numero_orden having count(*) > 1
  ),
  avisos as (
    select 'repetida'::text as tipo, v.numero_orden, v.ord, v.h, v.pos::integer as pos,
           v.modelo, v.metros, v.acabado, v.cep, v.caja,
           null::text[] as falta, null::text as linea_cruda
    from validas v
    where v.numero_orden in (select r.numero_orden from repetidos r)

    union all

    select 'incompleta', v.numero_orden, v.ord, v.h, v.pos::integer,
           v.modelo, v.metros, v.acabado, v.cep, v.caja,
           array_remove(array[
             case when v.modelo = '' then 'modelo' end,
             case when coalesce(v.metros_num, 0) <= 0 then 'metros' end
           ], null),
           null
    from validas v
    where v.modelo = '' or coalesce(v.metros_num, 0) <= 0

    union all

    select 'descartada', nullif(c.numero_orden, ''), c.ord, c.h, null::integer,
           c.modelo, c.metros, c.acabado, c.cep, c.caja,
           null, trim(c.ln)
    from campos c
    where c.numero_orden !~ '^[0-9]{6,8}$'
      and (
        c.numero_orden ~ '[0-9]'
        or (c.modelo <> '' and c.metros ~ '^[0-9][0-9.,]*$')
      )
  )
  select a.tipo, a.numero_orden, a.ord, a.h::smallint, a.pos,
         a.modelo, a.metros, a.acabado, a.cep, a.caja, a.falta, a.linea_cruda
  from avisos a
  order by a.ord, a.tipo;
end;
$$;

revoke execute on function validar_programacion(date) from public, anon;
grant execute on function validar_programacion(date) to authenticated;
