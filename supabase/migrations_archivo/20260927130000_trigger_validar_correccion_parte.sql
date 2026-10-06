-- supabase/migrations_archivo/20260927130000_trigger_validar_correccion_parte.sql
--
-- Blindaje en BD de las reglas de corrección de partes. Complementa
-- el arreglo de frontend del 27/09/2026 (corregirParte hereda
-- responsable_id del original): parte_admin_todo deja al admin
-- insertar con cualquier responsable_id, y parte_insert_responsable
-- solo mira el rol, no la propiedad del parte corregido — sin este
-- trigger se podría colar una corrección saltándose el formulario.
--
-- Corre BEFORE INSERT, así que ve el original todavía vigente: el
-- que lo marca como no vigente es trg_parte_corregir (AFTER INSERT).

create or replace function fn_parte_validar_correccion()
returns trigger
language plpgsql
as $$
declare
  v_original record;
begin
  -- Solo aplica a inserts que son correcciones de otro parte.
  if new.corrige_a_parte_id is null then
    return new;
  end if;

  select responsable_id, vigente, completado, completado_at
  into v_original
  from parte
  where id = new.corrige_a_parte_id;

  if not found then
    raise exception 'El parte que se intenta corregir no existe';
  end if;

  -- Siempre: el responsable no puede cambiar al corregir.
  if new.responsable_id is distinct from v_original.responsable_id then
    raise exception 'No se puede cambiar el responsable de un parte al corregirlo';
  end if;

  -- Siempre (también admin): solo se corrige el parte vigente y
  -- completado. Corregir uno ya sustituido dejaría DOS vigentes para
  -- el mismo tramo (el nuevo + la corrección que ya existía).
  if not v_original.vigente or not v_original.completado then
    raise exception 'El parte original no está vigente o no está completado';
  end if;

  -- Administrador: sin más restricciones.
  if fn_rol_actual() = 'administrador' then
    return new;
  end if;

  -- Resto: debe ser el dueño, y dentro de la ventana de 1h.
  if v_original.responsable_id is distinct from auth.uid() then
    raise exception 'Solo puedes corregir partes de los que eres responsable';
  end if;

  if v_original.completado_at is null
     or v_original.completado_at <= now() - interval '1 hour' then
    raise exception 'Ya ha pasado la ventana de 1 hora para corregir este parte';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_parte_validar_correccion on parte;
create trigger trg_parte_validar_correccion
before insert on parte
for each row execute function fn_parte_validar_correccion();

comment on function fn_parte_validar_correccion() is
  'Blindaje en BD (no solo en UI) de las reglas de corrección de '
  'partes: el responsable nunca puede cambiar al corregir; solo se '
  'corrige el parte vigente y completado; un responsable normal solo '
  'puede corregir SUS PROPIOS partes dentro de la hora; el '
  'administrador, cualquiera, sin límite de tiempo. Antes esto solo '
  'lo impedía CorreccionPartesScreen/TurnoScreen en el cliente.';
