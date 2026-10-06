-- M1 (02/10/2026): programacion_orden estaba con RLS desactivado y GRANT ALL a anon/authenticated.
-- Toda escritura legítima va por RPC security definer (corren como owner).

-- aplicar_programacion: versión antigua sin security definer ni comprobación de rol,
-- ejecutable por anon/PUBLIC; nadie la usa (repo, funciones, cron). Escribía en la tabla.
drop function if exists aplicar_programacion(date);

alter table programacion_orden enable row level security;

drop policy if exists programacion_orden_select on programacion_orden;
create policy programacion_orden_select on programacion_orden
  for select using (fn_rol_actual() in ('jefe','responsable','produccion','administrador'));
-- Sin políticas de INSERT/UPDATE/DELETE: toda escritura por RPC.

revoke all on programacion_orden from anon, authenticated;
grant select on programacion_orden to authenticated;

-- La vista corre con permisos del owner (convención del proyecto: NO security_invoker),
-- así que filtra por rol dentro de la propia vista.
create or replace view programacion_con_estado as
select
  p.id, p.horno, p.posicion, p.numero_orden, p.modelo, p.metros, p.acabado,
  p.cep, p.caja, p.tono, p.calibre,
  coalesce(l.estado::text, 'pendiente') as estado,
  p.created_at, p.updated_at
from programacion_orden p
left join lote l on l.numero_orden = p.numero_orden
where fn_rol_actual() in ('jefe','responsable','produccion','administrador')
order by p.horno, p.posicion;

revoke all on programacion_con_estado from anon;
grant select on programacion_con_estado to authenticated;
