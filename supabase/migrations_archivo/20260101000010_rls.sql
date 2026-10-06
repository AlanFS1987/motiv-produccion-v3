-- =============================================================
-- 0010 — RLS (Row Level Security)
-- Ref. spec: 11-esquema-supabase.md 13.8 (patrón general, "pendiente
-- de detallar" en la spec original) — esta migración lo implementa.
-- =============================================================

-- Helper: rol del usuario autenticado actual.
create or replace function fn_rol_actual()
returns rol_usuario
language sql stable security definer as $$
  select rol from usuario where id = auth.uid();
$$;

-- Helper: ¿el usuario actual es responsable/suplente del turno_id dado
-- (para permitir INSERT solo en su propio turno activo)?
create or replace function fn_es_responsable_de_turno(p_turno_id uuid)
returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from turno t
    where t.id = p_turno_id and t.abierto_por = auth.uid()
  ) or fn_rol_actual() in ('responsable', 'suplente');
$$;

-- -------------------------------------------------------------
-- usuario — cada uno ve su propio perfil; admin ve todo
-- -------------------------------------------------------------
alter table usuario enable row level security;

create policy usuario_select_propio on usuario
  for select using (id = auth.uid() or fn_rol_actual() = 'administrador');

create policy usuario_update_admin on usuario
  for update using (fn_rol_actual() = 'administrador');

-- -------------------------------------------------------------
-- parte — responsable/suplente INSERT en su turno activo;
-- jefe/produccion/calidad/administrador/operario SELECT.
-- No hay UPDATE directo (doble entrada, 04-rol-administrador.md 6.3):
-- toda "corrección" es un INSERT nuevo con corrige_a_parte_id.
-- -------------------------------------------------------------
alter table parte enable row level security;

create policy parte_select_todos on parte
  for select using (
    fn_rol_actual() in ('responsable', 'suplente', 'jefe', 'produccion',
                         'calidad', 'operario', 'administrador')
  );

create policy parte_insert_responsable on parte
  for insert with check (
    fn_rol_actual() in ('responsable', 'suplente', 'administrador')
  );

-- -------------------------------------------------------------
-- incidencia_calidad — responsable/suplente INSERT; jefe/calidad/
-- administrador SELECT (04-rol-administrador.md, 02-rol-jefe-planta.md 4.1)
-- -------------------------------------------------------------
alter table incidencia_calidad enable row level security;

create policy incidencia_calidad_select on incidencia_calidad
  for select using (
    fn_rol_actual() in ('responsable', 'suplente', 'jefe', 'calidad', 'administrador')
  );

create policy incidencia_calidad_insert on incidencia_calidad
  for insert with check (
    fn_rol_actual() in ('responsable', 'suplente', 'administrador')
  );

-- -------------------------------------------------------------
-- incidencia_produccion — mismo patrón, con 'produccion' en vez de 'calidad'
-- -------------------------------------------------------------
alter table incidencia_produccion enable row level security;

create policy incidencia_produccion_select on incidencia_produccion
  for select using (
    fn_rol_actual() in ('responsable', 'suplente', 'jefe', 'produccion', 'administrador')
  );

create policy incidencia_produccion_insert on incidencia_produccion
  for insert with check (
    fn_rol_actual() in ('responsable', 'suplente', 'administrador')
  );

-- -------------------------------------------------------------
-- operario_checklist / personaje_rpg — operario INSERT/SELECT propio
-- -------------------------------------------------------------
alter table operario_checklist enable row level security;

create policy operario_checklist_select on operario_checklist
  for select using (
    operario_id = auth.uid() or fn_rol_actual() in ('jefe', 'administrador')
  );

create policy operario_checklist_insert on operario_checklist
  for insert with check (
    operario_id = auth.uid() or fn_rol_actual() = 'administrador'
  );

alter table personaje_rpg enable row level security;

create policy personaje_rpg_select on personaje_rpg
  for select using (
    usuario_id = auth.uid() or fn_rol_actual() in ('jefe', 'administrador')
  );

create policy personaje_rpg_insert on personaje_rpg
  for insert with check (
    usuario_id = auth.uid() or fn_rol_actual() = 'administrador'
  );

create policy personaje_rpg_update_propia on personaje_rpg
  for update using (
    usuario_id = auth.uid()  -- elegir avatar (seleccionada)
  );

-- -------------------------------------------------------------
-- Tablas de solo-lectura para todos los roles autenticados
-- (catálogos, historial, logros propios)
-- -------------------------------------------------------------
alter table historial_ciclos enable row level security;

create policy historial_ciclos_select on historial_ciclos
  for select using (
    usuario_id = auth.uid() or fn_rol_actual() in ('jefe', 'administrador')
  );

alter table operario_logro enable row level security;

create policy operario_logro_select on operario_logro
  for select using (
    usuario_id = auth.uid() or fn_rol_actual() in ('jefe', 'administrador')
  );

-- -------------------------------------------------------------
-- Catálogos (modelo, marca, formato, producto, lote, linea, turno,
-- asignacion_operario_linea, checklist_items, logros_definicion,
-- puntos_*, niveles*, cierre_fabrica): SELECT abierto a cualquier
-- rol autenticado; escritura reservada a administrador (o a las
-- edge functions de resolución de catálogo, que corren con
-- service_role y por tanto no pasan por RLS).
-- -------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'modelo', 'marca', 'formato', 'producto', 'lote', 'linea', 'turno',
    'asignacion_operario_linea', 'checklist_items', 'logros_definicion',
    'puntos_piezas', 'puntos_rendimiento', 'puntos_rendimiento_responsable',
    'puntos_metros', 'niveles', 'niveles_responsable', 'cierre_fabrica'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for select using (auth.role() = ''authenticated'');',
      t || '_select_autenticados', t
    );
    execute format(
      'create policy %I on %I for all using (fn_rol_actual() = ''administrador'') with check (fn_rol_actual() = ''administrador'');',
      t || '_admin_todo', t
    );
  end loop;
end $$;

-- -------------------------------------------------------------
-- Rol 'pantalla' (12.2) — sin login, no tiene fila en `usuario` ni
-- `auth.uid()`. Se sirve con una clave de servicio de solo lectura
-- (service_role) desde el backend, NO como usuario autenticado — por
-- eso no tiene políticas propias aquí: bypassa RLS por diseño.
-- =============================================================
