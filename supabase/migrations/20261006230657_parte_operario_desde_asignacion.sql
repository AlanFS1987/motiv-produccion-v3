-- Partes huérfanos: parte.operario_id se copia de la asignación SOLO al crear el parte.
-- Si el responsable asigna la línea después de abrir el parte, el parte se quedaba con
-- operario_id nulo para siempre (el operario perdía los puntos y no lo veía en "Mi línea").
--
-- Este trigger rellena operario_id en los partes vigentes de ese turno y línea que lo
-- tengan NULO cuando se crea o se modifica la asignación. Nunca pisa un operario ya
-- asignado: una reasignación a mitad de turno no cambia los partes ya hechos.
-- security definer: la RLS de parte limita la edición del responsable a 1 h tras completar.
-- UNIQUE (turno_id, linea_id) garantiza un único operario por turno y línea.

create or replace function public.fn_asignacion_rellena_operario_en_partes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.parte
     set operario_id = new.operario_id
   where turno_id = new.turno_id
     and linea_id = new.linea_id
     and operario_id is null
     and vigente;
  return null;
end;
$fn$;

revoke execute on function public.fn_asignacion_rellena_operario_en_partes() from public, anon, authenticated;

drop trigger if exists trg_asignacion_rellena_operario on public.asignacion_operario_linea;
create trigger trg_asignacion_rellena_operario
after insert or update of operario_id on public.asignacion_operario_linea
for each row execute function public.fn_asignacion_rellena_operario_en_partes();

-- Backfill: partes vigentes con operario nulo cuya línea y turno sí tienen asignación.
-- (Los que no tienen asignación no se pueden deducir y quedan pendientes de revisión manual.)
update public.parte p
   set operario_id = a.operario_id
  from public.asignacion_operario_linea a
 where a.turno_id = p.turno_id
   and a.linea_id = p.linea_id
   and p.operario_id is null
   and p.vigente;
