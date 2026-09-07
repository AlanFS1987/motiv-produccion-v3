-- =============================================================
-- Notificaciones in-app — ajuste de alcance (RLS)
-- Sesión 07/09/2026.
--
-- Decisión: la campana solo se cablea en 4 shells (responsable/
-- suplente comparten App.tsx, operario, jefe, administrador) —
-- calidad y jefe_rectificado quedan fuera A PROPÓSITO, dependiendo
-- solo de Telegram para sus avisos (decisión explícita de esta
-- sesión, no un descuido). Se cierra también a nivel de RLS, no solo
-- ocultando la campana en pantalla — sin esto, un usuario de calidad
-- podría seguir leyendo `notificaciones` por cualquier otro camino
-- (devtools, futuro componente que la use sin querer, etc.),
-- contradiciendo la intención real.
--
-- `suplente` se incluye junto a `responsable` aunque el enunciado de
-- la sesión decía "operario, responsable, jefe y admin" — comparten
-- literalmente el mismo shell (App.tsx se monta igual para ambos
-- roles), así que excluir a `suplente` habría dejado la campana
-- visible mas sin datos para ese rol — inconsistencia, no lo que se
-- pidió.
-- =============================================================

drop policy if exists notificaciones_select_roles_conocidos on notificaciones;

do $$ begin
  create policy notificaciones_select_roles_limitados on notificaciones
    for select using (
      fn_rol_actual() in ('responsable', 'suplente', 'operario', 'jefe', 'administrador')
    );
exception when duplicate_object then null; end $$;

comment on table notificaciones is
  'Feed global de notificaciones in-app. Alcance restringido (sesión '
  '07/09/2026) a responsable/suplente/operario/jefe/administrador — '
  'calidad y jefe_rectificado quedan fuera a propósito, tanto de la '
  'campana (sin cablear en sus shells) como de esta política RLS, '
  'dependiendo solo de Telegram para sus avisos. El check de `tipo` '
  'se amplía con ALTER TABLE ... DROP/ADD CONSTRAINT cuando se añada '
  'el 6º tipo (mensaje_chat, fase 6). Solo se inserta desde funciones '
  'security definer (fn_notificar_telegram et al., fase 2).';
