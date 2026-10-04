-- =============================================================
-- Gestión de lotes: cierre automático al cumplirse el objetivo +
-- vista v_lote_gestion para la lista de lotes abiertos.
--
-- Cierre: cuando un parte vigente queda completado, si el lote está
-- 'iniciado', su objetivo_m2 está entre 100 y 50.000, el pendiente
-- (v_lote_pendiente, la misma cuenta que enseña la UI) es 0 y no
-- queda ningún parte vigente sin completar (otra línea produciendo),
-- el lote pasa a 'finalizado'. La reapertura automática
-- (trg_parte_reabre_lote / fn_reabrir_lote_si_finalizado) no se toca:
-- un parte nuevo reabre el lote y se vuelve a evaluar al completarse.
--
-- ORDEN: Postgres dispara los triggers del mismo evento y momento por
-- orden alfabético de nombre. 'trg_parte_z_cerrar_lote_completo' es
-- posterior a 'trg_parte_reabre_lote', así que en un INSERT de un
-- parte ya completado primero se reabre y después se evalúa el cierre.
-- No renombrar a algo anterior a 'trg_parte_reabre_lote'.
--
-- Concurrencia: se bloquea la fila del lote (FOR NO KEY UPDATE, que
-- no choca con el FOR KEY SHARE de la FK del parte) para que dos
-- líneas completando a la vez se evalúen en serie y la segunda vea el
-- commit de la primera.
-- =============================================================

create or replace function fn_cerrar_lote_si_completo()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_objetivo  numeric;
  v_pendiente numeric;
begin
  -- Nunca debe impedir guardar un parte: cualquier fallo se degrada a aviso.
  begin
    perform 1 from lote where id = new.lote_id and estado = 'iniciado' for no key update;
    if not found then
      return new;
    end if;

    select objetivo_m2, m2_pendiente into v_objetivo, v_pendiente
    from v_lote_pendiente where lote_id = new.lote_id;

    if v_objetivo is null or v_objetivo not between 100 and 50000
       or v_pendiente is distinct from 0 then
      return new;
    end if;

    if exists (select 1 from parte where lote_id = new.lote_id and vigente and not completado) then
      return new;
    end if;

    update lote set estado = 'finalizado' where id = new.lote_id and estado = 'iniciado';
  exception when others then
    raise warning 'fn_cerrar_lote_si_completo: lote % sin evaluar: % (%)', new.lote_id, sqlerrm, sqlstate;
  end;
  return new;
end;
$f$;

revoke all on function fn_cerrar_lote_si_completo() from public, anon, authenticated;

drop trigger if exists trg_parte_z_cerrar_lote_completo on parte;
create trigger trg_parte_z_cerrar_lote_completo
  after insert or update of completado, vigente, piezas_entradas on parte
  for each row
  when (new.vigente and new.completado)
  execute function fn_cerrar_lote_si_completo();

-- -------------------------------------------------------------
-- v_lote_gestion — una fila por lote para la pestaña Lotes.
-- Mismo patrón de seguridad que v_lote_pendiente (vista del owner, sin
-- security_invoker), pero con grants explícitos: nada para anon,
-- solo SELECT para authenticated.
-- pct_objetivo es un ratio (1 = 100 %), NULL sin objetivo.
-- ultima_actividad = max(parte.created_at), NULL si el lote no tiene partes.
-- -------------------------------------------------------------
create or replace view v_lote_gestion as
select
  p.lote_id,
  p.numero_orden,
  p.lote_estado                                  as estado,
  p.modelo_nombre                                as modelo,
  p.marca_nombre                                 as marca,
  p.formato_nombre                               as formato,
  p.objetivo_m2,
  p.m2_pendiente,
  p.piezas_pendiente,
  case when p.objetivo_m2 is null or p.objetivo_m2 = 0 then null
       else p.m2_producido / p.objetivo_m2
  end                                            as pct_objetivo,
  act.ultima_actividad,
  coalesce(act.tiene_parte_abierto, false)       as tiene_parte_abierto
from v_lote_pendiente p
left join (
  select lote_id,
         max(created_at)                        as ultima_actividad,
         bool_or(vigente and not completado)    as tiene_parte_abierto
  from parte
  group by lote_id
) act on act.lote_id = p.lote_id;

revoke all on v_lote_gestion from public, anon, authenticated;
grant select on v_lote_gestion to authenticated;

comment on view v_lote_gestion is
  'Una fila por lote para la pestaña Lotes: pendiente (de v_lote_pendiente), '
  'pct_objetivo (ratio producido/objetivo), ultima_actividad (max parte.created_at) '
  'y tiene_parte_abierto (parte vigente sin completar). Solo authenticated.';
