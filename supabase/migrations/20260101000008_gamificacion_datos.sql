-- =============================================================
-- 0008 — Gamificación: datos por usuario
-- Ref. spec: 07-arquitectura.md 9.3, 05-modelo-de-datos.md 7.7,
--            03-rol-operario.md 5.5/5.9/5.11, 11-esquema-supabase.md 13.6
-- =============================================================

-- -------------------------------------------------------------
-- historial_ciclos — "foto" permanente de cada ciclo cerrado.
-- Diseño híbrido: ciclo actual en vivo (vista) + histórico aquí.
-- Misma tabla para operario y responsable, distinguidos por `rol`.
-- -------------------------------------------------------------
create table historial_ciclos (
  id                     uuid primary key default gen_random_uuid(),
  usuario_id             uuid not null references usuario(id),
  rol                    text not null check (rol in ('operario', 'responsable')),
  cycle_id               int not null,
  fecha_cierre           timestamptz not null default now(),
  puntos_ciclo           int not null default 0,
  fuerza                 numeric,
  resistencia            numeric,
  velocidad              numeric,
  m2_total               numeric,
  piezas_total           int,
  tiempo_plena           numeric,
  tiempo_no_alimentada   numeric,
  tiempo_saturacion      numeric,
  tiempo_banco           numeric,
  tiempo_maquina         numeric,
  piezas_por_formato     jsonb,   -- suma clave a clave
  unique (usuario_id, cycle_id)
);

create index idx_historial_ciclos_usuario on historial_ciclos (usuario_id);
create index idx_historial_ciclos_cycle on historial_ciclos (cycle_id);

comment on table historial_ciclos is
  'Totales de por vida NO son una tabla: SUM(historial_ciclos.*) + '
  'ciclo actual en vivo (vista sobre operario_ledger, acotada a ≤28 '
  'días). Ver 07-arquitectura.md 9.3 para la lección de v2 que esto evita.';

-- -------------------------------------------------------------
-- personaje_rpg — un registro por cada personaje generado (IA)
-- -------------------------------------------------------------
create table personaje_rpg (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references usuario(id),
  nivel_en_generacion uuid not null references niveles(id),
  imagen_url          text not null,   -- Cloudinary
  historia            text,
  seleccionada        boolean not null default false,  -- solo una por usuario a la vez
  created_at          timestamptz not null default now()
);

create index idx_personaje_rpg_usuario on personaje_rpg (usuario_id);

-- Solo una selección activa por usuario — se aplica en BD, no solo
-- en la app, para que no dependa de que el cliente lo respete.
create unique index uq_personaje_rpg_seleccionada
  on personaje_rpg (usuario_id)
  where seleccionada = true;

-- -------------------------------------------------------------
-- operario_checklist — concurrencia resuelta por UNIQUE (5.9)
-- -------------------------------------------------------------
create table operario_checklist (
  id                  uuid primary key default gen_random_uuid(),
  linea_id            uuid not null references linea(id),
  turno_id            uuid not null references turno(id),
  checklist_item_id   uuid not null references checklist_items(id),
  operario_id         uuid not null references usuario(id),
  fotos_antes         text[] not null,
  fotos_despues       text[] not null,
  created_at          timestamptz not null default now(),
  unique (linea_id, turno_id, checklist_item_id)
);

create index idx_operario_checklist_operario on operario_checklist (operario_id);

-- -------------------------------------------------------------
-- operario_logro — progreso individual, niveles sin tope (5.11)
-- -------------------------------------------------------------
create table operario_logro (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references usuario(id),
  logro_id         uuid not null references logros_definicion(id),
  nivel_actual     int not null default 1,
  primera_vez_at   timestamptz not null default now(),
  ultima_vez_at    timestamptz not null default now(),
  unique (usuario_id, logro_id)
);

create index idx_operario_logro_usuario on operario_logro (usuario_id);

-- -------------------------------------------------------------
-- Atomicidad de generaciones_disponibles (08-pendientes.md):
-- UPDATE condicionado + CHECK >= 0, mismo patrón que el checklist.
-- Se expone como función RPC para que la edge function
-- `generar-personaje` la llame de forma atómica.
-- -------------------------------------------------------------
create or replace function fn_consumir_generacion(p_usuario_id uuid)
returns boolean
language plpgsql as $$
declare
  v_filas_afectadas int;
begin
  update usuario
  set generaciones_disponibles = generaciones_disponibles - 1
  where id = p_usuario_id and generaciones_disponibles > 0;

  get diagnostics v_filas_afectadas = row_count;
  return v_filas_afectadas > 0;
end;
$$;

-- Al subir de nivel: +3 generaciones disponibles (mismo mecanismo
-- para operario y responsable — 03-rol-operario.md 5.5).
create or replace function fn_otorgar_generaciones_por_nivel(p_usuario_id uuid, p_cantidad int default 3)
returns void
language sql as $$
  update usuario set generaciones_disponibles = generaciones_disponibles + p_cantidad
  where id = p_usuario_id;
$$;
