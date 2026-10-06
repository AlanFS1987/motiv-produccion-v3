-- =============================================================
-- Cierra un hueco de seguridad (S2, auditoría 27/09/2026):
-- personaje_rpg_insert permitía a CUALQUIER usuario insertar
-- directamente una fila con su propio usuario_id, saltándose por
-- completo la validación de generaciones disponibles
-- (fn_consumir_generacion_nivel) que sí aplica el flujo real de la
-- app (Edge Function generar-personaje, con service_role — que
-- además bypassa RLS y no depende de esta política para nada).
--
-- Confirmado antes de este cambio que ningún archivo del frontend
-- hace un INSERT directo en personaje_rpg (solo SELECT, y el UPDATE
-- de "elegir avatar" vía fn_seleccionar_personaje, RPC aparte) — la
-- cláusula "usuario_id = auth.uid()" de esta política no la usa
-- ningún camino legítimo de la app, solo era una puerta abierta sin
-- necesidad.
--
-- Esta es una RESTRICCIÓN, no una ampliación — a diferencia del
-- resto de políticas de este proyecto (que se SUMAN sin tocar las
-- existentes), aquí hay que sustituir la política vieja por una más
-- estrecha: añadir una nueva no habría servido, porque RLS combina
-- políticas permisivas con OR, así que la vieja habría seguido
-- abriendo la puerta en paralelo.
-- =============================================================

drop policy if exists personaje_rpg_insert on personaje_rpg;

create policy personaje_rpg_insert_admin on personaje_rpg
  for insert with check (fn_rol_actual() = 'administrador');

comment on policy personaje_rpg_insert_admin on personaje_rpg is
  'Solo administrador puede insertar directamente (uso excepcional/'
  'depuración) — el flujo real de generación de personajes pasa por '
  'la Edge Function generar-personaje, que usa service_role y por '
  'tanto no depende de esta política para nada. Antes (hasta '
  '27/09/2026) cualquier usuario podía insertar una fila arbitraria '
  'con su propio usuario_id, sin pasar por la validación de '
  'generaciones disponibles.';
