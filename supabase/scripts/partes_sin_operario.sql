-- Revisión diaria: partes vigentes sin operario. Debe devolver 0 filas (ver memorias/07-pendientes.md).
select t.fecha, t.tipo as turno, l.nombre as linea, p.piezas_entradas as piezas, lo.numero_orden,
       r.username as responsable_del_parte, a.username as abrio_el_turno, p.completado_at, p.id as parte_id
from parte p
join turno t on t.id = p.turno_id
join linea l on l.id = p.linea_id
left join lote lo on lo.id = p.lote_id
left join usuario r on r.id = p.responsable_id
left join usuario a on a.id = t.abierto_por
where p.operario_id is null and p.vigente
order by t.fecha desc, t.tipo, l.nombre;
