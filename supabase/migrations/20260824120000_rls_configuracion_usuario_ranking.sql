-- =============================================================
-- Sesión 24/08/2026 — auditoría de congruencia: tres huecos de RLS,
-- agrupados en una migración porque se detectaron en la misma pasada.
--
-- A) `configuracion` NO tenía RLS: se creó en 20260101000001 y nunca
--    entró en el bucle de catálogos de 20260101000010. En Supabase,
--    una tabla de `public` sin RLS queda con los grants por defecto
--    de PostgREST: cualquier usuario autenticado podía LEER y
--    también ESCRIBIR (`fecha_inicio_rotacion`, `objetivo_m2_dia`)
--    desde la consola del navegador. Se habilita RLS con el mismo
--    patrón que los catálogos: SELECT para autenticados (lo
--    necesitan fn_turno_de_letra / fn_ciclo_id / fn_ciclo_rango, que
--    NO son security definer y corren con los permisos de quien
--    consulta — incluso cuando se evalúan dentro de una política RLS
--    de `turno` —, y también la pantalla de fábrica, que lee
--    `fecha_inicio_rotacion` y `objetivo_m2_dia` directamente);
--    escritura solo administrador. Las Edge Functions usan
--    service_role y no se ven afectadas.
--
-- B) `usuario` solo era visible para uno mismo / admin /
--    (responsable-suplente → operarios). Los embeds de PostgREST
--    (`usuario:operario_id(username)` en lib/ranking.ts;
--    `responsable(username)` / `operario(username)` en el dashboard
--    del jefe) van contra la TABLA con la RLS de quien consulta —
--    resultado real: para un operario, el podio del ciclo actual
--    salía con "—" en todos los nombres menos el suyo; para el
--    jefe, la Vista Detallada sin nombres y el filtro por
--    responsable (ilike sobre `usuario`) ignorado en silencio.
--    (Los "Reyes del formato" sí funcionaban porque
--    v_rey_formato_historico expone el username desde una VISTA,
--    que corre con permisos del owner y salta la RLS — dos
--    mecanismos distintos para el mismo dato; esta política los
--    vuelve coherentes.)
--    Compromiso asumido y documentado: RLS es por FILA, no por
--    columna, así que esto expone también rol/letra (datos
--    operativos, públicos de facto en la fábrica: la letra determina
--    quién trabaja cada turno) y generaciones_disponibles (columna
--    ya sin significado desde 23/08/2026). La alternativa "solo
--    username" exigiría una vista dedicada + cambiar los embeds del
--    frontend a joins manuales — no compensa en una app interna de
--    ≤30 usuarios.
--
-- C) `historial_ciclos` solo era visible propio / jefe / admin — el
--    podio del CICLO ANTERIOR (lib/ranking.ts consulta la tabla
--    directamente, no una vista) devolvía a cada operario únicamente
--    su propia fila: un podio de una persona. Un ranking existe para
--    compararse, así que se abre el SELECT también a
--    operario/responsable (y a `pantalla`, para la futura diapositiva
--    de Ranking del carrusel). La escritura sigue sin existir para
--    ningún rol: solo escribe fn_cerrar_ciclos_pendientes
--    (security definer).
--
-- Como siempre en este proyecto: políticas NUEVAS que se SUMAN con
-- OR — no se toca ni amplía ninguna existente. Todo idempotente.
-- =============================================================

-- -------------------------------------------------------------
-- A) configuracion
-- -------------------------------------------------------------
alter table configuracion enable row level security;

do $$ begin
  create policy configuracion_select_autenticados on configuracion
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy configuracion_admin_todo on configuracion
    for all using (fn_rol_actual() = 'administrador')
    with check (fn_rol_actual() = 'administrador');
exception when duplicate_object then null; end $$;

comment on table configuracion is
  'Valores de configuración global (fecha_inicio_rotacion, '
  'objetivo_m2_dia...). RLS habilitada 24/08/2026 — hasta entonces '
  'la tabla estaba SIN RLS y era escribible por cualquier '
  'autenticado vía PostgREST (hueco detectado en auditoría, nunca '
  'explotado que se sepa). Lectura: autenticados (la necesitan '
  'fn_turno_de_letra/fn_ciclo_id, que no son security definer, y la '
  'pantalla de fábrica). Escritura: solo administrador.';

-- -------------------------------------------------------------
-- B) usuario — SELECT para cualquier rol conocido
-- fn_rol_actual() devuelve null si el uid no tiene fila en usuario,
-- así que "is not null" = "cualquier usuario real de la app",
-- incluidos pantalla y jefe_rectificado sin tener que mantener una
-- lista que se quede corta al añadir roles.
-- -------------------------------------------------------------
do $$ begin
  create policy usuario_select_roles_conocidos on usuario
    for select using (fn_rol_actual() is not null);
exception when duplicate_object then null; end $$;

comment on policy usuario_select_roles_conocidos on usuario is
  'Cualquier rol conocido puede leer usuario — necesario para los '
  'embeds de PostgREST del Ranking (usuario:operario_id(username)) y '
  'de la Vista Detallada del jefe, que van contra la tabla con la '
  'RLS de quien consulta. Expone también rol/letra (públicos de '
  'facto en fábrica) — compromiso documentado 24/08/2026, RLS por '
  'fila no permite restringir columnas. Se SUMA a usuario_select_propio '
  'y usuario_select_operarios_para_responsable (que quedan '
  'redundantes pero inofensivas).';

-- -------------------------------------------------------------
-- C) historial_ciclos — SELECT para los roles que ven el ranking
-- -------------------------------------------------------------
do $$ begin
  create policy historial_ciclos_select_ranking on historial_ciclos
    for select using (
      fn_rol_actual() in ('operario', 'responsable', 'pantalla')
    );
exception when duplicate_object then null; end $$;

comment on policy historial_ciclos_select_ranking on historial_ciclos is
  'El podio del ciclo anterior (lib/ranking.ts) consulta esta tabla '
  'directamente: sin esto, cada operario solo veía su propia fila '
  '(RLS "propio/jefe/admin") y el podio salía de una persona. '
  '`pantalla` incluida para la futura diapositiva de Ranking del '
  'carrusel. Se SUMA a historial_ciclos_select con OR.';
