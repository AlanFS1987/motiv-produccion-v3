-- =============================================================
-- Sesión 13/09/2026 — Realtime para la pantalla de fábrica.
--
-- Antes, cada diapositiva refrescaba sus datos por un efecto
-- colateral del carrusel: al volver a tocarle turno se remontaba y
-- volvía a pedir todo, cada ~60s, hubiera cambiado algo de verdad o
-- no. Se sustituye por Realtime: la pantalla escucha cambios en las
-- tablas que de verdad mueven sus datos y solo refresca cuando hay
-- un cambio real (frontend: RefrescoPantalla.tsx).
--
-- parte necesita ampliar su RLS de SELECT — hoy 'pantalla' no está
-- en la lista de roles de parte_select_todos, y Realtime respeta la
-- RLS de SELECT del rol que escucha: sin este cambio, la pantalla no
-- recibiría NINGÚN evento de esa tabla. turno (turno_select_autenticados,
-- ya es para cualquier autenticado) e historial_ciclos
-- (historial_ciclos_select_ranking, ya se abrió a 'pantalla' en la
-- sesión del Ranking) no necesitan tocarse.
--
-- Se deja fuera personaje_rpg a propósito: su RLS es más estricta
-- (propio/jefe/admin) por contener campos más personales (historia,
-- nivel_en_generacion) — el mismo motivo por el que en su día se creó
-- v_avatar_activo_operario en vez de ampliar la tabla entera. Los
-- avatares de Ranking/Reyes del formato se quedan con la frescura que
-- ya tenían (se refrescan la próxima vez que la pantalla recargue u
-- otro cambio relevante dispare un refresco) — decisión consciente,
-- no un descuido.
-- =============================================================

alter policy parte_select_todos on parte
using (
  fn_rol_actual() = any (array[
    'responsable', 'suplente', 'jefe', 'produccion', 'calidad',
    'operario', 'administrador', 'pantalla'
  ]::rol_usuario[])
);

alter publication supabase_realtime add table parte;
alter publication supabase_realtime add table turno;
alter publication supabase_realtime add table historial_ciclos;
