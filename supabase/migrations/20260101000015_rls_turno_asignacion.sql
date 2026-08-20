-- =============================================================
-- 0015 — RLS: responsable/suplente pueden abrir turno y asignar
-- operarios a línea (gap detectado al construir la pantalla real de
-- apertura de turno — 0010_rls.sql había dejado estas dos tablas
-- como escritura solo-administrador, dentro del bucle genérico de
-- "catálogos", lo cual era incorrecto: el responsable las escribe
-- a diario, no son catálogos de administración).
--
-- Las políticas nuevas se SUMAN a las ya existentes (RLS combina
-- políticas permisivas con OR) — no hace falta tocar ni borrar nada
-- de 0010_rls.sql.
-- =============================================================

create policy turno_insert_responsable on turno
  for insert with check (fn_rol_actual() in ('responsable', 'suplente'));

create policy turno_update_responsable on turno
  for update using (fn_rol_actual() in ('responsable', 'suplente'));

comment on policy turno_update_responsable on turno is
  'Deliberadamente amplia (cualquier responsable/suplente puede tocar '
  'cualquier turno, no solo "el suyo") — turno no tiene un dueño '
  'individual real, lo comparten los relevos de un mismo día. Revisar '
  'si algún día hace falta restringir más.';

create policy asignacion_operario_linea_insert_responsable on asignacion_operario_linea
  for insert with check (fn_rol_actual() in ('responsable', 'suplente'));

create policy asignacion_operario_linea_update_responsable on asignacion_operario_linea
  for update using (fn_rol_actual() in ('responsable', 'suplente'));

create policy asignacion_operario_linea_delete_responsable on asignacion_operario_linea
  for delete using (fn_rol_actual() in ('responsable', 'suplente'));
