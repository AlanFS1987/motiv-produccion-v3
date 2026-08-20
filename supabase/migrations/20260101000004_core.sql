-- =============================================================
-- 0004 — Core: linea, lote, turno, asignacion_operario_linea, parte
-- Ref. spec: 05-modelo-de-datos.md, 07-arquitectura.md 9.1,
--            11-esquema-supabase.md 13.2
-- =============================================================

-- -------------------------------------------------------------
-- linea — 6 filas fijas
-- -------------------------------------------------------------
create table linea (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique
);

insert into linea (nombre) values
  ('Línea 1'), ('Línea 2'), ('Línea 3'),
  ('Línea 4'), ('Línea 5'), ('Línea 6');

-- -------------------------------------------------------------
-- lote — identidad = número de orden (7.1 / 7.3)
-- -------------------------------------------------------------
create type estado_lote as enum ('iniciado', 'finalizado');

create table lote (
  id                    uuid primary key default gen_random_uuid(),
  numero_orden          text not null unique,          -- identidad real, nunca se reutiliza
  producto_id           uuid not null references producto(id),
  acabado_codigo        text,
  acabado_tipo          text,
  acabado_nombre        text,
  espesor               text not null check (espesor in ('9mm', '11mm')),
  tipo_palet            text,
  pza_caja              int,
  objetivo_m2           numeric,                        -- dato de la hoja, no fiable (7.2)
  codbar_caja           text,
  codbar_pieza          text,
  cod_upec              text,
  codbar_saso           text,
  observaciones_material text,
  observaciones_orden    text,
  texto_crudo_modelo    text not null,                  -- literal OCR, auditoría de fusiones
  texto_crudo_marca     text not null,
  estado                estado_lote not null default 'iniciado',
  created_by            uuid not null references usuario(id),
  created_at             timestamptz not null default now()
);

create index idx_lote_producto on lote (producto_id);
create index idx_lote_estado on lote (estado);

-- Reapertura automática: si llega un parte nuevo contra un lote
-- finalizado, el lote vuelve a 'iniciado' (13.7, resolver-catalogo).
-- Se deja como función reutilizable desde la edge function o desde
-- el trigger de `parte` de más abajo.
create or replace function fn_reabrir_lote_si_finalizado(p_lote_id uuid)
returns void language plpgsql as $$
begin
  update lote set estado = 'iniciado'
  where id = p_lote_id and estado = 'finalizado';
end;
$$;

-- -------------------------------------------------------------
-- turno — el estado (Abierto/En revisión/Cerrado) se CALCULA por
-- franja horaria, no se guarda (01-rol-responsable.md 3.1).
-- -------------------------------------------------------------
create type tipo_turno as enum ('M', 'T', 'N');

create table turno (
  id                       uuid primary key default gen_random_uuid(),
  fecha                    date not null,
  tipo                     tipo_turno not null,
  cerrado_manualmente_at   timestamptz,
  abierto_por              uuid not null references usuario(id),
  created_at               timestamptz not null default now(),
  unique (fecha, tipo)
);

create index idx_turno_fecha on turno (fecha);

-- -------------------------------------------------------------
-- asignacion_operario_linea — diaria, una activa por línea+turno (7.6)
-- -------------------------------------------------------------
create table asignacion_operario_linea (
  id           uuid primary key default gen_random_uuid(),
  turno_id     uuid not null references turno(id),
  linea_id     uuid not null references linea(id),
  operario_id  uuid not null references usuario(id),
  created_at   timestamptz not null default now(),
  unique (turno_id, linea_id)
);

create index idx_asignacion_operario on asignacion_operario_linea (operario_id);

-- -------------------------------------------------------------
-- parte — el corazón del modelo (7.1 / 7.5 / 7.10)
-- -------------------------------------------------------------
create table parte (
  id                          uuid primary key default gen_random_uuid(),
  turno_id                    uuid not null references turno(id),
  linea_id                    uuid not null references linea(id),
  lote_id                     uuid not null references lote(id),
  responsable_id              uuid not null references usuario(id),  -- titular o suplente

  tono                        text not null,   -- texto crudo OCR + sugerencia tono_ant+1
  calibre                     text,            -- texto crudo OCR, sin catalogar

  verificacion_caja_estado    text,            -- resultado de 3.5, si se hizo

  piezas_1a                   int not null default 0,  -- TOTAL STD
  piezas_comercial             int not null default 0,  -- COM
  piezas_eco                  int not null default 0,  -- sin uso aún
  piezas_descuadre_com         int not null default 0,  -- subconjunto informativo de comercial
  piezas_planar_com            int not null default 0,  -- se captura, sin uso todavía
  piezas_contenedor           int not null default 0,  -- descarte total
  piezas_entradas             int not null default 0,

  cal_1 int default 0, cal_2 int default 0, cal_3 int default 0, cal_4 int default 0,
  cal_5 int default 0, cal_6 int default 0, cal_7 int default 0, cal_8 int default 0,

  minutos_total                int not null default 0,
  minutos_plena                int not null default 0,
  minutos_no_alimentada        int not null default 0,
  minutos_saturacion           int not null default 0,
  minutos_banco                int not null default 0,  -- inhabilita banco de selección
  minutos_maquina              int not null default 0,  -- inhabilita máquina

  hora_captura_pantalla        timestamptz,     -- metadato de validación (Foto 3)

  -- calibre_com_pct se calcula por trigger (ver más abajo); nunca se
  -- escribe a mano. calibre_std_pct es su complementario, siempre
  -- derivado — se implementa como columna generada.
  calibre_com_pct              numeric,
  calibre_std_pct              numeric generated always as (
                                  case when calibre_com_pct is null then null
                                       else 100 - calibre_com_pct end
                                ) stored,

  vigente                      boolean not null default true,
  corrige_a_parte_id           uuid references parte(id),

  created_at                    timestamptz not null default now()
);

create index idx_parte_turno on parte (turno_id);
create index idx_parte_linea on parte (linea_id);
create index idx_parte_lote on parte (lote_id);
create index idx_parte_responsable on parte (responsable_id);
create index idx_parte_vigente on parte (vigente) where vigente = true;
create index idx_parte_corrige on parte (corrige_a_parte_id) where corrige_a_parte_id is not null;

-- calibre_com_pct = piezas_descuadre_com / piezas_entradas * 100
-- (nunca se guarda a mano — 11-esquema-supabase.md 13.2)
create or replace function fn_calcular_calibre_com_pct()
returns trigger language plpgsql as $$
begin
  if new.piezas_entradas is not null and new.piezas_entradas > 0 then
    new.calibre_com_pct := (new.piezas_descuadre_com::numeric / new.piezas_entradas) * 100;
  else
    new.calibre_com_pct := null;
  end if;
  return new;
end;
$$;

create trigger trg_parte_calibre_pct
  before insert or update of piezas_descuadre_com, piezas_entradas on parte
  for each row execute function fn_calcular_calibre_com_pct();

-- Corrección de partes por doble entrada (04-rol-administrador.md 6.3):
-- al insertar un parte que corrige a otro, el corregido pasa a
-- vigente=false automáticamente. No hay edición in-situ en ningún caso.
create or replace function fn_marcar_corregido_no_vigente()
returns trigger language plpgsql as $$
begin
  if new.corrige_a_parte_id is not null then
    update parte set vigente = false where id = new.corrige_a_parte_id;
  end if;
  return new;
end;
$$;

create trigger trg_parte_corregir
  after insert on parte
  for each row execute function fn_marcar_corregido_no_vigente();

-- Reabrir lote si estaba finalizado, en cuanto entra un parte nuevo
-- contra él (13.7 resolver-catalogo).
create or replace function fn_parte_reabre_lote()
returns trigger language plpgsql as $$
begin
  perform fn_reabrir_lote_si_finalizado(new.lote_id);
  return new;
end;
$$;

create trigger trg_parte_reabre_lote
  after insert on parte
  for each row execute function fn_parte_reabre_lote();
