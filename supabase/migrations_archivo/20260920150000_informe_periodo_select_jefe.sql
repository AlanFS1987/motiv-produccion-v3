-- =============================================================
-- Informes por periodo — lectura desde la app para jefe y
-- administrador. Sesión 20/09/2026.
--
-- 20260920130000_informe_periodo.sql dejó la tabla con RLS activada
-- SIN políticas (solo la leía la Edge Function con service_role). Al
-- añadir la pestaña "Informes" a JefeApp/AdminApp (listado de los PDF
-- diarios y semanales) hace falta que estos dos roles puedan LEER
-- la tabla. Solo SELECT: nadie escribe desde la app, los informes los
-- crea siempre la Edge Function generar-informe-periodo.
--
-- Los PDF de turno no necesitan nada: `turno.informe_pdf_url` ya es
-- legible por cualquier usuario autenticado, igual que el resto de
-- `turno`.
--
-- Si más adelante otro rol debe ver los informes (p. ej. `calidad` o
-- `produccion`), basta con ampliar la lista de esta política.
-- =============================================================

do $$
begin
  create policy informe_periodo_select_jefe_admin on informe_periodo
    for select using (fn_rol_actual() in ('jefe', 'administrador'));
exception when duplicate_object then null;
end $$;

comment on table informe_periodo is
  'Un informe PDF por periodo (diario o semanal) generado por la Edge '
  'Function generar-informe-periodo. desde/hasta son fechas de turno '
  '(el turno N de la fecha D acaba a las 06:00 de D+1). Único por '
  '(tipo, desde). Escritura: solo service_role (la Edge Function). '
  'Lectura: jefe y administrador (política informe_periodo_select_jefe_admin).';
