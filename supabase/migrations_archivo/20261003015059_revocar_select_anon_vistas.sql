-- 03/10/2026 — Revoca SELECT a anon en las vistas v_* de public.
-- Las vistas no son security_invoker, así que se ejecutan como propietario y se saltan
-- la RLS: con la clave pública, anon leía datos reales (v_produccion_turno, v_calidad_lote,
-- v_almacen_stock...). Ninguna pantalla consulta sin sesión (sin sesión solo se monta
-- Login; el rol 'pantalla' entra con cuenta real). authenticated y service_role no cambian.
do $$
declare
  r record;
begin
  for r in
    select c.oid::regclass as v
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('v', 'm')
      and c.relname like 'v\_%'
  loop
    execute format('revoke all on %s from anon', r.v);
  end loop;
end $$;
