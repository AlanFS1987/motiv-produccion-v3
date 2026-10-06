create or replace function deshacer_ultima_programacion()
returns table (filas_restauradas integer, snapshot_de timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_snapshot jsonb;
  v_creado_en timestamptz;
  v_filas integer;
begin
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  select id, snapshot, creado_en
  into v_id, v_snapshot, v_creado_en
  from programacion_orden_historico
  order by creado_en desc
  limit 1;

  if v_id is null then
    raise exception 'No hay ningún historial que deshacer';
  end if;

  delete from programacion_orden where true;

  insert into programacion_orden (horno, numero_orden, modelo, metros, acabado, cep, caja, posicion, tono, calibre)
  select
    (f->>'horno')::smallint, f->>'numero_orden', f->>'modelo',
    nullif(f->>'metros','')::numeric, f->>'acabado',
    coalesce((f->>'cep')::boolean, false), f->>'caja',
    (f->>'posicion')::integer, nullif(f->>'tono',''), nullif(f->>'calibre','')
  from jsonb_array_elements(v_snapshot) as f;

  get diagnostics v_filas = row_count;

  delete from programacion_orden_historico where id = v_id;

  return query select v_filas, v_creado_en;
end;
$$;

revoke execute on function deshacer_ultima_programacion() from public, anon;
grant execute on function deshacer_ultima_programacion() to authenticated;
