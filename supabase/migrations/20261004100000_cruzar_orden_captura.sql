-- 04/10/2026 — Cruce del Nº de orden leído en Foto 1 contra lotes y programación.
--
-- Contexto: programacion_orden solo es legible por jefe/responsable/produccion/administrador (RLS) y
-- la captura la hace también el suplente. lote/producto/modelo son legibles por cualquier autenticado.
-- Esta RPC (solo lectura, security definer) devuelve lo mínimo para avisar en la revisión de la Foto 1:
--   lote:         lote existente con ese numero_orden y su modelo (o null)
--   programacion: fila de programacion_orden con ese numero_orden y su modelo (o null)
--   parecidos:    hasta 3 órdenes (lotes o programación) de la misma longitud que difieren en UN dígito
-- Guarda con coalesce de rol (rol nulo no pasa); anon sin EXECUTE. Aditiva.

create or replace function cruzar_orden_captura(p_numero_orden text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

  select jsonb_build_object('numero_orden', l.numero_orden, 'modelo', m.nombre)
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
      select distinct on (c.numero_orden) c.numero_orden, c.modelo, c.origen
        from (
          select l.numero_orden, m.nombre as modelo, 'lote'::text as origen
            from lote l
            join producto p on p.id = l.producto_id
            join modelo m on m.id = p.modelo_id
          union all
          select po.numero_orden, po.modelo, 'programacion'::text
            from programacion_orden po
        ) c
       where c.numero_orden <> v_num
         and length(c.numero_orden) = 7
         and (select count(*) from generate_series(1, 7) i
               where substr(c.numero_orden, i, 1) <> substr(v_num, i, 1)) = 1
       order by c.numero_orden, c.origen
       limit 3
    ) x;

  return jsonb_build_object('lote', v_lote, 'programacion', v_prog, 'parecidos', v_parecidos);
end;
$$;

revoke execute on function cruzar_orden_captura(text) from public, anon;
grant execute on function cruzar_orden_captura(text) to authenticated;
