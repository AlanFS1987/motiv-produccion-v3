-- =============================================================
-- Gamificación — snapshot de stats por nivel + bonus de generaciones
-- disparado a mano por el administrador (sesión 23/08/2026).
--
-- DISEÑO ACORDADO:
--
-- - "Subir de nivel" no es un evento en la BD (el nivel siempre se
--   calcula al vuelo con fn_nivel_actual, nunca se persiste) y no hay
--   un único punto de mutación de puntos (parte, checklist, cierre de
--   ciclo) donde enganchar un trigger sin recrear el mismo patrón de
--   contador mutable que 20260822180000 documenta evitar a propósito
--   (v2: `fuerza = fuerza + delta`, se desincroniza con correcciones).
-- - En vez de eso: el administrador es el disparador manual, desde
--   una vista de usuarios ampliada (puntos totales, puntos para el
--   siguiente nivel, botón "otorgar generaciones"). Sin ventana de
--   tiempo que se cierre — el botón queda disponible indefinidamente
--   hasta que se pulse, así que un despiste del admin retrasa el
--   bonus pero nunca lo pierde.
-- - Sin campo de control aparte ("¿ya se otorgó?"): la propia
--   EXISTENCIA de la fila en `personaje_stats_nivel` para
--   (usuario_id, nivel_id) es la fuente de verdad. Nada que
--   sincronizar en dos sitios, nada que se pueda desincronizar. El
--   UNIQUE de abajo además previene doble clic sin lógica extra.
-- - Esta tabla resuelve de paso el objetivo original: que una carta
--   (`personaje_rpg`) generada tarde para un nivel ya superado siga
--   mostrando los stats DE CUANDO se alcanzó ese nivel, no los stats
--   en vivo del momento de generar. `generar-personaje` deberá leer
--   de aquí en vez de `v_stats_vida` — pendiente de tocar esa Edge
--   Function en otra sesión.
-- =============================================================

-- -------------------------------------------------------------
-- personaje_stats_nivel — snapshot de los 4 stats (fuerza,
-- resistencia, velocidad, vida) en el momento en que el
-- administrador otorga el bonus de ese nivel. Un registro por
-- usuario+nivel, nunca se actualiza (si se necesitara recalcular,
-- se borra y se vuelve a otorgar — no hay UPDATE previsto).
-- -------------------------------------------------------------
create table personaje_stats_nivel (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuario(id),
  nivel_id    uuid not null references niveles(id),
  fuerza      numeric not null,
  resistencia numeric not null,
  velocidad   numeric,
  vida        numeric not null,
  created_at  timestamptz not null default now(),
  unique (usuario_id, nivel_id)
);

create index idx_personaje_stats_nivel_usuario on personaje_stats_nivel (usuario_id);

comment on table personaje_stats_nivel is
  'Snapshot de fuerza/resistencia/velocidad/vida del usuario en el '
  'momento en que el administrador otorga el bonus de generaciones '
  'de un nivel (fn_otorgar_bonus_nivel). La existencia de la fila '
  '(usuario_id, nivel_id) ES el estado "ya otorgado" — no hay columna '
  'de control aparte. velocidad puede ser NULL igual que en '
  'v_stats_vida (sin tiempo_plena todavía). Pensada para que '
  'generar-personaje lea de aquí en vez de v_stats_vida en vivo, así '
  'una carta generada tarde para un nivel ya superado sigue '
  'mostrando el pasado del operario en ese nivel, no su presente.';

-- RLS: mismo patrón que historial_ciclos (propio; jefe; admin) — es
-- dato de progreso personal, visible para el propio usuario y para
-- quien gestiona la fábrica, nunca editable desde el cliente (solo
-- vía fn_otorgar_bonus_nivel, security definer).
alter table personaje_stats_nivel enable row level security;

create policy personaje_stats_nivel_select on personaje_stats_nivel
  for select
  using (
    usuario_id = auth.uid()
    or fn_rol_actual() in ('jefe', 'administrador')
  );

-- -------------------------------------------------------------
-- fn_otorgar_bonus_nivel — llamada por el botón del admin en la
-- vista de usuarios. Idempotente por diseño: si el nivel actual ya
-- tiene fila en personaje_stats_nivel, no hace nada y devuelve
-- otorgado=false (el frontend ya debería tener el botón
-- deshabilitado en ese caso, pero la función no confía en eso).
--
-- Orden deliberado (ver conversación de diseño): primero se
-- persisten los stats, DESPUÉS se otorgan las generaciones — así, si
-- algo fallara a media función, nunca queda un usuario con
-- generaciones ya otorgadas pero sin snapshot que las respalde.
-- -------------------------------------------------------------
create or replace function fn_otorgar_bonus_nivel(p_usuario_id uuid)
returns table (otorgado boolean, nivel_id uuid, nivel_nombre text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol         rol_usuario;
  v_nivel_id    uuid;
  v_nivel_nombre text;
  v_fuerza      numeric;
  v_resistencia numeric;
  v_velocidad   numeric;
  v_vida        numeric;
  v_insertadas  int;
begin
  select rol into v_rol from usuario where id = p_usuario_id;
  if v_rol not in ('operario', 'responsable') then
    raise exception 'El rol % no tiene gamificación (solo operario/responsable)', v_rol;
  end if;

  v_nivel_id := fn_nivel_actual(p_usuario_id);
  select nombre into v_nivel_nombre from niveles where id = v_nivel_id;

  -- Stats en vivo del momento (fuerza/resistencia/velocidad de
  -- v_stats_vida; vida = puntos totales de la vista que toque según
  -- el rol, misma fuente que usa fn_nivel_actual).
  select fuerza, resistencia, velocidad
    into v_fuerza, v_resistencia, v_velocidad
  from v_stats_vida
  where usuario_id = p_usuario_id and rol = v_rol::text;

  if v_rol = 'operario' then
    select puntos_totales into v_vida
    from v_puntos_operario_total_vida where operario_id = p_usuario_id;
  else
    select puntos_totales into v_vida
    from v_puntos_responsable_total_vida where responsable_id = p_usuario_id;
  end if;

  -- Intento de snapshot — si ya existía (usuario_id, nivel_id), el
  -- ON CONFLICT lo absorbe sin lanzar error y sin insertar nada.
  insert into personaje_stats_nivel (usuario_id, nivel_id, fuerza, resistencia, velocidad, vida)
  values (p_usuario_id, v_nivel_id, coalesce(v_fuerza, 0), coalesce(v_resistencia, 0), v_velocidad, coalesce(v_vida, 0))
  on conflict (usuario_id, nivel_id) do nothing;

  get diagnostics v_insertadas = row_count;

  if v_insertadas > 0 then
    perform fn_otorgar_generaciones_por_nivel(p_usuario_id, 3);
  end if;

  return query select (v_insertadas > 0), v_nivel_id, v_nivel_nombre;
end;
$$;

comment on function fn_otorgar_bonus_nivel(uuid) is
  'Botón "otorgar generaciones" de la vista de usuarios del admin. '
  'Guarda el snapshot de stats del nivel actual (fuerza/resistencia/'
  'velocidad/vida) y, solo si es la primera vez para ese nivel, '
  'otorga +3 generaciones. Idempotente: repetir la llamada para un '
  'nivel ya otorgado no hace nada (otorgado=false en el resultado).';

-- -------------------------------------------------------------
-- v_admin_usuarios_gamificacion — apoyo directo para la vista de
-- usuarios: puntos totales, nivel actual, puntos que faltan para el
-- siguiente nivel, y si el nivel actual ya tiene el bonus otorgado
-- (para que el frontend sepa de un vistazo si debe deshabilitar el
-- botón, sin tener que hacer un EXISTS aparte por cada fila).
-- -------------------------------------------------------------
create or replace view v_admin_usuarios_gamificacion as
with puntos as (
  select operario_id as usuario_id, 'operario'::rol_usuario as rol, puntos_totales
  from v_puntos_operario_total_vida
  union all
  select responsable_id, 'responsable'::rol_usuario, puntos_totales
  from v_puntos_responsable_total_vida
)
select
  p.usuario_id,
  p.rol,
  p.puntos_totales,
  n.id                                  as nivel_actual_id,
  n.nombre                              as nivel_actual_nombre,
  n.orden                               as nivel_actual_orden,
  case when p.rol = 'operario' then n.umbral_max else n.umbral_max_responsable end
    as umbral_max_nivel_actual,
  siguiente.id                          as siguiente_nivel_id,
  siguiente.nombre                      as siguiente_nivel_nombre,
  case when p.rol = 'operario' then siguiente.umbral_min else siguiente.umbral_min_responsable end
    as puntos_siguiente_nivel,
  case
    when siguiente.id is null then null
    else greatest(
      0,
      (case when p.rol = 'operario' then siguiente.umbral_min else siguiente.umbral_min_responsable end)
        - p.puntos_totales
    )
  end                                    as puntos_para_siguiente_nivel,
  (psn.id is not null)                  as bonus_nivel_actual_otorgado
from puntos p
join niveles n
  on p.puntos_totales >= (case when p.rol = 'operario' then n.umbral_min else n.umbral_min_responsable end)
  and (
    (case when p.rol = 'operario' then n.umbral_max else n.umbral_max_responsable end) is null
    or p.puntos_totales <= (case when p.rol = 'operario' then n.umbral_max else n.umbral_max_responsable end)
  )
left join niveles siguiente on siguiente.orden = n.orden + 1
left join personaje_stats_nivel psn
  on psn.usuario_id = p.usuario_id and psn.nivel_id = n.id;

comment on view v_admin_usuarios_gamificacion is
  'Una fila por operario/responsable: puntos totales, nivel actual, '
  'puntos que faltan para el siguiente (null si ya está en el '
  'último), y si el bonus de generaciones del nivel actual ya se '
  'otorgó (bonus_nivel_actual_otorgado) — controla directamente si '
  'el botón de la vista de usuarios del admin debe estar habilitado.';
