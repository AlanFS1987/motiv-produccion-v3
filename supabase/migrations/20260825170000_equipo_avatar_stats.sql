-- =============================================================
-- 25/08/2026 — Apoyo para la pestaña "Equipo" del responsable.
--
-- Hoy NINGUNA pantalla muestra las stats CONGELADAS de
-- personaje_stats_nivel — Stats+Avatar muestra las 4 barras en vivo
-- (decisión 23/08/2026, a propósito) y la carta por separado, sin
-- relación numérica. Equipo es la primera pantalla que sí necesita
-- "las stats de la carta tal como estaba cuando se generó", así que
-- hace falta esta vista nueva: junta personaje_rpg (imagen +
-- nivel_en_generacion de la carta ACTIVA) con personaje_stats_nivel
-- (las 4 stats congeladas de ESE nivel).
--
-- Si el nivel de la carta activa todavía no tiene fila en
-- personaje_stats_nivel (el admin no le ha otorgado ese nivel
-- todavía), fuerza/resistencia/velocidad/vida salen null vía LEFT
-- JOIN — la pantalla trata ese caso igual que "sin avatar" (sin
-- barras), decisión de sesión.
-- =============================================================

create or replace view v_equipo_avatar_stats as
select
  pr.usuario_id,
  pr.imagen_url,
  n.nombre       as nivel_nombre,
  n.color_marco,
  n.estrellas,
  psn.fuerza,
  psn.resistencia,
  psn.velocidad,
  psn.vida
from personaje_rpg pr
join niveles n on n.id = pr.nivel_en_generacion
left join personaje_stats_nivel psn
  on psn.usuario_id = pr.usuario_id and psn.nivel_id = pr.nivel_en_generacion
where pr.seleccionada = true;

comment on view v_equipo_avatar_stats is
  'Avatar activo + stats CONGELADAS del nivel de esa carta (no las '
  'stats en vivo) — para la pestaña Equipo del responsable, donde se '
  'ven varias personas a la vez y no tiene sentido pedir en vivo una '
  'por una. Sin security_invoker (owner, salta RLS de personaje_rpg), '
  'mismo patrón que v_avatar_activo_operario.';
