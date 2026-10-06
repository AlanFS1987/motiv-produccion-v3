-- =============================================================
-- 0005 — Incidencias de calidad / producción, cierre de fábrica
-- Ref. spec: 01-rol-responsable.md 3.4/3.7, 04-rol-administrador.md 6.2
-- =============================================================

create table incidencia_calidad (
  id           uuid primary key default gen_random_uuid(),
  parte_id     uuid not null references parte(id),  -- identidad = producto+tono en ese momento
  descripcion  text not null,
  fotos        text[],   -- URLs Cloudinary
  created_by   uuid not null references usuario(id),
  created_at   timestamptz not null default now()
);

create index idx_incidencia_calidad_parte on incidencia_calidad (parte_id);

create table incidencia_produccion (
  id           uuid primary key default gen_random_uuid(),
  turno_id     uuid not null references turno(id),
  linea_id     uuid references linea(id),   -- null = afecta a todo el turno
  descripcion  text not null,
  fotos        text[],
  created_by   uuid not null references usuario(id),
  created_at   timestamptz not null default now()
);

create index idx_incidencia_produccion_turno on incidencia_produccion (turno_id);
create index idx_incidencia_produccion_linea on incidencia_produccion (linea_id);

-- -------------------------------------------------------------
-- cierre_fabrica — bloquea apertura de turno, no afecta a ningún
-- cálculo de fechas (rotación / ciclo siguen contando igual).
-- -------------------------------------------------------------
create table cierre_fabrica (
  id            uuid primary key default gen_random_uuid(),
  fecha_inicio  date not null,
  fecha_fin     date not null,
  check (fecha_fin >= fecha_inicio)
);

create or replace function fn_fabrica_cerrada(p_fecha date)
returns boolean language sql stable as $$
  select exists (
    select 1 from cierre_fabrica
    where p_fecha between fecha_inicio and fecha_fin
  );
$$;

-- Bloqueo real: no se puede abrir turno durante el cierre.
create or replace function fn_bloquear_turno_en_cierre()
returns trigger language plpgsql as $$
begin
  if fn_fabrica_cerrada(new.fecha) then
    raise exception 'No se puede abrir turno: fábrica cerrada (periodo de vacaciones) en %', new.fecha;
  end if;
  return new;
end;
$$;

create trigger trg_turno_bloquear_cierre
  before insert on turno
  for each row execute function fn_bloquear_turno_en_cierre();
