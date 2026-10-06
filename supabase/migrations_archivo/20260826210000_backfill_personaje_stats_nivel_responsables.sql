-- =============================================================
-- Backfill retroactivo de personaje_stats_nivel para los 4
-- responsables reales migrados de v2 (07-pendientes.md #3 —
-- "mismo efecto retroactivo que ya tienen los operarios").
--
-- Los operarios ya se reconstruyeron en la sesión 23/08/2026
-- (scripts/migrar_v2_historial.sql), simulando cuándo cruzó cada uno
-- cada umbral de nivel. Este script hace lo mismo para responsable,
-- usando solo los ciclos 1-6 (ya migrados y cerrados en
-- historial_ciclo_responsable) — el ciclo 7 (en vivo) todavía no ha
-- empezado (lanzamiento 31/08/2026), así que no hace falta tocarlo.
--
-- Para cada responsable, recorre sus ciclos en orden y, tras sumar
-- cada uno al acumulado, comprueba qué niveles (umbral_min_responsable)
-- ya se han cruzado y todavía no tienen fila en personaje_stats_nivel
-- — inserta el snapshot con los totales acumulados HASTA ESE CICLO
-- (no los totales de hoy), igual que se hizo con los operarios.
--
-- Idempotente: el ON CONFLICT (usuario_id, nivel_id) DO NOTHING hace
-- que volver a ejecutar este script no duplique ni pise nada — si ya
-- existe la fila de un nivel (p.ej. porque el admin ya la otorgó a
-- mano desde entonces), simplemente no la toca.
-- =============================================================

do $$
declare
  v_usuario     record;
  v_ciclo       record;
  v_nivel       record;
  v_cum_puntos  numeric;
  v_cum_m2      numeric;
  v_cum_plena   numeric;
  v_cum_no_alim numeric;
  v_fuerza      numeric;
  v_resistencia numeric;
  v_velocidad   numeric;
begin
  for v_usuario in
    select id, username from usuario
    where rol = 'responsable'
      and username in ('hectorn', 'radu', 'valentina', 'joaquina')
  loop
    v_cum_puntos  := 0;
    v_cum_m2      := 0;
    v_cum_plena   := 0;
    v_cum_no_alim := 0;

    for v_ciclo in
      select cycle_id, puntos_ciclo, m2_total, minutos_plena, minutos_no_alimentada
      from historial_ciclo_responsable
      where usuario_id = v_usuario.id
      order by cycle_id asc
    loop
      v_cum_puntos  := v_cum_puntos  + coalesce(v_ciclo.puntos_ciclo, 0);
      v_cum_m2      := v_cum_m2      + coalesce(v_ciclo.m2_total, 0);
      v_cum_plena   := v_cum_plena   + coalesce(v_ciclo.minutos_plena, 0);
      v_cum_no_alim := v_cum_no_alim + coalesce(v_ciclo.minutos_no_alimentada, 0);

      for v_nivel in
        select n.id, n.orden
        from niveles n
        where n.umbral_min_responsable <= v_cum_puntos
          and not exists (
            select 1 from personaje_stats_nivel psn
            where psn.usuario_id = v_usuario.id and psn.nivel_id = n.id
          )
        order by n.orden asc
      loop
        v_fuerza      := round(v_cum_m2 / 1000.0, 2);
        v_resistencia := round((v_cum_plena + v_cum_no_alim) / 100.0, 2);
        v_velocidad   := case when v_cum_plena > 0 then round(v_cum_m2 / v_cum_plena, 4) else 0 end;

        insert into personaje_stats_nivel
          (usuario_id, nivel_id, fuerza, resistencia, velocidad, vida, generaciones_usadas)
        values
          (v_usuario.id, v_nivel.id, v_fuerza, v_resistencia, v_velocidad, v_cum_puntos, 0)
        on conflict (usuario_id, nivel_id) do nothing;

        raise notice 'Responsable % alcanzó nivel (orden %) en el ciclo %, snapshot creado (vida=%).',
          v_usuario.username, v_nivel.orden, v_ciclo.cycle_id, v_cum_puntos;
      end loop;
    end loop;
  end loop;
end $$;