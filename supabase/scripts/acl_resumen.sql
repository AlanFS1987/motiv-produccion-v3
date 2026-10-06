-- Resumen de ACL de tablas y vistas de public para anon/authenticated/service_role (nº de grupos y hash): comparar local y producción; ver memorias/23.
-- Se lee de pg_class.relacl, no de information_schema, que depende del rol que consulta.
select count(*) n, md5(coalesce(string_agg(t||'|'||g||'|'||p, E'\n' order by t,g),'')) h from (
 select c.relname t, r.rolname g, string_agg(a.privilege_type, ',' order by a.privilege_type) p
 from pg_class c join pg_namespace n on n.oid=c.relnamespace, aclexplode(c.relacl) a join pg_roles r on r.oid=a.grantee
 where n.nspname='public' and c.relkind in ('r','v','m','p','f') and r.rolname in ('anon','authenticated','service_role')
 group by 1,2) x;

-- Desglose por tipo de objeto y rol, solo para localizar diferencias cuando el hash no coincide.
select c.relkind k, r.rolname g, count(distinct c.relname) rels, string_agg(distinct a.privilege_type, ',' order by a.privilege_type) p
 from pg_class c join pg_namespace n on n.oid=c.relnamespace, aclexplode(c.relacl) a join pg_roles r on r.oid=a.grantee
 where n.nspname='public' and c.relkind in ('r','v','m','p','f') and r.rolname in ('anon','authenticated','service_role')
 group by 1,2 order by 1,2;
