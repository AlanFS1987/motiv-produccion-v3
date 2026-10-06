-- Inventario de objetos y datos de catálogo de la BD (local o producción) para comparar tras un squash o un reset; valores de referencia en memorias/23.
select
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')) funciones,
    (select count(*) from pg_policies where schemaname='public') politicas,
    (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal) triggers,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') tablas,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v') vistas,
    (select count(*) from cron.job) cron_jobs,
    (select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname='supabase_realtime') realtime,
    (select count(*) from ceria_documentacion_maquina) docs,
    (select count(*) from logros_definicion) logros,
    (select count(*) from niveles) niveles,
    (select count(*) from configuracion) config,
    (select count(*) from formato) formatos,
    (select count(*) from linea) lineas,
    (select count(*) from puntos_piezas) puntos_piezas,
    (select count(*) from chat_acceso) chat_acceso,
    (select count(*) from ceria_prompts) prompts;
