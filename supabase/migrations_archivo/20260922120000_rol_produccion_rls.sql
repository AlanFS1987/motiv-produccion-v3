-- =============================================================
-- Rol `produccion` (adjuntos de jefe de planta) — sesión 22/09/2026.
--
-- Contexto: el rol `produccion` ya existía en el enum, ya podía leer
-- `incidencia_produccion` (política `incidencia_produccion_select`,
-- 20260101000010_rls.sql) y ya aparecía en `admin-usuarios.ts`
-- (asignable desde el panel de administrador) — pero no tenía shell
-- propio, así que caía en `RolSinInterfaz`.
--
-- Decisión de sesión: `produccion` ve exactamente lo mismo que
-- `jefe` (Vista Rápida, Vista Detallada, Incidencias, Calidad,
-- Informes, Ceria, Chat), reutilizando sus mismos componentes
-- (`ProduccionApp.tsx`, ver frontend) — puramente lectura, sin
-- rectificado (esa sección no la controla tampoco el jefe).
--
-- Qué falta de RLS para que esas pantallas funcionen con este rol:
--   - `parte`: YA incluye 'produccion' en `parte_select_todos`
--     (20260101000010_rls.sql) — nada que tocar.
--   - Catálogos (`turno`, `linea`, `modelo`, `marca`, `formato`,
--     `producto`, `lote`...): YA abiertos a "cualquier autenticado"
--     (`*_select_autenticados`) — nada que tocar.
--   - `incidencia_produccion`: YA incluye 'produccion' — nada que
--     tocar.
--   - `incidencia_calidad`: falta 'produccion' (hoy solo
--     responsable/suplente/jefe/calidad/administrador) — la pestaña
--     "Calidad" e "Incidencias" del jefe la necesitan.
--   - `informe_periodo`: falta 'produccion' (hoy solo jefe/
--     administrador) — la pestaña "Informes" la necesita.
--   - Las vistas SQL (`v_produccion_turno`, `v_calidad_turno`,
--     `v_calidad_lote`, `v_calidad_modelo`) no tienen RLS propia,
--     heredan la de las tablas base (`parte`, `turno`...) — al ya
--     estar abiertas para 'produccion', las vistas funcionan solas,
--     sin tocarlas en esta migración.
--
-- Fuera de esta migración (a propósito): acceso a los canales de
-- Chat (`incidencia_calidad`, `incidencia_produccion`, `ceria` en
-- `chat_acceso`) — se da desde `ChatAccesoScreen.tsx` por el propio
-- administrador, sin necesidad de migración (mismo criterio que el
-- resto de `chat_acceso`).
-- =============================================================

alter policy incidencia_calidad_select on incidencia_calidad
  using (
    fn_rol_actual() in ('responsable', 'suplente', 'jefe', 'produccion', 'calidad', 'administrador')
  );

alter policy informe_periodo_select_jefe_admin on informe_periodo
  using (
    fn_rol_actual() in ('jefe', 'produccion', 'administrador')
  );

comment on policy incidencia_calidad_select on incidencia_calidad is
  'Lectura: responsable, suplente, jefe, produccion (22/09/2026, '
  'adjuntos de jefe de planta), calidad, administrador. Sin UPDATE '
  'ni DELETE para nadie salvo backend.';

comment on table informe_periodo is
  'Un informe PDF por periodo (diario o semanal) generado por la Edge '
  'Function generar-informe-periodo. desde/hasta son fechas de turno '
  '(el turno N de la fecha D acaba a las 06:00 de D+1). Único por '
  '(tipo, desde). Escritura: solo service_role (la Edge Function). '
  'Lectura: jefe, produccion (22/09/2026) y administrador (política '
  'informe_periodo_select_jefe_admin).';
