-- Baseline generada con supabase db dump --linked el 2026-10-06.
-- Sustituye a las 173 migraciones de supabase/migrations_archivo/.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."estado_lote" AS ENUM (
    'iniciado',
    'finalizado'
);


ALTER TYPE "public"."estado_lote" OWNER TO "postgres";


CREATE TYPE "public"."letra_turno" AS ENUM (
    'A',
    'B',
    'C',
    'D'
);


ALTER TYPE "public"."letra_turno" OWNER TO "postgres";


CREATE TYPE "public"."rol_usuario" AS ENUM (
    'responsable',
    'jefe',
    'produccion',
    'calidad',
    'operario',
    'administrador',
    'suplente',
    'pantalla',
    'jefe_rectificado',
    'mecanico'
);


ALTER TYPE "public"."rol_usuario" OWNER TO "postgres";


CREATE TYPE "public"."tabla_rango" AS (
	"fecha_inicio" "date",
	"fecha_fin" "date"
);


ALTER TYPE "public"."tabla_rango" OWNER TO "postgres";


CREATE TYPE "public"."tipo_turno" AS ENUM (
    'M',
    'T',
    'N'
);


ALTER TYPE "public"."tipo_turno" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_tono_calibre"("p_numero_orden" "text", "p_tono" "text", "p_calibre" "text") RETURNS TABLE("numero_orden" "text", "tono" "text", "calibre" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
declare
  v_num     text := trim(coalesce(p_numero_orden, ''));
  v_tono    text := nullif(trim(coalesce(p_tono, '')), '');
  v_calibre text := nullif(trim(coalesce(p_calibre, '')), '');
  v_filas   integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if v_num = '' then
    raise exception 'Falta el número de orden';
  end if;
  if length(v_tono) > 20 then
    raise exception 'El tono admite como máximo 20 caracteres';
  end if;
  if length(v_calibre) > 20 then
    raise exception 'El calibre admite como máximo 20 caracteres';
  end if;

  update programacion_orden po
     set tono = v_tono,
         calibre = v_calibre
   where po.numero_orden = v_num;
  get diagnostics v_filas = row_count;

  if v_filas = 0 then
    raise exception 'La orden % no está en la programación', v_num;
  end if;

  return query
    select po.numero_orden, po.tono, po.calibre
    from programacion_orden po
    where po.numero_orden = v_num;
end;
$$;


ALTER FUNCTION "public"."actualizar_tono_calibre"("p_numero_orden" "text", "p_tono" "text", "p_calibre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anadir_nota_ordenes"("p_ordenes" "text"[], "p_texto" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_texto        text := trim(coalesce(p_texto, ''));
  v_ordenes      text[];
  v_repetidas    text[];
  v_desconocidas text[];
  v_n            integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if length(v_texto) < 1 or length(v_texto) > 500 then
    raise exception 'La nota debe tener entre 1 y 500 caracteres';
  end if;

  if p_ordenes is null or cardinality(p_ordenes) = 0 then
    raise exception 'Indica al menos una orden';
  end if;
  if cardinality(p_ordenes) > 200 then
    raise exception 'Demasiadas órdenes (máximo 200 por nota)';
  end if;

  select array_agg(trim(coalesce(o, ''))) into v_ordenes from unnest(p_ordenes) as o;

  if exists (select 1 from unnest(v_ordenes) as o where o = '') then
    raise exception 'La lista contiene órdenes vacías';
  end if;

  select array_agg(o order by o) into v_repetidas
  from (select o from unnest(v_ordenes) as o group by o having count(*) > 1) d;
  if v_repetidas is not null then
    raise exception 'Órdenes repetidas en la lista: %', array_to_string(v_repetidas, ', ');
  end if;

  select array_agg(o order by o) into v_desconocidas
  from unnest(v_ordenes) as o
  where not exists (select 1 from programacion_orden po where po.numero_orden = o);
  if v_desconocidas is not null then
    raise exception 'Órdenes que no están en la programación: %', array_to_string(v_desconocidas, ', ');
  end if;

  insert into programacion_nota (numero_orden, texto, creado_por)
  select o, v_texto, auth.uid() from unnest(v_ordenes) as o;
  get diagnostics v_n = row_count;

  return v_n;
end;
$$;


ALTER FUNCTION "public"."anadir_nota_ordenes"("p_ordenes" "text"[], "p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."borrar_nota"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  delete from programacion_nota where id = p_id;
  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    raise exception 'La nota no existe';
  end if;
end;
$$;


ALTER FUNCTION "public"."borrar_nota"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calidad_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date" DEFAULT NULL::"date", "p_linea_nombre" "text" DEFAULT NULL::"text") RETURNS TABLE("linea_id" "uuid", "linea_nombre" "text", "partes_analizados" bigint, "piezas_entradas" bigint, "piezas_1a" bigint, "piezas_comercial" bigint, "piezas_eco" bigint, "piezas_contenedor" bigint, "pct_1a_completa" numeric, "pct_comercial_completa" numeric, "pct_eco_completa" numeric, "pct_contenedor_completa" numeric, "pct_1a_oficial" numeric, "pct_comercial_oficial" numeric, "primera_fecha_en_rango" "date", "ultima_fecha_en_rango" "date")
    LANGUAGE "sql" STABLE
    AS $$
  select
    p.linea_id,
    l.nombre                                                    as linea_nombre,
    count(p.id)                                                 as partes_analizados,
    sum(p.piezas_entradas)                                      as piezas_entradas,
    sum(p.piezas_1a)                                            as piezas_1a,
    sum(p.piezas_comercial)                                     as piezas_comercial,
    sum(p.piezas_eco)                                           as piezas_eco,
    sum(p.piezas_contenedor)                                    as piezas_contenedor,
    round(100.0 * sum(p.piezas_1a)         / nullif(sum(p.piezas_entradas), 0), 2) as pct_1a_completa,
    round(100.0 * sum(p.piezas_comercial)  / nullif(sum(p.piezas_entradas), 0), 2) as pct_comercial_completa,
    round(100.0 * sum(p.piezas_eco)        / nullif(sum(p.piezas_entradas), 0), 2) as pct_eco_completa,
    round(100.0 * sum(p.piezas_contenedor) / nullif(sum(p.piezas_entradas), 0), 2) as pct_contenedor_completa,
    round(100.0 * sum(p.piezas_1a)        / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_1a_oficial,
    round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial,
    min(t.fecha) as primera_fecha_en_rango,
    max(t.fecha) as ultima_fecha_en_rango
  from parte p
  join turno t on t.id = p.turno_id
  join linea l on l.id = p.linea_id
  where p.vigente = true
    and p.completado = true
    and t.fecha >= p_fecha_desde
    and t.fecha <= coalesce(p_fecha_hasta, p_fecha_desde)
    and (p_linea_nombre is null or l.nombre ilike '%' || p_linea_nombre || '%')
  group by p.linea_id, l.nombre
  order by sum(p.piezas_entradas) desc nulls last;
$$;


ALTER FUNCTION "public"."calidad_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calidad_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") IS 'Calidad agregada por línea, sumando TODO el rango de fechas en una sola fila (no por turno). Eje CALIDAD — sin tiempos ni rendimiento, ver produccion_linea_por_fecha.';



CREATE OR REPLACE FUNCTION "public"."calidad_lote_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date" DEFAULT NULL::"date", "p_numero_orden" "text" DEFAULT NULL::"text", "p_orden_calidad" "text" DEFAULT 'mejor_primero'::"text") RETURNS TABLE("lote_id" "uuid", "numero_orden" "text", "lote_estado" "text", "modelo_nombre" "text", "marca_nombre" "text", "formato_nombre" "text", "partes_analizados" bigint, "piezas_entradas" bigint, "piezas_1a" bigint, "piezas_comercial" bigint, "piezas_eco" bigint, "piezas_contenedor" bigint, "m2_1a" numeric, "m2_comercial" numeric, "m2_eco" numeric, "m2_contenedor" numeric, "m2_total" numeric, "pct_1a_completa" numeric, "pct_comercial_completa" numeric, "pct_eco_completa" numeric, "pct_contenedor_completa" numeric, "pct_1a_oficial" numeric, "pct_comercial_oficial" numeric, "primera_fecha_en_rango" "date", "ultima_fecha_en_rango" "date")
    LANGUAGE "sql" STABLE
    AS $$
  select
    lo.id                                                      as lote_id,
    lo.numero_orden,
    lo.estado                                                  as lote_estado,
    m.nombre                                                   as modelo_nombre,
    ma.nombre                                                  as marca_nombre,
    f.nombre                                                   as formato_nombre,

    count(distinct p.id)                                       as partes_analizados,

    sum(p.piezas_entradas)                                     as piezas_entradas,
    sum(p.piezas_1a)                                           as piezas_1a,
    sum(p.piezas_comercial)                                    as piezas_comercial,
    sum(p.piezas_eco)                                          as piezas_eco,
    sum(p.piezas_contenedor)                                   as piezas_contenedor,

    sum(p.piezas_1a)         * f.area_m2                       as m2_1a,
    sum(p.piezas_comercial)  * f.area_m2                       as m2_comercial,
    sum(p.piezas_eco)        * f.area_m2                       as m2_eco,
    sum(p.piezas_contenedor) * f.area_m2                       as m2_contenedor,
    sum(p.piezas_entradas)   * f.area_m2                       as m2_total,

    round(100.0 * sum(p.piezas_1a)         / nullif(sum(p.piezas_entradas), 0), 2) as pct_1a_completa,
    round(100.0 * sum(p.piezas_comercial)  / nullif(sum(p.piezas_entradas), 0), 2) as pct_comercial_completa,
    round(100.0 * sum(p.piezas_eco)        / nullif(sum(p.piezas_entradas), 0), 2) as pct_eco_completa,
    round(100.0 * sum(p.piezas_contenedor) / nullif(sum(p.piezas_entradas), 0), 2) as pct_contenedor_completa,

    round(100.0 * sum(p.piezas_1a)        / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_1a_oficial,
    round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial,

    min(t.fecha) as primera_fecha_en_rango,
    max(t.fecha) as ultima_fecha_en_rango

  from parte p
  join turno t on t.id = p.turno_id
  join lote lo on lo.id = p.lote_id
  join producto pr on pr.id = lo.producto_id
  join modelo m on m.id = pr.modelo_id
  join marca ma on ma.id = pr.marca_id
  join formato f on f.id = pr.formato_id
  where p.vigente = true
    and p.completado = true
    and t.fecha >= p_fecha_desde
    and t.fecha <= coalesce(p_fecha_hasta, p_fecha_desde)
    and (p_numero_orden is null or lo.numero_orden ilike '%' || p_numero_orden || '%')
  group by lo.id, lo.numero_orden, lo.estado, m.nombre, ma.nombre, f.nombre, f.area_m2
  order by
    case when p_orden_calidad = 'peor_primero'
      then round(100.0 * sum(p.piezas_1a) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2)
    end asc nulls last,
    case when p_orden_calidad = 'peor_primero' then null
      else round(100.0 * sum(p.piezas_1a) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2)
    end desc nulls last;
$$;


ALTER FUNCTION "public"."calidad_lote_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_numero_orden" "text", "p_orden_calidad" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calidad_lote_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_numero_orden" "text", "p_orden_calidad" "text") IS 'Calidad por lote filtrando con precisión por turno.fecha (no por primera_produccion/ultima_produccion aproximadas de v_calidad_lote). Usar cuando la pregunta incluye un rango de fechas; para consultas históricas sin fecha, seguir usando v_calidad_lote tal cual.';



CREATE OR REPLACE FUNCTION "public"."calidad_modelo_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date" DEFAULT NULL::"date", "p_nombre_modelo" "text" DEFAULT NULL::"text", "p_formato" "text" DEFAULT NULL::"text") RETURNS TABLE("producto_id" "uuid", "modelo_nombre" "text", "marca_nombre" "text", "formato_nombre" "text", "partes_analizados" bigint, "lotes_distintos" bigint, "piezas_entradas" bigint, "piezas_1a" bigint, "piezas_comercial" bigint, "piezas_eco" bigint, "piezas_contenedor" bigint, "m2_1a" numeric, "m2_comercial" numeric, "m2_eco" numeric, "m2_contenedor" numeric, "m2_total" numeric, "pct_1a_completa" numeric, "pct_comercial_completa" numeric, "pct_eco_completa" numeric, "pct_contenedor_completa" numeric, "pct_1a_oficial" numeric, "pct_comercial_oficial" numeric, "primera_fecha_en_rango" "date", "ultima_fecha_en_rango" "date")
    LANGUAGE "sql" STABLE
    AS $$
  select
    pr.id                                                       as producto_id,
    m.nombre                                                    as modelo_nombre,
    ma.nombre                                                   as marca_nombre,
    f.nombre                                                    as formato_nombre,

    count(distinct p.id)                                        as partes_analizados,
    count(distinct p.lote_id)                                   as lotes_distintos,

    sum(p.piezas_entradas)                                      as piezas_entradas,
    sum(p.piezas_1a)                                            as piezas_1a,
    sum(p.piezas_comercial)                                     as piezas_comercial,
    sum(p.piezas_eco)                                           as piezas_eco,
    sum(p.piezas_contenedor)                                    as piezas_contenedor,

    sum(p.piezas_1a)         * f.area_m2                        as m2_1a,
    sum(p.piezas_comercial)  * f.area_m2                        as m2_comercial,
    sum(p.piezas_eco)        * f.area_m2                        as m2_eco,
    sum(p.piezas_contenedor) * f.area_m2                        as m2_contenedor,
    sum(p.piezas_entradas)   * f.area_m2                        as m2_total,

    round(100.0 * sum(p.piezas_1a)         / nullif(sum(p.piezas_entradas), 0), 2) as pct_1a_completa,
    round(100.0 * sum(p.piezas_comercial)  / nullif(sum(p.piezas_entradas), 0), 2) as pct_comercial_completa,
    round(100.0 * sum(p.piezas_eco)        / nullif(sum(p.piezas_entradas), 0), 2) as pct_eco_completa,
    round(100.0 * sum(p.piezas_contenedor) / nullif(sum(p.piezas_entradas), 0), 2) as pct_contenedor_completa,

    round(100.0 * sum(p.piezas_1a)        / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_1a_oficial,
    round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial,

    min(t.fecha) as primera_fecha_en_rango,
    max(t.fecha) as ultima_fecha_en_rango

  from parte p
  join turno t on t.id = p.turno_id
  join lote lo on lo.id = p.lote_id
  join producto pr on pr.id = lo.producto_id
  join modelo m on m.id = pr.modelo_id
  join marca ma on ma.id = pr.marca_id
  join formato f on f.id = pr.formato_id
  where p.vigente = true
    and p.completado = true
    and t.fecha >= p_fecha_desde
    and t.fecha <= coalesce(p_fecha_hasta, p_fecha_desde)
    and (p_nombre_modelo is null or m.nombre ilike '%' || p_nombre_modelo || '%')
    and (p_formato is null or f.nombre = p_formato)
  group by pr.id, m.nombre, ma.nombre, f.nombre, f.area_m2
  order by sum(p.piezas_entradas) desc nulls last;
$$;


ALTER FUNCTION "public"."calidad_modelo_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_nombre_modelo" "text", "p_formato" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calidad_modelo_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_nombre_modelo" "text", "p_formato" "text") IS 'Calidad por modelo/producto filtrando con precisión por turno.fecha. Para consultas históricas sin fecha, seguir usando v_calidad_modelo tal cual.';



CREATE OR REPLACE FUNCTION "public"."confirmar_programacion"("p_fecha" "date", "p_filas" "jsonb") RETURNS TABLE("nuevos" integer, "eliminados" integer, "actualizados" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
declare
  v_nuevos integer;
  v_eliminados integer;
  v_actualizados integer;
  v_repetidos text;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'p_filas debe ser un array JSON';
  end if;

  if jsonb_array_length(p_filas) = 0 then
    raise exception 'No se puede confirmar una programación vacía: se borrarían todas las órdenes. Revisa el archivo y vuelve a intentarlo.';
  end if;

  create temporary table tmp_programacion_nueva on commit drop as
  select
    (f->>'horno')::smallint as horno,
    nullif(trim(f->>'numero_orden'), '') as numero_orden,
    f->>'modelo' as modelo,
    nullif(f->>'metros','')::numeric as metros,
    f->>'acabado' as acabado,
    coalesce((f->>'cep')::boolean, false) as cep,
    f->>'caja' as caja,
    (f->>'posicion')::integer as posicion,
    nullif(f->>'tono','') as tono,
    nullif(f->>'calibre','') as calibre
  from jsonb_array_elements(p_filas) as f;

  if exists (select 1 from tmp_programacion_nueva where numero_orden is null or horno is null) then
    raise exception 'Hay filas sin número de orden o sin horno';
  end if;

  select string_agg(numero_orden, ', ' order by numero_orden) into v_repetidos
  from (select numero_orden from tmp_programacion_nueva group by numero_orden having count(*) > 1) d;
  if v_repetidos is not null then
    raise exception 'Números de orden repetidos: %', v_repetidos;
  end if;

  -- Foto del estado actual ANTES de aplicar nada (para poder deshacer).
  insert into programacion_orden_historico (snapshot, creado_por)
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'horno', horno, 'numero_orden', numero_orden, 'modelo', modelo,
      'metros', metros, 'acabado', acabado, 'cep', cep, 'caja', caja,
      'posicion', posicion, 'tono', tono, 'calibre', calibre,
      'fecha_alta', fecha_alta
    )), '[]'::jsonb),
    auth.uid()
  from programacion_orden;

  select count(*) into v_nuevos
  from tmp_programacion_nueva n
  where not exists (select 1 from programacion_orden p where p.numero_orden = n.numero_orden);

  select count(*) into v_eliminados
  from programacion_orden p
  where not exists (select 1 from tmp_programacion_nueva n where n.numero_orden = p.numero_orden);

  select count(*) into v_actualizados
  from tmp_programacion_nueva n
  join programacion_orden p on p.numero_orden = n.numero_orden;

  delete from programacion_orden p
  where not exists (select 1 from tmp_programacion_nueva n where n.numero_orden = p.numero_orden);

  insert into programacion_orden
    (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre, fecha_alta)
  select horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre, p_fecha
  from tmp_programacion_nueva
  on conflict (numero_orden) do update
    set horno = excluded.horno,                       -- una orden puede cambiar de horno
        modelo = excluded.modelo,
        metros = excluded.metros,
        acabado = excluded.acabado,
        cep = excluded.cep,
        caja = excluded.caja,
        posicion = excluded.posicion,
        tono = coalesce(excluded.tono, programacion_orden.tono),
        calibre = coalesce(excluded.calibre, programacion_orden.calibre);
        -- fecha_alta NO se toca en el conflicto

  return query select v_nuevos, v_eliminados, v_actualizados;
end;
$$;


ALTER FUNCTION "public"."confirmar_programacion"("p_fecha" "date", "p_filas" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."confirmar_programacion"("p_fecha" "date", "p_filas" "jsonb") IS 'Escritura real sobre programacion_orden. security definer, solo jefe/administrador. Recibe el estado final YA REVISADO/EDITADO por el jefe (no confía en el parser a ciegas) y hace un reemplazo completo: upsert de lo que viene, delete de lo que falta. tono/calibre solo se sobrescriben si el cliente manda un valor no vacío, para no borrar por accidente lo ya rellenado.';



CREATE OR REPLACE FUNCTION "public"."cruzar_orden_captura"("p_numero_orden" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_num       text := trim(coalesce(p_numero_orden, ''));
  v_lote      jsonb;
  v_prog      jsonb;
  v_parecidos jsonb;
begin
  if coalesce(fn_rol_actual()::text, '') not in
     ('responsable', 'suplente', 'jefe', 'produccion', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if v_num !~ '^[0-9]{7}$' then
    raise exception 'Número de orden no válido';
  end if;

  select jsonb_build_object('numero_orden', l.numero_orden, 'modelo', m.nombre, 'objetivo_m2', l.objetivo_m2)
    into v_lote
    from lote l
    join producto p on p.id = l.producto_id
    join modelo m on m.id = p.modelo_id
   where l.numero_orden = v_num;

  select jsonb_build_object('numero_orden', po.numero_orden, 'modelo', po.modelo)
    into v_prog
    from programacion_orden po
   where po.numero_orden = v_num;

  select coalesce(jsonb_agg(x order by x.numero_orden), '[]'::jsonb)
    into v_parecidos
    from (
      select distinct on (c.numero_orden) c.numero_orden, c.modelo, c.marca, c.formato, c.origen
        from (
          select l.numero_orden, m.nombre as modelo, ma.nombre as marca, f.nombre as formato, 'lote'::text as origen
            from lote l
            join producto p on p.id = l.producto_id
            join modelo m on m.id = p.modelo_id
            join marca ma on ma.id = p.marca_id
            join formato f on f.id = p.formato_id
          union all
          select po.numero_orden, po.modelo, null::text, null::text, 'programacion'::text
            from programacion_orden po
        ) c
       where c.numero_orden <> v_num
         and length(c.numero_orden) = 7
         and (select count(*) from generate_series(1, 7) i
               where substr(c.numero_orden, i, 1) <> substr(v_num, i, 1)) = 1
       order by c.numero_orden, c.origen
    ) x;

  return jsonb_build_object('lote', v_lote, 'programacion', v_prog, 'parecidos', v_parecidos);
end;
$_$;


ALTER FUNCTION "public"."cruzar_orden_captura"("p_numero_orden" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deshacer_ultima_programacion"() RETURNS TABLE("filas_restauradas" integer, "snapshot_de" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_snapshot jsonb;
  v_creado_en timestamptz;
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  select id, snapshot, creado_en into v_id, v_snapshot, v_creado_en
  from programacion_orden_historico
  order by creado_en desc
  limit 1;

  if v_id is null then
    raise exception 'No hay ningún historial que deshacer';
  end if;

  delete from programacion_orden where true;

  insert into programacion_orden
    (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre, fecha_alta)
  select
    (f->>'horno')::smallint, f->>'numero_orden', f->>'modelo',
    nullif(f->>'metros','')::numeric, f->>'acabado',
    coalesce((f->>'cep')::boolean, false), f->>'caja',
    (f->>'posicion')::integer, nullif(f->>'tono',''), nullif(f->>'calibre',''),
    nullif(f->>'fecha_alta','')::date
  from jsonb_array_elements(v_snapshot) as f;

  get diagnostics v_filas = row_count;

  delete from programacion_orden_historico where id = v_id;

  return query select v_filas, v_creado_en;
end;
$$;


ALTER FUNCTION "public"."deshacer_ultima_programacion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deshacer_ultima_programacion"() IS 'Restaura programacion_orden a como estaba justo antes de la última confirmar_programacion (pila: cada uso retrocede un paso más). security definer, solo jefe/administrador.';



CREATE OR REPLACE FUNCTION "public"."diff_programacion"("p_fecha" "date") RETURNS TABLE("cambio" "text", "horno" smallint, "numero_orden" "text", "modelo" "text", "metros" numeric, "acabado" "text", "cep" boolean, "caja" "text", "posicion_actual" integer, "posicion_nueva" integer, "horno_actual" smallint, "horno_nuevo" smallint, "repetida" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return query
  with parseado as (
    select p.*, count(*) over (partition by p.numero_orden) as apariciones
    from parse_programacion(p_fecha) p
  ),
  nuevo as (
    -- una sola fila por numero_orden (la primera del CSV); los repetidos se
    -- señalan con la bandera y no multiplican el join
    select distinct on (numero_orden) *
    from parseado
    order by numero_orden, horno, posicion
  ),
  actual as (
    select po.horno, po.numero_orden, po.modelo, po.metros, po.acabado, po.cep, po.caja, po.posicion
    from programacion_orden po
  )
  select
    case
      when a.numero_orden is null then 'nuevo'
      when n.numero_orden is null then 'eliminado'
      when a.horno <> n.horno then 'cambia_horno'   -- antes que reordenado: la posición no es comparable entre hornos
      when a.posicion is distinct from n.posicion then 'reordenado'
      else 'sin_cambios'
    end as cambio,
    coalesce(n.horno, a.horno) as horno,
    coalesce(n.numero_orden, a.numero_orden) as numero_orden,
    coalesce(n.modelo, a.modelo) as modelo,
    coalesce(n.metros, a.metros) as metros,
    coalesce(n.acabado, a.acabado) as acabado,
    coalesce(n.cep, a.cep) as cep,
    coalesce(n.caja, a.caja) as caja,
    a.posicion as posicion_actual,
    n.posicion as posicion_nueva,
    a.horno as horno_actual,
    n.horno as horno_nuevo,
    coalesce(n.apariciones, 0) > 1 as repetida
  from nuevo n
  full outer join actual a on a.numero_orden = n.numero_orden
  order by
    coalesce(n.horno, a.horno),
    coalesce(n.posicion, a.posicion);
end;
$$;


ALTER FUNCTION "public"."diff_programacion"("p_fecha" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editar_nota"("p_id" "uuid", "p_texto" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_texto text := trim(coalesce(p_texto, ''));
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if length(v_texto) < 1 or length(v_texto) > 500 then
    raise exception 'La nota debe tener entre 1 y 500 caracteres';
  end if;

  update programacion_nota set texto = v_texto where id = p_id;
  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    raise exception 'La nota no existe';
  end if;
end;
$$;


ALTER FUNCTION "public"."editar_nota"("p_id" "uuid", "p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."existe_csv_programacion"("p_fecha" "date") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return exists (
    select 1 from admin_notas
    where tipo = 'programacion' and fecha = p_fecha
  );
end;
$$;


ALTER FUNCTION "public"."existe_csv_programacion"("p_fecha" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."existe_csv_programacion"("p_fecha" "date") IS 'Indica si ya hay un CSV de programación pegado para esa fecha. security definer (admin_notas es RLS-only-administrador) — la usa la pantalla Revisar del jefe para decidir si mostrar el textarea de pegar o el diff directamente.';



CREATE OR REPLACE FUNCTION "public"."fn_almacen_pedido_linea_recibida"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.recibido and not old.recibido then
    if new.fecha_recepcion is null then
      new.fecha_recepcion := now();
    end if;
    insert into almacen_movimiento (repuesto_id, tipo, cantidad, fecha, pedido_linea_id)
    values (new.repuesto_id, 'entrada', new.cantidad_pedida, new.fecha_recepcion, new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_almacen_pedido_linea_recibida"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_bloquear_ascenso_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.rol = 'administrador' and old.rol is distinct from 'administrador' then
    raise exception 'No se puede asignar el rol administrador desde la aplicación.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_bloquear_ascenso_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_bloquear_turno_en_cierre"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if fn_fabrica_cerrada(new.fecha) then
    raise exception 'No se puede abrir turno: fábrica cerrada (periodo de vacaciones) en %', new.fecha;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_bloquear_turno_en_cierre"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_buscar_marca_similar"("p_nombre_normalizado" "text") RETURNS TABLE("id" "uuid", "nombre" "text", "similitud" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select id, nombre, similarity(nombre_normalizado, p_nombre_normalizado) as similitud
  from marca
  order by similitud desc
  limit 5;
$$;


ALTER FUNCTION "public"."fn_buscar_marca_similar"("p_nombre_normalizado" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_buscar_modelo_similar"("p_nombre_normalizado" "text") RETURNS TABLE("id" "uuid", "nombre" "text", "similitud" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select id, nombre, similarity(nombre_normalizado, p_nombre_normalizado) as similitud
  from modelo
  order by similitud desc
  limit 5;
$$;


ALTER FUNCTION "public"."fn_buscar_modelo_similar"("p_nombre_normalizado" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_buscar_modelo_similar"("p_nombre_normalizado" "text") IS 'Devuelve hasta 5 candidatos ordenados por similitud (pg_trgm) contra modelo.nombre_normalizado. La Edge Function resolver-catalogo decide el umbral de corte (05-modelo-de-datos.md 7.4: "coincidencia clara → se enlaza; sin coincidencia clara → se crea, nunca bloquea").';



CREATE OR REPLACE FUNCTION "public"."fn_calcular_calibre_com_pct"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.piezas_entradas is not null and new.piezas_entradas > 0 then
    new.calibre_com_pct := (new.piezas_descuadre_com::numeric / new.piezas_entradas) * 100;
  else
    new.calibre_com_pct := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_calcular_calibre_com_pct"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cerrar_ciclos_pendientes"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cycle_id integer;
  v_ciclo_actual integer := fn_ciclo_id(now()::date);
begin
  for v_cycle_id in
    select distinct cycle_id from v_puntos_operario_ciclo where cycle_id < v_ciclo_actual
    union
    select distinct cycle_id from v_puntos_responsable_ciclo where cycle_id < v_ciclo_actual
  loop
    -- ---- OPERARIOS (+ partes_completados) ----
    insert into historial_ciclos (
      usuario_id, rol, cycle_id, fecha_cierre, puntos_ciclo, m2_total, piezas_total,
      tiempo_plena, tiempo_no_alimentada, tiempo_saturacion, tiempo_banco, tiempo_maquina,
      piezas_por_formato, m2_contenedor, m2_com, m2_std,
      partes_completados,
      fuerza, resistencia, velocidad,
      puntos_piezas, puntos_rendimiento, puntos_limpieza
    )
    select
      coalesce(prod.operario_id, pts.operario_id), 'operario', v_cycle_id, now(),
      coalesce(pts.puntos_ciclo, 0), coalesce(prod.m2_total, 0), coalesce(prod.piezas_total, 0),
      coalesce(prod.tiempo_plena, 0), coalesce(prod.tiempo_no_alimentada, 0), coalesce(prod.tiempo_saturacion, 0),
      coalesce(prod.tiempo_banco, 0), coalesce(prod.tiempo_maquina, 0),
      prod.piezas_por_formato, coalesce(prod.m2_contenedor, 0), coalesce(prod.m2_com, 0), coalesce(prod.m2_std, 0),
      coalesce(part.partes_completados, 0),
      round(coalesce(prod.m2_total, 0) / 1000.0, 2),
      round((coalesce(prod.tiempo_plena, 0) + coalesce(prod.tiempo_no_alimentada, 0)) / 100.0, 2),
      case when coalesce(prod.tiempo_plena, 0) > 0 then round(coalesce(prod.m2_total, 0) / prod.tiempo_plena, 4) else null end,
      pts.puntos_piezas, pts.puntos_rendimiento, pts.puntos_limpieza
    from v_produccion_operario_ciclo prod
    full outer join v_puntos_operario_ciclo pts
      on pts.operario_id = prod.operario_id and pts.cycle_id = prod.cycle_id
    left join v_partes_operario_ciclo part
      on part.operario_id = coalesce(prod.operario_id, pts.operario_id) and part.cycle_id = v_cycle_id
    where coalesce(prod.cycle_id, pts.cycle_id) = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      fecha_cierre = excluded.fecha_cierre, puntos_ciclo = excluded.puntos_ciclo,
      m2_total = excluded.m2_total, piezas_total = excluded.piezas_total,
      tiempo_plena = excluded.tiempo_plena, tiempo_no_alimentada = excluded.tiempo_no_alimentada,
      tiempo_saturacion = excluded.tiempo_saturacion, tiempo_banco = excluded.tiempo_banco,
      tiempo_maquina = excluded.tiempo_maquina, piezas_por_formato = excluded.piezas_por_formato,
      m2_contenedor = excluded.m2_contenedor, m2_com = excluded.m2_com, m2_std = excluded.m2_std,
      partes_completados = excluded.partes_completados,
      fuerza = excluded.fuerza, resistencia = excluded.resistencia, velocidad = excluded.velocidad,
      puntos_piezas = excluded.puntos_piezas, puntos_rendimiento = excluded.puntos_rendimiento,
      puntos_limpieza = excluded.puntos_limpieza;

    -- ---- RESPONSABLES (+ turnos_trabajados) ----
    insert into historial_ciclo_responsable (
      usuario_id, cycle_id, fecha_cierre, puntos_ciclo,
      m2_total, m2_contenedor, m2_com, m2_std,
      minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
      verificaciones_codbar, puntos_equipo_ciclo, operario_gano_ciclo,
      turnos_trabajados,
      fuerza, resistencia, velocidad
    )
    select
      pr.responsable_id, v_cycle_id, now(), coalesce(pr.puntos_ciclo, 0),
      coalesce(m.m2_total, 0), coalesce(m.m2_contenedor, 0), coalesce(m.m2_com, 0), coalesce(m.m2_std, 0),
      coalesce(tr.tiempo_plena, 0), coalesce(tr.minutos_no_alimentada, 0), coalesce(tr.minutos_saturacion, 0),
      coalesce(tr.minutos_banco, 0), coalesce(tr.minutos_maquina, 0),
      coalesce(vc.verificaciones_codbar, 0), coalesce(eq.puntos_equipo, 0), coalesce(eq.operario_gano_ciclo, false),
      coalesce(tu.turnos_trabajados, 0),
      round(coalesce(m.m2_total, 0) / 1000.0, 2),
      round(coalesce(tr.minutos_rendimiento, 0) / 100.0, 2),
      case when coalesce(tr.tiempo_plena, 0) > 0 then round(coalesce(m.m2_total, 0) / tr.tiempo_plena, 4) else null end
    from v_puntos_responsable_ciclo pr
    left join v_metros_responsable_ciclo m on m.responsable_id = pr.responsable_id and m.cycle_id = pr.cycle_id
    left join v_tiempo_responsable_ciclo tr on tr.responsable_id = pr.responsable_id and tr.cycle_id = pr.cycle_id
    left join v_verificaciones_codbar_responsable_ciclo vc on vc.responsable_id = pr.responsable_id and vc.cycle_id = pr.cycle_id
    left join v_puntos_equipo_responsable_ciclo eq on eq.responsable_id = pr.responsable_id and eq.cycle_id = pr.cycle_id
    left join v_turnos_responsable_ciclo tu on tu.responsable_id = pr.responsable_id and tu.cycle_id = pr.cycle_id
    where pr.cycle_id = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      fecha_cierre = excluded.fecha_cierre, puntos_ciclo = excluded.puntos_ciclo,
      m2_total = excluded.m2_total, m2_contenedor = excluded.m2_contenedor,
      m2_com = excluded.m2_com, m2_std = excluded.m2_std,
      minutos_plena = excluded.minutos_plena, minutos_no_alimentada = excluded.minutos_no_alimentada,
      minutos_saturacion = excluded.minutos_saturacion, minutos_banco = excluded.minutos_banco,
      minutos_maquina = excluded.minutos_maquina, verificaciones_codbar = excluded.verificaciones_codbar,
      puntos_equipo_ciclo = excluded.puntos_equipo_ciclo, operario_gano_ciclo = excluded.operario_gano_ciclo,
      turnos_trabajados = excluded.turnos_trabajados,
      fuerza = excluded.fuerza, resistencia = excluded.resistencia, velocidad = excluded.velocidad;

    raise notice 'Ciclo % cerrado (operarios en historial_ciclos, responsables en historial_ciclo_responsable).', v_cycle_id;
  end loop;
end;
$$;


ALTER FUNCTION "public"."fn_cerrar_ciclos_pendientes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_cerrar_ciclos_pendientes"() IS 'Cierra en historial_ciclos todo cycle_id < ciclo actual que aún no tenga fila, incluyendo fuerza/resistencia/velocidad y el desglose puntos_piezas/puntos_rendimiento/puntos_limpieza de ESE ciclo. Idempotente (on conflict do update) — segura para el cron semanal y para "recalcular ciclo anterior" a mano.';



CREATE OR REPLACE FUNCTION "public"."fn_cerrar_lote_si_completo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_objetivo  numeric;
  v_pendiente numeric;
begin
  -- Nunca debe impedir guardar un parte: cualquier fallo se degrada a aviso.
  begin
    perform 1 from lote where id = new.lote_id and estado = 'iniciado' for no key update;
    if not found then
      return new;
    end if;

    select objetivo_m2, m2_pendiente into v_objetivo, v_pendiente
    from v_lote_pendiente where lote_id = new.lote_id;

    if v_objetivo is null or v_objetivo not between 100 and 50000
       or v_pendiente is distinct from 0 then
      return new;
    end if;

    if exists (select 1 from parte where lote_id = new.lote_id and vigente and not completado) then
      return new;
    end if;

    update lote set estado = 'finalizado' where id = new.lote_id and estado = 'iniciado';
  exception when others then
    raise warning 'fn_cerrar_lote_si_completo: lote % sin evaluar: % (%)', new.lote_id, sqlerrm, sqlstate;
  end;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_cerrar_lote_si_completo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_chat_acceso"("p_tipo_chat" "text", "p_permiso" "text" DEFAULT 'ver'::"text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select case p_permiso
        when 'escribir' then puede_escribir
        else puede_ver
      end
      from chat_acceso
      where tipo_chat = p_tipo_chat and rol = fn_rol_actual()
    ),
    false
  );
$$;


ALTER FUNCTION "public"."fn_chat_acceso"("p_tipo_chat" "text", "p_permiso" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_chat_acceso"("p_tipo_chat" "text", "p_permiso" "text") IS 'Consulta chat_acceso para el rol actual. p_permiso: ''ver'' (por defecto) o ''escribir''. Ausencia de fila = false (deny-by-default). Usada por las políticas RLS de notificaciones y chat_mensajes, y por la Edge Function de Ceria.';



CREATE OR REPLACE FUNCTION "public"."fn_ciclo_id"("p_fecha" "date") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select floor(
    (p_fecha - (select valor::date from configuracion where clave = 'fecha_inicio_rotacion'))
    / 28.0
  )::int;
$$;


ALTER FUNCTION "public"."fn_ciclo_id"("p_fecha" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ciclo_rango"("p_cycle_id" integer) RETURNS "public"."tabla_rango"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    (select valor::date from configuracion where clave = 'fecha_inicio_rotacion') + (p_cycle_id * 28) as fecha_inicio,
    (select valor::date from configuracion where clave = 'fecha_inicio_rotacion') + (p_cycle_id * 28) + 27 as fecha_fin;
$$;


ALTER FUNCTION "public"."fn_ciclo_rango"("p_cycle_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_consumir_generacion"("p_usuario_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_filas_afectadas int;
begin
  update usuario
  set generaciones_disponibles = generaciones_disponibles - 1
  where id = p_usuario_id and generaciones_disponibles > 0;

  get diagnostics v_filas_afectadas = row_count;
  return v_filas_afectadas > 0;
end;
$$;


ALTER FUNCTION "public"."fn_consumir_generacion"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_consumir_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_filas_afectadas int;
begin
  update personaje_stats_nivel
  set generaciones_usadas = generaciones_usadas + 1
  where usuario_id = p_usuario_id
    and nivel_id = p_nivel_id
    and generaciones_usadas < 3;

  get diagnostics v_filas_afectadas = row_count;
  return v_filas_afectadas > 0;
end;
$$;


ALTER FUNCTION "public"."fn_consumir_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_consumir_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") IS 'Consume 1 generación del nivel p_nivel_id para p_usuario_id. Solo ejecutable por service_role (revocado a authenticated/anon) — se llama desde generar-personaje, que ya validó el JWT por su cuenta en el paso 1. No usa auth.uid(): con service_role siempre sería null.';



CREATE OR REPLACE FUNCTION "public"."fn_devolver_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update personaje_stats_nivel
  set generaciones_usadas = greatest(0, generaciones_usadas - 1)
  where usuario_id = p_usuario_id
    and nivel_id = p_nivel_id;
end;
$$;


ALTER FUNCTION "public"."fn_devolver_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_devolver_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") IS 'Devuelve 1 generación del nivel p_nivel_id a p_usuario_id — mismo criterio que fn_consumir_generacion_nivel, ver su comentario.';



CREATE OR REPLACE FUNCTION "public"."fn_disparar_informe_periodo"("p_tipo" "text", "p_desde" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_secret text;
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/generar-informe-periodo';
begin
  if p_tipo not in ('diario', 'semanal') then
    raise exception 'tipo de informe no válido: %', p_tipo;
  end if;

  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('tipo', p_tipo, 'desde', p_desde, 'enviar', true),
    -- Generar el PDF (sobre todo el semanal) puede tardar más que los
    -- 5 s por defecto de pg_net.
    timeout_milliseconds := 120000
  );
end;
$$;


ALTER FUNCTION "public"."fn_disparar_informe_periodo"("p_tipo" "text", "p_desde" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_disparar_resumen_calidad"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_secret text;
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram-resumen-calidad';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."fn_disparar_resumen_calidad"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_disparar_resumen_turno"("p_turno_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_secret text;
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/generar-resumen-turno';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('turno_id', p_turno_id)
  );
end;
$$;


ALTER FUNCTION "public"."fn_disparar_resumen_turno"("p_turno_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_encolar_informes_periodo_pendientes"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  r      record;
  v_hoy  date := (now() at time zone 'Europe/Madrid')::date;
begin
  -- Diarios pendientes
  for r in
    select distinct t.fecha
    from turno t
    where (((t.fecha + 1) + time '06:00') at time zone 'Europe/Madrid') + interval '75 minutes' < now()
      and (((t.fecha + 1) + time '06:00') at time zone 'Europe/Madrid') > now() - interval '30 hours'
      and not exists (
        select 1 from informe_periodo i
        where i.tipo = 'diario' and i.desde = t.fecha and i.enviado_at is not null
      )
    order by t.fecha
  loop
    perform fn_disparar_informe_periodo('diario', r.fecha);
  end loop;

  -- Semanales pendientes (domingo S -> semana S-6 … S)
  for r in
    select (v_hoy - g) as domingo
    from generate_series(0, 7) g
    where extract(isodow from (v_hoy - g)) = 7
      and ((((v_hoy - g) + 1) + time '06:00') at time zone 'Europe/Madrid') + interval '75 minutes' < now()
      and ((((v_hoy - g) + 1) + time '06:00') at time zone 'Europe/Madrid') > now() - interval '4 days'
      and exists (
        select 1 from turno t where t.fecha between (v_hoy - g) - 6 and (v_hoy - g)
      )
      and not exists (
        select 1 from informe_periodo i
        where i.tipo = 'semanal' and i.desde = (v_hoy - g) - 6 and i.enviado_at is not null
      )
    order by 1
  loop
    perform fn_disparar_informe_periodo('semanal', r.domingo - 6);
  end loop;
end;
$$;


ALTER FUNCTION "public"."fn_encolar_informes_periodo_pendientes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_encolar_informes_periodo_pendientes"() IS 'Red de seguridad de los informes diario/semanal: reintenta, como mensaje suelto, los que no se enviaron dentro del resumen de turno (periodo terminado hace >75 min y <30 h el diario / <4 días el semanal). Ver 19-informes-periodo.md.';



CREATE OR REPLACE FUNCTION "public"."fn_encolar_resumenes_turno_pendientes"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_turnos_cerrados uuid[];
begin
  -- 1) Detectar y marcar cierres automáticos, guardando qué turnos
  -- se acaban de cerrar en este pase.
  with cerrados as (
    update turno
    set cerrado_at = now(),
        como_cerro = 'automatico'
    where cerrado_at is null
      and (
        (
          case tipo
            when 'M' then (fecha + time '14:00')
            when 'T' then (fecha + time '22:00')
            when 'N' then ((fecha + 1) + time '06:00')
          end
        ) at time zone 'Europe/Madrid'
      ) + interval '1 hour' < now()
    returning id
  )
  select array_agg(id) into v_turnos_cerrados from cerrados;

  -- 1b) Cerrar sin producción cualquier parte que quedó a medias en
  -- esos turnos.
  if v_turnos_cerrados is not null then
    update parte
    set completado = true,
        completado_at = now()
    where turno_id = any(v_turnos_cerrados)
      and completado = false
      and vigente = true;
  end if;

  -- 2) Reintento de envíos que quedaron sin confirmar.
  for r in
    select id from turno
    where cerrado_at is not null
      and resumen_enviado_at is null
      and cerrado_at < now() - interval '5 minutes'
  loop
    perform fn_disparar_resumen_turno(r.id);
  end loop;
end;
$$;


ALTER FUNCTION "public"."fn_encolar_resumenes_turno_pendientes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_fabrica_cerrada"("p_fecha" "date") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from cierre_fabrica
    where p_fecha between fecha_inicio and fecha_fin
  );
$$;


ALTER FUNCTION "public"."fn_fabrica_cerrada"("p_fecha" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."personaje_rpg" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "nivel_en_generacion" "uuid" NOT NULL,
    "imagen_url" "text" NOT NULL,
    "historia" "text",
    "seleccionada" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."personaje_rpg" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_guardar_personaje_generado"("p_usuario_id" "uuid", "p_nivel_id" "uuid", "p_imagen_url" "text", "p_historia" "text") RETURNS "public"."personaje_rpg"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_fila personaje_rpg;
begin
  update personaje_rpg
  set seleccionada = false
  where usuario_id = p_usuario_id and seleccionada = true;

  insert into personaje_rpg (usuario_id, nivel_en_generacion, imagen_url, historia, seleccionada)
  values (p_usuario_id, p_nivel_id, p_imagen_url, p_historia, true)
  returning * into v_fila;

  return v_fila;
end;
$$;


ALTER FUNCTION "public"."fn_guardar_personaje_generado"("p_usuario_id" "uuid", "p_nivel_id" "uuid", "p_imagen_url" "text", "p_historia" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_guardar_personaje_generado"("p_usuario_id" "uuid", "p_nivel_id" "uuid", "p_imagen_url" "text", "p_historia" "text") IS 'El nuevo personaje generado pasa a ser automáticamente el seleccionado. Solo ejecutable por service_role (revocado a authenticated/anon, 26/08/2026) — la llama generar-personaje, que ya validó el JWT por su cuenta antes de invocarla con el cliente admin. Nunca recibía comprobación de auth.uid(), así que expuesta a anon/authenticated era un hueco real: cualquiera podía insertar un personaje arbitrario para cualquier usuario_id.';



CREATE OR REPLACE FUNCTION "public"."fn_incidencia_produccion_restringir_columnas_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_permitidas   text[];
  v_no_permitida text;
begin
  if fn_rol_actual() = 'administrador' then
    return new;
  end if;

  if fn_rol_actual() = 'mecanico' then
    v_permitidas := array[
      'respuesta_texto',
      'respuesta_fotos',
      'respuesta_sin_intervencion',
      'respuesta_mecanico_id',
      'respuesta_fecha',
      'estado'  -- generated always a partir de respuesta_fecha; cambia sola, nunca se escribe a mano
    ];

    select n.key into v_no_permitida
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key <> all (v_permitidas)
    limit 1;

    if v_no_permitida is not null then
      raise exception 'El mecánico solo puede modificar los campos de respuesta (columna no permitida: %)', v_no_permitida;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_incidencia_produccion_restringir_columnas_update"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_incidencia_produccion_restringir_columnas_update"() IS 'Restringe qué columnas puede tocar cada UPDATE en incidencia_produccion, más allá de la restricción por FILA que ya da RLS (incidencia_produccion_update_mecanico). El mecánico solo puede modificar sus 5 columnas de respuesta; el administrador, sin restricción. Mismo patrón que fn_parte_restringir_columnas_update.';



CREATE OR REPLACE FUNCTION "public"."fn_letra_de_turno"("p_fecha" "date", "p_tipo" "public"."tipo_turno") RETURNS "public"."letra_turno"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_letra letra_turno;
begin
  foreach v_letra in array array['A','B','C','D']::letra_turno[] loop
    if fn_turno_de_letra(p_fecha, v_letra) = p_tipo then
      return v_letra;
    end if;
  end loop;
  return null; -- no debería pasar: siempre hay alguien en cada turno
end;
$$;


ALTER FUNCTION "public"."fn_letra_de_turno"("p_fecha" "date", "p_tipo" "public"."tipo_turno") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_marcar_corregido_no_vigente"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.corrige_a_parte_id is not null then
    update parte set vigente = false where id = new.corrige_a_parte_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_marcar_corregido_no_vigente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_metros_entero"("p_texto" "text") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select case
           when length(d) between 1 and 18 then d::numeric
           else null
         end
  from (select regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g') as d) x
$$;


ALTER FUNCTION "public"."fn_metros_entero"("p_texto" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_metros_entero"("p_texto" "text") IS 'Metros enteros desde texto: quita todo lo que no sea un dígito (5.500, 5,500 y 5500 = 5500; 5,5 = 55). Sin dígitos o más de 18 -> null. Nunca lanza excepción. Regla única de parse_programacion y validar_programacion.';



CREATE OR REPLACE FUNCTION "public"."fn_nivel_actual"("p_usuario_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rol      rol_usuario;
  v_puntos   numeric;
  v_nivel_id uuid;
begin
  select rol into v_rol from usuario where id = p_usuario_id;

  if v_rol = 'operario' then
    select puntos_totales into v_puntos
    from v_puntos_operario_total_vida where operario_id = p_usuario_id;

    select id into v_nivel_id from niveles
    where coalesce(v_puntos, 0) >= umbral_min
      and (umbral_max is null or coalesce(v_puntos, 0) <= umbral_max)
    order by orden desc
    limit 1;

  elsif v_rol = 'responsable' then
    select puntos_totales into v_puntos
    from v_puntos_responsable_total_vida where responsable_id = p_usuario_id;

    select id into v_nivel_id from niveles
    where coalesce(v_puntos, 0) >= umbral_min_responsable
      and (umbral_max_responsable is null or coalesce(v_puntos, 0) <= umbral_max_responsable)
    order by orden desc
    limit 1;

  else
    raise exception 'El rol % no tiene niveles de gamificación (solo operario/responsable)', v_rol;
  end if;

  return v_nivel_id;
end;
$$;


ALTER FUNCTION "public"."fn_nivel_actual"("p_usuario_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_nivel_actual"("p_usuario_id" "uuid") IS 'Nivel actual (id de niveles) de un operario o responsable, según sus puntos totales de vida y el umbral de su rol. Usada por la Edge Function generar-personaje para saber qué prompt_imagen tocaba en el momento de generar.';



CREATE OR REPLACE FUNCTION "public"."fn_normalizar_texto"("p_texto" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select trim(
    regexp_replace(
      regexp_replace(upper(p_texto), '[^A-ZÑÁÉÍÓÚÜ0-9\s\-/.&]', ' ', 'g'),
      '\s+', ' ', 'g'
    )
  );
$$;


ALTER FUNCTION "public"."fn_normalizar_texto"("p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notificar_telegram"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_secret text;
  v_tipo   text;
  v_url    text := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/notificar-telegram';
begin
  select value into v_secret from app_secrets where key = 'telegram_webhook_secret';

  if tg_table_name = 'incidencia_calidad' then
    v_tipo := 'incidencia_calidad';
  elsif tg_table_name = 'incidencia_produccion' then
    v_tipo := 'incidencia_produccion';
  elsif tg_table_name = 'parte' then
    v_tipo := 'nuevo_lote';
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('tipo', v_tipo, 'id', new.id)
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_notificar_telegram"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_otorgar_bonus_nivel"("p_usuario_id" "uuid") RETURNS TABLE("otorgado" boolean, "nivel_id" "uuid", "nivel_nombre" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
declare
  v_rol         rol_usuario;
  v_nivel_id    uuid;
  v_nivel_nombre text;
  v_fuerza      numeric;
  v_resistencia numeric;
  v_velocidad   numeric;
  v_vida        numeric;
  v_insertadas  int;
begin
  if coalesce(fn_rol_actual()::text, '') <> 'administrador' then
    raise exception 'Solo un administrador puede otorgar el bonus de nivel';
  end if;

  select rol into v_rol from usuario where id = p_usuario_id;
  if v_rol not in ('operario', 'responsable') then
    raise exception 'El rol % no tiene gamificación (solo operario/responsable)', v_rol;
  end if;

  v_nivel_id := fn_nivel_actual(p_usuario_id);
  select nombre into v_nivel_nombre from niveles where id = v_nivel_id;

  select fuerza, resistencia, velocidad
    into v_fuerza, v_resistencia, v_velocidad
  from v_stats_vida
  where usuario_id = p_usuario_id and rol = v_rol::text;

  if v_rol = 'operario' then
    select puntos_totales into v_vida
    from v_puntos_operario_total_vida where operario_id = p_usuario_id;
  else
    select puntos_totales into v_vida
    from v_puntos_responsable_total_vida where responsable_id = p_usuario_id;
  end if;

  insert into personaje_stats_nivel (usuario_id, nivel_id, fuerza, resistencia, velocidad, vida)
  values (
    p_usuario_id, v_nivel_id,
    coalesce(v_fuerza, 0), coalesce(v_resistencia, 0), coalesce(v_velocidad, 0), coalesce(v_vida, 0)
  )
  on conflict (usuario_id, nivel_id) do nothing;

  get diagnostics v_insertadas = row_count;

  return query select (v_insertadas > 0), v_nivel_id, v_nivel_nombre;
end;
$$;


ALTER FUNCTION "public"."fn_otorgar_bonus_nivel"("p_usuario_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_otorgar_bonus_nivel"("p_usuario_id" "uuid") IS 'Botón "otorgar generaciones" de la vista de usuarios del admin. Guarda el snapshot de stats del nivel actual (fuerza/resistencia/velocidad/vida, las 4 con coalesce a 0). Sin llamada a fn_otorgar_generaciones_por_nivel (contador plano muerto, ver 20260823150000) — las 3 generaciones ya están implícitas al crear la fila en personaje_stats_nivel. Idempotente: repetir la llamada para un nivel ya otorgado no hace nada (otorgado=false). #variable_conflict use_column (25/08/2026): evita el "nivel_id is ambiguous" entre la columna de personaje_stats_nivel y el parámetro de salida del mismo nombre. Check de administrador añadido 26/08/2026 (lint de seguridad): antes cualquier usuario autenticado, o incluso anon, podía llamarla con cualquier usuario_id y auto-otorgarse el bonus sin pasar por el admin — el botón del frontend ya solo la llama con sesión de administrador, esto añade la barrera real en el servidor.';



CREATE OR REPLACE FUNCTION "public"."fn_otorgar_generaciones_por_nivel"("p_usuario_id" "uuid", "p_cantidad" integer DEFAULT 3) RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  update usuario set generaciones_disponibles = generaciones_disponibles + p_cantidad
  where id = p_usuario_id;
$$;


ALTER FUNCTION "public"."fn_otorgar_generaciones_por_nivel"("p_usuario_id" "uuid", "p_cantidad" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_parte_reabre_lote"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  perform fn_reabrir_lote_si_finalizado(new.lote_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_parte_reabre_lote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_parte_restringir_columnas_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_rol         rol_usuario := fn_rol_actual();
  v_permitidas  text[];
  v_no_permitida text;
begin
  -- Administrador: sin restricción, ya tiene su propia política ALL.
  if v_rol = 'administrador' then
    return new;
  end if;

  -- Camino operario: solo sus 5 columnas de verificación propia.
  if old.operario_id = auth.uid() and v_rol = 'operario' then
    v_permitidas := array[
      'verificacion_caja_estado_operario',
      'fotos_caja_operario',
      'verificacion_caja_detalle_operario',
      'verificacion_codbar_estado_operario',
      'verificacion_codbar_detalle_operario'
    ];

    select n.key into v_no_permitida
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key <> all (v_permitidas)
    limit 1;

    if v_no_permitida is not null then
      raise exception 'El operario solo puede modificar sus columnas de verificación (columna no permitida: %)', v_no_permitida;
    end if;

    return new;
  end if;

  -- Camino responsable en ventana de corrección (parte ya completado):
  -- no puede tocar completado / completado_at / vigente por esta vía.
  if old.responsable_id = auth.uid() and old.completado = true then
    if new.completado is distinct from old.completado
       or new.completado_at is distinct from old.completado_at
       or new.vigente is distinct from old.vigente
    then
      raise exception 'No se puede modificar completado/completado_at/vigente en la ventana de corrección de 1h — usa una corrección (INSERT con corrige_a_parte_id)';
    end if;
    return new;
  end if;

  -- Cualquier otro camino (ej. responsable editando parte pendiente,
  -- completado = false): sin restricción adicional, es el flujo normal.
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_parte_restringir_columnas_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_parte_set_formato_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  select pr.formato_id into new.formato_id
  from lote lo
  join producto pr on pr.id = lo.producto_id
  where lo.id = new.lote_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_parte_set_formato_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_parte_validar_correccion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_original record;
begin
  -- Solo aplica a inserts que son correcciones de otro parte.
  if new.corrige_a_parte_id is null then
    return new;
  end if;

  select responsable_id, vigente, completado, completado_at
  into v_original
  from parte
  where id = new.corrige_a_parte_id;

  if not found then
    raise exception 'El parte que se intenta corregir no existe';
  end if;

  -- Siempre: el responsable no puede cambiar al corregir.
  if new.responsable_id is distinct from v_original.responsable_id then
    raise exception 'No se puede cambiar el responsable de un parte al corregirlo';
  end if;

  -- Siempre (también admin): solo se corrige el parte vigente y
  -- completado. Corregir uno ya sustituido dejaría DOS vigentes para
  -- el mismo tramo (el nuevo + la corrección que ya existía).
  if not v_original.vigente or not v_original.completado then
    raise exception 'El parte original no está vigente o no está completado';
  end if;

  -- Administrador: sin más restricciones.
  if fn_rol_actual() = 'administrador' then
    return new;
  end if;

  -- Resto: debe ser el dueño, y dentro de la ventana de 1h.
  if v_original.responsable_id is distinct from auth.uid() then
    raise exception 'Solo puedes corregir partes de los que eres responsable';
  end if;

  if v_original.completado_at is null
     or v_original.completado_at <= now() - interval '1 hour' then
    raise exception 'Ya ha pasado la ventana de 1 hora para corregir este parte';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_parte_validar_correccion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_parte_validar_correccion"() IS 'Blindaje en BD (no solo en UI) de las reglas de corrección de partes: el responsable nunca puede cambiar al corregir; solo se corrige el parte vigente y completado; un responsable normal solo puede corregir SUS PROPIOS partes dentro de la hora; el administrador, cualquiera, sin límite de tiempo. Antes esto solo lo impedía CorreccionPartesScreen/TurnoScreen en el cliente.';



CREATE OR REPLACE FUNCTION "public"."fn_reabrir_lote_si_finalizado"("p_lote_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  update lote
  set estado = 'iniciado',
      resumen_calidad_enviado_at = null
  where id = p_lote_id and estado = 'finalizado';
end;
$$;


ALTER FUNCTION "public"."fn_reabrir_lote_si_finalizado"("p_lote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_rol_actual"() RETURNS "public"."rol_usuario"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select rol from usuario where id = auth.uid();
$$;


ALTER FUNCTION "public"."fn_rol_actual"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_seleccionar_personaje"("p_personaje_id" "uuid") RETURNS "public"."personaje_rpg"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_usuario_id uuid := auth.uid();
  v_fila personaje_rpg;
begin
  if v_usuario_id is null then
    raise exception 'No hay sesión activa';
  end if;

  if not exists (
    select 1 from personaje_rpg
    where id = p_personaje_id and usuario_id = v_usuario_id
  ) then
    raise exception 'Ese personaje no existe o no pertenece a este usuario';
  end if;

  update personaje_rpg
  set seleccionada = false
  where usuario_id = v_usuario_id and seleccionada = true;

  update personaje_rpg
  set seleccionada = true
  where id = p_personaje_id
  returning * into v_fila;

  return v_fila;
end;
$$;


ALTER FUNCTION "public"."fn_seleccionar_personaje"("p_personaje_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_seleccionar_personaje"("p_personaje_id" "uuid") IS 'Elegir avatar entre los ya generados (pestaña Stats/Avatar). Usa auth.uid() para saber de quién es la sesión — NUNCA recibe el usuario_id como parámetro del cliente, porque al ser security definer se saltaría RLS y sería explotable. Atómica por el mismo motivo que fn_guardar_personaje_generado: evita el choque con uq_personaje_rpg_seleccionada si el cliente hiciera esto en dos UPDATE sueltos.';



CREATE OR REPLACE FUNCTION "public"."fn_set_nombre_normalizado_marca"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.nombre_normalizado := fn_normalizar_texto(new.nombre);
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_set_nombre_normalizado_marca"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_nombre_normalizado_modelo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.nombre_normalizado := fn_normalizar_texto(new.nombre);
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_set_nombre_normalizado_modelo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_trigger_resumen_turno_cierre"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.cerrado_at is not null and old.cerrado_at is null then
    perform fn_disparar_resumen_turno(new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_trigger_resumen_turno_cierre"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_turno_de_letra"("p_fecha" "date", "p_letra" "public"."letra_turno") RETURNS "public"."tipo_turno"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_inicio  date;
  v_offset  int;
  v_dia     int;
  v_patron  tipo_turno[] := array[
    'N','N','N','N','N','N','N',
    null,null,
    'T','T','T','T','T','T','T',
    null,null,
    'M','M','M','M','M','M','M',
    null,null,null
  ];
begin
  select valor::date into v_inicio from configuracion where clave = 'fecha_inicio_rotacion';

  v_offset := case p_letra
    when 'A' then 0 when 'B' then 7 when 'C' then 14 when 'D' then 21
  end;

  v_dia := ((p_fecha - v_inicio - v_offset) % 28 + 28) % 28;

  return v_patron[v_dia + 1];
end;
$$;


ALTER FUNCTION "public"."fn_turno_de_letra"("p_fecha" "date", "p_letra" "public"."letra_turno") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_frase"("p_id" "uuid", "p_texto" "text", "p_activa" boolean, "p_orden" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_texto text := trim(coalesce(p_texto, ''));
  v_id    uuid;
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') <> 'administrador' then
    raise exception 'No autorizado';
  end if;

  if length(v_texto) < 1 or length(v_texto) > 200 then
    raise exception 'La frase debe tener entre 1 y 200 caracteres';
  end if;

  if p_id is null then
    insert into programacion_nota_frase (texto, activa, orden)
    values (
      v_texto,
      coalesce(p_activa, true),
      coalesce(p_orden, (select coalesce(max(orden), 0) + 10 from programacion_nota_frase))
    )
    returning id into v_id;
  else
    update programacion_nota_frase
       set texto = v_texto,
           activa = coalesce(p_activa, activa),
           orden = coalesce(p_orden, orden)
     where id = p_id;
    get diagnostics v_filas = row_count;
    if v_filas = 0 then
      raise exception 'La frase no existe';
    end if;
    v_id := p_id;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe una frase con ese texto';
end;
$$;


ALTER FUNCTION "public"."guardar_frase"("p_id" "uuid", "p_texto" "text", "p_activa" boolean, "p_orden" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_muestra_excel"("p_titulo" "text", "p_contenido" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if coalesce(trim(p_titulo), '') = '' or coalesce(trim(p_contenido), '') = '' then
    raise exception 'La muestra está vacía';
  end if;

  if length(p_contenido) > 2000000 then
    raise exception 'La muestra es demasiado grande (máx. 2 MB de texto)';
  end if;

  insert into admin_notas (tipo, titulo, contenido, creado_por)
  values ('nota', 'muestra_excel: ' || trim(p_titulo), p_contenido, auth.uid());
end;
$$;


ALTER FUNCTION "public"."guardar_muestra_excel"("p_titulo" "text", "p_contenido" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_programacion_csv"("p_fecha" "date", "p_contenido" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
declare
  v_num_filas integer;
  v_existente_id uuid;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if trim(p_contenido) = '' then
    raise exception 'El CSV está vacío';
  end if;

  v_num_filas := array_length(string_to_array(trim(p_contenido), E'\n'), 1);

  select id into v_existente_id
  from admin_notas
  where tipo = 'programacion' and fecha = p_fecha;

  if v_existente_id is not null then
    update admin_notas
    set contenido = p_contenido,
        num_filas = v_num_filas,
        creado_por = auth.uid(),
        updated_at = now()
    where id = v_existente_id;
  else
    insert into admin_notas (tipo, fecha, contenido, num_filas, creado_por)
    values ('programacion', p_fecha, p_contenido, v_num_filas, auth.uid());
  end if;
end;
$$;


ALTER FUNCTION "public"."guardar_programacion_csv"("p_fecha" "date", "p_contenido" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."guardar_programacion_csv"("p_fecha" "date", "p_contenido" "text") IS 'Permite a jefe/administrador pegar el CSV diario de programación (security definer: admin_notas es RLS-only-administrador para acceso directo). Mismo comportamiento que guardarProgramacion en lib/admin-notas.ts: sobrescribe si ya existía fila para esa fecha.';



CREATE OR REPLACE FUNCTION "public"."parse_programacion"("p_fecha" "date") RETURNS TABLE("horno" smallint, "posicion" integer, "numero_orden" "text", "modelo" "text", "metros" numeric, "acabado" "text", "cep" boolean, "caja" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."parse_programacion"("p_fecha" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."parse_programacion"("p_fecha" "date") IS 'Parsea el CSV crudo de admin_notas para una fecha. security definer (admin_notas es RLS-only-administrador, pero jefe también debe poder revisar la programación) — comprobación interna fn_rol_actual() in (''jefe'',''administrador''), lanza excepción si no.';



CREATE OR REPLACE FUNCTION "public"."produccion_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date" DEFAULT NULL::"date", "p_linea_nombre" "text" DEFAULT NULL::"text") RETURNS TABLE("linea_id" "uuid", "linea_nombre" "text", "turnos_analizados" bigint, "partes_analizados" bigint, "piezas_total" bigint, "m2_total" numeric, "minutos_total" bigint, "minutos_plena" bigint, "minutos_no_alimentada" bigint, "minutos_saturacion" bigint, "minutos_banco" bigint, "minutos_maquina" bigint, "pct_rendimiento" numeric, "rendimiento_numerador" bigint, "rendimiento_denominador" bigint, "primera_fecha_en_rango" "date", "ultima_fecha_en_rango" "date")
    LANGUAGE "sql" STABLE
    AS $$
  with por_turno_linea as (
    select
      p.linea_id,
      p.turno_id,
      t.fecha,
      sum(p.minutos_total)                                as suma_reportada,
      greatest(480, sum(p.minutos_total))                 as denominador,
      sum(p.minutos_plena + p.minutos_no_alimentada)      as numerador,
      sum(p.piezas_entradas)                              as piezas,
      sum(p.piezas_entradas * f.area_m2)                  as m2,
      sum(p.minutos_plena)                                as minutos_plena,
      sum(p.minutos_no_alimentada)                        as minutos_no_alimentada,
      sum(p.minutos_saturacion)                           as minutos_saturacion,
      sum(p.minutos_banco)                                as minutos_banco,
      sum(p.minutos_maquina)                              as minutos_maquina,
      count(p.id)                                         as partes
    from parte p
    join turno t on t.id = p.turno_id
    join lote lo on lo.id = p.lote_id
    join producto pr on pr.id = lo.producto_id
    join formato f on f.id = pr.formato_id
    where p.vigente = true
      and p.completado = true
      and t.fecha >= p_fecha_desde
      and t.fecha <= coalesce(p_fecha_hasta, p_fecha_desde)
    group by p.linea_id, p.turno_id, t.fecha
  )
  select
    ptl.linea_id,
    l.nombre                                            as linea_nombre,
    count(distinct ptl.turno_id)                        as turnos_analizados,
    sum(ptl.partes)                                      as partes_analizados,
    sum(ptl.piezas)                                      as piezas_total,
    sum(ptl.m2)                                          as m2_total,
    sum(ptl.suma_reportada)                              as minutos_total,
    sum(ptl.minutos_plena)                               as minutos_plena,
    sum(ptl.minutos_no_alimentada)                       as minutos_no_alimentada,
    sum(ptl.minutos_saturacion)                          as minutos_saturacion,
    sum(ptl.minutos_banco)                               as minutos_banco,
    sum(ptl.minutos_maquina)                             as minutos_maquina,
    round(100.0 * sum(ptl.numerador) / nullif(sum(ptl.denominador), 0), 2) as pct_rendimiento,
    sum(ptl.numerador)                                   as rendimiento_numerador,
    sum(ptl.denominador)                                 as rendimiento_denominador,
    min(ptl.fecha)                                       as primera_fecha_en_rango,
    max(ptl.fecha)                                       as ultima_fecha_en_rango
  from por_turno_linea ptl
  join linea l on l.id = ptl.linea_id
  where p_linea_nombre is null or l.nombre ilike '%' || p_linea_nombre || '%'
  group by ptl.linea_id, l.nombre
  order by sum(ptl.piezas) desc nulls last;
$$;


ALTER FUNCTION "public"."produccion_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."produccion_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") IS 'Producción agregada por línea, sumando TODO el rango de fechas en una sola fila (no por turno). Para comparar dos periodos de la misma línea, llamar dos veces con rangos distintos. Eje PRODUCCIÓN — sin columnas de calidad, ver calidad_linea_por_fecha.';



CREATE OR REPLACE FUNCTION "public"."set_updated_at_programacion_nota"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_programacion_nota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_programacion_orden"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_programacion_orden"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_programacion"("p_fecha" "date") RETURNS TABLE("tipo" "text", "numero_orden" "text", "linea" integer, "horno" smallint, "posicion" integer, "modelo" "text", "metros" "text", "acabado" "text", "cep" "text", "caja" "text", "falta" "text"[], "linea_cruda" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."validar_programacion"("p_fecha" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "fecha" "date",
    "titulo" "text",
    "contenido" "text" NOT NULL,
    "num_filas" integer,
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_notas_programacion_requiere_fecha" CHECK ((("tipo" <> 'programacion'::"text") OR ("fecha" IS NOT NULL))),
    CONSTRAINT "admin_notas_tipo_check" CHECK (("tipo" = ANY (ARRAY['programacion'::"text", 'nota'::"text"])))
);


ALTER TABLE "public"."admin_notas" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_notas" IS 'Espacio de trabajo libre del administrador: CSV diario de Programación (tipo=programacion, una fila por fecha, ver índice único parcial) y notas sueltas sobre cosas de la app (tipo=nota, sin fecha obligatoria). Solo el rol administrador tiene acceso (RLS for all) — no es un dato operativo del resto de la app, por eso no se reutilizó `configuracion`.';



CREATE TABLE IF NOT EXISTS "public"."almacen_categoria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "maquina" "text" NOT NULL,
    "submaquina" "text",
    "nombre" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."almacen_categoria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."almacen_movimiento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repuesto_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "cantidad" integer NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mecanico_id" "uuid",
    "pedido_linea_id" "uuid",
    "nota" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "almacen_movimiento_cantidad_check" CHECK (("cantidad" <> 0)),
    CONSTRAINT "almacen_movimiento_tipo_check" CHECK (("tipo" = ANY (ARRAY['entrada'::"text", 'salida'::"text", 'ajuste'::"text"])))
);


ALTER TABLE "public"."almacen_movimiento" OWNER TO "postgres";


COMMENT ON TABLE "public"."almacen_movimiento" IS 'Histórico de stock, nunca se pisa un número. Desde el 27/09/2026, el mecánico solo puede leer e insertar movimientos nuevos (entrada/salida/ajuste) — ya no puede editar ni borrar un movimiento ya registrado. El administrador conserva acceso completo para corregir errores excepcionales. Antes, una única política ''for all'' daba a ambos roles el mismo permiso total.';



CREATE TABLE IF NOT EXISTS "public"."almacen_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proveedor_id" "uuid" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."almacen_pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."almacen_pedido_linea" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "repuesto_id" "uuid" NOT NULL,
    "cantidad_pedida" integer NOT NULL,
    "recibido" boolean DEFAULT false NOT NULL,
    "fecha_recepcion" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "almacen_pedido_linea_cantidad_pedida_check" CHECK (("cantidad_pedida" > 0))
);


ALTER TABLE "public"."almacen_pedido_linea" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."almacen_proveedor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "contacto" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."almacen_proveedor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."almacen_repuesto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "categoria_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "imagen_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."almacen_repuesto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."almacen_repuesto_referencia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repuesto_id" "uuid" NOT NULL,
    "proveedor_id" "uuid" NOT NULL,
    "codigo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."almacen_repuesto_referencia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_secrets" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."app_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asignacion_operario_linea" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turno_id" "uuid" NOT NULL,
    "linea_id" "uuid" NOT NULL,
    "operario_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."asignacion_operario_linea" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ceria_conversaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ceria_conversaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ceria_documentacion_maquina" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "maquina" "text" NOT NULL,
    "submaquina" "text",
    "tipo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "contenido" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ceria_documentacion_maquina_tipo_check" CHECK (("tipo" = ANY (ARRAY['proceso'::"text", 'parametro'::"text", 'sensor'::"text", 'actuador'::"text", 'pieza'::"text", 'alarma'::"text", 'mantenimiento'::"text", 'configuracion_inicial'::"text", 'diagnostico'::"text"])))
);


ALTER TABLE "public"."ceria_documentacion_maquina" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ceria_mensajes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversacion_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "contenido" "text" NOT NULL,
    "tool_usada" "text",
    "datos" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ceria_mensajes_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."ceria_mensajes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ceria_modelo_activo" (
    "modelo_id" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."ceria_modelo_activo" OWNER TO "postgres";


COMMENT ON TABLE "public"."ceria_modelo_activo" IS 'Ausencia de fila = modelo activo (opuesto a chat_acceso a propósito — aquí el catálogo ya viene fijo en código, el caso base es "todo encendido"). Solo se inserta fila cuando el admin apaga un modelo concreto. Consultada por el selector de Ceria en el frontend y por resolverModeloFase3 en la Edge Function (para que apagar un modelo también bloquee su uso vía API directa, no solo lo oculte del desplegable).';



CREATE TABLE IF NOT EXISTS "public"."ceria_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "contenido" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ceria_prompts" OWNER TO "postgres";


COMMENT ON TABLE "public"."ceria_prompts" IS 'Prompt de interpretación por herramienta de Ceria — editable sin redesplegar la Edge Function. `clave` = nombre de la tool.';



CREATE TABLE IF NOT EXISTS "public"."ceria_tool_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversacion_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "herramienta" "text" NOT NULL,
    "args" "jsonb",
    "filas" integer,
    "filas_totales" integer,
    "limitado" boolean DEFAULT false,
    "duracion_ms" integer,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ceria_tool_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."ceria_tool_logs" IS 'Una fila por herramienta ejecutada en cada pregunta a Ceria. Permite analizar uso (qué tool se llama más), rendimiento (duracion_ms) y fiabilidad (columna error) sin depender de los logs de la Edge Function en el dashboard de Supabase, que rotan y no son consultables con SQL.';



CREATE TABLE IF NOT EXISTS "public"."chat_acceso" (
    "tipo_chat" "text" NOT NULL,
    "rol" "public"."rol_usuario" NOT NULL,
    "puede_ver" boolean DEFAULT true NOT NULL,
    "puede_escribir" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."chat_acceso" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_acceso" IS 'Control de acceso por rol para los 7 "chats" (5 notificaciones + general + ceria), editable por el admin desde una rejilla en el frontend. Ausencia de fila = sin acceso (deny-by-default). puede_escribir solo se consulta para tipo_chat=''general'' — en el resto, ver y escribir son la misma cosa o no aplica.';



CREATE TABLE IF NOT EXISTS "public"."chat_mensajes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "texto" "text",
    "fotos" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eliminado" boolean DEFAULT false NOT NULL,
    "borrado_por" "uuid",
    "borrado_at" timestamp with time zone,
    CONSTRAINT "chat_mensajes_check" CHECK ((("texto" IS NOT NULL) OR ("fotos" IS NOT NULL)))
);


ALTER TABLE "public"."chat_mensajes" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_mensajes" IS 'Canal único de chat, sin reparto en salas. Alcance: responsable, suplente, operario, jefe, administrador (sesión 07/09/2026, mismo criterio que notificaciones) — calidad y jefe_rectificado fuera a propósito. Borrado suave: `eliminado=true` marca el mensaje como "eliminado" en la UI, nunca se borra la fila de verdad.';



COMMENT ON COLUMN "public"."chat_mensajes"."fotos" IS 'URLs de Cloudinary — preset unsigned nuevo (motiv_v3_chat), mismo patrón que el resto de presets del proyecto. Paso manual pendiente fuera de esta migración: crear el preset en el dashboard de Cloudinary y añadir VITE_CLOUDINARY_PRESET_CHAT al .env del frontend.';



CREATE TABLE IF NOT EXISTS "public"."checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "puntos" integer DEFAULT 1 NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cierre_fabrica" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    CONSTRAINT "cierre_fabrica_check" CHECK (("fecha_fin" >= "fecha_inicio"))
);


ALTER TABLE "public"."cierre_fabrica" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion" (
    "clave" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "nota" "text"
);


ALTER TABLE "public"."configuracion" OWNER TO "postgres";


COMMENT ON TABLE "public"."configuracion" IS 'Valores de configuración global (fecha_inicio_rotacion, objetivo_m2_dia...). RLS habilitada 24/08/2026 — hasta entonces la tabla estaba SIN RLS y era escribible por cualquier autenticado vía PostgREST (hueco detectado en auditoría, nunca explotado que se sepa). Lectura: autenticados (la necesitan fn_turno_de_letra/fn_ciclo_id, que no son security definer, y la pantalla de fábrica). Escritura: solo administrador.';



CREATE TABLE IF NOT EXISTS "public"."engrase_parte" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "linea_id" "uuid" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "mecanico_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."engrase_parte" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engrase_parte_punto" (
    "parte_id" "uuid" NOT NULL,
    "punto_id" "uuid" NOT NULL
);


ALTER TABLE "public"."engrase_parte_punto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engrase_punto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."engrase_punto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formato" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "area_m2" numeric NOT NULL,
    CONSTRAINT "formato_area_m2_positivo" CHECK (("area_m2" > (0)::numeric))
);


ALTER TABLE "public"."formato" OWNER TO "postgres";


COMMENT ON COLUMN "public"."formato"."area_m2" IS 'Superficie de una pieza en m², derivada del nombre (mm x mm). Fuente única de verdad para el cálculo de m² en SQL (vistas de Ceria, dashboard del jefe) — evita repetir la conversión piezas->m² en cada consulta. Ver también frontend/src/lib/formato.ts para el equivalente en TypeScript (informe de cierre de turno).';



CREATE TABLE IF NOT EXISTS "public"."historial_ciclo_responsable" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "cycle_id" integer NOT NULL,
    "fecha_cierre" timestamp with time zone DEFAULT "now"() NOT NULL,
    "puntos_ciclo" numeric DEFAULT 0 NOT NULL,
    "m2_total" numeric DEFAULT 0 NOT NULL,
    "m2_contenedor" numeric DEFAULT 0 NOT NULL,
    "m2_com" numeric DEFAULT 0 NOT NULL,
    "m2_std" numeric DEFAULT 0 NOT NULL,
    "minutos_plena" numeric DEFAULT 0 NOT NULL,
    "minutos_no_alimentada" numeric DEFAULT 0 NOT NULL,
    "minutos_saturacion" numeric DEFAULT 0 NOT NULL,
    "minutos_banco" numeric DEFAULT 0 NOT NULL,
    "minutos_maquina" numeric DEFAULT 0 NOT NULL,
    "fuerza" numeric,
    "resistencia" numeric,
    "velocidad" numeric,
    "verificaciones_codbar" numeric DEFAULT 0 NOT NULL,
    "puntos_equipo_ciclo" numeric DEFAULT 0 NOT NULL,
    "operario_gano_ciclo" boolean DEFAULT false NOT NULL,
    "turnos_trabajados" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."historial_ciclo_responsable" OWNER TO "postgres";


COMMENT ON TABLE "public"."historial_ciclo_responsable" IS 'Snapshot por ciclo cerrado de cada responsable — tabla propia (25/08/2026, separada de historial_ciclos) porque el responsable nunca tiene piezas/formato, solo m² y tiempos agregados de todas las líneas que supervisó en el turno. SELECT: propio, cualquier responsable (para su Ranking), jefe/admin/pantalla. Escritura solo por fn_cerrar_ciclos_pendientes (security definer) o backfill manual puntual.';



COMMENT ON COLUMN "public"."historial_ciclo_responsable"."puntos_equipo_ciclo" IS 'Suma de puntos_ciclo de los operarios con los que este responsable trabajó de verdad ese ciclo (parte.responsable_id = él, parte.operario_id = ellos) — no por letra. Base de "El Equipo A".';



COMMENT ON COLUMN "public"."historial_ciclo_responsable"."operario_gano_ciclo" IS 'true si alguno de esos operarios ganó el ranking de ESE ciclo (v_ganador_por_ciclo, posicion=1). Base de "Creador de Héroes".';



CREATE TABLE IF NOT EXISTS "public"."historial_ciclos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "rol" "text" NOT NULL,
    "cycle_id" integer NOT NULL,
    "fecha_cierre" timestamp with time zone DEFAULT "now"() NOT NULL,
    "puntos_ciclo" integer DEFAULT 0 NOT NULL,
    "fuerza" numeric,
    "resistencia" numeric,
    "velocidad" numeric,
    "m2_total" numeric,
    "piezas_total" integer,
    "tiempo_plena" numeric,
    "tiempo_no_alimentada" numeric,
    "tiempo_saturacion" numeric,
    "tiempo_banco" numeric,
    "tiempo_maquina" numeric,
    "piezas_por_formato" "jsonb",
    "m2_contenedor" numeric DEFAULT 0,
    "m2_com" numeric DEFAULT 0,
    "m2_std" numeric DEFAULT 0,
    "puntos_piezas" integer DEFAULT 0,
    "puntos_rendimiento" integer DEFAULT 0,
    "puntos_limpieza" integer DEFAULT 0,
    "partes_completados" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "historial_ciclos_rol_check" CHECK (("rol" = ANY (ARRAY['operario'::"text", 'responsable'::"text"])))
);


ALTER TABLE "public"."historial_ciclos" OWNER TO "postgres";


COMMENT ON TABLE "public"."historial_ciclos" IS 'Totales de por vida NO son una tabla: SUM(historial_ciclos.*) + ciclo actual en vivo (vista sobre operario_ledger, acotada a ≤28 días). Ver 07-arquitectura.md 9.3 para la lección de v2 que esto evita.';



COMMENT ON COLUMN "public"."historial_ciclos"."m2_contenedor" IS 'm² de piezas_contenedor del ciclo, para el logro de tramo "Montaña de escombros". Rellenado por cerrar-ciclo.';



COMMENT ON COLUMN "public"."historial_ciclos"."m2_com" IS 'm² de piezas_comercial del ciclo, para el logro de tramo "Demasiado material pulido". Rellenado por cerrar-ciclo.';



COMMENT ON COLUMN "public"."historial_ciclos"."m2_std" IS 'm² de piezas_1a (estándar) del ciclo, para el logro de tramo "De primerísima calidad". Rellenado por cerrar-ciclo.';



COMMENT ON COLUMN "public"."historial_ciclos"."puntos_piezas" IS 'Puntos de piezas de ESE ciclo (no acumulado) — desglose de puntos_ciclo, para poder sumar "puntos piezas totales de por vida" en la tarjeta de Inicio sin recalcular desde parte.';



COMMENT ON COLUMN "public"."historial_ciclos"."puntos_rendimiento" IS 'Puntos de rendimiento de ESE ciclo — mismo motivo que puntos_piezas.';



COMMENT ON COLUMN "public"."historial_ciclos"."puntos_limpieza" IS 'Puntos de limpieza de ESE ciclo — mismo motivo que puntos_piezas.';



CREATE TABLE IF NOT EXISTS "public"."incidencia_calidad" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parte_id" "uuid" NOT NULL,
    "descripcion" "text" NOT NULL,
    "fotos" "text"[],
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."incidencia_calidad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidencia_produccion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turno_id" "uuid" NOT NULL,
    "linea_id" "uuid",
    "descripcion" "text" NOT NULL,
    "fotos" "text"[],
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "respuesta_texto" "text",
    "respuesta_fotos" "text"[],
    "respuesta_sin_intervencion" boolean DEFAULT false NOT NULL,
    "respuesta_mecanico_id" "uuid",
    "respuesta_fecha" timestamp with time zone,
    "estado" "text" GENERATED ALWAYS AS (
CASE
    WHEN ("respuesta_fecha" IS NULL) THEN 'pendiente'::"text"
    ELSE 'contestada'::"text"
END) STORED
);


ALTER TABLE "public"."incidencia_produccion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."informe_periodo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "desde" "date" NOT NULL,
    "hasta" "date" NOT NULL,
    "pdf_url" "text",
    "resumen" "jsonb",
    "generado_at" timestamp with time zone,
    "enviado_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "informe_periodo_rango" CHECK (("hasta" >= "desde")),
    CONSTRAINT "informe_periodo_tipo_check" CHECK (("tipo" = ANY (ARRAY['diario'::"text", 'semanal'::"text"])))
);


ALTER TABLE "public"."informe_periodo" OWNER TO "postgres";


COMMENT ON TABLE "public"."informe_periodo" IS 'Un informe PDF por periodo (diario o semanal) generado por la Edge Function generar-informe-periodo. desde/hasta son fechas de turno (el turno N de la fecha D acaba a las 06:00 de D+1). Único por (tipo, desde). Escritura: solo service_role (la Edge Function). Lectura: jefe, produccion (22/09/2026) y administrador (política informe_periodo_select_jefe_admin).';



COMMENT ON COLUMN "public"."informe_periodo"."pdf_url" IS 'URL pública (Cloudinary) del PDF. NULL solo si la fila existe pero la generación falló a medias.';



COMMENT ON COLUMN "public"."informe_periodo"."resumen" IS 'Totales compactos (m² por calidad, turnos registrados/esperados, faltantes, nº de lotes e incidencias) para componer el aviso sin recalcular el informe.';



COMMENT ON COLUMN "public"."informe_periodo"."enviado_at" IS 'Cuándo se envió el aviso a Telegram con el enlace al PDF. NULL = generado pero no enviado (o el envío falló).';



CREATE TABLE IF NOT EXISTS "public"."linea" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL
);


ALTER TABLE "public"."linea" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logros_definicion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "icono" "text",
    "condicion_tipo" "text" NOT NULL,
    "condicion_valor" numeric,
    "activo" boolean DEFAULT true NOT NULL,
    "rol" "text" DEFAULT 'operario'::"text" NOT NULL,
    "formato_nombre" "text"
);


ALTER TABLE "public"."logros_definicion" OWNER TO "postgres";


COMMENT ON TABLE "public"."logros_definicion" IS 'Catálogo de logros — 100% por consulta desde la sesión 22/08/2026: sin tabla de progreso asociada. condicion_tipo agrupa en la práctica en 2 familias (no 3 — "turno" ya no existe): "tramo" (sum(columna)/condicion_valor, redondeo hacia abajo, contra historial_ciclos + ciclo en vivo) y "ciclo" (count(*) de historial_ciclos que cumplen la condición, o para Rey de Reyes, comparación de puntos_ciclo agrupada por cycle_id sin condicion_valor numérico).';



CREATE TABLE IF NOT EXISTS "public"."lote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_orden" "text" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "acabado_codigo" "text",
    "acabado_tipo" "text",
    "acabado_nombre" "text",
    "espesor" "text" NOT NULL,
    "tipo_palet" "text",
    "pza_caja" integer,
    "objetivo_m2" numeric,
    "codbar_caja" "text",
    "codbar_pieza" "text",
    "cod_upec" "text",
    "codbar_saso" "text",
    "observaciones_material" "text",
    "observaciones_orden" "text",
    "texto_crudo_modelo" "text" NOT NULL,
    "texto_crudo_marca" "text" NOT NULL,
    "estado" "public"."estado_lote" DEFAULT 'iniciado'::"public"."estado_lote" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resumen_calidad_enviado_at" timestamp with time zone,
    CONSTRAINT "lote_espesor_check" CHECK ((("espesor" ~ '^\d{1,2}(\.\d)?mm$'::"text") AND ((("split_part"("espesor", 'mm'::"text", 1))::numeric >= (8)::numeric) AND (("split_part"("espesor", 'mm'::"text", 1))::numeric <= (12)::numeric))))
);


ALTER TABLE "public"."lote" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lote"."resumen_calidad_enviado_at" IS 'Cuándo salió este lote en un digest de "Resúmenes calidad" (notificar-telegram-resumen-calidad). NULL = pendiente de incluir en el próximo envío. Se limpia a NULL si el lote se reabre después de haber salido ya en un digest (ver fn_reabrir_lote_si_finalizado) para que vuelva a aparecer si se finaliza otra vez.';



CREATE TABLE IF NOT EXISTS "public"."marca" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "nombre_normalizado" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marca" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modelo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "nombre_normalizado" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."modelo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."niveles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "umbral_min" integer NOT NULL,
    "umbral_max" integer,
    "color_marco" "text" NOT NULL,
    "estrellas" integer NOT NULL,
    "efecto_aura" "text",
    "prompt_base" "text",
    "prompt_imagen" "text",
    "orden" integer NOT NULL,
    "descripcion" "text",
    "umbral_min_responsable" integer GENERATED ALWAYS AS (("round"((("umbral_min")::numeric * 1.5)))::integer) STORED,
    "umbral_max_responsable" integer GENERATED ALWAYS AS (
CASE
    WHEN ("umbral_max" IS NULL) THEN NULL::integer
    ELSE ("round"(((("umbral_max")::numeric * 1.5) + 0.5)))::integer
END) STORED
);


ALTER TABLE "public"."niveles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."niveles"."umbral_min_responsable" IS 'Umbral del operario × 1,5, redondeado. Generada — se recalcula sola si cambia umbral_min, nunca se escribe a mano.';



COMMENT ON COLUMN "public"."niveles"."umbral_max_responsable" IS 'Umbral del operario × 1,5 + 0,5 (mantiene tramos contiguos sin huecos entre niveles), redondeado. NULL en el último nivel (Leyenda), igual que umbral_max.';



CREATE TABLE IF NOT EXISTS "public"."notificacion_estado_usuario" (
    "usuario_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "ultima_leida_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notificacion_estado_usuario" OWNER TO "postgres";


COMMENT ON TABLE "public"."notificacion_estado_usuario" IS 'Timestamp de "último leído" por usuario Y POR TIPO (antes era uno solo por usuario, sesión 07/09/2026) — un canal por tipo, cada uno con su propio contador de no-leídas. Ausencia de fila para un tipo = nunca abierto ese canal = todo no-leído en él.';



CREATE TABLE IF NOT EXISTS "public"."notificacion_preferencias" (
    "usuario_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "push_activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."notificacion_preferencias" OWNER TO "postgres";


COMMENT ON TABLE "public"."notificacion_preferencias" IS 'Un interruptor por tipo y usuario. Solo gobierna si se manda push (Fase 7, futura) — nunca oculta nada del feed ni afecta al contador de no-leídas. Ausencia de fila = activado (el cliente solo inserta una fila cuando el usuario lo desactiva).';



CREATE TABLE IF NOT EXISTS "public"."notificacion_silencio" (
    "usuario_id" "uuid" NOT NULL,
    "activo" boolean DEFAULT false NOT NULL,
    "hora_inicio" time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    "hora_fin" time without time zone DEFAULT '07:00:00'::time without time zone NOT NULL
);


ALTER TABLE "public"."notificacion_silencio" OWNER TO "postgres";


COMMENT ON TABLE "public"."notificacion_silencio" IS 'Horario general de silencio (no distingue días de la semana, decisión 07/09/2026). Solo afecta al push (Fase 7, futura). Rango pensado para cruzar medianoche; ver comentario de la tabla para dónde se evalúa.';



CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "cuerpo" "text",
    "referencia_id" "uuid",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notificaciones_tipo_check" CHECK (("tipo" = ANY (ARRAY['incidencia_calidad'::"text", 'incidencia_produccion'::"text", 'nuevo_lote'::"text", 'resumen_turno'::"text", 'resumen_calidad'::"text"])))
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


COMMENT ON TABLE "public"."notificaciones" IS 'Feed global de notificaciones in-app. Alcance restringido (sesión 07/09/2026) a responsable/suplente/operario/jefe/administrador — calidad y jefe_rectificado quedan fuera a propósito, tanto de la campana (sin cablear en sus shells) como de esta política RLS, dependiendo solo de Telegram para sus avisos. El check de `tipo` se amplía con ALTER TABLE ... DROP/ADD CONSTRAINT cuando se añada el 6º tipo (mensaje_chat, fase 6). Solo se inserta desde funciones security definer (fn_notificar_telegram et al., fase 2).';



CREATE TABLE IF NOT EXISTS "public"."operario_checklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "linea_id" "uuid" NOT NULL,
    "turno_id" "uuid" NOT NULL,
    "checklist_item_id" "uuid" NOT NULL,
    "operario_id" "uuid" NOT NULL,
    "fotos_antes" "text"[] NOT NULL,
    "fotos_despues" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."operario_checklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parte" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turno_id" "uuid" NOT NULL,
    "linea_id" "uuid" NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "responsable_id" "uuid" NOT NULL,
    "tono" "text" NOT NULL,
    "calibre" "text",
    "verificacion_caja_estado" "text",
    "piezas_1a" integer DEFAULT 0 NOT NULL,
    "piezas_comercial" integer DEFAULT 0 NOT NULL,
    "piezas_eco" integer DEFAULT 0 NOT NULL,
    "piezas_descuadre_com" integer DEFAULT 0 NOT NULL,
    "piezas_planar_com" integer DEFAULT 0 NOT NULL,
    "piezas_contenedor" integer DEFAULT 0 NOT NULL,
    "piezas_entradas" integer DEFAULT 0 NOT NULL,
    "cal_1" integer DEFAULT 0,
    "cal_2" integer DEFAULT 0,
    "cal_3" integer DEFAULT 0,
    "cal_4" integer DEFAULT 0,
    "cal_5" integer DEFAULT 0,
    "cal_6" integer DEFAULT 0,
    "cal_7" integer DEFAULT 0,
    "cal_8" integer DEFAULT 0,
    "minutos_total" integer DEFAULT 0 NOT NULL,
    "minutos_plena" integer DEFAULT 0 NOT NULL,
    "minutos_no_alimentada" integer DEFAULT 0 NOT NULL,
    "minutos_saturacion" integer DEFAULT 0 NOT NULL,
    "minutos_banco" integer DEFAULT 0 NOT NULL,
    "minutos_maquina" integer DEFAULT 0 NOT NULL,
    "hora_captura_pantalla" timestamp with time zone,
    "calibre_com_pct" numeric,
    "calibre_std_pct" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("calibre_com_pct" IS NULL) THEN NULL::numeric
    ELSE ((100)::numeric - "calibre_com_pct")
END) STORED,
    "vigente" boolean DEFAULT true NOT NULL,
    "corrige_a_parte_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hora_captura_pantalla_texto_crudo" "text",
    "completado" boolean DEFAULT false NOT NULL,
    "completado_at" timestamp with time zone,
    "verificacion_caja_detalle" "jsonb",
    "fotos_caja" "text"[],
    "verificacion_codbar_estado" "text",
    "verificacion_codbar_detalle" "jsonb",
    "operario_id" "uuid",
    "verificacion_caja_estado_operario" "text",
    "fotos_caja_operario" "text"[],
    "verificacion_caja_detalle_operario" "jsonb",
    "verificacion_codbar_estado_operario" "text",
    "verificacion_codbar_detalle_operario" "jsonb",
    "formato_id" "uuid",
    CONSTRAINT "parte_verificacion_caja_estado_operario_check" CHECK (("verificacion_caja_estado_operario" = ANY (ARRAY['correcto'::"text", 'incorrecto'::"text", 'no_verificable'::"text"]))),
    CONSTRAINT "parte_verificacion_codbar_estado_check" CHECK (("verificacion_codbar_estado" = ANY (ARRAY['completo'::"text", 'parcial'::"text", 'manual'::"text", 'no_realizada'::"text"]))),
    CONSTRAINT "parte_verificacion_codbar_estado_operario_check" CHECK (("verificacion_codbar_estado_operario" = ANY (ARRAY['completo'::"text", 'parcial'::"text", 'no_realizada'::"text"])))
);


ALTER TABLE "public"."parte" OWNER TO "postgres";


COMMENT ON COLUMN "public"."parte"."hora_captura_pantalla_texto_crudo" IS 'Texto crudo del OCR para la hora de pantalla (Foto 3), tal cual lo leyó Claude, antes de cualquier intento de parseo a timestamptz. Útil para auditar por qué falló el parseo automático cuando hora_captura_pantalla queda en null. Ver 01-rol-responsable.md 3.2.';



COMMENT ON COLUMN "public"."parte"."completado" IS 'true una vez capturada la Foto 3 (piezas/tiempos reales) o cerrado explícitamente sin producción. false = pendiente, recién creado tras resolver el lote (Foto 1) con piezas/minutos a 0 provisionalmente.';



COMMENT ON COLUMN "public"."parte"."completado_at" IS 'Cuándo se cerró el parte (Foto 4 confirmada, o cierre sin producción). Base para la ventana de corrección de 1h del responsable, ver 04-rol-administrador.md 6.3.';



COMMENT ON COLUMN "public"."parte"."verificacion_codbar_estado" IS 'completo = los 4 campos con valor esperado quedaron verificados por escáner; parcial = alguno sí, alguno no; manual = botón "Confirmar a mano" (mismo criterio que verificado_manual en verificacion_caja_estado, distinto de un match real por escáner); no_realizada = el lote no tiene ningún código de barras esperado, o el responsable no llegó a intentar nada.';



COMMENT ON COLUMN "public"."parte"."verificacion_codbar_detalle" IS 'jsonb: array de los campos con valor esperado en el lote (codbar_caja/codbar_pieza/cod_upec/codbar_saso), cada uno con {campo, etiqueta, valorEsperado, verificado} — mismo propósito de auditoría futura que verificacion_caja_detalle. No guarda códigos leídos que no encajaron con ningún campo esperado, esos son solo feedback visual efímero en pantalla, no se persisten.';



COMMENT ON COLUMN "public"."parte"."operario_id" IS 'Operario asignado a esa línea+turno en el momento de crear el parte — copiado de asignacion_operario_linea al resolver el lote, no derivado por consulta. Nullable si la línea no tenía operario asignado en ese momento. Es quien puede verificar este parte en "Mi línea" (03-rol-operario.md) — a diferencia de la limpieza, aquí NO puede hacerlo cualquier operario del turno, solo este.';



COMMENT ON COLUMN "public"."parte"."verificacion_caja_estado_operario" IS 'Verificación de caja hecha por el operario asignado a la línea (operario_id), independiente de verificacion_caja_estado del responsable — capa adicional voluntaria, no sustituye ni depende de la del responsable. Sin estado "verificado_manual": el operario no tiene opción de confirmación manual, solo OCR real o sin verificar (estado null). Solo editable mientras completado = false (sin ventana de corrección posterior, a diferencia del responsable).';



COMMENT ON COLUMN "public"."parte"."fotos_caja_operario" IS 'URL(s) de la foto de verificación de caja hecha por el operario. Mismo patrón que parte.fotos_caja del responsable, pero en su propia columna para no mezclar autoría.';



COMMENT ON COLUMN "public"."parte"."verificacion_caja_detalle_operario" IS 'jsonb: array de los 4 campos (marca/modelo/tono/calibre) con estado + valores leído/esperado — mismo formato que verificacion_caja_detalle del responsable.';



COMMENT ON COLUMN "public"."parte"."verificacion_codbar_estado_operario" IS 'Verificación de códigos de barras hecha por el operario asignado a la línea, independiente de verificacion_codbar_estado del responsable. Sin estado "manual": mismo criterio que la caja, solo escaneo real o sin verificar (null).';



COMMENT ON COLUMN "public"."parte"."verificacion_codbar_detalle_operario" IS 'jsonb: mismo formato que verificacion_codbar_detalle del responsable — array de los campos con valor esperado en el lote, cada uno con {campo, etiqueta, valorEsperado, verificado}.';



COMMENT ON COLUMN "public"."parte"."formato_id" IS 'Denormalizado desde producto.formato_id (vía lote) en el momento de crear el parte — nunca se actualiza después (el formato de un parte no cambia una vez creado). Existe solo para poder indexar directamente sobre parte sin pasar por lote/producto en cada consulta de "Reyes del formato".';



CREATE TABLE IF NOT EXISTS "public"."turno" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "tipo" "public"."tipo_turno" NOT NULL,
    "abierto_por" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cerrado_at" timestamp with time zone,
    "como_cerro" "text",
    "resumen_enviado_at" timestamp with time zone,
    "informe_pdf_url" "text",
    CONSTRAINT "turno_como_cerro_check" CHECK (("como_cerro" = ANY (ARRAY['manual'::"text", 'automatico'::"text"])))
);


ALTER TABLE "public"."turno" OWNER TO "postgres";


COMMENT ON COLUMN "public"."turno"."cerrado_at" IS 'Cuándo se cerró el turno, sea manual o automático. NULL = sigue abierto/en revisión.';



COMMENT ON COLUMN "public"."turno"."como_cerro" IS '''manual'' (botón "Cerrar turno") o ''automatico'' (detectado por el cron al pasar la franja + 1h de revisión sin que nadie lo cerrara). Metadato informativo, no dispara nada por sí solo.';



COMMENT ON COLUMN "public"."turno"."resumen_enviado_at" IS 'Cuándo se envió con éxito el informe de cierre de turno a Telegram (lo marca la Edge Function generar-resumen-turno tras un envío OK). NULL = pendiente, o el intento anterior falló.';



COMMENT ON COLUMN "public"."turno"."informe_pdf_url" IS 'URL pública (Cloudinary) del PDF del informe de turno, generado por generar-resumen-turno SOLO al cerrar el turno. NULL mientras el turno sigue abierto/en revisión, o si la generación del PDF falló (no bloquea el envío del resumen a Telegram, ver comentario en la Edge Function).';



CREATE OR REPLACE VIEW "public"."operario_ledger" AS
 SELECT "p"."id" AS "parte_id",
    "p"."turno_id",
    "t"."fecha",
    "t"."tipo" AS "tipo_turno",
    "p"."linea_id",
    "p"."operario_id",
    "p"."responsable_id",
    "p"."lote_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "p"."piezas_1a",
    "p"."piezas_comercial",
    "p"."piezas_eco",
    "p"."piezas_contenedor",
    "p"."piezas_entradas",
    "p"."minutos_total",
    "p"."minutos_plena",
    "p"."minutos_no_alimentada",
    "p"."minutos_saturacion",
    "p"."minutos_banco",
    "p"."minutos_maquina",
    "p"."created_at"
   FROM ("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true));


ALTER VIEW "public"."operario_ledger" OWNER TO "postgres";


COMMENT ON VIEW "public"."operario_ledger" IS 'Vista sobre partes vigentes y COMPLETADOS. El operario sale SIEMPRE de parte.operario_id (fuente única, sesión 19/08/2026). Filtro completado=true añadido 20/08/2026 (07-pendientes.md #2).';



CREATE TABLE IF NOT EXISTS "public"."personaje_stats_nivel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "nivel_id" "uuid" NOT NULL,
    "fuerza" numeric NOT NULL,
    "resistencia" numeric NOT NULL,
    "velocidad" numeric,
    "vida" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generaciones_usadas" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "personaje_stats_nivel_generaciones_usadas_check" CHECK ((("generaciones_usadas" >= 0) AND ("generaciones_usadas" <= 3)))
);


ALTER TABLE "public"."personaje_stats_nivel" OWNER TO "postgres";


COMMENT ON TABLE "public"."personaje_stats_nivel" IS 'Snapshot de fuerza/resistencia/velocidad/vida del usuario en el momento en que el administrador otorga el bonus de generaciones de un nivel (fn_otorgar_bonus_nivel). La existencia de la fila (usuario_id, nivel_id) ES el estado "ya otorgado" — no hay columna de control aparte. velocidad puede ser NULL igual que en v_stats_vida (sin tiempo_plena todavía). Pensada para que generar-personaje lea de aquí en vez de v_stats_vida en vivo, así una carta generada tarde para un nivel ya superado sigue mostrando el pasado del operario en ese nivel, no su presente.';



COMMENT ON COLUMN "public"."personaje_stats_nivel"."generaciones_usadas" IS 'Cuántas de las 3 generaciones de ESTE nivel se han gastado ya. Sustituye a usuario.generaciones_disponibles (contador plano, solo servía para el nivel actual en vivo) — ver cabecera de esta migración.';



CREATE TABLE IF NOT EXISTS "public"."producto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modelo_id" "uuid" NOT NULL,
    "marca_id" "uuid" NOT NULL,
    "formato_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."producto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programacion_orden" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_orden" "text" NOT NULL,
    "horno" smallint NOT NULL,
    "posicion" integer NOT NULL,
    "modelo" "text",
    "metros" numeric,
    "acabado" "text",
    "cep" boolean DEFAULT false NOT NULL,
    "caja" "text",
    "tono" "text",
    "calibre" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_alta" "date",
    CONSTRAINT "programacion_orden_horno_check" CHECK ((("horno" >= 1) AND ("horno" <= 4)))
);


ALTER TABLE "public"."programacion_orden" OWNER TO "postgres";


COMMENT ON TABLE "public"."programacion_orden" IS 'Programación diaria de producción por horno (1-4). Se reemplaza día a día tras comparar el CSV nuevo contra el existente. El estado (pendiente/iniciado/finalizado) NO se guarda aquí: se calcula en vivo con LEFT JOIN contra lote por numero_orden.';



COMMENT ON COLUMN "public"."programacion_orden"."horno" IS 'Corresponde a la sección del CSV (antes llamada ESM-1..4). Los 4 hornos siempre aparecen.';



COMMENT ON COLUMN "public"."programacion_orden"."cep" IS 'Cepillado: true si el CSV traía una X en esa columna, false si estaba vacía.';



COMMENT ON COLUMN "public"."programacion_orden"."tono" IS 'Rellenado a mano por el jefe cuando el pedido es nuevo. Vacío = aún no procesado en SAP.';



COMMENT ON COLUMN "public"."programacion_orden"."calibre" IS 'Rellenado a mano por el jefe cuando el pedido es nuevo. Valores esperados a futuro: 3, 4, 44, SC.';



COMMENT ON COLUMN "public"."programacion_orden"."fecha_alta" IS 'Fecha en que la orden se insertó por primera vez. null = anterior a esta columna. confirmar_programacion solo la fija al insertar.';



CREATE OR REPLACE VIEW "public"."programacion_con_estado" AS
 SELECT "p"."id",
    "p"."horno",
    "p"."posicion",
    "p"."numero_orden",
    "p"."modelo",
    "p"."metros",
    "p"."acabado",
    "p"."cep",
    "p"."caja",
    "p"."tono",
    "p"."calibre",
    COALESCE(("l"."estado")::"text", 'pendiente'::"text") AS "estado",
    "p"."created_at",
    "p"."updated_at",
    "p"."fecha_alta"
   FROM ("public"."programacion_orden" "p"
     LEFT JOIN "public"."lote" "l" ON (("l"."numero_orden" = "p"."numero_orden")))
  WHERE ("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'responsable'::"public"."rol_usuario", 'produccion'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))
  ORDER BY "p"."horno", "p"."posicion";


ALTER VIEW "public"."programacion_con_estado" OWNER TO "postgres";


COMMENT ON VIEW "public"."programacion_con_estado" IS 'Vista de consulta (móvil/PDF): programación del día con estado calculado en vivo. pendiente = no existe lote para ese numero_orden; iniciado/finalizado = viene de lote.estado.';



CREATE TABLE IF NOT EXISTS "public"."programacion_nota" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_orden" "text" NOT NULL,
    "texto" "text" NOT NULL,
    "creado_por" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "programacion_nota_numero_orden_check" CHECK (("length"(TRIM(BOTH FROM "numero_orden")) > 0)),
    CONSTRAINT "programacion_nota_texto_check" CHECK ((("length"(TRIM(BOTH FROM "texto")) >= 1) AND ("length"(TRIM(BOTH FROM "texto")) <= 500)))
);


ALTER TABLE "public"."programacion_nota" OWNER TO "postgres";


COMMENT ON TABLE "public"."programacion_nota" IS 'Notas por orden de programación (varias por orden). Referencia por numero_orden SIN FK: sobreviven si la orden sale de programación. Solo escritura vía RPC (anadir_nota_ordenes/editar_nota/borrar_nota).';



CREATE TABLE IF NOT EXISTS "public"."programacion_nota_frase" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "texto" "text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "programacion_nota_frase_texto_check" CHECK ((("length"(TRIM(BOTH FROM "texto")) >= 1) AND ("length"(TRIM(BOTH FROM "texto")) <= 200)))
);


ALTER TABLE "public"."programacion_nota_frase" OWNER TO "postgres";


COMMENT ON TABLE "public"."programacion_nota_frase" IS 'Frases frecuentes para las notas de programación. Las edita el administrador (guardar_frase); baja lógica con activa = false.';



CREATE TABLE IF NOT EXISTS "public"."programacion_orden_historico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid"
);


ALTER TABLE "public"."programacion_orden_historico" OWNER TO "postgres";


COMMENT ON TABLE "public"."programacion_orden_historico" IS 'Foto de programacion_orden justo antes de cada confirmar_programacion. Permite deshacer_ultima_programacion() si el jefe confirma un CSV equivocado. Lectura: jefe, administrador (política original) y, desde el 27/09/2026, también responsable y producción (mismo alcance que programacion_orden en vivo) — para poder mostrar la fecha del último snapshot en la hoja de impresión (bug A5). Escritura solo vía funciones security definer.';



CREATE TABLE IF NOT EXISTS "public"."puntos_metros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "m2_min" integer NOT NULL,
    "m2_max" integer,
    "puntos" integer NOT NULL
);


ALTER TABLE "public"."puntos_metros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."puntos_piezas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "formato" "text" NOT NULL,
    "min" integer NOT NULL,
    "max" integer,
    "puntos" integer NOT NULL,
    CONSTRAINT "puntos_piezas_check" CHECK (("max" >= "min"))
);


ALTER TABLE "public"."puntos_piezas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."puntos_piezas"."max" IS 'NULL = sin límite superior (solo en el último tramo de cada formato) — mismo patrón que puntos_metros.m2_max. Cuando se construya la vista/consulta que use esta tabla, tratar NULL como "cualquier cantidad por encima de min cuenta para este tramo".';



CREATE TABLE IF NOT EXISTS "public"."puntos_rendimiento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pct_min" numeric NOT NULL,
    "pct_max" numeric NOT NULL,
    "puntos" integer NOT NULL,
    CONSTRAINT "puntos_rendimiento_check" CHECK (("pct_max" >= "pct_min"))
);


ALTER TABLE "public"."puntos_rendimiento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."puntos_rendimiento_responsable" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pct_min" numeric NOT NULL,
    "pct_max" numeric NOT NULL,
    "puntos" integer NOT NULL,
    CONSTRAINT "puntos_rendimiento_responsable_check" CHECK (("pct_max" >= "pct_min"))
);


ALTER TABLE "public"."puntos_rendimiento_responsable" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refuerzo_operario_turno" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turno_id" "uuid" NOT NULL,
    "operario_id" "uuid" NOT NULL,
    "habilitado_por" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."refuerzo_operario_turno" OWNER TO "postgres";


COMMENT ON TABLE "public"."refuerzo_operario_turno" IS 'Presencia excepcional de un operario en un turno que no es el de su letra habitual — ver comentario de cabecera de esta migración. No implica trabajo en una línea (eso sigue siendo asignacion_operario_linea); solo marca "está aquí hoy".';



CREATE TABLE IF NOT EXISTS "public"."unidad_intercambiable" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "identificador" "text" NOT NULL,
    "nombre" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unidad_intercambiable_tipo_check" CHECK (("tipo" = ANY (ARRAY['cabezal_flejado'::"text", 'calderin_cola_cera'::"text"])))
);


ALTER TABLE "public"."unidad_intercambiable" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unidad_movimiento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unidad_id" "uuid" NOT NULL,
    "tipo_evento" "text" NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linea_id" "uuid",
    "nota" "text",
    "mecanico_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unidad_movimiento_check" CHECK ((("tipo_evento" <> 'vuelve_montada'::"text") OR ("linea_id" IS NOT NULL))),
    CONSTRAINT "unidad_movimiento_tipo_evento_check" CHECK (("tipo_evento" = ANY (ARRAY['sale_a_reparar'::"text", 'vuelve_montada'::"text"])))
);


ALTER TABLE "public"."unidad_movimiento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuario" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "rol" "public"."rol_usuario" NOT NULL,
    "letra" "public"."letra_turno",
    "generaciones_disponibles" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "usuario_generaciones_disponibles_check" CHECK (("generaciones_disponibles" >= 0))
);


ALTER TABLE "public"."usuario" OWNER TO "postgres";


COMMENT ON TABLE "public"."usuario" IS 'Perfil de aplicación. `suplente` no es tabla aparte: es una fila más con rol=suplente, sin letra, un único registro ficticio (13.3, 08-pendientes.md).';



CREATE OR REPLACE VIEW "public"."v_metros_responsable_por_turno" AS
 SELECT "p"."responsable_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "p"."turno_id",
    "sum"((("p"."piezas_entradas")::numeric * "f"."area_m2")) AS "m2_total"
   FROM (((("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  WHERE ("p"."vigente" = true)
  GROUP BY "p"."responsable_id", ("public"."fn_ciclo_id"("t"."fecha")), "p"."turno_id";


ALTER VIEW "public"."v_metros_responsable_por_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_metros_responsable_por_turno" IS 'm² totales del turno (todas las líneas) agrupados por responsable. Mismo filtro (solo vigente=true) que v_rendimiento_responsable_por_turno a propósito — ver cabecera de la migración.';



CREATE OR REPLACE VIEW "public"."v_operarios_linea_turno" AS
 SELECT DISTINCT "turno_id",
    "linea_id",
    "operario_id"
   FROM "public"."parte" "p"
  WHERE (("vigente" = true) AND ("completado" = true) AND ("operario_id" IS NOT NULL));


ALTER VIEW "public"."v_operarios_linea_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_operarios_linea_turno" IS 'Operarios distintos (parte.operario_id) que tienen algún parte vigente Y COMPLETADO en cada línea+turno — normalmente uno solo; más de uno solo si el responsable reasignó la línea a mitad de turno. Usada para el reparto igualitario de puntos.';



CREATE OR REPLACE VIEW "public"."v_piezas_formato_linea_turno" AS
 SELECT "p"."turno_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "p"."linea_id",
    "f"."nombre" AS "formato",
    "sum"("p"."piezas_entradas") AS "piezas_formato"
   FROM (((("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true))
  GROUP BY "p"."turno_id", ("public"."fn_ciclo_id"("t"."fecha")), "p"."linea_id", "f"."nombre";


ALTER VIEW "public"."v_piezas_formato_linea_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_piezas_formato_linea_turno" IS 'Piezas (piezas_entradas) agregadas por línea+turno+formato, SIN distinguir operario todavía — un turno puede tener más de un formato en la misma línea si el lote cambió a mitad. Base para v_puntos_piezas_linea_turno.';



CREATE OR REPLACE VIEW "public"."v_puntos_limpieza_operario_por_turno" AS
 SELECT "oc"."operario_id",
    "oc"."turno_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "sum"("ci"."puntos") AS "puntos_limpieza_turno"
   FROM (("public"."operario_checklist" "oc"
     JOIN "public"."checklist_items" "ci" ON (("ci"."id" = "oc"."checklist_item_id")))
     JOIN "public"."turno" "t" ON (("t"."id" = "oc"."turno_id")))
  GROUP BY "oc"."operario_id", "oc"."turno_id", ("public"."fn_ciclo_id"("t"."fecha"));


ALTER VIEW "public"."v_puntos_limpieza_operario_por_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_limpieza_operario_por_turno" IS 'Puntos de limpieza del operario, sumados por turno completo (sin línea, un operario puede limpiar varias). Sección 4 del resumen: solo aparece en el historial si el total es > 0 — ese filtro lo aplica quien consuma esta vista, no la vista en sí (una fila con 0 puntos no es incorrecta, solo no se muestra).';



CREATE OR REPLACE VIEW "public"."v_puntos_limpieza_operario_ciclo" AS
 SELECT "operario_id",
    "cycle_id",
    "sum"("puntos_limpieza_turno") AS "puntos_limpieza_ciclo"
   FROM "public"."v_puntos_limpieza_operario_por_turno"
  GROUP BY "operario_id", "cycle_id";


ALTER VIEW "public"."v_puntos_limpieza_operario_ciclo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_puntos_metros_responsable_por_turno" AS
 SELECT "v"."responsable_id",
    "v"."cycle_id",
    "v"."turno_id",
    "v"."m2_total",
    "pm"."puntos" AS "puntos_metros_turno"
   FROM ("public"."v_metros_responsable_por_turno" "v"
     JOIN "public"."puntos_metros" "pm" ON ((("v"."m2_total" >= ("pm"."m2_min")::numeric) AND (("pm"."m2_max" IS NULL) OR ("v"."m2_total" <= ("pm"."m2_max")::numeric)))));


ALTER VIEW "public"."v_puntos_metros_responsable_por_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_metros_responsable_por_turno" IS 'Puntos de metros del responsable por turno completo (sección 4: Total del responsable = metros + rendimiento). Para el ciclo, sumar puntos_metros_turno agrupando por responsable_id+cycle_id — no se crea aquí la vista "_ciclo" porque nada la consume todavía (sin pantalla ni cerrar-ciclo construidos, ver sección 8).';



CREATE OR REPLACE VIEW "public"."v_puntos_metros_responsable_ciclo" AS
 SELECT "responsable_id",
    "cycle_id",
    "sum"("puntos_metros_turno") AS "puntos_metros_ciclo"
   FROM "public"."v_puntos_metros_responsable_por_turno"
  GROUP BY "responsable_id", "cycle_id";


ALTER VIEW "public"."v_puntos_metros_responsable_ciclo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_puntos_piezas_linea_turno" AS
 SELECT "v"."turno_id",
    "v"."cycle_id",
    "v"."linea_id",
    "sum"("pp"."puntos") AS "puntos_linea_turno"
   FROM ("public"."v_piezas_formato_linea_turno" "v"
     JOIN "public"."puntos_piezas" "pp" ON ((("pp"."formato" = "v"."formato") AND ("v"."piezas_formato" >= "pp"."min") AND (("pp"."max" IS NULL) OR ("v"."piezas_formato" <= "pp"."max")))))
  GROUP BY "v"."turno_id", "v"."cycle_id", "v"."linea_id";


ALTER VIEW "public"."v_puntos_piezas_linea_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_piezas_linea_turno" IS 'Puntos de piezas de la línea+turno, ya sumados entre todos los formatos que hubo (si cambió el formato a mitad de turno) — todavía sin repartir entre operarios distintos de esa línea+turno.';



CREATE OR REPLACE VIEW "public"."v_puntos_piezas_operario_por_linea_turno" AS
 SELECT "op"."operario_id",
    "plt"."cycle_id",
    "plt"."turno_id",
    "plt"."linea_id",
    (("plt"."puntos_linea_turno")::numeric / ("count"(*) OVER (PARTITION BY "plt"."turno_id", "plt"."linea_id"))::numeric) AS "puntos_operario"
   FROM ("public"."v_puntos_piezas_linea_turno" "plt"
     JOIN "public"."v_operarios_linea_turno" "op" ON ((("op"."turno_id" = "plt"."turno_id") AND ("op"."linea_id" = "plt"."linea_id"))));


ALTER VIEW "public"."v_puntos_piezas_operario_por_linea_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_piezas_operario_por_linea_turno" IS 'Puntos de piezas de cada línea+turno (ya sumados entre formatos) repartidos a partes iguales entre los operarios que tuvieron parte ahí — mismo criterio que rendimiento (sección 3 del resumen). puntos_operario es numeric, puede salir con decimales.';



CREATE OR REPLACE VIEW "public"."v_puntos_piezas_operario_ciclo" AS
 SELECT "operario_id",
    "cycle_id",
    "sum"("puntos_operario") AS "puntos_piezas_ciclo"
   FROM "public"."v_puntos_piezas_operario_por_linea_turno"
  GROUP BY "operario_id", "cycle_id";


ALTER VIEW "public"."v_puntos_piezas_operario_ciclo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_rendimiento_linea_turno" AS
 SELECT "p"."turno_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "p"."linea_id",
    "sum"("p"."minutos_total") AS "suma_reportada",
    GREATEST((480)::bigint, "sum"("p"."minutos_total")) AS "denominador",
    "sum"(("p"."minutos_plena" + "p"."minutos_no_alimentada")) AS "numerador",
    "round"(((100.0 * ("sum"(("p"."minutos_plena" + "p"."minutos_no_alimentada")))::numeric) / (GREATEST((480)::bigint, "sum"("p"."minutos_total")))::numeric), 2) AS "pct_rendimiento"
   FROM ("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true))
  GROUP BY "p"."turno_id", ("public"."fn_ciclo_id"("t"."fecha")), "p"."linea_id";


ALTER VIEW "public"."v_rendimiento_linea_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_rendimiento_linea_turno" IS 'Rendimiento agregado por línea+turno COMPLETO (partes vigentes y completados, sin distinguir operario) — base para repartir después entre los operarios que trabajaron esa línea+turno.';



CREATE OR REPLACE VIEW "public"."v_puntos_rendimiento_linea_turno" AS
 SELECT "v"."turno_id",
    "v"."cycle_id",
    "v"."linea_id",
    "pr"."puntos" AS "puntos_linea_turno"
   FROM ("public"."v_rendimiento_linea_turno" "v"
     JOIN "public"."puntos_rendimiento" "pr" ON ((("v"."pct_rendimiento" >= "pr"."pct_min") AND ("v"."pct_rendimiento" <= "pr"."pct_max"))));


ALTER VIEW "public"."v_puntos_rendimiento_linea_turno" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_puntos_rendimiento_operario_por_turno" AS
 SELECT "op"."operario_id",
    "plt"."cycle_id",
    "plt"."turno_id",
    "plt"."linea_id",
    (("plt"."puntos_linea_turno")::numeric / ("count"(*) OVER (PARTITION BY "plt"."turno_id", "plt"."linea_id"))::numeric) AS "puntos_operario"
   FROM ("public"."v_puntos_rendimiento_linea_turno" "plt"
     JOIN "public"."v_operarios_linea_turno" "op" ON ((("op"."turno_id" = "plt"."turno_id") AND ("op"."linea_id" = "plt"."linea_id"))));


ALTER VIEW "public"."v_puntos_rendimiento_operario_por_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_rendimiento_operario_por_turno" IS 'Puntos de rendimiento de cada línea+turno repartidos a partes iguales entre los operarios que tuvieron parte ahí. puntos_operario es numeric (puede salir con decimales si hay más de un operario) — se suma tal cual para el ciclo.';



CREATE OR REPLACE VIEW "public"."v_puntos_rendimiento_operario_ciclo" AS
 SELECT "operario_id",
    "cycle_id",
    "sum"("puntos_operario") AS "puntos_rendimiento_ciclo"
   FROM "public"."v_puntos_rendimiento_operario_por_turno"
  GROUP BY "operario_id", "cycle_id";


ALTER VIEW "public"."v_puntos_rendimiento_operario_ciclo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_puntos_operario_ciclo" AS
 SELECT "vp"."operario_id",
    "vp"."cycle_id",
    "vp"."puntos_ciclo",
    "u"."username",
    "vp"."puntos_piezas",
    "vp"."puntos_rendimiento",
    "vp"."puntos_limpieza"
   FROM (( SELECT "x"."operario_id",
            "x"."cycle_id",
            (("sum"("x"."pr") + "sum"("x"."pi")) + "sum"("x"."pl")) AS "puntos_ciclo",
            "sum"("x"."pi") AS "puntos_piezas",
            "sum"("x"."pr") AS "puntos_rendimiento",
            "sum"("x"."pl") AS "puntos_limpieza"
           FROM ( SELECT "v_puntos_rendimiento_operario_ciclo"."operario_id",
                    "v_puntos_rendimiento_operario_ciclo"."cycle_id",
                    "v_puntos_rendimiento_operario_ciclo"."puntos_rendimiento_ciclo" AS "pr",
                    0 AS "pi",
                    0 AS "pl"
                   FROM "public"."v_puntos_rendimiento_operario_ciclo"
                UNION ALL
                 SELECT "v_puntos_piezas_operario_ciclo"."operario_id",
                    "v_puntos_piezas_operario_ciclo"."cycle_id",
                    0,
                    "v_puntos_piezas_operario_ciclo"."puntos_piezas_ciclo",
                    0
                   FROM "public"."v_puntos_piezas_operario_ciclo"
                UNION ALL
                 SELECT "v_puntos_limpieza_operario_ciclo"."operario_id",
                    "v_puntos_limpieza_operario_ciclo"."cycle_id",
                    0,
                    0,
                    "v_puntos_limpieza_operario_ciclo"."puntos_limpieza_ciclo"
                   FROM "public"."v_puntos_limpieza_operario_ciclo") "x"
          GROUP BY "x"."operario_id", "x"."cycle_id") "vp"
     JOIN "public"."usuario" "u" ON (("u"."id" = "vp"."operario_id")));


ALTER VIEW "public"."v_puntos_operario_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_operario_ciclo" IS 'Puntos totales del operario (rendimiento+piezas+limpieza) por ciclo, con desglose por categoria y username horneado (PostgREST no resuelve embeds sobre vistas con UNION). Repone las columnas de desglose que 20260824130000 dejo fuera.';



CREATE OR REPLACE VIEW "public"."v_puntos_operario_total_vida" AS
 SELECT "id" AS "operario_id",
    ((COALESCE(( SELECT "sum"("hc"."puntos_ciclo") AS "sum"
           FROM "public"."historial_ciclos" "hc"
          WHERE (("hc"."usuario_id" = "u"."id") AND ("hc"."rol" = 'operario'::"text"))), (0)::bigint))::numeric + COALESCE(( SELECT "voc"."puntos_ciclo"
           FROM "public"."v_puntos_operario_ciclo" "voc"
          WHERE (("voc"."operario_id" = "u"."id") AND ("voc"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE)))), (0)::numeric)) AS "puntos_totales"
   FROM "public"."usuario" "u"
  WHERE ("rol" = 'operario'::"public"."rol_usuario");


ALTER VIEW "public"."v_puntos_operario_total_vida" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_operario_total_vida" IS 'Suma histórico (historial_ciclos) + ciclo actual en vivo, YA completo: rendimiento + piezas + limpieza (ampliado 22/08/2026, ver v_puntos_operario_ciclo). Es la base del nivel del operario (niveles.umbral_min/max) y del ranking.';



CREATE OR REPLACE VIEW "public"."v_rendimiento_responsable_por_turno" AS
 SELECT "p"."responsable_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "p"."turno_id",
    "sum"("p"."minutos_total") AS "suma_reportada",
    GREATEST((2880)::bigint, "sum"("p"."minutos_total")) AS "denominador",
    "sum"(("p"."minutos_plena" + "p"."minutos_no_alimentada")) AS "numerador",
    "round"(((100.0 * ("sum"(("p"."minutos_plena" + "p"."minutos_no_alimentada")))::numeric) / (GREATEST((2880)::bigint, "sum"("p"."minutos_total")))::numeric), 2) AS "pct_rendimiento"
   FROM ("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
  WHERE ("p"."vigente" = true)
  GROUP BY "p"."responsable_id", ("public"."fn_ciclo_id"("t"."fecha")), "p"."turno_id";


ALTER VIEW "public"."v_rendimiento_responsable_por_turno" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_puntos_rendimiento_responsable_ciclo" AS
 SELECT "v"."responsable_id",
    "v"."cycle_id",
    "sum"("prr"."puntos") AS "puntos_rendimiento_ciclo"
   FROM ("public"."v_rendimiento_responsable_por_turno" "v"
     JOIN "public"."puntos_rendimiento_responsable" "prr" ON ((("v"."pct_rendimiento" >= "prr"."pct_min") AND ("v"."pct_rendimiento" <= "prr"."pct_max"))))
  GROUP BY "v"."responsable_id", "v"."cycle_id";


ALTER VIEW "public"."v_puntos_rendimiento_responsable_ciclo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_puntos_responsable_ciclo" AS
 SELECT COALESCE("m"."responsable_id", "r"."responsable_id") AS "responsable_id",
    COALESCE("m"."cycle_id", "r"."cycle_id") AS "cycle_id",
    (COALESCE("m"."puntos_metros_ciclo", (0)::bigint) + COALESCE("r"."puntos_rendimiento_ciclo", (0)::bigint)) AS "puntos_ciclo"
   FROM ("public"."v_puntos_metros_responsable_ciclo" "m"
     FULL JOIN "public"."v_puntos_rendimiento_responsable_ciclo" "r" ON ((("r"."responsable_id" = "m"."responsable_id") AND ("r"."cycle_id" = "m"."cycle_id"))));


ALTER VIEW "public"."v_puntos_responsable_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_responsable_ciclo" IS 'Puntos totales del responsable (metros+rendimiento) por ciclo, para CUALQUIER cycle_id — análogo a v_puntos_operario_ciclo.';



CREATE OR REPLACE VIEW "public"."v_puntos_responsable_total_vida" AS
 SELECT "id" AS "responsable_id",
    ((COALESCE(( SELECT "sum"("hcr"."puntos_ciclo") AS "sum"
           FROM "public"."historial_ciclo_responsable" "hcr"
          WHERE ("hcr"."usuario_id" = "u"."id")), (0)::numeric) + (COALESCE(( SELECT "vp"."puntos_ciclo"
           FROM "public"."v_puntos_responsable_ciclo" "vp"
          WHERE (("vp"."responsable_id" = "u"."id") AND ("vp"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE)))), (0)::bigint))::numeric))::bigint AS "puntos_totales"
   FROM "public"."usuario" "u"
  WHERE ("rol" = 'responsable'::"public"."rol_usuario");


ALTER VIEW "public"."v_puntos_responsable_total_vida" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_responsable_total_vida" IS 'Puntos totales de vida del responsable (metros+rendimiento), histórico (historial_ciclo_responsable, desde 25/08/2026 — antes historial_ciclos) + ciclo en vivo. Análoga a v_puntos_operario_total_vida.';



CREATE OR REPLACE VIEW "public"."v_admin_usuarios_gamificacion" AS
 WITH "puntos" AS (
         SELECT "v_puntos_operario_total_vida"."operario_id" AS "usuario_id",
            'operario'::"public"."rol_usuario" AS "rol",
            "v_puntos_operario_total_vida"."puntos_totales"
           FROM "public"."v_puntos_operario_total_vida"
        UNION ALL
         SELECT "v_puntos_responsable_total_vida"."responsable_id",
            'responsable'::"public"."rol_usuario" AS "rol_usuario",
            "v_puntos_responsable_total_vida"."puntos_totales"
           FROM "public"."v_puntos_responsable_total_vida"
        )
 SELECT "p"."usuario_id",
    "p"."rol",
    "p"."puntos_totales",
    "n"."id" AS "nivel_actual_id",
    "n"."nombre" AS "nivel_actual_nombre",
    "n"."orden" AS "nivel_actual_orden",
        CASE
            WHEN ("p"."rol" = 'operario'::"public"."rol_usuario") THEN "n"."umbral_max"
            ELSE "n"."umbral_max_responsable"
        END AS "umbral_max_nivel_actual",
    "siguiente"."id" AS "siguiente_nivel_id",
    "siguiente"."nombre" AS "siguiente_nivel_nombre",
        CASE
            WHEN ("p"."rol" = 'operario'::"public"."rol_usuario") THEN "siguiente"."umbral_min"
            ELSE "siguiente"."umbral_min_responsable"
        END AS "puntos_siguiente_nivel",
        CASE
            WHEN ("siguiente"."id" IS NULL) THEN NULL::numeric
            ELSE GREATEST((0)::numeric, ((
            CASE
                WHEN ("p"."rol" = 'operario'::"public"."rol_usuario") THEN "siguiente"."umbral_min"
                ELSE "siguiente"."umbral_min_responsable"
            END)::numeric - "p"."puntos_totales"))
        END AS "puntos_para_siguiente_nivel",
    ("psn"."id" IS NOT NULL) AS "bonus_nivel_actual_otorgado"
   FROM ((("puntos" "p"
     JOIN "public"."niveles" "n" ON ((("p"."puntos_totales" >= (
        CASE
            WHEN ("p"."rol" = 'operario'::"public"."rol_usuario") THEN "n"."umbral_min"
            ELSE "n"."umbral_min_responsable"
        END)::numeric) AND ((
        CASE
            WHEN ("p"."rol" = 'operario'::"public"."rol_usuario") THEN "n"."umbral_max"
            ELSE "n"."umbral_max_responsable"
        END IS NULL) OR ("p"."puntos_totales" <= (
        CASE
            WHEN ("p"."rol" = 'operario'::"public"."rol_usuario") THEN "n"."umbral_max"
            ELSE "n"."umbral_max_responsable"
        END)::numeric)))))
     LEFT JOIN "public"."niveles" "siguiente" ON (("siguiente"."orden" = ("n"."orden" + 1))))
     LEFT JOIN "public"."personaje_stats_nivel" "psn" ON ((("psn"."usuario_id" = "p"."usuario_id") AND ("psn"."nivel_id" = "n"."id"))));


ALTER VIEW "public"."v_admin_usuarios_gamificacion" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_admin_usuarios_gamificacion" IS 'Una fila por operario/responsable: puntos totales, nivel actual, puntos que faltan para el siguiente (null si ya está en el último), y si el bonus de generaciones del nivel actual ya se otorgó (bonus_nivel_actual_otorgado) — controla directamente si el botón de la vista de usuarios del admin debe estar habilitado.';



CREATE OR REPLACE VIEW "public"."v_alimentacion_turno_linea" AS
 SELECT "t"."id" AS "turno_id",
    "t"."fecha",
    "t"."tipo" AS "tipo_turno",
    "p"."linea_id",
    "l"."nombre" AS "linea_nombre",
    "array_agg"(DISTINCT "f"."nombre" ORDER BY "f"."nombre") AS "formatos",
    "count"(DISTINCT "f"."id") AS "formatos_distintos",
    "count"("p"."id") AS "partes_analizados",
    "sum"("p"."piezas_entradas") AS "piezas_total",
    "sum"("p"."minutos_total") AS "minutos_total",
    "sum"("p"."minutos_plena") AS "minutos_plena",
    "sum"("p"."minutos_no_alimentada") AS "minutos_no_alimentada",
    "sum"("p"."minutos_saturacion") AS "minutos_saturacion",
    "sum"("p"."minutos_banco") AS "minutos_banco",
    "sum"("p"."minutos_maquina") AS "minutos_maquina",
    "round"((("sum"("p"."piezas_entradas"))::numeric / (NULLIF("sum"("p"."minutos_plena"), 0))::numeric), 2) AS "piezas_min_plena",
    "round"((("sum"("p"."piezas_entradas"))::numeric / (NULLIF("sum"("p"."minutos_total"), 0))::numeric), 2) AS "piezas_min_turno",
    "round"(((100.0 * ("sum"("p"."minutos_plena"))::numeric) / (NULLIF("sum"("p"."minutos_total"), 0))::numeric), 2) AS "pct_plena"
   FROM ((((("public"."turno" "t"
     JOIN "public"."parte" "p" ON ((("p"."turno_id" = "t"."id") AND ("p"."vigente" = true) AND ("p"."completado" = true))))
     JOIN "public"."linea" "l" ON (("l"."id" = "p"."linea_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  GROUP BY "t"."id", "t"."fecha", "t"."tipo", "p"."linea_id", "l"."nombre";


ALTER VIEW "public"."v_alimentacion_turno_linea" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_alimentacion_turno_linea" IS 'Por turno+línea: piezas, minutos y tres cocientes (piezas_min_plena, piezas_min_turno, pct_plena) con MINUTOS REALES, sin suelo de 480. formatos/formatos_distintos permiten filtrar los turnos de un solo formato. Para agregar varios turnos: SUM(piezas)/SUM(minutos), nunca promediar los cocientes. Eje de PRODUCCIÓN, sin calidad.';



CREATE OR REPLACE VIEW "public"."v_almacen_pedido_estado" AS
 SELECT "pedido_id",
        CASE
            WHEN "bool_and"("recibido") THEN 'recibido_completo'::"text"
            WHEN "bool_or"("recibido") THEN 'parcial'::"text"
            ELSE 'pendiente'::"text"
        END AS "estado"
   FROM "public"."almacen_pedido_linea"
  GROUP BY "pedido_id";


ALTER VIEW "public"."v_almacen_pedido_estado" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_almacen_stock" AS
 SELECT "r"."id" AS "repuesto_id",
    COALESCE("sum"("m"."cantidad"), (0)::bigint) AS "stock"
   FROM ("public"."almacen_repuesto" "r"
     LEFT JOIN "public"."almacen_movimiento" "m" ON (("m"."repuesto_id" = "r"."id")))
  GROUP BY "r"."id";


ALTER VIEW "public"."v_almacen_stock" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_avatar_activo_operario" AS
 SELECT "usuario_id",
    "imagen_url"
   FROM "public"."personaje_rpg"
  WHERE ("seleccionada" = true);


ALTER VIEW "public"."v_avatar_activo_operario" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_avatar_activo_operario" IS 'Avatar RPG activo (imagen_url) de cada usuario que tiene uno generado — expone SOLO lo mínimo (nunca historia ni nivel_en_generacion) para poder mostrarlo en el podio del Ranking a cualquier compañero, saltando la RLS más restrictiva de personaje_rpg (propio/jefe/admin) igual que hacen v_rey_formato_historico/actual con el username. `seleccionada = true` es como mucho una fila por usuario (índice único uq_personaje_rpg_seleccionada), así que no hace falta DISTINCT ni agregación. Consumida por lib/ranking.ts (obtenerAvataresActivos()).';



CREATE OR REPLACE VIEW "public"."v_calidad_lote" AS
 SELECT "lo"."id" AS "lote_id",
    "lo"."numero_orden",
    "lo"."estado" AS "lote_estado",
    "m"."nombre" AS "modelo_nombre",
    "ma"."nombre" AS "marca_nombre",
    "f"."nombre" AS "formato_nombre",
    "count"(DISTINCT "p"."id") AS "partes_analizados",
    "sum"("p"."piezas_entradas") AS "piezas_entradas",
    "sum"("p"."piezas_1a") AS "piezas_1a",
    "sum"("p"."piezas_comercial") AS "piezas_comercial",
    "sum"("p"."piezas_eco") AS "piezas_eco",
    "sum"("p"."piezas_contenedor") AS "piezas_contenedor",
    (("sum"("p"."piezas_1a"))::numeric * "f"."area_m2") AS "m2_1a",
    (("sum"("p"."piezas_comercial"))::numeric * "f"."area_m2") AS "m2_comercial",
    (("sum"("p"."piezas_eco"))::numeric * "f"."area_m2") AS "m2_eco",
    (("sum"("p"."piezas_contenedor"))::numeric * "f"."area_m2") AS "m2_contenedor",
    (("sum"("p"."piezas_entradas"))::numeric * "f"."area_m2") AS "m2_total",
    "round"(((100.0 * ("sum"("p"."piezas_1a"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_1a_completa",
    "round"(((100.0 * ("sum"("p"."piezas_comercial"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_comercial_completa",
    "round"(((100.0 * ("sum"("p"."piezas_eco"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_eco_completa",
    "round"(((100.0 * ("sum"("p"."piezas_contenedor"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_contenedor_completa",
    "round"(((100.0 * ("sum"("p"."piezas_1a"))::numeric) / (NULLIF(("sum"("p"."piezas_1a") + "sum"("p"."piezas_comercial")), 0))::numeric), 2) AS "pct_1a_oficial",
    "round"(((100.0 * ("sum"("p"."piezas_comercial"))::numeric) / (NULLIF(("sum"("p"."piezas_1a") + "sum"("p"."piezas_comercial")), 0))::numeric), 2) AS "pct_comercial_oficial",
    "min"("t"."fecha") AS "primera_produccion",
    "max"("t"."fecha") AS "ultima_produccion"
   FROM (((((("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."modelo" "m" ON (("m"."id" = "pr"."modelo_id")))
     JOIN "public"."marca" "ma" ON (("ma"."id" = "pr"."marca_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true))
  GROUP BY "lo"."id", "lo"."numero_orden", "lo"."estado", "m"."nombre", "ma"."nombre", "f"."nombre", "f"."area_m2";


ALTER VIEW "public"."v_calidad_lote" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_calidad_lote" IS 'Calidad agregada por lote (numero_orden). Mismas dos métricas (completa/oficial) que v_calidad_modelo, a nivel de una orden concreta en vez de todo el histórico del producto.';



CREATE OR REPLACE VIEW "public"."v_calidad_modelo" AS
 SELECT "pr"."id" AS "producto_id",
    "m"."nombre" AS "modelo_nombre",
    "ma"."nombre" AS "marca_nombre",
    "f"."nombre" AS "formato_nombre",
    "count"(DISTINCT "p"."id") AS "partes_analizados",
    "count"(DISTINCT "p"."lote_id") AS "lotes_distintos",
    "sum"("p"."piezas_entradas") AS "piezas_entradas",
    "sum"("p"."piezas_1a") AS "piezas_1a",
    "sum"("p"."piezas_comercial") AS "piezas_comercial",
    "sum"("p"."piezas_eco") AS "piezas_eco",
    "sum"("p"."piezas_contenedor") AS "piezas_contenedor",
    (("sum"("p"."piezas_1a"))::numeric * "f"."area_m2") AS "m2_1a",
    (("sum"("p"."piezas_comercial"))::numeric * "f"."area_m2") AS "m2_comercial",
    (("sum"("p"."piezas_eco"))::numeric * "f"."area_m2") AS "m2_eco",
    (("sum"("p"."piezas_contenedor"))::numeric * "f"."area_m2") AS "m2_contenedor",
    (("sum"("p"."piezas_entradas"))::numeric * "f"."area_m2") AS "m2_total",
    "round"(((100.0 * ("sum"("p"."piezas_1a"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_1a_completa",
    "round"(((100.0 * ("sum"("p"."piezas_comercial"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_comercial_completa",
    "round"(((100.0 * ("sum"("p"."piezas_eco"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_eco_completa",
    "round"(((100.0 * ("sum"("p"."piezas_contenedor"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_contenedor_completa",
    "round"(((100.0 * ("sum"("p"."piezas_1a"))::numeric) / (NULLIF(("sum"("p"."piezas_1a") + "sum"("p"."piezas_comercial")), 0))::numeric), 2) AS "pct_1a_oficial",
    "round"(((100.0 * ("sum"("p"."piezas_comercial"))::numeric) / (NULLIF(("sum"("p"."piezas_1a") + "sum"("p"."piezas_comercial")), 0))::numeric), 2) AS "pct_comercial_oficial",
    "min"("t"."fecha") AS "primera_produccion",
    "max"("t"."fecha") AS "ultima_produccion"
   FROM (((((("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."modelo" "m" ON (("m"."id" = "pr"."modelo_id")))
     JOIN "public"."marca" "ma" ON (("ma"."id" = "pr"."marca_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true))
  GROUP BY "pr"."id", "m"."nombre", "ma"."nombre", "f"."nombre", "f"."area_m2";


ALTER VIEW "public"."v_calidad_modelo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_calidad_modelo" IS 'Calidad histórica agregada por producto (modelo+marca+formato). Completa = sobre piezas_entradas; Oficial = solo 1ª+comercial entre sí (eco/contenedor excluidos). Solo partes vigentes y completados. Todo sumado en SQL — nunca sumar filas manualmente.';



CREATE OR REPLACE VIEW "public"."v_calidad_turno" AS
 SELECT "t"."id" AS "turno_id",
    "t"."fecha",
    "t"."tipo" AS "tipo_turno",
    "sum"("p"."piezas_entradas") AS "piezas_entradas",
    "sum"("p"."piezas_1a") AS "piezas_1a",
    "sum"("p"."piezas_comercial") AS "piezas_comercial",
    "sum"("p"."piezas_eco") AS "piezas_eco",
    "sum"("p"."piezas_contenedor") AS "piezas_contenedor",
    "round"(((100.0 * ("sum"("p"."piezas_1a"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_1a_completa",
    "round"(((100.0 * ("sum"("p"."piezas_comercial"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_comercial_completa",
    "round"(((100.0 * ("sum"("p"."piezas_eco"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_eco_completa",
    "round"(((100.0 * ("sum"("p"."piezas_contenedor"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_contenedor_completa",
    "round"(((100.0 * ("sum"("p"."piezas_1a"))::numeric) / (NULLIF(("sum"("p"."piezas_1a") + "sum"("p"."piezas_comercial")), 0))::numeric), 2) AS "pct_1a_oficial",
    "round"(((100.0 * ("sum"("p"."piezas_comercial"))::numeric) / (NULLIF(("sum"("p"."piezas_1a") + "sum"("p"."piezas_comercial")), 0))::numeric), 2) AS "pct_comercial_oficial",
    "sum"((("p"."piezas_entradas")::numeric * "f"."area_m2")) AS "m2_entradas",
    "sum"((("p"."piezas_1a")::numeric * "f"."area_m2")) AS "m2_1a",
    "sum"((("p"."piezas_comercial")::numeric * "f"."area_m2")) AS "m2_comercial",
    "sum"((("p"."piezas_eco")::numeric * "f"."area_m2")) AS "m2_eco",
    "sum"((("p"."piezas_contenedor")::numeric * "f"."area_m2")) AS "m2_contenedor"
   FROM (((("public"."turno" "t"
     JOIN "public"."parte" "p" ON ((("p"."turno_id" = "t"."id") AND ("p"."vigente" = true) AND ("p"."completado" = true))))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  GROUP BY "t"."id", "t"."fecha", "t"."tipo";


ALTER VIEW "public"."v_calidad_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_calidad_turno" IS 'Calidad agregada por turno+fecha, con piezas Y m² por categoría. m² calculado parte a parte (join a formato) antes de sumar, porque un turno puede tener varias líneas con productos/formatos distintos. Eje CALIDAD independiente de producción.';



CREATE OR REPLACE VIEW "public"."v_ceria_uso_herramientas" AS
 SELECT "herramienta",
    "count"(*) AS "veces_usada",
    "round"("avg"("duracion_ms")) AS "duracion_media_ms",
    "round"("avg"("filas")) AS "filas_media",
    "count"(*) FILTER (WHERE ("error" IS NOT NULL)) AS "errores",
    "max"("created_at") AS "ultimo_uso"
   FROM "public"."ceria_tool_logs"
  GROUP BY "herramienta"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."v_ceria_uso_herramientas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_ceria_uso_herramientas" IS 'Ranking de uso de herramientas de Ceria: frecuencia, duración media, filas media devueltas, y conteo de errores. Útil para decidir qué optimizar o qué herramienta ya no se usa.';



CREATE OR REPLACE VIEW "public"."v_equipo_avatar_stats" AS
 SELECT "pr"."usuario_id",
    "pr"."imagen_url",
    "n"."nombre" AS "nivel_nombre",
    "n"."color_marco",
    "n"."estrellas",
    "psn"."fuerza",
    "psn"."resistencia",
    "psn"."velocidad",
    "psn"."vida"
   FROM (("public"."personaje_rpg" "pr"
     JOIN "public"."niveles" "n" ON (("n"."id" = "pr"."nivel_en_generacion")))
     LEFT JOIN "public"."personaje_stats_nivel" "psn" ON ((("psn"."usuario_id" = "pr"."usuario_id") AND ("psn"."nivel_id" = "pr"."nivel_en_generacion"))))
  WHERE ("pr"."seleccionada" = true);


ALTER VIEW "public"."v_equipo_avatar_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_equipo_avatar_stats" IS 'Avatar activo + stats CONGELADAS del nivel de esa carta (no las stats en vivo) — para la pestaña Equipo del responsable, donde se ven varias personas a la vez y no tiene sentido pedir en vivo una por una. Sin security_invoker (owner, salta RLS de personaje_rpg), mismo patrón que v_avatar_activo_operario.';



CREATE OR REPLACE VIEW "public"."v_ganador_por_ciclo" AS
 SELECT "cycle_id",
    "usuario_id" AS "operario_id",
    "puntos_ciclo",
    "row_number"() OVER (PARTITION BY "cycle_id" ORDER BY "puntos_ciclo" DESC) AS "posicion"
   FROM ( SELECT "historial_ciclos"."cycle_id",
            "historial_ciclos"."usuario_id",
            "historial_ciclos"."puntos_ciclo"
           FROM "public"."historial_ciclos"
          WHERE ("historial_ciclos"."rol" = 'operario'::"text")
        UNION ALL
         SELECT "v_puntos_operario_ciclo"."cycle_id",
            "v_puntos_operario_ciclo"."operario_id" AS "usuario_id",
            "v_puntos_operario_ciclo"."puntos_ciclo"
           FROM "public"."v_puntos_operario_ciclo") "x";


ALTER VIEW "public"."v_ganador_por_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_ganador_por_ciclo" IS 'Ranking de CADA ciclo (cerrados en historial_ciclos + el actual en vivo vía v_puntos_operario_ciclo), con posicion=1 el ganador. Base del logro "Rey de Reyes" (cuántos ciclos ha ganado un operario).';



CREATE OR REPLACE VIEW "public"."v_ganador_por_ciclo_responsable" AS
 SELECT "cycle_id",
    "usuario_id" AS "responsable_id",
    "puntos_ciclo",
    "row_number"() OVER (PARTITION BY "cycle_id" ORDER BY "puntos_ciclo" DESC) AS "posicion"
   FROM ( SELECT "historial_ciclo_responsable"."cycle_id",
            "historial_ciclo_responsable"."usuario_id",
            "historial_ciclo_responsable"."puntos_ciclo"
           FROM "public"."historial_ciclo_responsable"
        UNION ALL
         SELECT "v_puntos_responsable_ciclo"."cycle_id",
            "v_puntos_responsable_ciclo"."responsable_id" AS "usuario_id",
            "v_puntos_responsable_ciclo"."puntos_ciclo"
           FROM "public"."v_puntos_responsable_ciclo") "x";


ALTER VIEW "public"."v_ganador_por_ciclo_responsable" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_ganador_por_ciclo_responsable" IS 'Ranking de CADA ciclo de responsable (cerrados en historial_ciclo_responsable + el actual en vivo vía v_puntos_responsable_ciclo), con posicion=1 el ganador. Base del logro "Líder indiscutible".';



CREATE OR REPLACE VIEW "public"."v_lote_pendiente" AS
 SELECT "lo"."id" AS "lote_id",
    "lo"."numero_orden",
    "lo"."estado" AS "lote_estado",
    "lo"."objetivo_m2",
    "m"."nombre" AS "modelo_nombre",
    "ma"."nombre" AS "marca_nombre",
    "f"."nombre" AS "formato_nombre",
    "f"."area_m2",
    COALESCE("prod"."piezas_producidas", (0)::bigint) AS "piezas_producidas",
    ((COALESCE("prod"."piezas_producidas", (0)::bigint))::numeric * "f"."area_m2") AS "m2_producido",
        CASE
            WHEN ("lo"."objetivo_m2" IS NULL) THEN NULL::numeric
            ELSE "round"(("lo"."objetivo_m2" / "f"."area_m2"))
        END AS "piezas_objetivo",
        CASE
            WHEN ("lo"."objetivo_m2" IS NULL) THEN NULL::numeric
            ELSE GREATEST(("lo"."objetivo_m2" - ((COALESCE("prod"."piezas_producidas", (0)::bigint))::numeric * "f"."area_m2")), (0)::numeric)
        END AS "m2_pendiente",
        CASE
            WHEN ("lo"."objetivo_m2" IS NULL) THEN NULL::numeric
            ELSE GREATEST(("round"(("lo"."objetivo_m2" / "f"."area_m2")) - (COALESCE("prod"."piezas_producidas", (0)::bigint))::numeric), (0)::numeric)
        END AS "piezas_pendiente"
   FROM ((((("public"."lote" "lo"
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."modelo" "m" ON (("m"."id" = "pr"."modelo_id")))
     JOIN "public"."marca" "ma" ON (("ma"."id" = "pr"."marca_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
     LEFT JOIN ( SELECT "parte"."lote_id",
            "sum"("parte"."piezas_entradas") AS "piezas_producidas"
           FROM "public"."parte"
          WHERE (("parte"."vigente" = true) AND ("parte"."completado" = true))
          GROUP BY "parte"."lote_id") "prod" ON (("prod"."lote_id" = "lo"."id")));


ALTER VIEW "public"."v_lote_pendiente" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_lote_pendiente" IS 'Pendiente de producir por lote: objetivo_m2 menos lo ya producido (piezas_entradas de todos los partes vigentes+completados del lote, cualquier línea/turno). NULL (no 0) sin objetivo_m2 capturado — 0 significa "ya completado", NULL significa "no hay con qué comparar". Clampado a 0 si se produjo de más. Usado por lib/lote.ts (pestaña Lotes) y lib/relevo.ts (Vista de Relevo).';



CREATE OR REPLACE VIEW "public"."v_lote_gestion" AS
 SELECT "p"."lote_id",
    "p"."numero_orden",
    "p"."lote_estado" AS "estado",
    "p"."modelo_nombre" AS "modelo",
    "p"."marca_nombre" AS "marca",
    "p"."formato_nombre" AS "formato",
    "p"."objetivo_m2",
    "p"."m2_pendiente",
    "p"."piezas_pendiente",
        CASE
            WHEN (("p"."objetivo_m2" IS NULL) OR ("p"."objetivo_m2" = (0)::numeric)) THEN NULL::numeric
            ELSE ("p"."m2_producido" / "p"."objetivo_m2")
        END AS "pct_objetivo",
    "act"."ultima_actividad",
    COALESCE("act"."tiene_parte_abierto", false) AS "tiene_parte_abierto"
   FROM ("public"."v_lote_pendiente" "p"
     LEFT JOIN ( SELECT "parte"."lote_id",
            "max"("parte"."created_at") AS "ultima_actividad",
            "bool_or"(("parte"."vigente" AND (NOT "parte"."completado"))) AS "tiene_parte_abierto"
           FROM "public"."parte"
          GROUP BY "parte"."lote_id") "act" ON (("act"."lote_id" = "p"."lote_id")));


ALTER VIEW "public"."v_lote_gestion" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_lote_gestion" IS 'Una fila por lote para la pestaña Lotes: pendiente (de v_lote_pendiente), pct_objetivo (ratio producido/objetivo), ultima_actividad (max parte.created_at) y tiene_parte_abierto (parte vigente sin completar). Solo authenticated.';



CREATE OR REPLACE VIEW "public"."v_metros_responsable_ciclo" AS
 SELECT "p"."responsable_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "sum"((("p"."piezas_entradas")::numeric * "f"."area_m2")) AS "m2_total",
    "sum"((("p"."piezas_contenedor")::numeric * "f"."area_m2")) AS "m2_contenedor",
    "sum"((("p"."piezas_comercial")::numeric * "f"."area_m2")) AS "m2_com",
    "sum"(((("p"."piezas_1a" + "p"."piezas_eco"))::numeric * "f"."area_m2")) AS "m2_std"
   FROM (((("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true))
  GROUP BY "p"."responsable_id", ("public"."fn_ciclo_id"("t"."fecha"));


ALTER VIEW "public"."v_metros_responsable_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_metros_responsable_ciclo" IS 'm² del responsable por ciclo, total y por categoría (contenedor / com / std) — mismo criterio de categorías que el resto del proyecto (ver v_calidad_turno). Ampliada 25/08/2026 para alimentar historial_ciclo_responsable.';



CREATE OR REPLACE VIEW "public"."v_mi_mejor_parte_por_formato" AS
 SELECT "p"."operario_id",
    "f"."nombre" AS "formato",
    "max"("p"."piezas_entradas") AS "mejor_parte"
   FROM ("public"."parte" "p"
     JOIN "public"."formato" "f" ON (("f"."id" = "p"."formato_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true) AND ("p"."operario_id" IS NOT NULL))
  GROUP BY "p"."operario_id", "f"."nombre";


ALTER VIEW "public"."v_mi_mejor_parte_por_formato" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_mi_mejor_parte_por_formato" IS 'Mejor parte histórico (piezas de un solo parte) de CADA operario en cada formato — para que el Ranking muestre "tu mejor parte" junto a los dos reyes, aunque el operario no sea ninguno de ellos.';



CREATE OR REPLACE VIEW "public"."v_niveles_disponibles_generar" AS
 SELECT "psn"."usuario_id",
    "psn"."nivel_id",
    "n"."nombre" AS "nivel_nombre",
    "n"."orden" AS "nivel_orden",
    "psn"."generaciones_usadas",
    (3 - "psn"."generaciones_usadas") AS "generaciones_restantes",
    (EXISTS ( SELECT 1
           FROM "public"."personaje_rpg" "pr"
          WHERE (("pr"."usuario_id" = "psn"."usuario_id") AND ("pr"."nivel_en_generacion" = "psn"."nivel_id")))) AS "ya_generado"
   FROM ("public"."personaje_stats_nivel" "psn"
     JOIN "public"."niveles" "n" ON (("n"."id" = "psn"."nivel_id")));


ALTER VIEW "public"."v_niveles_disponibles_generar" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_niveles_disponibles_generar" IS 'Niveles alcanzados por cada usuario con sus generaciones restantes (de 3) y si ya hay una carta generada para ese nivel — apoyo directo de la pantalla Avatar (elegir para qué nivel generar).';



CREATE OR REPLACE VIEW "public"."v_operarios_de_responsable_ciclo" AS
 SELECT DISTINCT "p"."responsable_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "p"."operario_id"
   FROM ("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
  WHERE (("p"."vigente" = true) AND ("p"."operario_id" IS NOT NULL));


ALTER VIEW "public"."v_operarios_de_responsable_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_operarios_de_responsable_ciclo" IS 'Operarios que tuvieron al menos un parte con este responsable en ese ciclo — relación real de trabajo, no letra. Un operario puede aparecer bajo varios responsables en el mismo ciclo (cobertura).';



CREATE OR REPLACE VIEW "public"."v_partes_operario_ciclo" AS
 SELECT "p"."operario_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "count"(DISTINCT ROW("p"."turno_id", "p"."linea_id")) AS "partes_completados"
   FROM ("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true) AND ("p"."operario_id" IS NOT NULL))
  GROUP BY "p"."operario_id", ("public"."fn_ciclo_id"("t"."fecha"));


ALTER VIEW "public"."v_partes_operario_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_partes_operario_ciclo" IS 'Turno+línea DISTINTOS trabajados por operario+ciclo, para CUALQUIER cycle_id — base de "partes" en el Ranking y de partes_completados en historial_ciclos. Corregido 27/09/2026: antes contaba filas de parte (count(*)), lo que inflaba el número cuando el mismo turno+línea tenía varios partes por cambios de tono/lote a mitad de turno, no solo por trabajar 2 líneas distintas. Los ciclos ya cerrados en historial_ciclos ANTES de esta fecha conservan el conteo antiguo, a propósito (decisión: el histórico cerrado no se recalcula).';



CREATE OR REPLACE VIEW "public"."v_piezas_operario_formato_ciclo" AS
 SELECT "p"."operario_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "f"."nombre" AS "formato",
    "sum"("p"."piezas_entradas") AS "piezas_formato"
   FROM (((("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true) AND ("p"."operario_id" IS NOT NULL))
  GROUP BY "p"."operario_id", ("public"."fn_ciclo_id"("t"."fecha")), "f"."nombre";


ALTER VIEW "public"."v_piezas_operario_formato_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_piezas_operario_formato_ciclo" IS 'Piezas por operario+formato+ciclo, atribución DIRECTA vía parte.operario_id (sin reparto igualitario — ver cabecera de la migración). Paso intermedio de v_produccion_operario_ciclo.';



CREATE OR REPLACE VIEW "public"."v_produccion_operario_ciclo" AS
 WITH "base" AS (
         SELECT "p"."operario_id",
            "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
            "sum"("p"."piezas_entradas") AS "piezas_total",
            "sum"((("p"."piezas_entradas")::numeric * "f"."area_m2")) AS "m2_total",
            "sum"((("p"."piezas_contenedor")::numeric * "f"."area_m2")) AS "m2_contenedor",
            "sum"((("p"."piezas_comercial")::numeric * "f"."area_m2")) AS "m2_com",
            "sum"((("p"."piezas_1a")::numeric * "f"."area_m2")) AS "m2_std",
            "sum"("p"."minutos_plena") AS "tiempo_plena",
            "sum"("p"."minutos_no_alimentada") AS "tiempo_no_alimentada",
            "sum"("p"."minutos_saturacion") AS "tiempo_saturacion",
            "sum"("p"."minutos_banco") AS "tiempo_banco",
            "sum"("p"."minutos_maquina") AS "tiempo_maquina"
           FROM (((("public"."parte" "p"
             JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
             JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
             JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
             JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
          WHERE (("p"."vigente" = true) AND ("p"."completado" = true) AND ("p"."operario_id" IS NOT NULL))
          GROUP BY "p"."operario_id", ("public"."fn_ciclo_id"("t"."fecha"))
        ), "formatos" AS (
         SELECT "v_piezas_operario_formato_ciclo"."operario_id",
            "v_piezas_operario_formato_ciclo"."cycle_id",
            "jsonb_object_agg"("v_piezas_operario_formato_ciclo"."formato", "v_piezas_operario_formato_ciclo"."piezas_formato") AS "piezas_por_formato"
           FROM "public"."v_piezas_operario_formato_ciclo"
          GROUP BY "v_piezas_operario_formato_ciclo"."operario_id", "v_piezas_operario_formato_ciclo"."cycle_id"
        )
 SELECT "b"."operario_id",
    "b"."cycle_id",
    "b"."piezas_total",
    "b"."m2_total",
    "b"."m2_contenedor",
    "b"."m2_com",
    "b"."m2_std",
    "b"."tiempo_plena",
    "b"."tiempo_no_alimentada",
    "b"."tiempo_saturacion",
    "b"."tiempo_banco",
    "b"."tiempo_maquina",
    COALESCE("fm"."piezas_por_formato", '{}'::"jsonb") AS "piezas_por_formato"
   FROM ("base" "b"
     LEFT JOIN "formatos" "fm" ON ((("fm"."operario_id" = "b"."operario_id") AND ("fm"."cycle_id" = "b"."cycle_id"))));


ALTER VIEW "public"."v_produccion_operario_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_produccion_operario_ciclo" IS 'Producción en bruto por operario+ciclo — mismas columnas que historial_ciclos (m2_total, piezas_total, tiempo_*, m2 por categoría, piezas_por_formato), calculadas al vuelo para CUALQUIER ciclo. Para los logros de tramo: sum(columna) sobre historial_ciclos (cerrados) + esta vista filtrada al cycle_id actual (el que aún no cerró). Atribución directa vía parte.operario_id, sin reparto igualitario — ver cabecera.';



CREATE OR REPLACE VIEW "public"."v_produccion_turno" AS
 WITH "rendimiento_por_linea" AS (
         SELECT "p_1"."turno_id",
            "p_1"."linea_id",
            "sum"("p_1"."minutos_total") AS "suma_reportada",
            GREATEST((480)::bigint, "sum"("p_1"."minutos_total")) AS "denominador",
            "sum"(("p_1"."minutos_plena" + "p_1"."minutos_no_alimentada")) AS "numerador"
           FROM "public"."parte" "p_1"
          WHERE (("p_1"."vigente" = true) AND ("p_1"."completado" = true))
          GROUP BY "p_1"."turno_id", "p_1"."linea_id"
        ), "rendimiento_por_turno" AS (
         SELECT "rendimiento_por_linea"."turno_id",
            "sum"("rendimiento_por_linea"."numerador") AS "rendimiento_numerador",
            "sum"("rendimiento_por_linea"."denominador") AS "rendimiento_denominador"
           FROM "rendimiento_por_linea"
          GROUP BY "rendimiento_por_linea"."turno_id"
        )
 SELECT "t"."id" AS "turno_id",
    "t"."fecha",
    "t"."tipo" AS "tipo_turno",
    ("t"."cerrado_at" IS NOT NULL) AS "cerrado",
    "count"(DISTINCT "p"."linea_id") AS "lineas_activas",
    "count"(DISTINCT "p"."lote_id") AS "lotes_distintos",
    "count"("p"."id") AS "partes_analizados",
    "sum"("p"."piezas_entradas") AS "piezas_total",
    "sum"((("p"."piezas_entradas")::numeric * "f"."area_m2")) AS "m2_total",
    "sum"("p"."minutos_total") AS "minutos_total",
    "sum"("p"."minutos_plena") AS "minutos_plena",
    "sum"("p"."minutos_no_alimentada") AS "minutos_no_alimentada",
    "sum"("p"."minutos_saturacion") AS "minutos_saturacion",
    "sum"("p"."minutos_banco") AS "minutos_banco",
    "sum"("p"."minutos_maquina") AS "minutos_maquina",
    "round"(((100.0 * "rpt"."rendimiento_numerador") / NULLIF("rpt"."rendimiento_denominador", (0)::numeric)), 2) AS "pct_rendimiento",
    "rpt"."rendimiento_numerador",
    "rpt"."rendimiento_denominador"
   FROM ((((("public"."turno" "t"
     JOIN "public"."parte" "p" ON ((("p"."turno_id" = "t"."id") AND ("p"."vigente" = true) AND ("p"."completado" = true))))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
     JOIN "rendimiento_por_turno" "rpt" ON (("rpt"."turno_id" = "t"."id")))
  GROUP BY "t"."id", "t"."fecha", "t"."tipo", "t"."cerrado_at", "rpt"."rendimiento_numerador", "rpt"."rendimiento_denominador";


ALTER VIEW "public"."v_produccion_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_produccion_turno" IS 'Producción agregada por turno completo. rendimiento_numerador/rendimiento_denominador se calculan en la CTE rendimiento_por_turno (agregada por TURNO, una fila por turno) antes de unirse con las filas de parte -- evita el bug de fan-out corregido 04/09/2026: antes se unía directamente contra rendimiento_por_linea (una fila por línea), y una línea con varios partes en el turno duplicaba su numerador/denominador una vez por cada parte extra. Eje de PRODUCCIÓN: no incluye calidad (1ª/comercial/etc) -- ver v_calidad_turno para eso, con fecha para poder cruzarlas.';



CREATE OR REPLACE VIEW "public"."v_puntos_equipo_responsable_ciclo" AS
 SELECT "ore"."responsable_id",
    "ore"."cycle_id",
    "sum"(COALESCE("pts"."puntos_ciclo", (0)::numeric)) AS "puntos_equipo",
    "bool_or"((COALESCE("gan"."posicion", (0)::bigint) = 1)) AS "operario_gano_ciclo"
   FROM (("public"."v_operarios_de_responsable_ciclo" "ore"
     LEFT JOIN "public"."v_puntos_operario_ciclo" "pts" ON ((("pts"."operario_id" = "ore"."operario_id") AND ("pts"."cycle_id" = "ore"."cycle_id"))))
     LEFT JOIN "public"."v_ganador_por_ciclo" "gan" ON ((("gan"."operario_id" = "ore"."operario_id") AND ("gan"."cycle_id" = "ore"."cycle_id"))))
  GROUP BY "ore"."responsable_id", "ore"."cycle_id";


ALTER VIEW "public"."v_puntos_equipo_responsable_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_equipo_responsable_ciclo" IS 'Puntos sumados y si alguno ganó el ciclo, de los operarios reales de cada responsable, para CUALQUIER cycle_id (cerrado o vivo). Base de las columnas congeladas de arriba y del ciclo en vivo del motor de logros.';



CREATE OR REPLACE VIEW "public"."v_puntos_limpieza_operario_total_vida" AS
 SELECT "id" AS "operario_id",
    ((COALESCE(( SELECT "sum"("hc"."puntos_limpieza") AS "sum"
           FROM "public"."historial_ciclos" "hc"
          WHERE (("hc"."usuario_id" = "u"."id") AND ("hc"."rol" = 'operario'::"text"))), (0)::bigint))::numeric + COALESCE(( SELECT "plp"."puntos_limpieza_ciclo"
           FROM "public"."v_puntos_limpieza_operario_ciclo" "plp"
          WHERE (("plp"."operario_id" = "u"."id") AND ("plp"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE)))), (0)::numeric)) AS "puntos_limpieza_totales"
   FROM "public"."usuario" "u"
  WHERE ("rol" = 'operario'::"public"."rol_usuario");


ALTER VIEW "public"."v_puntos_limpieza_operario_total_vida" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_limpieza_operario_total_vida" IS 'Puntos de limpieza de por vida — ver v_puntos_piezas_operario_total_vida.';



CREATE OR REPLACE VIEW "public"."v_puntos_piezas_operario_total_vida" AS
 SELECT "id" AS "operario_id",
    ((COALESCE(( SELECT "sum"("hc"."puntos_piezas") AS "sum"
           FROM "public"."historial_ciclos" "hc"
          WHERE (("hc"."usuario_id" = "u"."id") AND ("hc"."rol" = 'operario'::"text"))), (0)::bigint))::numeric + COALESCE(( SELECT "ppz"."puntos_piezas_ciclo"
           FROM "public"."v_puntos_piezas_operario_ciclo" "ppz"
          WHERE (("ppz"."operario_id" = "u"."id") AND ("ppz"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE)))), (0)::numeric)) AS "puntos_piezas_totales"
   FROM "public"."usuario" "u"
  WHERE ("rol" = 'operario'::"public"."rol_usuario");


ALTER VIEW "public"."v_puntos_piezas_operario_total_vida" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_piezas_operario_total_vida" IS 'Puntos de piezas de por vida (histórico cerrado + ciclo en vivo) para la tarjeta de Inicio — análoga a v_puntos_operario_total_vida pero solo de esta categoría.';



CREATE OR REPLACE VIEW "public"."v_puntos_rendimiento_operario_total_vida" AS
 SELECT "id" AS "operario_id",
    ((COALESCE(( SELECT "sum"("hc"."puntos_rendimiento") AS "sum"
           FROM "public"."historial_ciclos" "hc"
          WHERE (("hc"."usuario_id" = "u"."id") AND ("hc"."rol" = 'operario'::"text"))), (0)::bigint))::numeric + COALESCE(( SELECT "prd"."puntos_rendimiento_ciclo"
           FROM "public"."v_puntos_rendimiento_operario_ciclo" "prd"
          WHERE (("prd"."operario_id" = "u"."id") AND ("prd"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE)))), (0)::numeric)) AS "puntos_rendimiento_totales"
   FROM "public"."usuario" "u"
  WHERE ("rol" = 'operario'::"public"."rol_usuario");


ALTER VIEW "public"."v_puntos_rendimiento_operario_total_vida" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_puntos_rendimiento_operario_total_vida" IS 'Puntos de rendimiento de por vida — ver v_puntos_piezas_operario_total_vida.';



CREATE OR REPLACE VIEW "public"."v_rectificado_modelo" AS
 SELECT "t"."id" AS "turno_id",
    "t"."fecha",
    "t"."tipo" AS "tipo_turno",
    "p"."linea_id",
    "l"."nombre" AS "linea_nombre",
    "m"."nombre" AS "modelo_nombre",
    "sum"("p"."piezas_entradas") AS "piezas_total",
    "sum"((("p"."piezas_entradas")::numeric * "f"."area_m2")) AS "m2_total",
    "sum"("p"."piezas_descuadre_com") AS "piezas_descuadre_com",
    "round"(((100.0 * ("sum"("p"."piezas_descuadre_com"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_calibre_com",
    "round"((100.0 - ((100.0 * ("sum"("p"."piezas_descuadre_com"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric)), 2) AS "pct_calibre_std"
   FROM (((((("public"."turno" "t"
     JOIN "public"."parte" "p" ON ((("p"."turno_id" = "t"."id") AND ("p"."vigente" = true) AND ("p"."completado" = true))))
     JOIN "public"."linea" "l" ON (("l"."id" = "p"."linea_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."modelo" "m" ON (("m"."id" = "pr"."modelo_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  GROUP BY "t"."id", "t"."fecha", "t"."tipo", "p"."linea_id", "l"."nombre", "m"."nombre";


ALTER VIEW "public"."v_rectificado_modelo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_rectificado_modelo" IS 'Vista Detallada de jefe_rectificado: añade desglose por modelo a la calidad de calibre, para el acordeón turno→línea→modelo/parte.';



CREATE OR REPLACE VIEW "public"."v_rectificado_turno" AS
 SELECT "t"."id" AS "turno_id",
    "t"."fecha",
    "t"."tipo" AS "tipo_turno",
    "p"."linea_id",
    "l"."nombre" AS "linea_nombre",
    "sum"("p"."piezas_entradas") AS "piezas_total",
    "sum"((("p"."piezas_entradas")::numeric * "f"."area_m2")) AS "m2_total",
    "sum"("p"."minutos_total") AS "minutos_total",
    GREATEST((480)::bigint, "sum"("p"."minutos_total")) AS "denominador_rendimiento",
    "sum"("p"."minutos_plena") AS "minutos_pleno_rendimiento",
    "sum"("p"."minutos_no_alimentada") AS "minutos_paradas_propias",
    "sum"((("p"."minutos_saturacion" + "p"."minutos_maquina") + "p"."minutos_banco")) AS "minutos_paradas_ajenas",
    "round"(((100.0 * ("sum"(("p"."minutos_plena" + "p"."minutos_no_alimentada")))::numeric) / (GREATEST((480)::bigint, "sum"("p"."minutos_total")))::numeric), 2) AS "pct_rendimiento",
    "round"((("sum"("p"."piezas_entradas"))::numeric / (NULLIF("sum"("p"."minutos_plena"), 0))::numeric), 2) AS "piezas_minuto",
    "sum"("p"."piezas_descuadre_com") AS "piezas_descuadre_com",
    "round"(((100.0 * ("sum"("p"."piezas_descuadre_com"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric), 2) AS "pct_calibre_com",
    "round"((100.0 - ((100.0 * ("sum"("p"."piezas_descuadre_com"))::numeric) / (NULLIF("sum"("p"."piezas_entradas"), 0))::numeric)), 2) AS "pct_calibre_std",
    "sum"((("p"."piezas_descuadre_com")::numeric * "f"."area_m2")) AS "m2_calibre_com",
    "sum"(((("p"."piezas_entradas" - "p"."piezas_descuadre_com"))::numeric * "f"."area_m2")) AS "m2_calibre_std"
   FROM ((((("public"."turno" "t"
     JOIN "public"."parte" "p" ON ((("p"."turno_id" = "t"."id") AND ("p"."vigente" = true) AND ("p"."completado" = true))))
     JOIN "public"."linea" "l" ON (("l"."id" = "p"."linea_id")))
     JOIN "public"."lote" "lo" ON (("lo"."id" = "p"."lote_id")))
     JOIN "public"."producto" "pr" ON (("pr"."id" = "lo"."producto_id")))
     JOIN "public"."formato" "f" ON (("f"."id" = "pr"."formato_id")))
  GROUP BY "t"."id", "t"."fecha", "t"."tipo", "p"."linea_id", "l"."nombre";


ALTER VIEW "public"."v_rectificado_turno" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_rectificado_turno" IS 'Vista Rápida de jefe_rectificado: por turno+línea. Tiempos en 3 bloques (pleno / paradas propias = no_alimentada / paradas ajenas = saturación+máquina+banco). Calidad = cuadre/descuadre de calibre (piezas_descuadre_com), no 1ª/comercial/eco/contenedor. Rige el mismo criterio de suelo (480/línea) que el resto del proyecto — agregar varias líneas de un turno completo (suelo 2880) se hace en el cliente sumando denominador_rendimiento.';



CREATE OR REPLACE VIEW "public"."v_rey_formato_actual" AS
 WITH "ciclo_actual" AS (
         SELECT "v_piezas_operario_formato_ciclo"."operario_id",
            "v_piezas_operario_formato_ciclo"."cycle_id",
            "v_piezas_operario_formato_ciclo"."formato",
            "v_piezas_operario_formato_ciclo"."piezas_formato"
           FROM "public"."v_piezas_operario_formato_ciclo"
          WHERE ("v_piezas_operario_formato_ciclo"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE))
        ), "maximos" AS (
         SELECT "ciclo_actual"."formato",
            "max"("ciclo_actual"."piezas_formato") AS "piezas_record"
           FROM "ciclo_actual"
          GROUP BY "ciclo_actual"."formato"
        )
 SELECT "c"."formato",
    "c"."operario_id",
    "u"."username" AS "operario_username",
    "c"."piezas_formato"
   FROM (("ciclo_actual" "c"
     JOIN "maximos" "m" ON ((("m"."formato" = "c"."formato") AND ("m"."piezas_record" = "c"."piezas_formato"))))
     LEFT JOIN "public"."usuario" "u" ON (("u"."id" = "c"."operario_id")));


ALTER VIEW "public"."v_rey_formato_actual" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_rey_formato_actual" IS 'Operario con más piezas de cada formato en el ciclo actual — agregado pequeño (pocos operarios × 7 formatos), sin problema de rendimiento. Empates: mismo criterio que v_rey_formato_historico.';



CREATE OR REPLACE VIEW "public"."v_rey_formato_historico" AS
 WITH "maximos" AS (
         SELECT "parte"."formato_id",
            "max"("parte"."piezas_entradas") AS "piezas_record"
           FROM "public"."parte"
          WHERE (("parte"."vigente" = true) AND ("parte"."completado" = true) AND ("parte"."formato_id" IS NOT NULL))
          GROUP BY "parte"."formato_id"
        )
 SELECT "f"."nombre" AS "formato",
    "p"."operario_id",
    "u"."username" AS "operario_username",
    "p"."piezas_entradas",
    "t"."fecha",
    "t"."tipo" AS "turno_tipo",
    "l"."nombre" AS "linea_nombre"
   FROM ((((("public"."parte" "p"
     JOIN "maximos" "m" ON ((("m"."formato_id" = "p"."formato_id") AND ("m"."piezas_record" = "p"."piezas_entradas"))))
     JOIN "public"."formato" "f" ON (("f"."id" = "p"."formato_id")))
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
     JOIN "public"."linea" "l" ON (("l"."id" = "p"."linea_id")))
     LEFT JOIN "public"."usuario" "u" ON (("u"."id" = "p"."operario_id")))
  WHERE (("p"."vigente" = true) AND ("p"."completado" = true));


ALTER VIEW "public"."v_rey_formato_historico" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_rey_formato_historico" IS 'Récord histórico de piezas de un formato en un solo parte, con TODOS los empates si los hay. Apoyada en idx_parte_formato_record — resuelve el MAX por formato sin escanear parte entera.';



CREATE OR REPLACE VIEW "public"."v_tiempo_responsable_ciclo" AS
 SELECT "p"."responsable_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "sum"("p"."minutos_plena") AS "tiempo_plena",
    "sum"(("p"."minutos_plena" + "p"."minutos_no_alimentada")) AS "minutos_rendimiento",
    "sum"("p"."minutos_no_alimentada") AS "minutos_no_alimentada",
    "sum"("p"."minutos_saturacion") AS "minutos_saturacion",
    "sum"("p"."minutos_banco") AS "minutos_banco",
    "sum"("p"."minutos_maquina") AS "minutos_maquina"
   FROM ("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
  WHERE ("p"."vigente" = true)
  GROUP BY "p"."responsable_id", ("public"."fn_ciclo_id"("t"."fecha"));


ALTER VIEW "public"."v_tiempo_responsable_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tiempo_responsable_ciclo" IS 'Minutos del responsable por ciclo. tiempo_plena/minutos_rendimiento se mantienen (los usa fn_cerrar_ciclos_pendientes para velocidad/ resistencia) + los tiempos separados, ampliada 25/08/2026 para historial_ciclo_responsable.';



CREATE OR REPLACE VIEW "public"."v_stats_vida" AS
 WITH "historico_operario" AS (
         SELECT "historial_ciclos"."usuario_id",
            "historial_ciclos"."rol",
            "sum"("historial_ciclos"."m2_total") AS "m2_total",
            "sum"(COALESCE("historial_ciclos"."tiempo_plena", (0)::numeric)) AS "tiempo_plena",
            "sum"((COALESCE("historial_ciclos"."tiempo_plena", (0)::numeric) + COALESCE("historial_ciclos"."tiempo_no_alimentada", (0)::numeric))) AS "minutos_rendimiento"
           FROM "public"."historial_ciclos"
          WHERE ("historial_ciclos"."rol" = 'operario'::"text")
          GROUP BY "historial_ciclos"."usuario_id", "historial_ciclos"."rol"
        ), "historico_responsable" AS (
         SELECT "historial_ciclo_responsable"."usuario_id",
            'responsable'::"text" AS "rol",
            "sum"("historial_ciclo_responsable"."m2_total") AS "m2_total",
            "sum"(COALESCE("historial_ciclo_responsable"."minutos_plena", (0)::numeric)) AS "tiempo_plena",
            "sum"((COALESCE("historial_ciclo_responsable"."minutos_plena", (0)::numeric) + COALESCE("historial_ciclo_responsable"."minutos_no_alimentada", (0)::numeric))) AS "minutos_rendimiento"
           FROM "public"."historial_ciclo_responsable"
          GROUP BY "historial_ciclo_responsable"."usuario_id"
        ), "historico" AS (
         SELECT "historico_operario"."usuario_id",
            "historico_operario"."rol",
            "historico_operario"."m2_total",
            "historico_operario"."tiempo_plena",
            "historico_operario"."minutos_rendimiento"
           FROM "historico_operario"
        UNION ALL
         SELECT "historico_responsable"."usuario_id",
            "historico_responsable"."rol",
            "historico_responsable"."m2_total",
            "historico_responsable"."tiempo_plena",
            "historico_responsable"."minutos_rendimiento"
           FROM "historico_responsable"
        ), "vivo_operario" AS (
         SELECT "v_produccion_operario_ciclo"."operario_id" AS "usuario_id",
            'operario'::"text" AS "rol",
            "v_produccion_operario_ciclo"."m2_total",
            COALESCE("v_produccion_operario_ciclo"."tiempo_plena", (0)::bigint) AS "tiempo_plena",
            (COALESCE("v_produccion_operario_ciclo"."tiempo_plena", (0)::bigint) + COALESCE("v_produccion_operario_ciclo"."tiempo_no_alimentada", (0)::bigint)) AS "minutos_rendimiento"
           FROM "public"."v_produccion_operario_ciclo"
          WHERE ("v_produccion_operario_ciclo"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE))
        ), "vivo_responsable" AS (
         SELECT "m"."responsable_id" AS "usuario_id",
            'responsable'::"text" AS "rol",
            "m"."m2_total",
            COALESCE("tr"."tiempo_plena", (0)::bigint) AS "tiempo_plena",
            COALESCE("tr"."minutos_rendimiento", (0)::bigint) AS "minutos_rendimiento"
           FROM ("public"."v_metros_responsable_ciclo" "m"
             LEFT JOIN "public"."v_tiempo_responsable_ciclo" "tr" ON ((("tr"."responsable_id" = "m"."responsable_id") AND ("tr"."cycle_id" = "m"."cycle_id"))))
          WHERE ("m"."cycle_id" = "public"."fn_ciclo_id"(CURRENT_DATE))
        ), "vivo" AS (
         SELECT "vivo_operario"."usuario_id",
            "vivo_operario"."rol",
            "vivo_operario"."m2_total",
            "vivo_operario"."tiempo_plena",
            "vivo_operario"."minutos_rendimiento"
           FROM "vivo_operario"
        UNION ALL
         SELECT "vivo_responsable"."usuario_id",
            "vivo_responsable"."rol",
            "vivo_responsable"."m2_total",
            "vivo_responsable"."tiempo_plena",
            "vivo_responsable"."minutos_rendimiento"
           FROM "vivo_responsable"
        ), "total" AS (
         SELECT COALESCE("h"."usuario_id", "v"."usuario_id") AS "usuario_id",
            COALESCE("h"."rol", "v"."rol") AS "rol",
            (COALESCE("h"."m2_total", (0)::numeric) + COALESCE("v"."m2_total", (0)::numeric)) AS "m2_total_vida",
            (COALESCE("h"."tiempo_plena", (0)::numeric) + (COALESCE("v"."tiempo_plena", (0)::bigint))::numeric) AS "tiempo_plena_vida",
            (COALESCE("h"."minutos_rendimiento", (0)::numeric) + (COALESCE("v"."minutos_rendimiento", (0)::bigint))::numeric) AS "minutos_rendimiento_vida"
           FROM ("historico" "h"
             FULL JOIN "vivo" "v" ON ((("v"."usuario_id" = "h"."usuario_id") AND ("v"."rol" = "h"."rol"))))
        )
 SELECT "usuario_id",
    "rol",
    "round"(("m2_total_vida" / 1000.0), 2) AS "fuerza",
    "round"(("minutos_rendimiento_vida" / 100.0), 2) AS "resistencia",
        CASE
            WHEN ("tiempo_plena_vida" > (0)::numeric) THEN "round"(("m2_total_vida" / "tiempo_plena_vida"), 4)
            ELSE NULL::numeric
        END AS "velocidad",
    "round"("m2_total_vida", 2) AS "m2_total_vida",
    "round"(("tiempo_plena_vida" / 60.0), 2) AS "horas_plena_vida"
   FROM "total";


ALTER VIEW "public"."v_stats_vida" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_stats_vida" IS 'Fuerza/resistencia/velocidad de toda la vida (histórico + ciclo en vivo), MÁS m2_total_vida y horas_plena_vida en crudo. Para cualquier usuario y rol. FIX 02/09/2026: el histórico de responsable ahora se lee de historial_ciclo_responsable (antes siempre daba 0 para ese rol, igual que el bug ya corregido en v_puntos_responsable_total_vida — ver 20260825180000).';



CREATE OR REPLACE VIEW "public"."v_turnos_responsable_ciclo" AS
 SELECT "abierto_por" AS "responsable_id",
    "public"."fn_ciclo_id"("fecha") AS "cycle_id",
    "count"(*) AS "turnos_trabajados"
   FROM "public"."turno" "t"
  WHERE ("abierto_por" IS NOT NULL)
  GROUP BY "abierto_por", ("public"."fn_ciclo_id"("fecha"));


ALTER VIEW "public"."v_turnos_responsable_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_turnos_responsable_ciclo" IS 'Turnos abiertos por responsable+ciclo (turno.abierto_por), para CUALQUIER cycle_id — literal, no partes (varias líneas en el mismo turno NO deben multiplicar el conteo). Base de "turnos" en el Ranking y de turnos_trabajados en historial_ciclo_responsable.';



CREATE OR REPLACE VIEW "public"."v_unidad_ubicacion_actual" AS
 SELECT DISTINCT ON ("unidad_id") "unidad_id",
        CASE
            WHEN ("tipo_evento" = 'vuelve_montada'::"text") THEN 'montada'::"text"
            ELSE 'en_reparacion'::"text"
        END AS "estado",
    "linea_id",
    "fecha" AS "desde"
   FROM "public"."unidad_movimiento"
  ORDER BY "unidad_id", "fecha" DESC;


ALTER VIEW "public"."v_unidad_ubicacion_actual" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_veces_lider_indiscutible" AS
 SELECT "responsable_id",
    "count"(*) AS "veces"
   FROM "public"."v_ganador_por_ciclo_responsable"
  WHERE ("posicion" = 1)
  GROUP BY "responsable_id";


ALTER VIEW "public"."v_veces_lider_indiscutible" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_veces_lider_indiscutible" IS 'Cuántos ciclos ha ganado (1º del ranking de responsables) cada responsable — para "Líder indiscutible" (sin condicion_valor numérico, se compara contra los demás 3, no contra un umbral).';



CREATE OR REPLACE VIEW "public"."v_veces_rey_de_reyes" AS
 SELECT "operario_id",
    "count"(*) AS "veces"
   FROM "public"."v_ganador_por_ciclo"
  WHERE ("posicion" = 1)
  GROUP BY "operario_id";


ALTER VIEW "public"."v_veces_rey_de_reyes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_veces_rey_de_reyes" IS 'Cuántos ciclos ha ganado (1º del ranking) cada operario — para el logro "Rey de Reyes" (sin condicion_valor numérico, se compara contra los demás, no contra un umbral).';



CREATE OR REPLACE VIEW "public"."v_verificaciones_codbar_responsable_ciclo" AS
 SELECT "p"."responsable_id",
    "public"."fn_ciclo_id"("t"."fecha") AS "cycle_id",
    "count"(*) AS "verificaciones_codbar"
   FROM ("public"."parte" "p"
     JOIN "public"."turno" "t" ON (("t"."id" = "p"."turno_id")))
  WHERE (("p"."vigente" = true) AND ("p"."verificacion_codbar_estado" = ANY (ARRAY['completo'::"text", 'parcial'::"text", 'manual'::"text"])))
  GROUP BY "p"."responsable_id", ("public"."fn_ciclo_id"("t"."fecha"));


ALTER VIEW "public"."v_verificaciones_codbar_responsable_ciclo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_verificaciones_codbar_responsable_ciclo" IS 'Partes con verificación de código de barras REAL (completo/parcial/manual, no no_realizada) por responsable+ciclo. Base de "El detallista" y de la columna verificaciones_codbar de historial_ciclo_responsable.';



ALTER TABLE ONLY "public"."admin_notas"
    ADD CONSTRAINT "admin_notas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."almacen_categoria"
    ADD CONSTRAINT "almacen_categoria_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."almacen_categoria"
    ADD CONSTRAINT "almacen_categoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."almacen_movimiento"
    ADD CONSTRAINT "almacen_movimiento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."almacen_pedido_linea"
    ADD CONSTRAINT "almacen_pedido_linea_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."almacen_pedido"
    ADD CONSTRAINT "almacen_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."almacen_proveedor"
    ADD CONSTRAINT "almacen_proveedor_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."almacen_proveedor"
    ADD CONSTRAINT "almacen_proveedor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."almacen_repuesto"
    ADD CONSTRAINT "almacen_repuesto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."almacen_repuesto_referencia"
    ADD CONSTRAINT "almacen_repuesto_referencia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_secrets"
    ADD CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."asignacion_operario_linea"
    ADD CONSTRAINT "asignacion_operario_linea_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asignacion_operario_linea"
    ADD CONSTRAINT "asignacion_operario_linea_turno_id_linea_id_key" UNIQUE ("turno_id", "linea_id");



ALTER TABLE ONLY "public"."ceria_conversaciones"
    ADD CONSTRAINT "ceria_conversaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ceria_documentacion_maquina"
    ADD CONSTRAINT "ceria_documentacion_maquina_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."ceria_documentacion_maquina"
    ADD CONSTRAINT "ceria_documentacion_maquina_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ceria_mensajes"
    ADD CONSTRAINT "ceria_mensajes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ceria_modelo_activo"
    ADD CONSTRAINT "ceria_modelo_activo_pkey" PRIMARY KEY ("modelo_id");



ALTER TABLE ONLY "public"."ceria_prompts"
    ADD CONSTRAINT "ceria_prompts_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."ceria_prompts"
    ADD CONSTRAINT "ceria_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ceria_tool_logs"
    ADD CONSTRAINT "ceria_tool_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_acceso"
    ADD CONSTRAINT "chat_acceso_pkey" PRIMARY KEY ("tipo_chat", "rol");



ALTER TABLE ONLY "public"."chat_mensajes"
    ADD CONSTRAINT "chat_mensajes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cierre_fabrica"
    ADD CONSTRAINT "cierre_fabrica_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."engrase_parte"
    ADD CONSTRAINT "engrase_parte_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engrase_parte_punto"
    ADD CONSTRAINT "engrase_parte_punto_pkey" PRIMARY KEY ("parte_id", "punto_id");



ALTER TABLE ONLY "public"."engrase_punto"
    ADD CONSTRAINT "engrase_punto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formato"
    ADD CONSTRAINT "formato_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."formato"
    ADD CONSTRAINT "formato_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_ciclo_responsable"
    ADD CONSTRAINT "historial_ciclo_responsable_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_ciclo_responsable"
    ADD CONSTRAINT "historial_ciclo_responsable_usuario_id_cycle_id_key" UNIQUE ("usuario_id", "cycle_id");



ALTER TABLE ONLY "public"."historial_ciclos"
    ADD CONSTRAINT "historial_ciclos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_ciclos"
    ADD CONSTRAINT "historial_ciclos_usuario_id_cycle_id_key" UNIQUE ("usuario_id", "cycle_id");



ALTER TABLE ONLY "public"."incidencia_calidad"
    ADD CONSTRAINT "incidencia_calidad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidencia_produccion"
    ADD CONSTRAINT "incidencia_produccion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."informe_periodo"
    ADD CONSTRAINT "informe_periodo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."informe_periodo"
    ADD CONSTRAINT "informe_periodo_unico" UNIQUE ("tipo", "desde");



ALTER TABLE ONLY "public"."linea"
    ADD CONSTRAINT "linea_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."linea"
    ADD CONSTRAINT "linea_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logros_definicion"
    ADD CONSTRAINT "logros_definicion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lote"
    ADD CONSTRAINT "lote_numero_orden_key" UNIQUE ("numero_orden");



ALTER TABLE ONLY "public"."lote"
    ADD CONSTRAINT "lote_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marca"
    ADD CONSTRAINT "marca_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modelo"
    ADD CONSTRAINT "modelo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."niveles"
    ADD CONSTRAINT "niveles_orden_key" UNIQUE ("orden");



ALTER TABLE ONLY "public"."niveles"
    ADD CONSTRAINT "niveles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificacion_estado_usuario"
    ADD CONSTRAINT "notificacion_estado_usuario_pkey" PRIMARY KEY ("usuario_id", "tipo");



ALTER TABLE ONLY "public"."notificacion_preferencias"
    ADD CONSTRAINT "notificacion_preferencias_pkey" PRIMARY KEY ("usuario_id", "tipo");



ALTER TABLE ONLY "public"."notificacion_silencio"
    ADD CONSTRAINT "notificacion_silencio_pkey" PRIMARY KEY ("usuario_id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operario_checklist"
    ADD CONSTRAINT "operario_checklist_linea_id_turno_id_checklist_item_id_key" UNIQUE ("linea_id", "turno_id", "checklist_item_id");



ALTER TABLE ONLY "public"."operario_checklist"
    ADD CONSTRAINT "operario_checklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personaje_rpg"
    ADD CONSTRAINT "personaje_rpg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personaje_stats_nivel"
    ADD CONSTRAINT "personaje_stats_nivel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personaje_stats_nivel"
    ADD CONSTRAINT "personaje_stats_nivel_usuario_id_nivel_id_key" UNIQUE ("usuario_id", "nivel_id");



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_modelo_id_marca_id_formato_id_key" UNIQUE ("modelo_id", "marca_id", "formato_id");



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programacion_nota_frase"
    ADD CONSTRAINT "programacion_nota_frase_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programacion_nota_frase"
    ADD CONSTRAINT "programacion_nota_frase_texto_key" UNIQUE ("texto");



ALTER TABLE ONLY "public"."programacion_nota"
    ADD CONSTRAINT "programacion_nota_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programacion_orden_historico"
    ADD CONSTRAINT "programacion_orden_historico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programacion_orden"
    ADD CONSTRAINT "programacion_orden_numero_orden_key" UNIQUE ("numero_orden");



ALTER TABLE ONLY "public"."programacion_orden"
    ADD CONSTRAINT "programacion_orden_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."puntos_metros"
    ADD CONSTRAINT "puntos_metros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."puntos_piezas"
    ADD CONSTRAINT "puntos_piezas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."puntos_rendimiento"
    ADD CONSTRAINT "puntos_rendimiento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."puntos_rendimiento_responsable"
    ADD CONSTRAINT "puntos_rendimiento_responsable_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refuerzo_operario_turno"
    ADD CONSTRAINT "refuerzo_operario_turno_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refuerzo_operario_turno"
    ADD CONSTRAINT "refuerzo_operario_turno_turno_id_operario_id_key" UNIQUE ("turno_id", "operario_id");



ALTER TABLE ONLY "public"."turno"
    ADD CONSTRAINT "turno_fecha_tipo_key" UNIQUE ("fecha", "tipo");



ALTER TABLE ONLY "public"."turno"
    ADD CONSTRAINT "turno_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unidad_intercambiable"
    ADD CONSTRAINT "unidad_intercambiable_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unidad_intercambiable"
    ADD CONSTRAINT "unidad_intercambiable_tipo_identificador_key" UNIQUE ("tipo", "identificador");



ALTER TABLE ONLY "public"."unidad_movimiento"
    ADD CONSTRAINT "unidad_movimiento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_username_key" UNIQUE ("username");



CREATE UNIQUE INDEX "admin_notas_programacion_por_dia" ON "public"."admin_notas" USING "btree" ("fecha") WHERE ("tipo" = 'programacion'::"text");



CREATE UNIQUE INDEX "almacen_movimiento_pedido_linea_unico" ON "public"."almacen_movimiento" USING "btree" ("pedido_linea_id") WHERE ("pedido_linea_id" IS NOT NULL);



CREATE INDEX "ceria_documentacion_maquina_maquina_idx" ON "public"."ceria_documentacion_maquina" USING "btree" ("maquina", "submaquina", "tipo");



CREATE INDEX "idx_asignacion_operario" ON "public"."asignacion_operario_linea" USING "btree" ("operario_id");



CREATE INDEX "idx_ceria_conversaciones_user" ON "public"."ceria_conversaciones" USING "btree" ("user_id");



CREATE INDEX "idx_ceria_mensajes_conversacion" ON "public"."ceria_mensajes" USING "btree" ("conversacion_id", "created_at");



CREATE INDEX "idx_ceria_tool_logs_conversacion" ON "public"."ceria_tool_logs" USING "btree" ("conversacion_id");



CREATE INDEX "idx_ceria_tool_logs_created_at" ON "public"."ceria_tool_logs" USING "btree" ("created_at");



CREATE INDEX "idx_ceria_tool_logs_herramienta" ON "public"."ceria_tool_logs" USING "btree" ("herramienta");



CREATE INDEX "idx_chat_mensajes_created_at" ON "public"."chat_mensajes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_historial_ciclos_cycle" ON "public"."historial_ciclos" USING "btree" ("cycle_id");



CREATE INDEX "idx_historial_ciclos_usuario" ON "public"."historial_ciclos" USING "btree" ("usuario_id");



CREATE INDEX "idx_incidencia_calidad_parte" ON "public"."incidencia_calidad" USING "btree" ("parte_id");



CREATE INDEX "idx_incidencia_produccion_linea" ON "public"."incidencia_produccion" USING "btree" ("linea_id");



CREATE INDEX "idx_incidencia_produccion_turno" ON "public"."incidencia_produccion" USING "btree" ("turno_id");



CREATE INDEX "idx_lote_estado" ON "public"."lote" USING "btree" ("estado");



CREATE INDEX "idx_lote_producto" ON "public"."lote" USING "btree" ("producto_id");



CREATE INDEX "idx_marca_trgm" ON "public"."marca" USING "gin" ("nombre_normalizado" "public"."gin_trgm_ops");



CREATE INDEX "idx_modelo_trgm" ON "public"."modelo" USING "gin" ("nombre_normalizado" "public"."gin_trgm_ops");



CREATE INDEX "idx_notificaciones_created_at" ON "public"."notificaciones" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notificaciones_tipo" ON "public"."notificaciones" USING "btree" ("tipo");



CREATE INDEX "idx_operario_checklist_operario" ON "public"."operario_checklist" USING "btree" ("operario_id");



CREATE INDEX "idx_parte_corrige" ON "public"."parte" USING "btree" ("corrige_a_parte_id") WHERE ("corrige_a_parte_id" IS NOT NULL);



CREATE INDEX "idx_parte_formato_record" ON "public"."parte" USING "btree" ("formato_id", "vigente", "completado", "piezas_entradas" DESC);



CREATE INDEX "idx_parte_linea" ON "public"."parte" USING "btree" ("linea_id");



CREATE INDEX "idx_parte_lote" ON "public"."parte" USING "btree" ("lote_id");



CREATE INDEX "idx_parte_operario" ON "public"."parte" USING "btree" ("operario_id");



CREATE INDEX "idx_parte_responsable" ON "public"."parte" USING "btree" ("responsable_id");



CREATE INDEX "idx_parte_turno" ON "public"."parte" USING "btree" ("turno_id");



CREATE INDEX "idx_parte_vigente" ON "public"."parte" USING "btree" ("vigente") WHERE ("vigente" = true);



CREATE INDEX "idx_personaje_rpg_usuario" ON "public"."personaje_rpg" USING "btree" ("usuario_id");



CREATE INDEX "idx_personaje_stats_nivel_usuario" ON "public"."personaje_stats_nivel" USING "btree" ("usuario_id");



CREATE INDEX "idx_producto_marca" ON "public"."producto" USING "btree" ("marca_id");



CREATE INDEX "idx_producto_modelo" ON "public"."producto" USING "btree" ("modelo_id");



CREATE INDEX "idx_refuerzo_operario_turno" ON "public"."refuerzo_operario_turno" USING "btree" ("operario_id");



CREATE INDEX "idx_turno_fecha" ON "public"."turno" USING "btree" ("fecha");



CREATE INDEX "idx_usuario_letra" ON "public"."usuario" USING "btree" ("letra") WHERE ("letra" IS NOT NULL);



CREATE INDEX "idx_usuario_rol" ON "public"."usuario" USING "btree" ("rol");



CREATE INDEX "programacion_nota_numero_orden_idx" ON "public"."programacion_nota" USING "btree" ("numero_orden");



CREATE UNIQUE INDEX "uq_parte_pendiente_por_linea_turno" ON "public"."parte" USING "btree" ("turno_id", "linea_id") WHERE (("vigente" = true) AND ("completado" = false));



COMMENT ON INDEX "public"."uq_parte_pendiente_por_linea_turno" IS 'Solo puede haber UN parte pendiente (completado=false, vigente true) por línea+turno. Ver sesión 02/09/2026 — bug de partes duplicados al volver atrás tras la Foto 1.';



CREATE UNIQUE INDEX "uq_personaje_rpg_seleccionada" ON "public"."personaje_rpg" USING "btree" ("usuario_id") WHERE ("seleccionada" = true);



CREATE UNIQUE INDEX "uq_usuario_suplente_unico" ON "public"."usuario" USING "btree" ((("rol" = 'suplente'::"public"."rol_usuario"))) WHERE ("rol" = 'suplente'::"public"."rol_usuario");



CREATE OR REPLACE TRIGGER "trg_almacen_pedido_linea_recibida" BEFORE UPDATE ON "public"."almacen_pedido_linea" FOR EACH ROW EXECUTE FUNCTION "public"."fn_almacen_pedido_linea_recibida"();



CREATE OR REPLACE TRIGGER "trg_incidencia_produccion_restringir_columnas" BEFORE UPDATE ON "public"."incidencia_produccion" FOR EACH ROW EXECUTE FUNCTION "public"."fn_incidencia_produccion_restringir_columnas_update"();



CREATE OR REPLACE TRIGGER "trg_marca_normalizar" BEFORE INSERT OR UPDATE OF "nombre" ON "public"."marca" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_nombre_normalizado_marca"();



CREATE OR REPLACE TRIGGER "trg_modelo_normalizar" BEFORE INSERT OR UPDATE OF "nombre" ON "public"."modelo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_nombre_normalizado_modelo"();



CREATE OR REPLACE TRIGGER "trg_notificar_telegram_calidad" AFTER INSERT ON "public"."incidencia_calidad" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_telegram"();



CREATE OR REPLACE TRIGGER "trg_notificar_telegram_nuevo_lote" AFTER UPDATE OF "verificacion_caja_estado" ON "public"."parte" FOR EACH ROW WHEN ((("new"."verificacion_caja_estado" IS NOT NULL) AND ("new"."verificacion_caja_estado" IS DISTINCT FROM "old"."verificacion_caja_estado"))) EXECUTE FUNCTION "public"."fn_notificar_telegram"();



CREATE OR REPLACE TRIGGER "trg_notificar_telegram_produccion" AFTER INSERT ON "public"."incidencia_produccion" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_telegram"();



CREATE OR REPLACE TRIGGER "trg_parte_calibre_pct" BEFORE INSERT OR UPDATE OF "piezas_descuadre_com", "piezas_entradas" ON "public"."parte" FOR EACH ROW EXECUTE FUNCTION "public"."fn_calcular_calibre_com_pct"();



CREATE OR REPLACE TRIGGER "trg_parte_corregir" AFTER INSERT ON "public"."parte" FOR EACH ROW EXECUTE FUNCTION "public"."fn_marcar_corregido_no_vigente"();



CREATE OR REPLACE TRIGGER "trg_parte_reabre_lote" AFTER INSERT ON "public"."parte" FOR EACH ROW EXECUTE FUNCTION "public"."fn_parte_reabre_lote"();



CREATE OR REPLACE TRIGGER "trg_parte_restringir_columnas" BEFORE UPDATE ON "public"."parte" FOR EACH ROW EXECUTE FUNCTION "public"."fn_parte_restringir_columnas_update"();



CREATE OR REPLACE TRIGGER "trg_parte_set_formato_id" BEFORE INSERT ON "public"."parte" FOR EACH ROW EXECUTE FUNCTION "public"."fn_parte_set_formato_id"();



COMMENT ON TRIGGER "trg_parte_set_formato_id" ON "public"."parte" IS 'Rellena parte.formato_id automáticamente al crear el parte, desde lote->producto->formato. Solo BEFORE INSERT (no UPDATE): el lote de un parte no cambia después de creado.';



CREATE OR REPLACE TRIGGER "trg_parte_validar_correccion" BEFORE INSERT ON "public"."parte" FOR EACH ROW EXECUTE FUNCTION "public"."fn_parte_validar_correccion"();



CREATE OR REPLACE TRIGGER "trg_parte_z_cerrar_lote_completo" AFTER INSERT OR UPDATE OF "completado", "vigente", "piezas_entradas" ON "public"."parte" FOR EACH ROW WHEN (("new"."vigente" AND "new"."completado")) EXECUTE FUNCTION "public"."fn_cerrar_lote_si_completo"();



CREATE OR REPLACE TRIGGER "trg_programacion_nota_updated_at" BEFORE UPDATE ON "public"."programacion_nota" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_programacion_nota"();



CREATE OR REPLACE TRIGGER "trg_programacion_orden_updated_at" BEFORE UPDATE ON "public"."programacion_orden" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_programacion_orden"();



CREATE OR REPLACE TRIGGER "trg_turno_bloquear_cierre" BEFORE INSERT ON "public"."turno" FOR EACH ROW EXECUTE FUNCTION "public"."fn_bloquear_turno_en_cierre"();



CREATE OR REPLACE TRIGGER "trg_turno_resumen_cierre" AFTER UPDATE OF "cerrado_at" ON "public"."turno" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trigger_resumen_turno_cierre"();



CREATE OR REPLACE TRIGGER "trg_usuario_bloquear_ascenso_admin" BEFORE UPDATE ON "public"."usuario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_bloquear_ascenso_admin"();



ALTER TABLE ONLY "public"."admin_notas"
    ADD CONSTRAINT "admin_notas_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."almacen_movimiento"
    ADD CONSTRAINT "almacen_movimiento_mecanico_id_fkey" FOREIGN KEY ("mecanico_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."almacen_movimiento"
    ADD CONSTRAINT "almacen_movimiento_pedido_linea_fkey" FOREIGN KEY ("pedido_linea_id") REFERENCES "public"."almacen_pedido_linea"("id");



ALTER TABLE ONLY "public"."almacen_movimiento"
    ADD CONSTRAINT "almacen_movimiento_repuesto_id_fkey" FOREIGN KEY ("repuesto_id") REFERENCES "public"."almacen_repuesto"("id");



ALTER TABLE ONLY "public"."almacen_pedido"
    ADD CONSTRAINT "almacen_pedido_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."almacen_pedido_linea"
    ADD CONSTRAINT "almacen_pedido_linea_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."almacen_pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."almacen_pedido_linea"
    ADD CONSTRAINT "almacen_pedido_linea_repuesto_id_fkey" FOREIGN KEY ("repuesto_id") REFERENCES "public"."almacen_repuesto"("id");



ALTER TABLE ONLY "public"."almacen_pedido"
    ADD CONSTRAINT "almacen_pedido_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."almacen_proveedor"("id");



ALTER TABLE ONLY "public"."almacen_repuesto"
    ADD CONSTRAINT "almacen_repuesto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."almacen_categoria"("id");



ALTER TABLE ONLY "public"."almacen_repuesto"
    ADD CONSTRAINT "almacen_repuesto_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."almacen_repuesto_referencia"
    ADD CONSTRAINT "almacen_repuesto_referencia_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."almacen_proveedor"("id");



ALTER TABLE ONLY "public"."almacen_repuesto_referencia"
    ADD CONSTRAINT "almacen_repuesto_referencia_repuesto_id_fkey" FOREIGN KEY ("repuesto_id") REFERENCES "public"."almacen_repuesto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asignacion_operario_linea"
    ADD CONSTRAINT "asignacion_operario_linea_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "public"."linea"("id");



ALTER TABLE ONLY "public"."asignacion_operario_linea"
    ADD CONSTRAINT "asignacion_operario_linea_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."asignacion_operario_linea"
    ADD CONSTRAINT "asignacion_operario_linea_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id");



ALTER TABLE ONLY "public"."ceria_conversaciones"
    ADD CONSTRAINT "ceria_conversaciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."ceria_mensajes"
    ADD CONSTRAINT "ceria_mensajes_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "public"."ceria_conversaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ceria_tool_logs"
    ADD CONSTRAINT "ceria_tool_logs_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "public"."ceria_conversaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ceria_tool_logs"
    ADD CONSTRAINT "ceria_tool_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_mensajes"
    ADD CONSTRAINT "chat_mensajes_borrado_por_fkey" FOREIGN KEY ("borrado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."chat_mensajes"
    ADD CONSTRAINT "chat_mensajes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engrase_parte"
    ADD CONSTRAINT "engrase_parte_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "public"."linea"("id");



ALTER TABLE ONLY "public"."engrase_parte"
    ADD CONSTRAINT "engrase_parte_mecanico_id_fkey" FOREIGN KEY ("mecanico_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."engrase_parte_punto"
    ADD CONSTRAINT "engrase_parte_punto_parte_id_fkey" FOREIGN KEY ("parte_id") REFERENCES "public"."engrase_parte"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engrase_parte_punto"
    ADD CONSTRAINT "engrase_parte_punto_punto_id_fkey" FOREIGN KEY ("punto_id") REFERENCES "public"."engrase_punto"("id");



ALTER TABLE ONLY "public"."historial_ciclo_responsable"
    ADD CONSTRAINT "historial_ciclo_responsable_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."historial_ciclos"
    ADD CONSTRAINT "historial_ciclos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."incidencia_calidad"
    ADD CONSTRAINT "incidencia_calidad_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."incidencia_calidad"
    ADD CONSTRAINT "incidencia_calidad_parte_id_fkey" FOREIGN KEY ("parte_id") REFERENCES "public"."parte"("id");



ALTER TABLE ONLY "public"."incidencia_produccion"
    ADD CONSTRAINT "incidencia_produccion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."incidencia_produccion"
    ADD CONSTRAINT "incidencia_produccion_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "public"."linea"("id");



ALTER TABLE ONLY "public"."incidencia_produccion"
    ADD CONSTRAINT "incidencia_produccion_respuesta_mecanico_id_fkey" FOREIGN KEY ("respuesta_mecanico_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."incidencia_produccion"
    ADD CONSTRAINT "incidencia_produccion_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id");



ALTER TABLE ONLY "public"."lote"
    ADD CONSTRAINT "lote_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."lote"
    ADD CONSTRAINT "lote_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id");



ALTER TABLE ONLY "public"."notificacion_estado_usuario"
    ADD CONSTRAINT "notificacion_estado_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificacion_preferencias"
    ADD CONSTRAINT "notificacion_preferencias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificacion_silencio"
    ADD CONSTRAINT "notificacion_silencio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operario_checklist"
    ADD CONSTRAINT "operario_checklist_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id");



ALTER TABLE ONLY "public"."operario_checklist"
    ADD CONSTRAINT "operario_checklist_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "public"."linea"("id");



ALTER TABLE ONLY "public"."operario_checklist"
    ADD CONSTRAINT "operario_checklist_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."operario_checklist"
    ADD CONSTRAINT "operario_checklist_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_corrige_a_parte_id_fkey" FOREIGN KEY ("corrige_a_parte_id") REFERENCES "public"."parte"("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_formato_id_fkey" FOREIGN KEY ("formato_id") REFERENCES "public"."formato"("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "public"."linea"("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."parte"
    ADD CONSTRAINT "parte_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id");



ALTER TABLE ONLY "public"."personaje_rpg"
    ADD CONSTRAINT "personaje_rpg_nivel_en_generacion_fkey" FOREIGN KEY ("nivel_en_generacion") REFERENCES "public"."niveles"("id");



ALTER TABLE ONLY "public"."personaje_rpg"
    ADD CONSTRAINT "personaje_rpg_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."personaje_stats_nivel"
    ADD CONSTRAINT "personaje_stats_nivel_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "public"."niveles"("id");



ALTER TABLE ONLY "public"."personaje_stats_nivel"
    ADD CONSTRAINT "personaje_stats_nivel_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_formato_id_fkey" FOREIGN KEY ("formato_id") REFERENCES "public"."formato"("id");



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "public"."marca"("id");



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "public"."modelo"("id");



ALTER TABLE ONLY "public"."programacion_nota"
    ADD CONSTRAINT "programacion_nota_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."programacion_orden_historico"
    ADD CONSTRAINT "programacion_orden_historico_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."refuerzo_operario_turno"
    ADD CONSTRAINT "refuerzo_operario_turno_habilitado_por_fkey" FOREIGN KEY ("habilitado_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."refuerzo_operario_turno"
    ADD CONSTRAINT "refuerzo_operario_turno_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."refuerzo_operario_turno"
    ADD CONSTRAINT "refuerzo_operario_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id");



ALTER TABLE ONLY "public"."turno"
    ADD CONSTRAINT "turno_abierto_por_fkey" FOREIGN KEY ("abierto_por") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."unidad_movimiento"
    ADD CONSTRAINT "unidad_movimiento_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "public"."linea"("id");



ALTER TABLE ONLY "public"."unidad_movimiento"
    ADD CONSTRAINT "unidad_movimiento_mecanico_id_fkey" FOREIGN KEY ("mecanico_id") REFERENCES "public"."usuario"("id");



ALTER TABLE ONLY "public"."unidad_movimiento"
    ADD CONSTRAINT "unidad_movimiento_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidad_intercambiable"("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."admin_notas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_notas_admin_todo" ON "public"."admin_notas" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



ALTER TABLE "public"."almacen_categoria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "almacen_categoria_mecanico_admin_todo" ON "public"."almacen_categoria" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."almacen_movimiento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "almacen_movimiento_admin_delete" ON "public"."almacen_movimiento" FOR DELETE USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "almacen_movimiento_admin_update" ON "public"."almacen_movimiento" FOR UPDATE USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "almacen_movimiento_insert" ON "public"."almacen_movimiento" FOR INSERT WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "almacen_movimiento_select" ON "public"."almacen_movimiento" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."almacen_pedido" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."almacen_pedido_linea" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "almacen_pedido_linea_mecanico_admin_todo" ON "public"."almacen_pedido_linea" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "almacen_pedido_mecanico_admin_todo" ON "public"."almacen_pedido" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."almacen_proveedor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "almacen_proveedor_mecanico_admin_todo" ON "public"."almacen_proveedor" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."almacen_repuesto" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "almacen_repuesto_mecanico_admin_todo" ON "public"."almacen_repuesto" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."almacen_repuesto_referencia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "almacen_repuesto_referencia_mecanico_admin_todo" ON "public"."almacen_repuesto_referencia" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."asignacion_operario_linea" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asignacion_operario_linea_admin_todo" ON "public"."asignacion_operario_linea" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "asignacion_operario_linea_delete_responsable" ON "public"."asignacion_operario_linea" FOR DELETE USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario"])));



CREATE POLICY "asignacion_operario_linea_insert_responsable" ON "public"."asignacion_operario_linea" FOR INSERT WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario"])));



CREATE POLICY "asignacion_operario_linea_select_autenticados" ON "public"."asignacion_operario_linea" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "asignacion_operario_linea_update_responsable" ON "public"."asignacion_operario_linea" FOR UPDATE USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario"])));



ALTER TABLE "public"."ceria_conversaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ceria_conversaciones_propia" ON "public"."ceria_conversaciones" USING ((("user_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")));



ALTER TABLE "public"."ceria_documentacion_maquina" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ceria_documentacion_maquina_admin_todo" ON "public"."ceria_documentacion_maquina" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "ceria_documentacion_maquina_select" ON "public"."ceria_documentacion_maquina" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."ceria_mensajes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ceria_mensajes_propia" ON "public"."ceria_mensajes" USING ((EXISTS ( SELECT 1
   FROM "public"."ceria_conversaciones" "c"
  WHERE (("c"."id" = "ceria_mensajes"."conversacion_id") AND (("c"."user_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ceria_conversaciones" "c"
  WHERE (("c"."id" = "ceria_mensajes"."conversacion_id") AND (("c"."user_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"))))));



ALTER TABLE "public"."ceria_modelo_activo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ceria_modelo_activo_admin_escribe" ON "public"."ceria_modelo_activo" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "ceria_modelo_activo_select" ON "public"."ceria_modelo_activo" FOR SELECT USING (("public"."fn_rol_actual"() IS NOT NULL));



ALTER TABLE "public"."ceria_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ceria_prompts_admin_todo" ON "public"."ceria_prompts" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "ceria_prompts_select" ON "public"."ceria_prompts" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."ceria_tool_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_acceso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_acceso_admin_escribe" ON "public"."chat_acceso" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "chat_acceso_select" ON "public"."chat_acceso" FOR SELECT USING (("public"."fn_rol_actual"() IS NOT NULL));



ALTER TABLE "public"."chat_mensajes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_mensajes_borrado_suave" ON "public"."chat_mensajes" FOR UPDATE USING ((("usuario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"))) WITH CHECK ((("usuario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")));



CREATE POLICY "chat_mensajes_insert_segun_acceso" ON "public"."chat_mensajes" FOR INSERT WITH CHECK ((("usuario_id" = "auth"."uid"()) AND "public"."fn_chat_acceso"('general'::"text", 'escribir'::"text")));



CREATE POLICY "chat_mensajes_select_segun_acceso" ON "public"."chat_mensajes" FOR SELECT USING ("public"."fn_chat_acceso"('general'::"text", 'ver'::"text"));



ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checklist_items_admin_todo" ON "public"."checklist_items" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "checklist_items_select_autenticados" ON "public"."checklist_items" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."cierre_fabrica" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cierre_fabrica_admin_todo" ON "public"."cierre_fabrica" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "cierre_fabrica_select_autenticados" ON "public"."cierre_fabrica" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."configuracion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracion_admin_todo" ON "public"."configuracion" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "configuracion_select_autenticados" ON "public"."configuracion" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."engrase_parte" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engrase_parte_insert_mecanico" ON "public"."engrase_parte" FOR INSERT WITH CHECK ((("public"."fn_rol_actual"() = 'mecanico'::"public"."rol_usuario") AND ("mecanico_id" = "auth"."uid"())));



ALTER TABLE "public"."engrase_parte_punto" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engrase_parte_punto_insert_mecanico" ON "public"."engrase_parte_punto" FOR INSERT WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "engrase_parte_punto_select" ON "public"."engrase_parte_punto" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "engrase_parte_select" ON "public"."engrase_parte" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."engrase_punto" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engrase_punto_admin_todo" ON "public"."engrase_punto" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "engrase_punto_select" ON "public"."engrase_punto" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."formato" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "formato_admin_todo" ON "public"."formato" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "formato_select_autenticados" ON "public"."formato" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."historial_ciclo_responsable" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_ciclo_responsable_select" ON "public"."historial_ciclo_responsable" FOR SELECT USING ((("usuario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario", 'pantalla'::"public"."rol_usuario"]))));



ALTER TABLE "public"."historial_ciclos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_ciclos_select" ON "public"."historial_ciclos" FOR SELECT USING ((("usuario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))));



CREATE POLICY "historial_ciclos_select_ranking" ON "public"."historial_ciclos" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['operario'::"public"."rol_usuario", 'responsable'::"public"."rol_usuario", 'pantalla'::"public"."rol_usuario"])));



COMMENT ON POLICY "historial_ciclos_select_ranking" ON "public"."historial_ciclos" IS 'El podio del ciclo anterior (lib/ranking.ts) consulta esta tabla directamente: sin esto, cada operario solo veía su propia fila (RLS "propio/jefe/admin") y el podio salía de una persona. `pantalla` incluida para la futura diapositiva de Ranking del carrusel. Se SUMA a historial_ciclos_select con OR.';



ALTER TABLE "public"."incidencia_calidad" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incidencia_calidad_insert" ON "public"."incidencia_calidad" FOR INSERT WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "incidencia_calidad_select" ON "public"."incidencia_calidad" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'jefe'::"public"."rol_usuario", 'produccion'::"public"."rol_usuario", 'calidad'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



COMMENT ON POLICY "incidencia_calidad_select" ON "public"."incidencia_calidad" IS 'Lectura: responsable, suplente, jefe, produccion (22/09/2026, adjuntos de jefe de planta), calidad, administrador. Sin UPDATE ni DELETE para nadie salvo backend.';



ALTER TABLE "public"."incidencia_produccion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incidencia_produccion_insert" ON "public"."incidencia_produccion" FOR INSERT WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "incidencia_produccion_select" ON "public"."incidencia_produccion" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'jefe'::"public"."rol_usuario", 'produccion'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "incidencia_produccion_select_mecanico" ON "public"."incidencia_produccion" FOR SELECT USING (("public"."fn_rol_actual"() = 'mecanico'::"public"."rol_usuario"));



CREATE POLICY "incidencia_produccion_update_mecanico" ON "public"."incidencia_produccion" FOR UPDATE USING ((("public"."fn_rol_actual"() = 'mecanico'::"public"."rol_usuario") AND ("respuesta_fecha" IS NULL))) WITH CHECK (("respuesta_mecanico_id" = "auth"."uid"()));



ALTER TABLE "public"."informe_periodo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "informe_periodo_select_jefe_admin" ON "public"."informe_periodo" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'produccion'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "informe_periodo_select_responsable" ON "public"."informe_periodo" FOR SELECT USING (("public"."fn_rol_actual"() = 'responsable'::"public"."rol_usuario"));



ALTER TABLE "public"."linea" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "linea_admin_todo" ON "public"."linea" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "linea_select_autenticados" ON "public"."linea" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."logros_definicion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "logros_definicion_admin_todo" ON "public"."logros_definicion" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "logros_definicion_select_autenticados" ON "public"."logros_definicion" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."lote" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lote_admin_todo" ON "public"."lote" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "lote_select_autenticados" ON "public"."lote" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "lote_update_responsable" ON "public"."lote" FOR UPDATE USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario"])));



COMMENT ON POLICY "lote_update_responsable" ON "public"."lote" IS 'Permite Finalizar/Reabrir desde la pantalla de Gestión de lotes (01-rol-responsable.md 3.10). Deliberadamente amplia, mismo criterio que turno_update_responsable.';



ALTER TABLE "public"."marca" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marca_admin_todo" ON "public"."marca" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "marca_select_autenticados" ON "public"."marca" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."modelo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modelo_admin_todo" ON "public"."modelo" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "modelo_select_autenticados" ON "public"."modelo" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."niveles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "niveles_admin_todo" ON "public"."niveles" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "niveles_select_autenticados" ON "public"."niveles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "notif_estado_usuario_propio" ON "public"."notificacion_estado_usuario" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "notif_preferencias_propio" ON "public"."notificacion_preferencias" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "notif_silencio_propio" ON "public"."notificacion_silencio" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."notificacion_estado_usuario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificacion_preferencias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificacion_silencio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificaciones_select_segun_acceso" ON "public"."notificaciones" FOR SELECT USING ("public"."fn_chat_acceso"("tipo", 'ver'::"text"));



ALTER TABLE "public"."operario_checklist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operario_checklist_insert" ON "public"."operario_checklist" FOR INSERT WITH CHECK ((("operario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")));



CREATE POLICY "operario_checklist_select" ON "public"."operario_checklist" FOR SELECT USING ((("operario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))));



ALTER TABLE "public"."parte" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parte_admin_todo" ON "public"."parte" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "parte_insert_responsable" ON "public"."parte" FOR INSERT WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "parte_select_jefe_rectificado" ON "public"."parte" FOR SELECT USING (("public"."fn_rol_actual"() = 'jefe_rectificado'::"public"."rol_usuario"));



COMMENT ON POLICY "parte_select_jefe_rectificado" ON "public"."parte" IS 'Rol de rectificado: solo lectura, vía las vistas v_rectificado_*. Sin INSERT/UPDATE/DELETE — no gestiona ningún dato, solo consulta.';



CREATE POLICY "parte_select_todos" ON "public"."parte" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'jefe'::"public"."rol_usuario", 'produccion'::"public"."rol_usuario", 'calidad'::"public"."rol_usuario", 'operario'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario", 'pantalla'::"public"."rol_usuario"])));



CREATE POLICY "parte_update_operario_verificacion" ON "public"."parte" FOR UPDATE USING (("operario_id" = "auth"."uid"())) WITH CHECK (("operario_id" = "auth"."uid"()));



COMMENT ON POLICY "parte_update_operario_verificacion" ON "public"."parte" IS 'Permite a "Mi línea" (03-rol-operario.md 5.X) que el operario asignado a la línea+turno actualice sus propias columnas de verificación (*_operario). Restricción por fila (operario_id), no por columna — mismo criterio que el resto de policies del proyecto.';



CREATE POLICY "parte_update_responsable_propio_pendiente" ON "public"."parte" FOR UPDATE TO "authenticated" USING ((("responsable_id" = "auth"."uid"()) AND ("completado" = false))) WITH CHECK (("responsable_id" = "auth"."uid"()));



CREATE POLICY "parte_update_vigente_responsable_ventana" ON "public"."parte" FOR UPDATE TO "authenticated" USING ((("responsable_id" = "auth"."uid"()) AND ("completado" = true) AND ("vigente" = true) AND ("completado_at" > ("now"() - '01:00:00'::interval)))) WITH CHECK (("responsable_id" = "auth"."uid"()));



ALTER TABLE "public"."personaje_rpg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "personaje_rpg_insert_admin" ON "public"."personaje_rpg" FOR INSERT WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



COMMENT ON POLICY "personaje_rpg_insert_admin" ON "public"."personaje_rpg" IS 'Solo administrador puede insertar directamente (uso excepcional/depuración) — el flujo real de generación de personajes pasa por la Edge Function generar-personaje, que usa service_role y por tanto no depende de esta política para nada. Antes (hasta 27/09/2026) cualquier usuario podía insertar una fila arbitraria con su propio usuario_id, sin pasar por la validación de generaciones disponibles.';



CREATE POLICY "personaje_rpg_select" ON "public"."personaje_rpg" FOR SELECT USING ((("usuario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))));



CREATE POLICY "personaje_rpg_update_propia" ON "public"."personaje_rpg" FOR UPDATE USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."personaje_stats_nivel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "personaje_stats_nivel_select" ON "public"."personaje_stats_nivel" FOR SELECT USING ((("usuario_id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))));



ALTER TABLE "public"."producto" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "producto_admin_todo" ON "public"."producto" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "producto_select_autenticados" ON "public"."producto" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."programacion_nota" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programacion_nota_frase" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programacion_nota_frase_select" ON "public"."programacion_nota_frase" FOR SELECT TO "authenticated" USING ((COALESCE(("public"."fn_rol_actual"())::"text", ''::"text") = ANY (ARRAY['jefe'::"text", 'responsable'::"text", 'produccion'::"text", 'administrador'::"text"])));



CREATE POLICY "programacion_nota_select" ON "public"."programacion_nota" FOR SELECT TO "authenticated" USING ((COALESCE(("public"."fn_rol_actual"())::"text", ''::"text") = ANY (ARRAY['jefe'::"text", 'responsable'::"text", 'produccion'::"text", 'administrador'::"text"])));



ALTER TABLE "public"."programacion_orden" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programacion_orden_historico" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programacion_orden_historico_select" ON "public"."programacion_orden_historico" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "programacion_orden_historico_select_ampliada" ON "public"."programacion_orden_historico" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'produccion'::"public"."rol_usuario"])));



CREATE POLICY "programacion_orden_select" ON "public"."programacion_orden" FOR SELECT USING (("public"."fn_rol_actual"() = ANY (ARRAY['jefe'::"public"."rol_usuario", 'responsable'::"public"."rol_usuario", 'produccion'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."puntos_metros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "puntos_metros_admin_todo" ON "public"."puntos_metros" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "puntos_metros_select_autenticados" ON "public"."puntos_metros" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."puntos_piezas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "puntos_piezas_admin_todo" ON "public"."puntos_piezas" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "puntos_piezas_select_autenticados" ON "public"."puntos_piezas" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."puntos_rendimiento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "puntos_rendimiento_admin_todo" ON "public"."puntos_rendimiento" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



ALTER TABLE "public"."puntos_rendimiento_responsable" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "puntos_rendimiento_responsable_admin_todo" ON "public"."puntos_rendimiento_responsable" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "puntos_rendimiento_responsable_select_autenticados" ON "public"."puntos_rendimiento_responsable" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "puntos_rendimiento_select_autenticados" ON "public"."puntos_rendimiento" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."refuerzo_operario_turno" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refuerzo_operario_turno_delete" ON "public"."refuerzo_operario_turno" FOR DELETE USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



CREATE POLICY "refuerzo_operario_turno_insert" ON "public"."refuerzo_operario_turno" FOR INSERT WITH CHECK ((("habilitado_por" = "auth"."uid"()) AND ("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))));



CREATE POLICY "refuerzo_operario_turno_select" ON "public"."refuerzo_operario_turno" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "solo service_role inserta logs de ceria" ON "public"."ceria_tool_logs" FOR INSERT WITH CHECK (false);



ALTER TABLE "public"."turno" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "turno_admin_todo" ON "public"."turno" USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")) WITH CHECK (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "turno_insert_responsable_suplente" ON "public"."turno" FOR INSERT TO "authenticated" WITH CHECK (
CASE "public"."fn_rol_actual"()
    WHEN 'responsable'::"public"."rol_usuario" THEN ("tipo" = "public"."fn_turno_de_letra"("fecha", ( SELECT "usuario"."letra"
       FROM "public"."usuario"
      WHERE ("usuario"."id" = "auth"."uid"()))))
    WHEN 'suplente'::"public"."rol_usuario" THEN true
    ELSE false
END);



CREATE POLICY "turno_select_autenticados" ON "public"."turno" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "turno_update_responsable" ON "public"."turno" FOR UPDATE USING (("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario"])));



COMMENT ON POLICY "turno_update_responsable" ON "public"."turno" IS 'Deliberadamente amplia (cualquier responsable/suplente puede tocar cualquier turno, no solo "el suyo") — turno no tiene un dueño individual real, lo comparten los relevos de un mismo día. Revisar si algún día hace falta restringir más.';



ALTER TABLE "public"."unidad_intercambiable" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unidad_intercambiable_mecanico_admin_todo" ON "public"."unidad_intercambiable" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."unidad_movimiento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unidad_movimiento_mecanico_admin_todo" ON "public"."unidad_movimiento" USING (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"]))) WITH CHECK (("public"."fn_rol_actual"() = ANY (ARRAY['mecanico'::"public"."rol_usuario", 'administrador'::"public"."rol_usuario"])));



ALTER TABLE "public"."usuario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuario_select_operarios_para_responsable" ON "public"."usuario" FOR SELECT TO "authenticated" USING ((("rol" = 'operario'::"public"."rol_usuario") AND ("public"."fn_rol_actual"() = ANY (ARRAY['responsable'::"public"."rol_usuario", 'suplente'::"public"."rol_usuario"]))));



CREATE POLICY "usuario_select_propio" ON "public"."usuario" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario")));



CREATE POLICY "usuario_select_roles_conocidos" ON "public"."usuario" FOR SELECT USING (("public"."fn_rol_actual"() IS NOT NULL));



COMMENT ON POLICY "usuario_select_roles_conocidos" ON "public"."usuario" IS 'Cualquier rol conocido puede leer usuario — necesario para los embeds de PostgREST del Ranking (usuario:operario_id(username)) y de la Vista Detallada del jefe, que van contra la tabla con la RLS de quien consulta. Expone también rol/letra (públicos de facto en fábrica) — compromiso documentado 24/08/2026, RLS por fila no permite restringir columnas. Se SUMA a usuario_select_propio y usuario_select_operarios_para_responsable (que quedan redundantes pero inofensivas).';



CREATE POLICY "usuario_update_admin" ON "public"."usuario" FOR UPDATE USING (("public"."fn_rol_actual"() = 'administrador'::"public"."rol_usuario"));



CREATE POLICY "usuarios ven sus propios logs de ceria" ON "public"."ceria_tool_logs" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."rol" = 'administrador'::"public"."rol_usuario"))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_mensajes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."historial_ciclos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notificaciones";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."parte";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."turno";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "public"."actualizar_tono_calibre"("p_numero_orden" "text", "p_tono" "text", "p_calibre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_tono_calibre"("p_numero_orden" "text", "p_tono" "text", "p_calibre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_tono_calibre"("p_numero_orden" "text", "p_tono" "text", "p_calibre" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."anadir_nota_ordenes"("p_ordenes" "text"[], "p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anadir_nota_ordenes"("p_ordenes" "text"[], "p_texto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anadir_nota_ordenes"("p_ordenes" "text"[], "p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."borrar_nota"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."borrar_nota"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."borrar_nota"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."calidad_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calidad_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calidad_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."calidad_lote_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_numero_orden" "text", "p_orden_calidad" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calidad_lote_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_numero_orden" "text", "p_orden_calidad" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calidad_lote_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_numero_orden" "text", "p_orden_calidad" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."calidad_modelo_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_nombre_modelo" "text", "p_formato" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calidad_modelo_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_nombre_modelo" "text", "p_formato" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calidad_modelo_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_nombre_modelo" "text", "p_formato" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirmar_programacion"("p_fecha" "date", "p_filas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_programacion"("p_fecha" "date", "p_filas" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_programacion"("p_fecha" "date", "p_filas" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cruzar_orden_captura"("p_numero_orden" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cruzar_orden_captura"("p_numero_orden" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cruzar_orden_captura"("p_numero_orden" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."deshacer_ultima_programacion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deshacer_ultima_programacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."deshacer_ultima_programacion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."diff_programacion"("p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."diff_programacion"("p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diff_programacion"("p_fecha" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."editar_nota"("p_id" "uuid", "p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."editar_nota"("p_id" "uuid", "p_texto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."editar_nota"("p_id" "uuid", "p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."existe_csv_programacion"("p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."existe_csv_programacion"("p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."existe_csv_programacion"("p_fecha" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_almacen_pedido_linea_recibida"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_almacen_pedido_linea_recibida"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_almacen_pedido_linea_recibida"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_bloquear_ascenso_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_bloquear_ascenso_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_bloquear_ascenso_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_bloquear_turno_en_cierre"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_bloquear_turno_en_cierre"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_bloquear_turno_en_cierre"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_buscar_marca_similar"("p_nombre_normalizado" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_buscar_marca_similar"("p_nombre_normalizado" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_buscar_marca_similar"("p_nombre_normalizado" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_buscar_modelo_similar"("p_nombre_normalizado" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_buscar_modelo_similar"("p_nombre_normalizado" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_buscar_modelo_similar"("p_nombre_normalizado" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_calcular_calibre_com_pct"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_calcular_calibre_com_pct"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_calibre_com_pct"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_cerrar_ciclos_pendientes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_cerrar_ciclos_pendientes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_cerrar_lote_si_completo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_cerrar_lote_si_completo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_chat_acceso"("p_tipo_chat" "text", "p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_chat_acceso"("p_tipo_chat" "text", "p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_chat_acceso"("p_tipo_chat" "text", "p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_ciclo_id"("p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_ciclo_id"("p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ciclo_id"("p_fecha" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_ciclo_rango"("p_cycle_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_ciclo_rango"("p_cycle_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ciclo_rango"("p_cycle_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_consumir_generacion"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_consumir_generacion"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_consumir_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_consumir_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_devolver_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_devolver_generacion_nivel"("p_usuario_id" "uuid", "p_nivel_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_disparar_informe_periodo"("p_tipo" "text", "p_desde" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_disparar_informe_periodo"("p_tipo" "text", "p_desde" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_disparar_resumen_calidad"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_disparar_resumen_calidad"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_disparar_resumen_turno"("p_turno_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_disparar_resumen_turno"("p_turno_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_disparar_resumen_turno"("p_turno_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_encolar_informes_periodo_pendientes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_encolar_informes_periodo_pendientes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_encolar_resumenes_turno_pendientes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_encolar_resumenes_turno_pendientes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_fabrica_cerrada"("p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_fabrica_cerrada"("p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_fabrica_cerrada"("p_fecha" "date") TO "service_role";



GRANT ALL ON TABLE "public"."personaje_rpg" TO "anon";
GRANT ALL ON TABLE "public"."personaje_rpg" TO "authenticated";
GRANT ALL ON TABLE "public"."personaje_rpg" TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_guardar_personaje_generado"("p_usuario_id" "uuid", "p_nivel_id" "uuid", "p_imagen_url" "text", "p_historia" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_guardar_personaje_generado"("p_usuario_id" "uuid", "p_nivel_id" "uuid", "p_imagen_url" "text", "p_historia" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_incidencia_produccion_restringir_columnas_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_incidencia_produccion_restringir_columnas_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_incidencia_produccion_restringir_columnas_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_letra_de_turno"("p_fecha" "date", "p_tipo" "public"."tipo_turno") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_letra_de_turno"("p_fecha" "date", "p_tipo" "public"."tipo_turno") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_letra_de_turno"("p_fecha" "date", "p_tipo" "public"."tipo_turno") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_marcar_corregido_no_vigente"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_marcar_corregido_no_vigente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_marcar_corregido_no_vigente"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_metros_entero"("p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_metros_entero"("p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_nivel_actual"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_nivel_actual"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_normalizar_texto"("p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_normalizar_texto"("p_texto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalizar_texto"("p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_notificar_telegram"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_telegram"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notificar_telegram"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_otorgar_bonus_nivel"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_otorgar_bonus_nivel"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_otorgar_bonus_nivel"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_otorgar_generaciones_por_nivel"("p_usuario_id" "uuid", "p_cantidad" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_otorgar_generaciones_por_nivel"("p_usuario_id" "uuid", "p_cantidad" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_parte_reabre_lote"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_parte_reabre_lote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_parte_reabre_lote"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_parte_restringir_columnas_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_parte_restringir_columnas_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_parte_restringir_columnas_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_parte_set_formato_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_parte_set_formato_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_parte_set_formato_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_parte_validar_correccion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_parte_validar_correccion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_parte_validar_correccion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_reabrir_lote_si_finalizado"("p_lote_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_reabrir_lote_si_finalizado"("p_lote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reabrir_lote_si_finalizado"("p_lote_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_rol_actual"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_rol_actual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_rol_actual"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_seleccionar_personaje"("p_personaje_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_seleccionar_personaje"("p_personaje_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_seleccionar_personaje"("p_personaje_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_set_nombre_normalizado_marca"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_set_nombre_normalizado_marca"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_nombre_normalizado_marca"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_set_nombre_normalizado_modelo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_set_nombre_normalizado_modelo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_nombre_normalizado_modelo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_trigger_resumen_turno_cierre"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_trigger_resumen_turno_cierre"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_trigger_resumen_turno_cierre"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_turno_de_letra"("p_fecha" "date", "p_letra" "public"."letra_turno") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_turno_de_letra"("p_fecha" "date", "p_letra" "public"."letra_turno") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_turno_de_letra"("p_fecha" "date", "p_letra" "public"."letra_turno") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_frase"("p_id" "uuid", "p_texto" "text", "p_activa" boolean, "p_orden" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_frase"("p_id" "uuid", "p_texto" "text", "p_activa" boolean, "p_orden" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_frase"("p_id" "uuid", "p_texto" "text", "p_activa" boolean, "p_orden" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_muestra_excel"("p_titulo" "text", "p_contenido" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_muestra_excel"("p_titulo" "text", "p_contenido" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_muestra_excel"("p_titulo" "text", "p_contenido" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_programacion_csv"("p_fecha" "date", "p_contenido" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_programacion_csv"("p_fecha" "date", "p_contenido" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_programacion_csv"("p_fecha" "date", "p_contenido" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."parse_programacion"("p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."parse_programacion"("p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_programacion"("p_fecha" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."produccion_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."produccion_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."produccion_linea_por_fecha"("p_fecha_desde" "date", "p_fecha_hasta" "date", "p_linea_nombre" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at_programacion_nota"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at_programacion_nota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_programacion_nota"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at_programacion_orden"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at_programacion_orden"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_programacion_orden"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_programacion"("p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_programacion"("p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_programacion"("p_fecha" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."admin_notas" TO "anon";
GRANT ALL ON TABLE "public"."admin_notas" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notas" TO "service_role";



GRANT ALL ON TABLE "public"."almacen_categoria" TO "anon";
GRANT ALL ON TABLE "public"."almacen_categoria" TO "authenticated";
GRANT ALL ON TABLE "public"."almacen_categoria" TO "service_role";



GRANT ALL ON TABLE "public"."almacen_movimiento" TO "anon";
GRANT ALL ON TABLE "public"."almacen_movimiento" TO "authenticated";
GRANT ALL ON TABLE "public"."almacen_movimiento" TO "service_role";



GRANT ALL ON TABLE "public"."almacen_pedido" TO "anon";
GRANT ALL ON TABLE "public"."almacen_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."almacen_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."almacen_pedido_linea" TO "anon";
GRANT ALL ON TABLE "public"."almacen_pedido_linea" TO "authenticated";
GRANT ALL ON TABLE "public"."almacen_pedido_linea" TO "service_role";



GRANT ALL ON TABLE "public"."almacen_proveedor" TO "anon";
GRANT ALL ON TABLE "public"."almacen_proveedor" TO "authenticated";
GRANT ALL ON TABLE "public"."almacen_proveedor" TO "service_role";



GRANT ALL ON TABLE "public"."almacen_repuesto" TO "anon";
GRANT ALL ON TABLE "public"."almacen_repuesto" TO "authenticated";
GRANT ALL ON TABLE "public"."almacen_repuesto" TO "service_role";



GRANT ALL ON TABLE "public"."almacen_repuesto_referencia" TO "anon";
GRANT ALL ON TABLE "public"."almacen_repuesto_referencia" TO "authenticated";
GRANT ALL ON TABLE "public"."almacen_repuesto_referencia" TO "service_role";



GRANT ALL ON TABLE "public"."app_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."asignacion_operario_linea" TO "anon";
GRANT ALL ON TABLE "public"."asignacion_operario_linea" TO "authenticated";
GRANT ALL ON TABLE "public"."asignacion_operario_linea" TO "service_role";



GRANT ALL ON TABLE "public"."ceria_conversaciones" TO "anon";
GRANT ALL ON TABLE "public"."ceria_conversaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."ceria_conversaciones" TO "service_role";



GRANT ALL ON TABLE "public"."ceria_documentacion_maquina" TO "anon";
GRANT ALL ON TABLE "public"."ceria_documentacion_maquina" TO "authenticated";
GRANT ALL ON TABLE "public"."ceria_documentacion_maquina" TO "service_role";



GRANT ALL ON TABLE "public"."ceria_mensajes" TO "anon";
GRANT ALL ON TABLE "public"."ceria_mensajes" TO "authenticated";
GRANT ALL ON TABLE "public"."ceria_mensajes" TO "service_role";



GRANT ALL ON TABLE "public"."ceria_modelo_activo" TO "anon";
GRANT ALL ON TABLE "public"."ceria_modelo_activo" TO "authenticated";
GRANT ALL ON TABLE "public"."ceria_modelo_activo" TO "service_role";



GRANT ALL ON TABLE "public"."ceria_prompts" TO "anon";
GRANT ALL ON TABLE "public"."ceria_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."ceria_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."ceria_tool_logs" TO "anon";
GRANT ALL ON TABLE "public"."ceria_tool_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ceria_tool_logs" TO "service_role";



GRANT ALL ON TABLE "public"."chat_acceso" TO "anon";
GRANT ALL ON TABLE "public"."chat_acceso" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_acceso" TO "service_role";



GRANT ALL ON TABLE "public"."chat_mensajes" TO "anon";
GRANT ALL ON TABLE "public"."chat_mensajes" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_mensajes" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."cierre_fabrica" TO "anon";
GRANT ALL ON TABLE "public"."cierre_fabrica" TO "authenticated";
GRANT ALL ON TABLE "public"."cierre_fabrica" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion" TO "anon";
GRANT ALL ON TABLE "public"."configuracion" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion" TO "service_role";



GRANT ALL ON TABLE "public"."engrase_parte" TO "anon";
GRANT ALL ON TABLE "public"."engrase_parte" TO "authenticated";
GRANT ALL ON TABLE "public"."engrase_parte" TO "service_role";



GRANT ALL ON TABLE "public"."engrase_parte_punto" TO "anon";
GRANT ALL ON TABLE "public"."engrase_parte_punto" TO "authenticated";
GRANT ALL ON TABLE "public"."engrase_parte_punto" TO "service_role";



GRANT ALL ON TABLE "public"."engrase_punto" TO "anon";
GRANT ALL ON TABLE "public"."engrase_punto" TO "authenticated";
GRANT ALL ON TABLE "public"."engrase_punto" TO "service_role";



GRANT ALL ON TABLE "public"."formato" TO "anon";
GRANT ALL ON TABLE "public"."formato" TO "authenticated";
GRANT ALL ON TABLE "public"."formato" TO "service_role";



GRANT ALL ON TABLE "public"."historial_ciclo_responsable" TO "anon";
GRANT ALL ON TABLE "public"."historial_ciclo_responsable" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_ciclo_responsable" TO "service_role";



GRANT ALL ON TABLE "public"."historial_ciclos" TO "anon";
GRANT ALL ON TABLE "public"."historial_ciclos" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_ciclos" TO "service_role";



GRANT ALL ON TABLE "public"."incidencia_calidad" TO "anon";
GRANT ALL ON TABLE "public"."incidencia_calidad" TO "authenticated";
GRANT ALL ON TABLE "public"."incidencia_calidad" TO "service_role";



GRANT ALL ON TABLE "public"."incidencia_produccion" TO "anon";
GRANT ALL ON TABLE "public"."incidencia_produccion" TO "authenticated";
GRANT ALL ON TABLE "public"."incidencia_produccion" TO "service_role";



GRANT ALL ON TABLE "public"."informe_periodo" TO "anon";
GRANT ALL ON TABLE "public"."informe_periodo" TO "authenticated";
GRANT ALL ON TABLE "public"."informe_periodo" TO "service_role";



GRANT ALL ON TABLE "public"."linea" TO "anon";
GRANT ALL ON TABLE "public"."linea" TO "authenticated";
GRANT ALL ON TABLE "public"."linea" TO "service_role";



GRANT ALL ON TABLE "public"."logros_definicion" TO "anon";
GRANT ALL ON TABLE "public"."logros_definicion" TO "authenticated";
GRANT ALL ON TABLE "public"."logros_definicion" TO "service_role";



GRANT ALL ON TABLE "public"."lote" TO "anon";
GRANT ALL ON TABLE "public"."lote" TO "authenticated";
GRANT ALL ON TABLE "public"."lote" TO "service_role";



GRANT ALL ON TABLE "public"."marca" TO "anon";
GRANT ALL ON TABLE "public"."marca" TO "authenticated";
GRANT ALL ON TABLE "public"."marca" TO "service_role";



GRANT ALL ON TABLE "public"."modelo" TO "anon";
GRANT ALL ON TABLE "public"."modelo" TO "authenticated";
GRANT ALL ON TABLE "public"."modelo" TO "service_role";



GRANT ALL ON TABLE "public"."niveles" TO "anon";
GRANT ALL ON TABLE "public"."niveles" TO "authenticated";
GRANT ALL ON TABLE "public"."niveles" TO "service_role";



GRANT ALL ON TABLE "public"."notificacion_estado_usuario" TO "anon";
GRANT ALL ON TABLE "public"."notificacion_estado_usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacion_estado_usuario" TO "service_role";



GRANT ALL ON TABLE "public"."notificacion_preferencias" TO "anon";
GRANT ALL ON TABLE "public"."notificacion_preferencias" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacion_preferencias" TO "service_role";



GRANT ALL ON TABLE "public"."notificacion_silencio" TO "anon";
GRANT ALL ON TABLE "public"."notificacion_silencio" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacion_silencio" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."operario_checklist" TO "anon";
GRANT ALL ON TABLE "public"."operario_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."operario_checklist" TO "service_role";



GRANT ALL ON TABLE "public"."parte" TO "anon";
GRANT ALL ON TABLE "public"."parte" TO "authenticated";
GRANT ALL ON TABLE "public"."parte" TO "service_role";



GRANT ALL ON TABLE "public"."turno" TO "anon";
GRANT ALL ON TABLE "public"."turno" TO "authenticated";
GRANT ALL ON TABLE "public"."turno" TO "service_role";



GRANT ALL ON TABLE "public"."operario_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."operario_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."personaje_stats_nivel" TO "anon";
GRANT ALL ON TABLE "public"."personaje_stats_nivel" TO "authenticated";
GRANT ALL ON TABLE "public"."personaje_stats_nivel" TO "service_role";



GRANT ALL ON TABLE "public"."producto" TO "anon";
GRANT ALL ON TABLE "public"."producto" TO "authenticated";
GRANT ALL ON TABLE "public"."producto" TO "service_role";



GRANT ALL ON TABLE "public"."programacion_orden" TO "service_role";
GRANT SELECT ON TABLE "public"."programacion_orden" TO "authenticated";



GRANT ALL ON TABLE "public"."programacion_con_estado" TO "authenticated";
GRANT ALL ON TABLE "public"."programacion_con_estado" TO "service_role";



GRANT ALL ON TABLE "public"."programacion_nota" TO "service_role";
GRANT SELECT ON TABLE "public"."programacion_nota" TO "authenticated";



GRANT ALL ON TABLE "public"."programacion_nota_frase" TO "service_role";
GRANT SELECT ON TABLE "public"."programacion_nota_frase" TO "authenticated";



GRANT ALL ON TABLE "public"."programacion_orden_historico" TO "service_role";
GRANT SELECT ON TABLE "public"."programacion_orden_historico" TO "authenticated";



GRANT ALL ON TABLE "public"."puntos_metros" TO "anon";
GRANT ALL ON TABLE "public"."puntos_metros" TO "authenticated";
GRANT ALL ON TABLE "public"."puntos_metros" TO "service_role";



GRANT ALL ON TABLE "public"."puntos_piezas" TO "anon";
GRANT ALL ON TABLE "public"."puntos_piezas" TO "authenticated";
GRANT ALL ON TABLE "public"."puntos_piezas" TO "service_role";



GRANT ALL ON TABLE "public"."puntos_rendimiento" TO "anon";
GRANT ALL ON TABLE "public"."puntos_rendimiento" TO "authenticated";
GRANT ALL ON TABLE "public"."puntos_rendimiento" TO "service_role";



GRANT ALL ON TABLE "public"."puntos_rendimiento_responsable" TO "anon";
GRANT ALL ON TABLE "public"."puntos_rendimiento_responsable" TO "authenticated";
GRANT ALL ON TABLE "public"."puntos_rendimiento_responsable" TO "service_role";



GRANT ALL ON TABLE "public"."refuerzo_operario_turno" TO "anon";
GRANT ALL ON TABLE "public"."refuerzo_operario_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."refuerzo_operario_turno" TO "service_role";



GRANT ALL ON TABLE "public"."unidad_intercambiable" TO "anon";
GRANT ALL ON TABLE "public"."unidad_intercambiable" TO "authenticated";
GRANT ALL ON TABLE "public"."unidad_intercambiable" TO "service_role";



GRANT ALL ON TABLE "public"."unidad_movimiento" TO "anon";
GRANT ALL ON TABLE "public"."unidad_movimiento" TO "authenticated";
GRANT ALL ON TABLE "public"."unidad_movimiento" TO "service_role";



GRANT ALL ON TABLE "public"."usuario" TO "anon";
GRANT ALL ON TABLE "public"."usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."usuario" TO "service_role";



GRANT ALL ON TABLE "public"."v_metros_responsable_por_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_metros_responsable_por_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_operarios_linea_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_operarios_linea_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_piezas_formato_linea_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_piezas_formato_linea_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_limpieza_operario_por_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_limpieza_operario_por_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_limpieza_operario_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_limpieza_operario_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_metros_responsable_por_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_metros_responsable_por_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_metros_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_metros_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_piezas_linea_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_piezas_linea_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_piezas_operario_por_linea_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_piezas_operario_por_linea_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_piezas_operario_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_piezas_operario_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_rendimiento_linea_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_rendimiento_linea_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_rendimiento_linea_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_rendimiento_linea_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_rendimiento_operario_por_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_rendimiento_operario_por_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_rendimiento_operario_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_rendimiento_operario_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_operario_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_operario_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_operario_total_vida" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_operario_total_vida" TO "service_role";



GRANT ALL ON TABLE "public"."v_rendimiento_responsable_por_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_rendimiento_responsable_por_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_rendimiento_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_rendimiento_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_responsable_total_vida" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_responsable_total_vida" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_usuarios_gamificacion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_usuarios_gamificacion" TO "service_role";



GRANT ALL ON TABLE "public"."v_alimentacion_turno_linea" TO "authenticated";
GRANT ALL ON TABLE "public"."v_alimentacion_turno_linea" TO "service_role";



GRANT ALL ON TABLE "public"."v_almacen_pedido_estado" TO "authenticated";
GRANT ALL ON TABLE "public"."v_almacen_pedido_estado" TO "service_role";



GRANT ALL ON TABLE "public"."v_almacen_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."v_almacen_stock" TO "service_role";



GRANT ALL ON TABLE "public"."v_avatar_activo_operario" TO "authenticated";
GRANT ALL ON TABLE "public"."v_avatar_activo_operario" TO "service_role";



GRANT ALL ON TABLE "public"."v_calidad_lote" TO "authenticated";
GRANT ALL ON TABLE "public"."v_calidad_lote" TO "service_role";



GRANT ALL ON TABLE "public"."v_calidad_modelo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_calidad_modelo" TO "service_role";



GRANT ALL ON TABLE "public"."v_calidad_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_calidad_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_ceria_uso_herramientas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ceria_uso_herramientas" TO "service_role";



GRANT ALL ON TABLE "public"."v_equipo_avatar_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_equipo_avatar_stats" TO "service_role";



GRANT ALL ON TABLE "public"."v_ganador_por_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ganador_por_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_ganador_por_ciclo_responsable" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ganador_por_ciclo_responsable" TO "service_role";



GRANT ALL ON TABLE "public"."v_lote_pendiente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lote_pendiente" TO "service_role";



GRANT ALL ON TABLE "public"."v_lote_gestion" TO "service_role";
GRANT SELECT ON TABLE "public"."v_lote_gestion" TO "authenticated";



GRANT ALL ON TABLE "public"."v_metros_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_metros_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_mi_mejor_parte_por_formato" TO "authenticated";
GRANT ALL ON TABLE "public"."v_mi_mejor_parte_por_formato" TO "service_role";



GRANT ALL ON TABLE "public"."v_niveles_disponibles_generar" TO "authenticated";
GRANT ALL ON TABLE "public"."v_niveles_disponibles_generar" TO "service_role";



GRANT ALL ON TABLE "public"."v_operarios_de_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_operarios_de_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_partes_operario_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_partes_operario_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_piezas_operario_formato_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_piezas_operario_formato_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_produccion_operario_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_produccion_operario_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_produccion_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_produccion_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_equipo_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_equipo_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_limpieza_operario_total_vida" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_limpieza_operario_total_vida" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_piezas_operario_total_vida" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_piezas_operario_total_vida" TO "service_role";



GRANT ALL ON TABLE "public"."v_puntos_rendimiento_operario_total_vida" TO "authenticated";
GRANT ALL ON TABLE "public"."v_puntos_rendimiento_operario_total_vida" TO "service_role";



GRANT ALL ON TABLE "public"."v_rectificado_modelo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_rectificado_modelo" TO "service_role";



GRANT ALL ON TABLE "public"."v_rectificado_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."v_rectificado_turno" TO "service_role";



GRANT ALL ON TABLE "public"."v_rey_formato_actual" TO "authenticated";
GRANT ALL ON TABLE "public"."v_rey_formato_actual" TO "service_role";



GRANT ALL ON TABLE "public"."v_rey_formato_historico" TO "authenticated";
GRANT ALL ON TABLE "public"."v_rey_formato_historico" TO "service_role";



GRANT ALL ON TABLE "public"."v_tiempo_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tiempo_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_stats_vida" TO "authenticated";
GRANT ALL ON TABLE "public"."v_stats_vida" TO "service_role";



GRANT ALL ON TABLE "public"."v_turnos_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_turnos_responsable_ciclo" TO "service_role";



GRANT ALL ON TABLE "public"."v_unidad_ubicacion_actual" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unidad_ubicacion_actual" TO "service_role";



GRANT ALL ON TABLE "public"."v_veces_lider_indiscutible" TO "authenticated";
GRANT ALL ON TABLE "public"."v_veces_lider_indiscutible" TO "service_role";



GRANT ALL ON TABLE "public"."v_veces_rey_de_reyes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_veces_rey_de_reyes" TO "service_role";



GRANT ALL ON TABLE "public"."v_verificaciones_codbar_responsable_ciclo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_verificaciones_codbar_responsable_ciclo" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC;





























-- Jobs de pg_cron (no los incluye db dump; copiados de cron.job, 2026-10-06)
select cron.schedule('cerrar-ciclos-pendientes', '0 * * * 1',
  $c$select fn_cerrar_ciclos_pendientes() where extract(hour from (now() at time zone 'Europe/Madrid')) = 8;$c$);
select cron.schedule('informes-periodo-pendientes', '30 * * * *',
  $c$select fn_encolar_informes_periodo_pendientes();$c$);
select cron.schedule('resumen-calidad-diario', '0 * * * *',
  $c$select fn_disparar_resumen_calidad() where extract(hour from (now() at time zone 'Europe/Madrid')) in (7, 15, 23);$c$);
select cron.schedule('resumenes-turno-pendientes', '0 * * * *',
  $c$select fn_encolar_resumenes_turno_pendientes();$c$);

-- Ajuste de privilegios: el Supabase local concede por defecto MAINTAIN, REFERENCES,
-- TRIGGER y TRUNCATE (y SELECT/DML a anon en vistas) a anon/authenticated al crear cada objeto,
-- y producción no los tiene. Generado comparando las ACL de producción (pg_class.relacl) el 2026-10-06.
REVOKE ALL ON TABLE public.app_secrets FROM anon;
REVOKE ALL ON TABLE public.programacion_nota FROM anon;
REVOKE ALL ON TABLE public.programacion_nota_frase FROM anon;
REVOKE ALL ON TABLE public.programacion_orden FROM anon;
REVOKE ALL ON TABLE public.programacion_orden_historico FROM anon;
REVOKE ALL ON TABLE public.app_secrets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.programacion_nota FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.programacion_nota_frase FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.programacion_orden FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.programacion_orden_historico FROM authenticated;
REVOKE ALL ON TABLE public.operario_ledger FROM anon;
REVOKE ALL ON TABLE public.programacion_con_estado FROM anon;
REVOKE ALL ON TABLE public.v_admin_usuarios_gamificacion FROM anon;
REVOKE ALL ON TABLE public.v_alimentacion_turno_linea FROM anon;
REVOKE ALL ON TABLE public.v_almacen_pedido_estado FROM anon;
REVOKE ALL ON TABLE public.v_almacen_stock FROM anon;
REVOKE ALL ON TABLE public.v_avatar_activo_operario FROM anon;
REVOKE ALL ON TABLE public.v_calidad_lote FROM anon;
REVOKE ALL ON TABLE public.v_calidad_modelo FROM anon;
REVOKE ALL ON TABLE public.v_calidad_turno FROM anon;
REVOKE ALL ON TABLE public.v_ceria_uso_herramientas FROM anon;
REVOKE ALL ON TABLE public.v_equipo_avatar_stats FROM anon;
REVOKE ALL ON TABLE public.v_ganador_por_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_ganador_por_ciclo_responsable FROM anon;
REVOKE ALL ON TABLE public.v_lote_gestion FROM anon;
REVOKE ALL ON TABLE public.v_lote_pendiente FROM anon;
REVOKE ALL ON TABLE public.v_metros_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_metros_responsable_por_turno FROM anon;
REVOKE ALL ON TABLE public.v_mi_mejor_parte_por_formato FROM anon;
REVOKE ALL ON TABLE public.v_niveles_disponibles_generar FROM anon;
REVOKE ALL ON TABLE public.v_operarios_de_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_operarios_linea_turno FROM anon;
REVOKE ALL ON TABLE public.v_partes_operario_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_piezas_formato_linea_turno FROM anon;
REVOKE ALL ON TABLE public.v_piezas_operario_formato_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_produccion_operario_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_produccion_turno FROM anon;
REVOKE ALL ON TABLE public.v_puntos_equipo_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_limpieza_operario_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_limpieza_operario_por_turno FROM anon;
REVOKE ALL ON TABLE public.v_puntos_limpieza_operario_total_vida FROM anon;
REVOKE ALL ON TABLE public.v_puntos_metros_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_metros_responsable_por_turno FROM anon;
REVOKE ALL ON TABLE public.v_puntos_operario_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_operario_total_vida FROM anon;
REVOKE ALL ON TABLE public.v_puntos_piezas_linea_turno FROM anon;
REVOKE ALL ON TABLE public.v_puntos_piezas_operario_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_piezas_operario_por_linea_turno FROM anon;
REVOKE ALL ON TABLE public.v_puntos_piezas_operario_total_vida FROM anon;
REVOKE ALL ON TABLE public.v_puntos_rendimiento_linea_turno FROM anon;
REVOKE ALL ON TABLE public.v_puntos_rendimiento_operario_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_rendimiento_operario_por_turno FROM anon;
REVOKE ALL ON TABLE public.v_puntos_rendimiento_operario_total_vida FROM anon;
REVOKE ALL ON TABLE public.v_puntos_rendimiento_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_puntos_responsable_total_vida FROM anon;
REVOKE ALL ON TABLE public.v_rectificado_modelo FROM anon;
REVOKE ALL ON TABLE public.v_rectificado_turno FROM anon;
REVOKE ALL ON TABLE public.v_rendimiento_linea_turno FROM anon;
REVOKE ALL ON TABLE public.v_rendimiento_responsable_por_turno FROM anon;
REVOKE ALL ON TABLE public.v_rey_formato_actual FROM anon;
REVOKE ALL ON TABLE public.v_rey_formato_historico FROM anon;
REVOKE ALL ON TABLE public.v_stats_vida FROM anon;
REVOKE ALL ON TABLE public.v_tiempo_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_turnos_responsable_ciclo FROM anon;
REVOKE ALL ON TABLE public.v_unidad_ubicacion_actual FROM anon;
REVOKE ALL ON TABLE public.v_veces_lider_indiscutible FROM anon;
REVOKE ALL ON TABLE public.v_veces_rey_de_reyes FROM anon;
REVOKE ALL ON TABLE public.v_verificaciones_codbar_responsable_ciclo FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_lote_gestion FROM authenticated;
