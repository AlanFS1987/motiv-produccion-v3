create table programacion_orden (
  id uuid primary key default gen_random_uuid(),

  -- identidad y sección
  numero_orden text not null,
  horno smallint not null check (horno between 1 and 4),  -- deriva de la sección (Horno 1..4), no se repite visualmente por fila pero se guarda como dato
  posicion integer not null,                                -- orden dentro del horno, según el último CSV procesado

  -- columnas que vienen del CSV
  modelo text,
  metros numeric,
  acabado text,
  cep boolean not null default false,                       -- true = 'X' en el CSV, false = vacío
  caja text,                                                -- marca (ARGENTA, CIFRE, AZUVI...)

  -- columnas que rellena el jefe manualmente al procesar un pedido nuevo
  tono text,
  calibre text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (horno, numero_orden)
);

comment on table programacion_orden is 'Programación diaria de producción por horno (1-4). Se reemplaza día a día tras comparar el CSV nuevo contra el existente. El estado (pendiente/iniciado/finalizado) NO se guarda aquí: se calcula en vivo con LEFT JOIN contra lote por numero_orden.';
comment on column programacion_orden.horno is 'Corresponde a la sección del CSV (antes llamada ESM-1..4). Los 4 hornos siempre aparecen.';
comment on column programacion_orden.cep is 'Cepillado: true si el CSV traía una X en esa columna, false si estaba vacía.';
comment on column programacion_orden.tono is 'Rellenado a mano por el jefe cuando el pedido es nuevo. Vacío = aún no procesado en SAP.';
comment on column programacion_orden.calibre is 'Rellenado a mano por el jefe cuando el pedido es nuevo. Valores esperados a futuro: 3, 4, 44, SC.';

-- trigger simple para mantener updated_at
create or replace function set_updated_at_programacion_orden()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_programacion_orden_updated_at
before update on programacion_orden
for each row execute function set_updated_at_programacion_orden();
