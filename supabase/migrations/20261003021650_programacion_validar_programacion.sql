-- 03/10/2026 — Programación, fase A3: `validar_programacion(fecha)`.
--
-- Solo lectura (jefe/administrador). Devuelve los avisos que Revisar debe resolver, con los
-- CAMPOS CRUDOS de cada aparición: `diff_programacion` solo devuelve una fila por número
-- repetido, y el jefe necesita ver todas para elegir cuál es la buena.
--
--   repetida    mismo `numero_orden` más de una vez en el CSV (mismo horno o distinto).
--               Una fila por aparición.
--   incompleta  número válido pero falta MODELO o METROS (nulo/vacío/ilegible/≤ 0).
--               NO se marcan ACABADO ni CAJA vacíos: hay órdenes legítimas sin acabado.
--               `falta` dice qué campo(s).
--   descartada  línea que `parse_programacion` ignora pero que PARECE una orden: el número
--               tiene dígitos pero no cumple ^[0-9]{6,8}$, o no hay número válido y sí hay
--               modelo y metros numéricos. Informativa. No avisa del ruido conocido:
--               huecos « - », títulos, cabeceras repetidas, «CAMBIO DE FORMATO…», vacías.
--
-- No toca `parse_programacion` ni `diff_programacion`: reutiliza su misma lógica de líneas
-- (cabeceras, horno por orden de cabecera, posición por horno) para que `horno`/`posicion`
-- coincidan con los del diff. `linea` es el nº de línea (1..n) dentro del texto guardado;
-- `linea_cruda` solo se rellena en las descartadas.

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
      -- METROS: el CSV usa el punto como separador de miles (5.500 = 5500)
      case when metros ~ '^[0-9][0-9.]*$' then replace(metros, '.', '')::numeric end as metros_num
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
        or (c.modelo <> '' and c.metros ~ '^[0-9][0-9.]*$')
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
