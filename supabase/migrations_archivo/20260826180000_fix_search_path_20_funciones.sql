-- =============================================================
-- Fix seguridad — search_path fijo en funciones sin especificar
-- (lint Supabase, 26/08/2026).
--
-- Sin search_path fijo, Postgres resuelve nombres de tablas/funciones
-- según el search_path de quien LLAMA a la función, no de quien la
-- definió. Con funciones security definer eso abre la puerta a que
-- alguien con permiso de crear objetos cuele una tabla/función con el
-- mismo nombre en otro esquema que se resuelva antes que la real.
-- Con funciones normales (no definer) el riesgo real es menor, pero
-- fijar search_path = public es la misma corrección mecánica en los
-- dos casos y ya es la convención del proyecto (ver
-- 20260820160000_fix_search_path_funciones.sql, que ya hizo esto
-- mismo para fn_rol_actual y fn_es_responsable_de_turno).
--
-- ALTER FUNCTION ... SET search_path no toca el cuerpo de la función
-- en absoluto — solo fija un parámetro de sesión para cuando se
-- ejecuta. Cero cambio de comportamiento mientras todos los objetos
-- que cada función usa vivan en el esquema public (confirmado: todas
-- las tablas, vistas y la extensión pg_trgm del proyecto están en
-- public hoy).
--
-- Las 6 funciones de trigger sin parámetros (fn_set_nombre_
-- normalizado_modelo, fn_set_nombre_normalizado_marca, fn_calcular_
-- calibre_com_pct, fn_parte_reabre_lote, fn_bloquear_turno_en_cierre,
-- fn_trigger_resumen_turno_cierre, fn_parte_restringir_columnas_
-- update, fn_parte_set_formato_id) tampoco cambian de firma — se
-- identifican solo por su nombre, sin argumentos.
-- =============================================================

alter function fn_set_nombre_normalizado_modelo() set search_path = public;
alter function fn_set_nombre_normalizado_marca() set search_path = public;
alter function fn_calcular_calibre_com_pct() set search_path = public;
alter function fn_parte_reabre_lote() set search_path = public;
alter function fn_fabrica_cerrada(date) set search_path = public;
alter function fn_bloquear_turno_en_cierre() set search_path = public;
alter function fn_reabrir_lote_si_finalizado(uuid) set search_path = public;
alter function fn_letra_de_turno(date, tipo_turno) set search_path = public;
alter function fn_consumir_generacion(uuid) set search_path = public;
alter function fn_otorgar_generaciones_por_nivel(uuid, int) set search_path = public;
alter function fn_buscar_modelo_similar(text) set search_path = public;
alter function fn_buscar_marca_similar(text) set search_path = public;
alter function fn_normalizar_texto(text) set search_path = public;
alter function fn_trigger_resumen_turno_cierre() set search_path = public;
alter function fn_encolar_resumenes_turno_pendientes() set search_path = public;
alter function fn_turno_de_letra(date, letra_turno) set search_path = public;
alter function fn_ciclo_id(date) set search_path = public;
alter function fn_ciclo_rango(int) set search_path = public;
alter function fn_parte_restringir_columnas_update() set search_path = public;
alter function fn_parte_set_formato_id() set search_path = public;
