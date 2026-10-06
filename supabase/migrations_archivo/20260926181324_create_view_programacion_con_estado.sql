create view programacion_con_estado as
select
  p.id,
  p.horno,
  p.posicion,
  p.numero_orden,
  p.modelo,
  p.metros,
  p.acabado,
  p.cep,
  p.caja,
  p.tono,
  p.calibre,
  coalesce(l.estado::text, 'pendiente') as estado,
  p.created_at,
  p.updated_at
from programacion_orden p
left join lote l on l.numero_orden = p.numero_orden
order by p.horno, p.posicion;

comment on view programacion_con_estado is 'Vista de consulta (móvil/PDF): programación del día con estado calculado en vivo. pendiente = no existe lote para ese numero_orden; iniciado/finalizado = viene de lote.estado.';
