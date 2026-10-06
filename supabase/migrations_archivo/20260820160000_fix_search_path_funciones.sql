-- =============================================================
-- Fix: funciones security definer sin `search_path` fijado
-- (07-pendientes.md #7). Sin esto, Postgres resuelve nombres de
-- tablas/funciones según el search_path de quien LLAMA a la
-- función, no de quien la definió — con security definer eso abre
-- la puerta a que alguien con permisos de crear objetos cuele una
-- tabla/función con el mismo nombre en otro esquema que se resuelva
-- primero. Fijar search_path = public cierra esa ambigüedad.
-- =============================================================

create or replace function fn_rol_actual()
returns rol_usuario
language sql stable security definer
set search_path = public
as $$
  select rol from usuario where id = auth.uid();
$$;

create or replace function fn_es_responsable_de_turno(p_turno_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from turno t
    where t.id = p_turno_id and t.abierto_por = auth.uid()
  ) or fn_rol_actual() in ('responsable', 'suplente');
$$;