-- 04/10/2026 — cruzar_orden_captura: se quita el «limit 10» de los parecidos.
--
-- El límite cortaba vecinos ANTES de que el frontend filtre por «mismo producto»: en zonas densas de
-- órdenes consecutivas el gemelo real podía quedar fuera. Sin límite el resultado queda acotado por
-- construcción (a un dígito de distancia en 7 posiciones hay como máximo 7 x 9 = 63 números posibles).
-- Mismo patrón de seguridad que la versión anterior (security definer, guarda con coalesce de rol,
-- revoke a public/anon, grant a authenticated). Solo cambia el cuerpo; firma y resultado idénticos.

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
$$;

revoke execute on function cruzar_orden_captura(text) from public, anon;
grant execute on function cruzar_orden_captura(text) to authenticated;
