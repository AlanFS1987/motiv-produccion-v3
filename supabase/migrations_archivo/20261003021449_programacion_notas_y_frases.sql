-- 03/10/2026 — Programación, fase A2: notas por orden y frases frecuentes.
--
-- Las notas hoy se escriben a mano sobre la hoja impresa. Una nota se escribe una vez y se
-- aplica a varias órdenes (caso real: 15 órdenes con la misma nota).
--
-- * `programacion_nota`: varias notas por orden. Se referencian por `numero_orden` SIN FK a
--   `programacion_orden` a propósito: las notas sobreviven si la orden sale de programación
--   (y sirven a otras partes de la app; `lote` ya usa `numero_orden`). El autor se guarda
--   como `usuario.id` (FK, `on delete set null`); el nombre sale de `usuario.username`,
--   como en el resto de la app.
-- * `programacion_nota_frase`: frases frecuentes para el desplegable (las edita el
--   administrador; baja lógica con `activa = false`).
--
-- Seguridad: RLS desde la creación, solo SELECT por rol, ningún permiso a anon y ninguna
-- política de escritura. Toda escritura pasa por las RPC de abajo (security definer).
-- Aditiva: no toca nada existente.

-- -------------------------------------------------------------
-- 1) Tablas
-- -------------------------------------------------------------
create table if not exists programacion_nota (
  id            uuid primary key default gen_random_uuid(),
  numero_orden  text not null check (length(trim(numero_orden)) > 0),
  texto         text not null check (length(trim(texto)) between 1 and 500),
  creado_por    uuid default auth.uid() references usuario (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table programacion_nota is
  'Notas por orden de programación (varias por orden). Referencia por numero_orden SIN FK: sobreviven si la orden sale de programación. Solo escritura vía RPC (anadir_nota_ordenes/editar_nota/borrar_nota).';

create index if not exists programacion_nota_numero_orden_idx
  on programacion_nota (numero_orden);

create table if not exists programacion_nota_frase (
  id      uuid primary key default gen_random_uuid(),
  texto   text not null unique check (length(trim(texto)) between 1 and 200),
  activa  boolean not null default true,
  orden   integer not null default 0
);

comment on table programacion_nota_frase is
  'Frases frecuentes para las notas de programación. Las edita el administrador (guardar_frase); baja lógica con activa = false.';

create or replace function set_updated_at_programacion_nota()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_programacion_nota_updated_at on programacion_nota;
create trigger trg_programacion_nota_updated_at
  before update on programacion_nota
  for each row execute function set_updated_at_programacion_nota();

-- Siembra (idempotente)
insert into programacion_nota_frase (texto, orden) values
  ('guardar 2 palets y una caja', 10),
  ('recordar sacar palet de revisión', 20),
  ('cuidado diseño UGL', 30)
on conflict (texto) do nothing;

-- -------------------------------------------------------------
-- 2) RLS: solo SELECT por rol; sin permisos a anon; sin escritura directa
-- -------------------------------------------------------------
alter table programacion_nota enable row level security;
alter table programacion_nota_frase enable row level security;

revoke all on programacion_nota from public, anon, authenticated;
revoke all on programacion_nota_frase from public, anon, authenticated;
grant select on programacion_nota to authenticated;
grant select on programacion_nota_frase to authenticated;

drop policy if exists programacion_nota_select on programacion_nota;
create policy programacion_nota_select on programacion_nota
  for select to authenticated
  using (coalesce(fn_rol_actual()::text, '') in ('jefe', 'responsable', 'produccion', 'administrador'));

drop policy if exists programacion_nota_frase_select on programacion_nota_frase;
create policy programacion_nota_frase_select on programacion_nota_frase
  for select to authenticated
  using (coalesce(fn_rol_actual()::text, '') in ('jefe', 'responsable', 'produccion', 'administrador'));

-- -------------------------------------------------------------
-- 3) RPC de notas (jefe / administrador)
-- -------------------------------------------------------------

-- Añade la misma nota a varias órdenes. Todo o nada: si falla una validación no se
-- inserta ninguna. Devuelve cuántas notas se han creado.
create or replace function anadir_nota_ordenes(p_ordenes text[], p_texto text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto        text := trim(coalesce(p_texto, ''));
  v_ordenes      text[];
  v_repetidas    text[];
  v_desconocidas text[];
  v_n            integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if length(v_texto) < 1 or length(v_texto) > 500 then
    raise exception 'La nota debe tener entre 1 y 500 caracteres';
  end if;

  if p_ordenes is null or cardinality(p_ordenes) = 0 then
    raise exception 'Indica al menos una orden';
  end if;
  if cardinality(p_ordenes) > 200 then
    raise exception 'Demasiadas órdenes (máximo 200 por nota)';
  end if;

  select array_agg(trim(coalesce(o, ''))) into v_ordenes from unnest(p_ordenes) as o;

  if exists (select 1 from unnest(v_ordenes) as o where o = '') then
    raise exception 'La lista contiene órdenes vacías';
  end if;

  select array_agg(o order by o) into v_repetidas
  from (select o from unnest(v_ordenes) as o group by o having count(*) > 1) d;
  if v_repetidas is not null then
    raise exception 'Órdenes repetidas en la lista: %', array_to_string(v_repetidas, ', ');
  end if;

  select array_agg(o order by o) into v_desconocidas
  from unnest(v_ordenes) as o
  where not exists (select 1 from programacion_orden po where po.numero_orden = o);
  if v_desconocidas is not null then
    raise exception 'Órdenes que no están en la programación: %', array_to_string(v_desconocidas, ', ');
  end if;

  insert into programacion_nota (numero_orden, texto, creado_por)
  select o, v_texto, auth.uid() from unnest(v_ordenes) as o;
  get diagnostics v_n = row_count;

  return v_n;
end;
$$;

create or replace function editar_nota(p_id uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text := trim(coalesce(p_texto, ''));
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if length(v_texto) < 1 or length(v_texto) > 500 then
    raise exception 'La nota debe tener entre 1 y 500 caracteres';
  end if;

  update programacion_nota set texto = v_texto where id = p_id;
  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    raise exception 'La nota no existe';
  end if;
end;
$$;

create or replace function borrar_nota(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  delete from programacion_nota where id = p_id;
  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    raise exception 'La nota no existe';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 4) RPC de frases (solo administrador). p_id nulo = alta; si no, edición.
--    Baja lógica con p_activa = false. En una edición, p_activa/p_orden nulos
--    conservan el valor actual; en un alta, activa = true y orden = al final.
-- -------------------------------------------------------------
create or replace function guardar_frase(p_id uuid, p_texto text, p_activa boolean, p_orden integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text := trim(coalesce(p_texto, ''));
  v_id    uuid;
  v_filas integer;
begin
  if coalesce(fn_rol_actual()::text, '') <> 'administrador' then
    raise exception 'No autorizado';
  end if;

  if length(v_texto) < 1 or length(v_texto) > 200 then
    raise exception 'La frase debe tener entre 1 y 200 caracteres';
  end if;

  if p_id is null then
    insert into programacion_nota_frase (texto, activa, orden)
    values (
      v_texto,
      coalesce(p_activa, true),
      coalesce(p_orden, (select coalesce(max(orden), 0) + 10 from programacion_nota_frase))
    )
    returning id into v_id;
  else
    update programacion_nota_frase
       set texto = v_texto,
           activa = coalesce(p_activa, activa),
           orden = coalesce(p_orden, orden)
     where id = p_id;
    get diagnostics v_filas = row_count;
    if v_filas = 0 then
      raise exception 'La frase no existe';
    end if;
    v_id := p_id;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe una frase con ese texto';
end;
$$;

revoke execute on function anadir_nota_ordenes(text[], text) from public, anon;
revoke execute on function editar_nota(uuid, text) from public, anon;
revoke execute on function borrar_nota(uuid) from public, anon;
revoke execute on function guardar_frase(uuid, text, boolean, integer) from public, anon;
grant execute on function anadir_nota_ordenes(text[], text) to authenticated;
grant execute on function editar_nota(uuid, text) to authenticated;
grant execute on function borrar_nota(uuid) to authenticated;
grant execute on function guardar_frase(uuid, text, boolean, integer) to authenticated;
