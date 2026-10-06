-- =============================================================
-- Informes por periodo — lectura también para RESPONSABLE. 21/09/2026.
--
-- 20260920150000_informe_periodo_select_jefe.sql dejó leer
-- `informe_periodo` a jefe y administrador (pestaña Informes). Ahora
-- el botón "Copiar" del responsable (pestaña Resumen,
-- ResumenScreen.tsx) también necesita leerla: al cerrar el turno de
-- NOCHE, añade al texto el enlace al informe del día (y, en domingo,
-- al de la semana) si ya se generó.
--
-- Política nueva y aditiva, siguiendo la convención del proyecto
-- (para dar un permiso nuevo se crea una política nueva, nunca se
-- amplía una existente): se suma con OR a la de jefe/administrador,
-- ninguna de las dos se toca. Solo SELECT — el responsable nunca
-- escribe en esta tabla, igual que jefe y administrador.
-- =============================================================

do $$
begin
  create policy informe_periodo_select_responsable on informe_periodo
    for select using (fn_rol_actual() = 'responsable');
exception when duplicate_object then null;
end $$;

comment on table informe_periodo is
  'Un informe PDF por periodo (diario o semanal) generado por la Edge '
  'Function generar-informe-periodo. desde/hasta son fechas de turno '
  '(el turno N de la fecha D acaba a las 06:00 de D+1). Único por '
  '(tipo, desde). Escritura: solo service_role (la Edge Function). '
  'Lectura: jefe y administrador (pestaña Informes, '
  'informe_periodo_select_jefe_admin) y responsable (enlace en el '
  '"Copiar" del resumen de turno, informe_periodo_select_responsable).';
