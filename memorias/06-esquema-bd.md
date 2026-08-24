# 06 — Esquema de base de datos

Contrastado con la BD real el 19/08/2026 y actualizado con cada
migración hasta `20260824130000`. `supabase db diff --linked` sin
diferencias (21/08/2026). Para regenerar: `information_schema.columns`,
`pg_policies`, `pg_proc`, `cron.job`.

Extensiones: `pg_trgm`, `pgcrypto`, `pg_cron`, `pg_net`.

## Enums

- `rol_usuario`: responsable, jefe, produccion, calidad, operario,
  administrador, suplente, pantalla, jefe_rectificado (los 9 cubiertos
  por migración).
- `letra_turno`: A, B, C, D. `tipo_turno`: M, T, N.
- `estado_lote`: iniciado, finalizado.

## Tablas

**configuracion** (clave PK, valor, nota). Filas: `fecha_inicio_rotacion
= 2026-02-16` (ver `01`), `objetivo_m2_dia = 35000` (ver `10`).

**app_secrets** (key PK, value). Sin acceso para anon/authenticated.
Fila `telegram_webhook_secret`.

**usuario** — id PK = `auth.users.id`, username unique, rol, letra
(solo responsables y operarios; null para el resto),
`generaciones_disponibles` (sin significado desde 23/08/2026 — el
contador real es `personaje_stats_nivel.generaciones_usadas`; la
columna sigue leyéndose en código, ver `07`), created_at. Índice
único parcial: una sola fila con rol = suplente. 27 usuarios reales
(`CLAUDE.md`).

**modelo / marca** — id, nombre, nombre_normalizado (trigger),
created_at. Índice GIN trgm.

**formato** — id, nombre unique (7 filas), `area_m2` derivado del
nombre (`[VERIFICAR]`, ver `01`).

**producto** — id, modelo_id, marca_id, formato_id, created_at; unique
(modelo, marca, formato).

**lote** — id, numero_orden unique, producto_id,
acabado_codigo/tipo/nombre, espesor check ('9mm','11mm'), tipo_palet,
pza_caja, objetivo_m2, codbar_caja, codbar_pieza, cod_upec, codbar_saso,
observaciones_material, observaciones_orden, texto_crudo_modelo,
texto_crudo_marca, estado estado_lote default iniciado,
resumen_calidad_enviado_at, created_by, created_at.

**linea** — id, nombre unique (Línea 1…6).

**turno** — id, fecha date, tipo, cerrado_at, como_cerro
('manual'/'automatico'), resumen_enviado_at, abierto_por, created_at;
unique (fecha, tipo).

**asignacion_operario_linea** — id, turno_id, linea_id, operario_id,
created_at; unique (turno, línea).

**refuerzo_operario_turno** — id, turno_id, operario_id, habilitado_por,
created_at; unique (turno, operario).

**parte** — id, turno_id, linea_id, lote_id, responsable_id,
operario_id (nullable, fuente única de quién hizo el parte — `01`),
`formato_id` (denormalizado de `producto` vía `lote` por trigger
BEFORE INSERT, solo para indexar; backfill hecho), tono, calibre,
verificacion_caja_estado (correcto/incorrecto/no_verificable/verificado_manual),
fotos_caja text[], verificacion_caja_detalle jsonb,
verificacion_codbar_estado (completo/parcial/manual/no_realizada),
verificacion_codbar_detalle jsonb, las 5 columnas `*_operario`
equivalentes, piezas_1a, piezas_comercial, piezas_eco,
piezas_descuadre_com, piezas_planar_com, piezas_contenedor,
piezas_entradas (int default 0), cal_1…cal_8, minutos_total,
minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco,
minutos_maquina (int default 0), hora_captura_pantalla timestamptz,
hora_captura_pantalla_texto_crudo, calibre_com_pct numeric (trigger),
calibre_std_pct numeric generada, vigente bool default true,
corrige_a_parte_id FK parte, completado bool default false,
completado_at, created_at. Índice `idx_parte_formato_record`
(`formato_id, vigente, completado, piezas_entradas desc`).

**incidencia_calidad** — id, parte_id, descripcion, fotos text[],
created_by, created_at.

**incidencia_produccion** — id, turno_id, linea_id (nullable = todo el
turno), descripcion, fotos, created_by, created_at.

**cierre_fabrica** — id, fecha_inicio, fecha_fin (check fin ≥ inicio).

**checklist_items** — id, nombre, puntos default 1, activo. 6 filas.

**operario_checklist** — id, linea_id, turno_id, checklist_item_id,
operario_id, fotos_antes text[], fotos_despues text[], created_at;
unique (línea, turno, ítem).

**puntos_rendimiento** (6 filas), **puntos_rendimiento_responsable**
(10), **puntos_piezas** (formato, min, max nullable, puntos — 35),
**puntos_metros** (10). Tramos en `04`.

**niveles** — 9 filas: nombre, umbral_min/max, descripcion, color,
estrellas, efecto_aura, prompt_base, prompt_imagen, orden, +
`umbral_min_responsable`/`umbral_max_responsable` generadas (×1,5).

**logros_definicion** — 19 filas sembradas (operario). Columnas
`rol` (default 'operario'), `formato_nombre`, `condicion_tipo`,
`condicion_valor` (nullable). `operario_logro` (progreso guardado) se
eliminó el 22/08/2026: todo se calcula por consulta (`04`).

**personaje_rpg** — usuario, nivel_en_generacion, imagen_url, historia,
seleccionada. Índice único `uq_personaje_rpg_seleccionada`.

**personaje_stats_nivel** — unique (usuario_id, nivel_id); fuerza,
resistencia, velocidad, vida congelados; `generaciones_usadas` int
default 0 check 0-3. La existencia de la fila = nivel otorgado (`04`).

**historial_ciclos** — usuario, rol, cycle_id, fecha_cierre,
puntos_ciclo, puntos_piezas, puntos_rendimiento, puntos_limpieza
(desglose solo para operarios), fuerza, resistencia, velocidad,
m2_total, m2_std, m2_com, m2_contenedor, piezas_total, tiempo_*,
piezas_por_formato jsonb; unique (usuario, cycle_id). Contiene los
datos migrados de v2 (ciclos 0..6, operarios y responsables — `04`);
el primer cierre automático real será el del ciclo 7 (28/09/2026).

**ceria_prompts**, **ceria_conversaciones**, **ceria_mensajes** — `11`.

## Vistas

Todas sin `security_invoker`: se evalúan como el owner y saltan RLS
(convención en `CLAUDE.md`). Es lo que permite que `pantalla`, Ranking
y Logros lean agregados de tablas cuya RLS no les cubre.

Dashboard (`08`): `v_produccion_turno`, `v_calidad_turno`,
`v_calidad_modelo`, `v_calidad_lote`.

Puntos operario (`04`): `operario_ledger` (partes vigentes y
completados, operario = `parte.operario_id`),
`v_rendimiento_operario_por_turno`, `v_puntos_rendimiento_operario_ciclo`,
`v_piezas_formato_linea_turno` → `v_puntos_piezas_linea_turno` →
`v_puntos_piezas_operario_por_linea_turno`,
`v_puntos_limpieza_operario_por_turno`, `v_puntos_operario_total_vida`,
`v_puntos_{piezas,rendimiento,limpieza}_operario_total_vida`,
`v_puntos_{piezas,limpieza}_operario_ciclo` → `v_puntos_operario_ciclo`
(con `username` horneado desde 24/08).

Producción/stats/logros operario: `v_piezas_operario_formato_ciclo` →
`v_produccion_operario_ciclo`, `v_stats_vida`, `v_rey_formato_historico`,
`v_rey_formato_actual`, `v_mi_mejor_parte_por_formato`,
`v_ganador_por_ciclo`, `v_veces_rey_de_reyes`, `v_avatar_activo_operario`
(solo `imagen_url`, para saltar la RLS de `personaje_rpg`).

Responsable: `v_metros_responsable_por_turno` →
`v_puntos_metros_responsable_por_turno`,
`v_rendimiento_responsable_por_turno`,
`v_puntos_rendimiento_responsable_ciclo`, `v_metros_responsable_ciclo`,
`v_puntos_metros_responsable_ciclo` → `v_puntos_responsable_ciclo`,
`v_tiempo_responsable_ciclo`, `v_puntos_responsable_total_vida`.

Personaje/admin: `v_niveles_disponibles_generar`,
`v_admin_usuarios_gamificacion`.

## Funciones

| Función | Notas |
|---|---|
| `fn_rol_actual()` | security definer, stable, `set search_path = public` |
| `fn_normalizar_texto(text)` | immutable |
| `fn_turno_de_letra(date, letra)`, `fn_letra_de_turno`, `fn_ciclo_id(date)`, `fn_ciclo_rango(int)` | stable |
| `fn_fabrica_cerrada(date)`, `fn_bloquear_turno_en_cierre()` | cierre anual |
| `fn_bloquear_ascenso_admin()` | trigger en `usuario`: rechaza UPDATE a rol administrador |
| `fn_reabrir_lote_si_finalizado(uuid)`, `fn_parte_reabre_lote()` | estado → iniciado, limpia resumen_calidad_enviado_at |
| `fn_marcar_corregido_no_vigente()` | trigger de parte, security definer |
| `fn_parte_restringir_columnas_update()` | trigger before update en parte (`05`) |
| `fn_parte_set_formato_id()` | trigger before insert en parte |
| `fn_calcular_calibre_com_pct()` | trigger before insert/update en parte |
| `fn_buscar_modelo_similar`, `fn_buscar_marca_similar` | pg_trgm, top 5 |
| `fn_notificar_telegram()`, `fn_disparar_resumen_turno(uuid)`, `fn_disparar_resumen_calidad()` | security definer, leen app_secrets, `net.http_post` |
| `fn_encolar_resumenes_turno_pendientes()` | cierre automático + reintento |
| `fn_cerrar_ciclos_pendientes()` | security definer, idempotente (`04`) |
| `fn_nivel_actual(uuid)` | security definer, stable |
| `fn_guardar_personaje_generado(uuid, uuid, text, text)` | security definer, atómico; la llama `generar-personaje` |
| `fn_consumir_generacion_nivel(p_usuario_id, p_nivel_id)`, `fn_devolver_generacion_nivel(…)` | security definer, ejecución **solo service_role** |
| `fn_seleccionar_personaje(p_personaje_id)` | security definer, `auth.uid()`; la llama el cliente |
| `fn_otorgar_bonus_nivel(uuid)` | security definer, idempotente; botón del admin (`04`) |
| `fn_consumir_generacion(uuid)`, `fn_otorgar_generaciones_por_nivel` | modelo antiguo de contador plano, sin uso; sin borrar |

Eliminada: `fn_es_responsable_de_turno` (21/08/2026, sin uso y con
bug de diseño).

**Patrón de seguridad de RPCs `security definer`** (depende de QUIÉN
llama):
- Llamadas directamente por el cliente: NUNCA reciben `usuario_id`,
  resuelven `auth.uid()` (ej. `fn_seleccionar_personaje`). Un id que
  manda el cliente sería explotable al saltarse RLS.
- Llamadas desde una Edge Function con `service_role`: `auth.uid()`
  siempre es `null`, así que reciben `p_usuario_id` (ya validado por
  JWT en la función) y se restringe la ejecución a `service_role`
  (`revoke execute from public, authenticated, anon`). Ej.
  `fn_consumir_generacion_nivel`. Se aprendió a base de fallo real
  ("No hay sesión activa" en producción, 23/08/2026).

## Políticas RLS (permisivas, se combinan con OR)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| parte | cualquier rol conocido salvo `pantalla` y `jefe_rectificado` | responsable, suplente, admin | propio & `completado=false`; propio & completado & vigente & `completado_at > now()-1h`; operario si `operario_id = uid` (solo columnas `*_operario`, por trigger); administrador cualquier fila | administrador |
| turno | autenticados | responsable solo si `tipo = fn_turno_de_letra(fecha, su letra)`; suplente cualquiera; admin | responsable/suplente; admin | admin |
| asignacion_operario_linea | autenticados | responsable/suplente; admin | responsable/suplente; admin | responsable/suplente; admin |
| refuerzo_operario_turno | autenticados | responsable/suplente/admin con `habilitado_por = uid` | — | responsable/suplente/admin |
| lote | autenticados | admin (Edge Function con service_role) | responsable/suplente; admin | admin |
| incidencia_calidad | responsable, suplente, jefe, calidad, admin | responsable, suplente, admin | — | — |
| incidencia_produccion | responsable, suplente, jefe, produccion, admin | responsable, suplente, admin | — | — |
| operario_checklist | propio; jefe; admin | propio; admin | — | — |
| personaje_rpg | propio; jefe; admin | propio; admin | propio | — |
| personaje_stats_nivel | propio; admin | — (solo funciones definer) | — | — |
| historial_ciclos | propio; jefe; admin; operario/responsable/pantalla (ranking, 24/08) | — | — | — |
| usuario | cualquier rol conocido (24/08) | — | admin | — |
| configuracion | admin (24/08; antes sin RLS) `[VERIFICAR]` si otros roles necesitan SELECT — `rotacion.ts` y la pantalla leen `fecha_inicio_rotacion`/`objetivo_m2_dia` | admin | admin | admin |
| modelo, marca, formato, producto, linea, checklist_items, logros_definicion, puntos_*, niveles, cierre_fabrica | autenticados | admin | admin | admin |
| app_secrets | ninguno (revoke) | | | |

La pantalla de fábrica no lee `parte`: lee vistas (owner). Desde
24/08 `pantalla` sí tiene SELECT en `usuario` e `historial_ciclos`.

Nota: el comentario final de `20260101000010_rls.sql` ("rol pantalla
sin login, service_role desde el backend") describe un diseño
descartado — el real es con login (`10`). La migración no se edita.
