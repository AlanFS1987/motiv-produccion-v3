-- =============================================================
-- Sesión 24/08/2026 — el podio del Ranking (top 3) mostraba solo un
-- icono genérico aunque el operario ya tuviera avatar RPG generado
-- (caso real detectado: "luisc" en el podio con avatar generado,
-- icono genérico en pantalla). Causa raíz doble:
--
-- 1) `lib/ranking.ts` nunca pedía la imagen — el podio se construye
--    solo con operario_id/username/puntos, sin tocar `personaje_rpg`.
--
-- 2) Aunque se pidiera, la RLS de `personaje_rpg`
--    (usuario_id = auth.uid() or fn_rol_actual() in ('jefe','admin'))
--    lo bloquearía igual para un operario mirando el avatar de OTRO
--    operario en el podio — mismo tipo de hueco que la RLS de
--    `usuario`/`historial_ciclos` de la auditoría del 24/08.
--
-- En vez de ampliar la RLS de la tabla completa (que expondría
-- también `historia`, dato más personal, y `nivel_en_generacion`),
-- se sigue el patrón YA establecido en el proyecto para este mismo
-- problema (v_rey_formato_historico / v_rey_formato_actual, que
-- exponen operario_username sin abrir toda `usuario`): una vista fina
-- que expone SOLO lo necesario para el Ranking, corre con permisos
-- del owner y salta la RLS de la tabla base sin tocarla.
-- =============================================================

create or replace view v_avatar_activo_operario as
select
  usuario_id,
  imagen_url
from personaje_rpg
where seleccionada = true;

comment on view v_avatar_activo_operario is
  'Avatar RPG activo (imagen_url) de cada usuario que tiene uno '
  'generado — expone SOLO lo mínimo (nunca historia ni '
  'nivel_en_generacion) para poder mostrarlo en el podio del Ranking '
  'a cualquier compañero, saltando la RLS más restrictiva de '
  'personaje_rpg (propio/jefe/admin) igual que hacen '
  'v_rey_formato_historico/actual con el username. `seleccionada = '
  'true` es como mucho una fila por usuario (índice único '
  'uq_personaje_rpg_seleccionada), así que no hace falta DISTINCT ni '
  'agregación. Consumida por lib/ranking.ts '
  '(obtenerAvataresActivos()).';
