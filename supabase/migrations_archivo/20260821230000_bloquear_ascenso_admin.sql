-- supabase/migrations/20260821230000_bloquear_ascenso_admin.sql
-- Refuerzo de la decisión ya tomada en 09-administrador.md ("Alta de
-- usuarios desde la app" descartada por riesgo): el rol admin solo se
-- asigna por SQL a mano. Este trigger bloquea que un UPDATE sobre
-- `usuario` (desde el panel, desde un bug de UI, o desde cualquier
-- sitio que pase por RLS) le dé rol='administrador' a alguien que no
-- lo tenía ya. No afecta al INSERT manual que se sigue haciendo desde
-- el Dashboard de Supabase.

create or replace function fn_bloquear_ascenso_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol = 'administrador' and old.rol is distinct from 'administrador' then
    raise exception 'No se puede asignar el rol administrador desde la aplicación.';
  end if;
  return new;
end;
$$;

create trigger trg_usuario_bloquear_ascenso_admin
  before update on usuario
  for each row execute function fn_bloquear_ascenso_admin();