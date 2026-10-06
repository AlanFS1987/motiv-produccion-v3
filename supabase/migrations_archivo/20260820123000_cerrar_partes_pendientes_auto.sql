-- =============================================================
-- Cerrar "sin producción" los partes que quedan a medias cuando el
-- turno se cierra automáticamente (07-pendientes.md #1) — decisión
-- sesión 20/08/2026: mismo comportamiento que el botón "Cerrar sin
-- producción" que ya usa el responsable a mano
-- (lib/parte.ts -> cerrarSinProduccion), solo que lo dispara el cron
-- en vez de una persona.
--
-- Sin esto, un parte completado=false cuyo turno cierra por reloj
-- quedaba huérfano para siempre: vigente, sin producción, sin
-- aparecer en ningún sitio (el informe de turno solo lista partes
-- con piezas_entradas > 0, "Mi línea" del operario deja de mostrarlo
-- en cuanto cambia el turno).
-- =============================================================

create or replace function fn_encolar_resumenes_turno_pendientes()
returns void
language plpgsql
as $$
declare
  r record;
  v_turnos_cerrados uuid[];
begin
  -- 1) Detectar y marcar cierres automáticos, guardando qué turnos
  -- se acaban de cerrar en este pase.
  with cerrados as (
    update turno
    set cerrado_at = now(),
        como_cerro = 'automatico'
    where cerrado_at is null
      and (
        (
          case tipo
            when 'M' then (fecha + time '14:00')
            when 'T' then (fecha + time '22:00')
            when 'N' then ((fecha + 1) + time '06:00')
          end
        ) at time zone 'Europe/Madrid'
      ) + interval '1 hour' < now()
    returning id
  )
  select array_agg(id) into v_turnos_cerrados from cerrados;

  -- 1b) Cerrar sin producción cualquier parte que quedó a medias en
  -- esos turnos.
  if v_turnos_cerrados is not null then
    update parte
    set completado = true,
        completado_at = now()
    where turno_id = any(v_turnos_cerrados)
      and completado = false
      and vigente = true;
  end if;

  -- 2) Reintento de envíos que quedaron sin confirmar.
  for r in
    select id from turno
    where cerrado_at is not null
      and resumen_enviado_at is null
      and cerrado_at < now() - interval '5 minutes'
  loop
    perform fn_disparar_resumen_turno(r.id);
  end loop;
end;
$$;