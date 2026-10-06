-- =============================================================
-- Generaciones LIGADAS A CADA NIVEL (sesión de diseño 23/08/2026,
-- revisión sobre el diseño anterior de generaciones_disponibles
-- plano). Motivo: con un contador plano y un solo botón, solo se
-- podía generar el nivel actual EN VIVO (fn_nivel_actual) — no había
-- forma de generar la carta de un nivel ya superado, aunque el
-- operario hubiera recibido 3 generaciones "por" ese nivel.
--
-- Nuevo modelo: cada fila de personaje_stats_nivel (que ya representa
-- "este usuario alcanzó este nivel, con estas stats congeladas")
-- lleva su propio contador de 0 a 3 generaciones usadas. El operario
-- elige PARA QUÉ NIVEL alcanzado quiere generar, y la Edge Function
-- usa las stats CONGELADAS de ese nivel (no las en vivo) tanto para
-- la imagen como para la historia — más correcto que antes, donde la
-- imagen ya era de un nivel fijo pero la historia usaba stats en vivo.
--
-- usuario.generaciones_disponibles queda SIN USO desde esta migración
-- (no se borra la columna — es inofensiva ahí parada, nadie la lee
-- ni la escribe ya. Se puede eliminar más adelante si se quiere).
-- =============================================================

alter table personaje_stats_nivel
  add column if not exists generaciones_usadas int not null default 0
    check (generaciones_usadas >= 0 and generaciones_usadas <= 3);

comment on column personaje_stats_nivel.generaciones_usadas is
  'Cuántas de las 3 generaciones de ESTE nivel se han gastado ya. '
  'Sustituye a usuario.generaciones_disponibles (contador plano, '
  'solo servía para el nivel actual en vivo) — ver cabecera de esta '
  'migración.';

-- -------------------------------------------------------------
-- fn_consumir_generacion_nivel — auth.uid() SIEMPRE, nunca un
-- usuario_id que mande el cliente (mismo motivo de seguridad que
-- fn_seleccionar_personaje: es security definer, se salta RLS).
-- -------------------------------------------------------------
create or replace function fn_consumir_generacion_nivel(p_nivel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_filas_afectadas int;
begin
  if v_usuario_id is null then
    raise exception 'No hay sesión activa';
  end if;

  update personaje_stats_nivel
  set generaciones_usadas = generaciones_usadas + 1
  where usuario_id = v_usuario_id
    and nivel_id = p_nivel_id
    and generaciones_usadas < 3;

  get diagnostics v_filas_afectadas = row_count;
  return v_filas_afectadas > 0;
end;
$$;

comment on function fn_consumir_generacion_nivel(uuid) is
  'Consume 1 generación del nivel p_nivel_id PARA EL USUARIO QUE '
  'LLAMA (auth.uid(), nunca un parámetro del cliente). Devuelve false '
  'si no alcanzó ese nivel o ya gastó sus 3 generaciones ahí.';

-- -------------------------------------------------------------
-- fn_devolver_generacion_nivel — para cuando falla la generación
-- DESPUÉS de consumir el crédito (fallo de API externa, no culpa del
-- operario). Mismo criterio de seguridad: auth.uid(), no parámetro.
-- -------------------------------------------------------------
create or replace function fn_devolver_generacion_nivel(p_nivel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'No hay sesión activa';
  end if;

  update personaje_stats_nivel
  set generaciones_usadas = greatest(0, generaciones_usadas - 1)
  where usuario_id = v_usuario_id
    and nivel_id = p_nivel_id;
end;
$$;

comment on function fn_devolver_generacion_nivel(uuid) is
  'Devuelve 1 generación del nivel p_nivel_id al usuario que llama, '
  'si la generación falló tras consumir el crédito. greatest(0, ...) '
  'por seguridad, aunque no debería poder bajar de 0 en uso normal.';

-- -------------------------------------------------------------
-- v_niveles_disponibles_generar — para la pantalla Avatar: qué
-- niveles alcanzados tiene el usuario, cuántas generaciones le
-- quedan en cada uno, y si ya generó una carta para ese nivel.
-- RLS: mismo criterio que personaje_stats_nivel (propio o jefe/admin).
-- -------------------------------------------------------------
create or replace view v_niveles_disponibles_generar as
select
  psn.usuario_id,
  psn.nivel_id,
  n.nombre                          as nivel_nombre,
  n.orden                           as nivel_orden,
  psn.generaciones_usadas,
  3 - psn.generaciones_usadas       as generaciones_restantes,
  exists (
    select 1 from personaje_rpg pr
    where pr.usuario_id = psn.usuario_id and pr.nivel_en_generacion = psn.nivel_id
  ) as ya_generado
from personaje_stats_nivel psn
join niveles n on n.id = psn.nivel_id;

comment on view v_niveles_disponibles_generar is
  'Niveles alcanzados por cada usuario con sus generaciones '
  'restantes (de 3) y si ya hay una carta generada para ese nivel — '
  'apoyo directo de la pantalla Avatar (elegir para qué nivel generar).';
