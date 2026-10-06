# 06 — Esquema de base de datos

Contrastado con la BD real el 06/10/2026 (baseline `20261006204519`, que sustituye a
173 migraciones; ver `23`): 58 tablas, 59 vistas, 61 funciones propias en `public`, 114
políticas RLS, 19 triggers, 4 trabajos de `pg_cron`. Las secciones de abajo se escribieron por
etapas; los bloques «Rol mecánico», «Programación» y «Otros objetos no descritos
arriba» van al final.
Extensiones instaladas: `pg_trgm` (en `public`), `pgcrypto`, `pg_cron`, `pg_net`,
`supabase_vault`, `uuid-ossp` y `pg_stat_statements`.

## Enums

- `rol_usuario`: responsable, jefe, produccion, calidad, operario,
  administrador, suplente, pantalla, jefe_rectificado, mecanico (los 10
  cubiertos por migración; `mecanico` se añadió el 16/09/2026, ver
  sección "Rol mecánico").
- `letra_turno`: A, B, C, D. `tipo_turno`: M, T, N.
- `estado_lote`: iniciado, finalizado.

## Tablas

**configuracion** (clave PK, valor, nota). Filas: `fecha_inicio_rotacion
= 2026-02-16` (ver `01`), `objetivo_m2_dia = 48000` (ver `10`; era 35000 en la primera versión, y el frontend usa 35000 solo si la fila falta).

**app_secrets** (key PK, value). Sin acceso para anon/authenticated.
Fila `telegram_webhook_secret`.

**usuario** — id PK = `auth.users.id`, username unique, rol, letra
(solo responsables y operarios; null para el resto),
`generaciones_disponibles` (sin significado desde 23/08/2026; ya no se
lee en ningún sitio del código tras la limpieza de la sesión
25/08/2026 — la columna sigue existiendo en la tabla, inofensiva),
created_at. Índice único parcial: una sola fila con rol = suplente.
34 usuarios (recuento 03/10/2026): 4 responsables (A/B/C/D), 20 operarios
(A=5, B=4, C=4, D=6 y uno sin letra), 1 jefe, 1 produccion, 3 calidad, 1
administrador, 1 pantalla, 1 jefe_rectificado y 2 mecanico. La fila `suplente` **no existe ni
se creará**: decisión cerrada en sesión 25/08/2026 de no usar una
cuenta compartida para cubrir turnos (detalle en `01`, "Suplente y
refuerzo"); el índice único parcial y el rol del enum se quedan sin
uso.

**modelo / marca** — id, nombre, nombre_normalizado (trigger),
created_at. Índice GIN trgm.

**formato** — id, nombre unique (7 filas), `area_m2` derivado del
nombre; valores confirmados en BD 24/08/2026 (ver `01`).

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
(`formato_id, vigente, completado, piezas_entradas desc`). Índice único
parcial `uq_parte_pendiente_por_linea_turno` (turno_id, linea_id) where
vigente and not completado — como mucho un pendiente por línea+turno
(sesión 02/09/2026, bug real: Foto 1 crea el parte antes de tiempo, y
darle a "atrás" después dejaba huérfanos que colisionaban con
"Continuar"/"Nuevo tono"; ver `02`).

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

**logros_definicion** — 37 filas sembradas: 19 de operario
(23/08/2026) + 18 de responsable (25/08/2026). Columnas `rol`
(default 'operario'), `formato_nombre`, `condicion_tipo`,
`condicion_valor` (nullable). `operario_logro` (progreso guardado) se
eliminó el 22/08/2026: todo se calcula por consulta (`04`).

**personaje_rpg** — usuario, nivel_en_generacion, imagen_url, historia,
seleccionada. Índice único `uq_personaje_rpg_seleccionada`.

**personaje_stats_nivel** — unique (usuario_id, nivel_id); fuerza,
resistencia, velocidad, vida congelados; `generaciones_usadas` int
default 0 check 0-3. La existencia de la fila = nivel otorgado (`04`).

**historial_ciclos** — usuario, rol (redundante desde 25/08/2026,
siempre `'operario'` — el responsable se separó a su propia tabla, ver
siguiente; limpieza pendiente sin prisa, `07`), cycle_id, fecha_cierre,
puntos_ciclo, puntos_piezas, puntos_rendimiento, puntos_limpieza,
fuerza, resistencia, velocidad, m2_total, m2_std, m2_com, m2_contenedor,
piezas_total, tiempo_*, piezas_por_formato jsonb; unique (usuario,
cycle_id). Contiene los datos migrados de v2 de operario (ciclos 1..6,
100 filas, comprobado 24/08/2026 — `04`); el primer cierre automático
real será el del ciclo 7 (28/09/2026).

**historial_ciclo_responsable** (25/08/2026) — la misma "foto de
ciclo" que `historial_ciclos` pero para responsable, en tabla propia
(no comparte fila con operario: columnas y vocabulario distintos,
motivo en `04`). usuario_id, cycle_id, fecha_cierre, puntos_ciclo,
m2_total, m2_contenedor, m2_com, m2_std, minutos_plena,
minutos_no_alimentada, minutos_saturacion, minutos_banco,
minutos_maquina, verificaciones_codbar, puntos_equipo_ciclo,
operario_gano_ciclo, turnos_trabajados, fuerza, resistencia, velocidad;
unique (usuario_id, cycle_id). 23 filas migradas de v2 (ciclos 1..6,
desde `responsable_ledger`, comprobado 25/08/2026 — `04`); se escribe
solo vía `fn_cerrar_ciclos_pendientes` o backfill manual.

**ceria_prompts**, **ceria_conversaciones**, **ceria_mensajes** — `11`.

**ceria_modelo_activo** (07/09/2026) — apagado de modelos de Fase 3 de
Ceria por el administrador (`11`): modelo_id (PK, texto — id del
catálogo fijo en código `MODELOS_FASE3`), activo. Convención
**opuesta** a `chat_acceso` a propósito: ausencia de fila = modelo
**activo** (el catálogo ya viene fijo en código, el caso base es "todo
encendido"); solo se inserta fila cuando el admin apaga uno en concreto.

**notificaciones** (07/09/2026) — feed de eventos in-app, independiente
de Telegram (`15`): id, `tipo` (check: incidencia_calidad /
incidencia_produccion / nuevo_lote / resumen_turno / resumen_calidad),
titulo, cuerpo, referencia_id (id de la fila origen), data jsonb
(fotos, URL de PDF), created_at. Sin política de INSERT para
`authenticated`/`anon` — solo escriben las 3 Edge Functions que ya
mandan a Telegram, con `service_role`. `check` de `tipo` pensado para
ampliarse con un 6º valor (`mensaje_chat`) si algún día hiciera falta.

**notificacion_estado_usuario** — "hasta dónde ha leído cada usuario",
clave compuesta **(usuario_id, tipo)** desde el 07/09/2026 (antes era
un único timestamp por usuario; el rediseño a canales por tipo obligó
a que cada canal tenga su propio contador de no-leídas). Ausencia de
fila para un tipo = nunca abierto ese canal = todo no-leído en él.

**notificacion_preferencias** — interruptor de push por (usuario_id,
tipo), default activado. **Sin efecto real hoy** — solo gobernará el
envío de push cuando exista (Fase 7, sin construir); no oculta nada
del feed ni afecta al contador de no-leídas.

**notificacion_silencio** — horario general de silencio por usuario
(activo bool, hora_inicio, hora_fin — mismo rango todos los días, no
distingue entre semana/fin de semana). Mismo caso que la anterior:
**sin efecto real hasta que exista push**.

**chat_mensajes** — canal único de chat humano, sin salas: usuario_id,
texto, fotos text[] (Cloudinary, preset `motiv_v3_chat`), created_at,
`eliminado` bool default false (borrado **suave**, nunca DELETE real
— mismo criterio que `parte.vigente`), borrado_por, borrado_at. Check
`texto is not null or fotos is not null`. Alcance de roles:
responsable, suplente, operario, jefe, administrador — **calidad y
jefe_rectificado quedan fuera a propósito** (dependen solo de
Telegram), misma decisión que en `notificaciones`.

**chat_acceso** — control de acceso por rol para los **7 "chats"**
(los 5 tipos automáticos de `notificaciones` + `general` + `ceria`):
tipo_chat, rol, puede_ver, puede_escribir. **Deny-by-default**:
ausencia de fila = sin acceso; quitar el "ver" de un rol borra la fila
en vez de dejarla con `puede_ver=false`. Solo `general` usa
`puede_escribir` de forma distinta a `puede_ver` — en el resto un
único interruptor.

**Tablas temporales del import v2 → v3 — eliminadas 26/08/2026**:
`staging_responsable_v2`, `stg_migracion_v2`, `tmp_puntos_turno`
cumplieron su función de backfill (ver `04`, `historial_ciclo_responsable`)
y no formaban parte del diseño de v3. Verificado antes de borrar que
ningún objeto (vista/función/trigger) dependía de ellas. Dejó el
camino libre para el squash de migraciones (`23`).

**`stg_migracion_operario_v2` — eliminada el 06/10/2026** (staging del import v2: operario_nombre,
fecha, formato, piezas, m², minutos y turno/línea, 2.694 filas). Ninguna función, vista, trigger,
frontend ni Edge Function la usaba. Se borró junto con las copias `bak_*` antes del squash
(`23`); respaldo en `privado/backups/squash/bak_tablas_20261006.sql`.

## Vistas

Todas sin `security_invoker`: se evalúan como el owner y saltan RLS
(convención en `CLAUDE.md`). Es lo que permite que `pantalla`, Ranking
y Logros lean agregados de tablas cuya RLS no les cubre. El linter de
Supabase marca las 58 vistas del proyecto (49 en la revisión del 26/08/2026)
como `security_definer_view` (nivel ERROR) — es exactamente este comportamiento por
diseño, no un hueco: no requiere ningún cambio. Lo que sí protege a las vistas es el
`GRANT`: desde el 03/10/2026 `anon` no tiene `SELECT` en ninguna (ver `00`); una vista
nueva nace con `SELECT` para `anon` y hay que revocarlo.

Dashboard (`08`): `v_produccion_turno`, `v_calidad_turno`,
`v_calidad_modelo`, `v_calidad_lote`.

Puntos operario (`04`): `operario_ledger` (partes vigentes y
completados, operario = `parte.operario_id`) para Historial;
`v_rendimiento_linea_turno` → `v_puntos_rendimiento_linea_turno` →
`v_operarios_linea_turno` → `v_puntos_rendimiento_operario_por_turno` →
`v_puntos_rendimiento_operario_ciclo` (reparto igualitario entre
operarios de la misma línea+turno, sesión 19/08/2026 — sustituye a la
antigua `v_rendimiento_operario_por_turno`, eliminada),
`v_piezas_formato_linea_turno` → `v_puntos_piezas_linea_turno` →
`v_puntos_piezas_operario_por_linea_turno`,
`v_puntos_limpieza_operario_por_turno`, `v_puntos_operario_total_vida`,
`v_puntos_{piezas,rendimiento,limpieza}_operario_total_vida`,
`v_puntos_{piezas,limpieza}_operario_ciclo` → `v_puntos_operario_ciclo`
(con `username` horneado desde 24/08).

Producción/stats/logros operario: `v_piezas_operario_formato_ciclo` →
`v_produccion_operario_ciclo`, `v_stats_vida` (fix 02/09/2026: el
histórico de responsable ahora suma también `historial_ciclo_responsable`,
antes solo `historial_ciclos` — mismo bug que `v_puntos_responsable_
total_vida` del 25/08, ver `04`), `v_rey_formato_historico`,
`v_rey_formato_actual`, `v_mi_mejor_parte_por_formato`,
`v_ganador_por_ciclo`, `v_veces_rey_de_reyes`, `v_avatar_activo_operario`
(solo `imagen_url`, para saltar la RLS de `personaje_rpg`).

Responsable: `v_metros_responsable_por_turno` →
`v_puntos_metros_responsable_por_turno`,
`v_rendimiento_responsable_por_turno`,
`v_puntos_rendimiento_responsable_ciclo`, `v_metros_responsable_ciclo`
(ahora también da m² por categoría),
`v_puntos_metros_responsable_ciclo` → `v_puntos_responsable_ciclo`,
`v_tiempo_responsable_ciclo` (ahora los 5 tiempos por separado),
`v_puntos_responsable_total_vida` (reescrita 25/08/2026 para sumar
`historial_ciclo_responsable`, ver nota de bug más abajo).

Gamificación responsable — nuevas 25/08/2026:
`v_verificaciones_codbar_responsable_ciclo`,
`v_operarios_de_responsable_ciclo` → `v_puntos_equipo_responsable_ciclo`,
`v_partes_operario_ciclo` (para operario), `v_turnos_responsable_ciclo`,
`v_equipo_avatar_stats` (avatar + stats **congeladas**, primera vista
del proyecto así), `v_ganador_por_ciclo_responsable` +
`v_veces_lider_indiscutible`. Detalle de cada una en `04`.

Personaje/admin: `v_niveles_disponibles_generar`,
`v_admin_usuarios_gamificacion`.

## Funciones

Todas las funciones del esquema tienen `search_path` fijo
(`set search_path = public`) desde el 26/08/2026 — antes 20 de ellas
no lo tenían (lint `function_search_path_mutable`). `ALTER FUNCTION
... SET search_path`, sin tocar el cuerpo de ninguna.

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
| `fn_notificar_telegram()` | security definer, lee app_secrets, `net.http_post` (`05`). Extendida el 07/09/2026 para, además de la llamada HTTP a Telegram, hacer INSERT en `notificaciones` con título/cuerpo enriquecidos (línea + turno). Hubo un vaivén de diseño el mismo día: un intento intermedio reconstruía el texto completo en PL/pgSQL aparte del que arma la Edge Function para Telegram — se revirtió al detectar que ambas versiones se desincronizaban (una línea que faltaba en una de las dos); el texto vive en un solo sitio (`15`) |
| `fn_disparar_resumen_calidad()` | security definer, lee app_secrets, `net.http_post`. Tras el vaivén del 07/09/2026 **vuelve a ser solo el disparo HTTP** — el INSERT en `notificaciones` para `resumen_calidad` lo hace directamente la Edge Function `notificar-telegram-resumen-calidad`, no la función SQL |
| `fn_disparar_resumen_turno(uuid)` | security definer, lee app_secrets, `net.http_post`. Igual que la anterior tras el 07/09/2026: solo disparo HTTP, el INSERT en `notificaciones` para `resumen_turno` lo hace la Edge Function `generar-resumen-turno`. **Pendiente de restringir** (`07`): la llama un trigger no-definer (`fn_trigger_resumen_turno_cierre`) que corre con los permisos de quien cierra el turno de verdad — restringir su ejecución a `service_role` sin antes hacer también ese trigger `security definer` rompería el cierre manual de turno. Sigue expuesta a `anon`/`authenticated` vía RPC (lint 26/08/2026, sin arreglar a propósito; no tocado en la sesión 07/09) |
| `fn_chat_acceso(p_tipo_chat text, p_permiso text default 'ver')` | (07/09/2026) security definer, stable. Consulta `chat_acceso` para `fn_rol_actual()`; `p_permiso` es `'ver'` o `'escribir'`. Devuelve `false` si no hay fila (deny-by-default). Usada por las políticas RLS de `notificaciones` y `chat_mensajes`, y por la Edge Function de Ceria para decidir si el rol que llama tiene acceso a `tipo_chat='ceria'` (`11`) |
| `fn_encolar_resumenes_turno_pendientes()` | cierre automático + reintento |
| `fn_cerrar_ciclos_pendientes()` | security definer, idempotente (`on conflict do update`); escribe en `historial_ciclos` (operario) y `historial_ciclo_responsable` (responsable, tabla separada desde 25/08/2026). **Sin `not exists` desde las reescrituras del 25/08**: recorre TODO `cycle_id` anterior al actual con datos en las vistas en vivo y sobrescribe cualquier fila que ya exista — ya no distingue "cerrar por primera vez" de "recalcular a propósito". Detalle y por qué no es un riesgo hoy en `04`. Ejecución **solo service_role** desde 26/08/2026 (lint de seguridad: sin caller legítimo por RPC hoy — la dispara solo el cron; cuando se construya el botón admin "Recalcular ciclo anterior", ver `07`, decidir entre check de rol o llamada vía Edge Function) |
| `fn_nivel_actual(uuid)` | security definer, stable. Ejecución **solo service_role** desde 26/08/2026 — su propio comentario ya decía que no estaba pensada como RPC libre; hoy solo la usa internamente `fn_otorgar_bonus_nivel` |
| `fn_guardar_personaje_generado(uuid, uuid, text, text)` | security definer, atómico; la llama `generar-personaje`. Ejecución **solo service_role** desde 26/08/2026 (lint de seguridad: no tenía `auth.uid()` ni restricción de ejecución — cualquiera con la clave anon podía insertar un personaje arbitrario para cualquier usuario_id) |
| `fn_consumir_generacion_nivel(p_usuario_id, p_nivel_id)`, `fn_devolver_generacion_nivel(…)` | security definer, ejecución **solo service_role** |
| `fn_seleccionar_personaje(p_personaje_id)` | security definer, `auth.uid()`; la llama el cliente |
| `fn_otorgar_bonus_nivel(uuid)` | security definer, idempotente; botón del admin (`04`). Reparada 25/08/2026: quitada la llamada muerta a `fn_otorgar_generaciones_por_nivel`, `velocidad` ahora con `coalesce`, y añadido `#variable_conflict use_column;` para resolver la ambigüedad `nivel_id` (parámetro de salida vs. columna) que la hacía fallar con error `42702`. **26/08/2026 (lint de seguridad)**: añadida comprobación interna `fn_rol_actual() = 'administrador'` — antes cualquier usuario autenticado, o incluso anon, podía llamarla con cualquier usuario_id y auto-otorgarse el bonus sin pasar por el admin. El botón del frontend sigue llamándola igual (sesión propia del admin, rol `authenticated`), así que no se le tocó el `GRANT` |
| `fn_consumir_generacion(uuid)`, `fn_otorgar_generaciones_por_nivel` | modelo antiguo de contador plano, sin uso; sin borrar |

Eliminada: `fn_es_responsable_de_turno` (21/08/2026, sin uso y con
bug de diseño).

**Patrón de seguridad de RPCs `security definer`** (depende de QUIÉN
llama):
- Llamadas directamente por el cliente, sin lógica de rol: NUNCA
  reciben `usuario_id`, resuelven `auth.uid()` (ej.
  `fn_seleccionar_personaje`). Un id que manda el cliente sería
  explotable al saltarse RLS.
- Llamadas desde una Edge Function con `service_role`: `auth.uid()`
  siempre es `null`, así que reciben `p_usuario_id` (ya validado por
  JWT en la función) y se restringe la ejecución a `service_role`
  (`revoke execute from public, authenticated, anon`). Ej.
  `fn_consumir_generacion_nivel`, y desde 26/08/2026 también
  `fn_guardar_personaje_generado`, `fn_nivel_actual`,
  `fn_cerrar_ciclos_pendientes`, `fn_disparar_resumen_calidad`. Se
  aprendió a base de fallo real ("No hay sesión activa" en
  producción, 23/08/2026).
- Llamadas directamente por el cliente CON `usuario_id` como
  parámetro, cuando la función necesita actuar sobre un usuario
  distinto de quien llama (ej. el admin otorgando algo a otro): el
  `GRANT` a `authenticated` se mantiene, pero el cuerpo comprueba
  `fn_rol_actual()` y lanza excepción si no es el rol esperado. Único
  caso hoy: `fn_otorgar_bonus_nivel` (comprobación añadida
  26/08/2026, antes no existía — ver tabla de arriba). A diferencia
  del patrón anterior, aquí la barrera vive DENTRO de la función, no
  en el `GRANT`, porque el caller legítimo sigue siendo un `authenticated`
  normal (el admin), no un `service_role`.

Auditoría completa de las 11 funciones `security definer` señaladas
por el linter de Supabase (26/08/2026): 5 reparadas (arriba), 1
pendiente (`fn_disparar_resumen_turno`), y 5 sin acción por ser
seguras tal cual o no ser invocables por RPC en la práctica —
`fn_seleccionar_personaje` y `fn_rol_actual` (ya usan `auth.uid()`
correctamente); `fn_notificar_telegram`, `fn_marcar_corregido_no_vigente`
y `fn_bloquear_ascenso_admin` (funciones de trigger, `returns trigger`
— Postgres no permite ejecutarlas fuera de un trigger real, así que
el linter las marca pero no son explotables vía RPC).

Estado del linter el 03/10/2026 (`authenticated_security_definer_function_executable`,
21 funciones): 13 son RPC de Programación y notas (`parse_programacion`,
`diff_programacion`, `validar_programacion`, `confirmar_programacion`,
`deshacer_ultima_programacion`, `guardar_programacion_csv`, `existe_csv_programacion`,
`actualizar_tono_calibre`, `anadir_nota_ordenes`, `editar_nota`, `borrar_nota`,
`guardar_frase`, `guardar_muestra_excel`), todas con guarda de rol interna (patrón de
arriba: la barrera vive dentro de la función porque el llamador legítimo es un
`authenticated`); 3 son funciones de trigger (`fn_bloquear_ascenso_admin`,
`fn_marcar_corregido_no_vigente`, `fn_notificar_telegram`); y 5 anteriores:
`fn_otorgar_bonus_nivel` (guarda interna de administrador), `fn_disparar_resumen_turno`
(pendiente, `07`), `fn_seleccionar_personaje` y `fn_rol_actual` (usan `auth.uid()`) y
`fn_chat_acceso` (consulta `chat_acceso`; la usan las políticas RLS). Las funciones que solo
llaman Edge Functions o el cron son `service_role`-only y no aparecen en este aviso.
### `informe_periodo` (20260920130000)

Un informe PDF por periodo. Único por `(tipo, desde)`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tipo` | text | `diario` / `semanal` (CHECK) |
| `desde`, `hasta` | date | fechas de TURNO (el N de la fecha D acaba a las 06:00 de D+1). Diario: `desde = hasta`. Semanal: lunes y domingo. CHECK `hasta >= desde` |
| `pdf_url` | text | Cloudinary; NULL solo si la generación falló a medias |
| `resumen` | jsonb | totales compactos: m² por calidad, turnos registrados/esperados/faltantes/sin cerrar, nº de lotes e incidencias |
| `generado_at`, `enviado_at` | timestamptz | `enviado_at` es también el "candado" que evita el doble envío |
| `created_at` | timestamptz | |

RLS: escritura solo `service_role` (Edge Function). Lectura:
`informe_periodo_select_jefe_admin` (`fn_rol_actual() in ('jefe',
'produccion', 'administrador')`, migración `20260920150000`, ampliada
a `produccion` en `20260922120000`) + `informe_periodo_select_responsable`
(`fn_rol_actual() = 'responsable'`, migración `20260921110000`, para el
enlace en el "Copiar" del resumen de turno).

Funciones (`20260920140000`), con `REVOKE EXECUTE` a
`public/anon/authenticated`: `fn_disparar_informe_periodo(tipo, desde)` y
`fn_encolar_informes_periodo_pendientes()` (cron de respaldo). El trigger
`trg_turno_informe_periodo_cierre` y su función se crearon ahí y se
**eliminaron** en `20260921100000` (los informes van dentro del resumen
de turno).

## Políticas RLS (permisivas, se combinan con OR)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| parte | cualquier rol conocido salvo `pantalla` (incluye `jefe_rectificado` vía `parte_select_jefe_rectificado`, ver `13`) | responsable, suplente, admin | propio & `completado=false`; propio & completado & vigente & `completado_at > now()-1h`; operario si `operario_id = uid` (solo columnas `*_operario`, por trigger); administrador cualquier fila | administrador |
| turno | autenticados | responsable solo si `tipo = fn_turno_de_letra(fecha, su letra)`; suplente cualquiera; admin | responsable/suplente; admin | admin |
| asignacion_operario_linea | autenticados | responsable/suplente; admin | responsable/suplente; admin | responsable/suplente; admin |
| refuerzo_operario_turno | autenticados | responsable/suplente/admin con `habilitado_por = uid` | — | responsable/suplente/admin |
| lote | autenticados | admin (Edge Function con service_role) | responsable/suplente; admin | admin |
| incidencia_calidad | responsable, suplente, jefe, produccion, calidad, admin | responsable, suplente, admin | — | — |
| incidencia_produccion | responsable, suplente, jefe, produccion, admin | responsable, suplente, admin | — | — |
| operario_checklist | propio; jefe; admin | propio; admin | — | — |
| personaje_rpg | propio; jefe; admin | propio; admin | propio | — |
| personaje_stats_nivel | propio; admin | — (solo funciones definer) | — | — |
| historial_ciclos | propio; jefe; admin; operario/responsable/pantalla (ranking, 24/08) | — | — | — |
| historial_ciclo_responsable | propio; `fn_rol_actual() in ('responsable','jefe','administrador','pantalla')` (25/08) | — | solo `fn_cerrar_ciclos_pendientes` (security definer) o backfill manual | — |
| usuario | cualquier rol conocido (24/08) | — | admin | — |
| configuracion | `configuracion_select_autenticados`: cualquier autenticado (lo necesitan `rotacion.ts` y la pantalla) | admin | admin | admin |
| modelo, marca, formato, producto, linea, checklist_items, logros_definicion, puntos_*, niveles, cierre_fabrica | autenticados | admin | admin | admin |
| app_secrets | ninguno (revoke) | | | |
| notificaciones | `fn_chat_acceso(tipo, 'ver')` (07/09, sustituye a una lista fija de roles usada en un paso intermedio del mismo día) | solo desde funciones `security definer` (sin GRANT a authenticated/anon) | — | — |
| chat_mensajes | `fn_chat_acceso('general', 'ver')` (desde `20260907180000`, sustituye a la lista fija de roles usada en un paso intermedio) | `fn_chat_acceso('general', 'escribir')` + `usuario_id = auth.uid()` | borrado suave: propio (`usuario_id = auth.uid()`) o administrador — nunca DELETE real | — |
| chat_acceso | cualquier rol conocido | admin (`for all`) | admin | admin |
| notificacion_estado_usuario | propio | propio | propio | propio (política única `for all`, `usuario_id = auth.uid()`) |
| notificacion_preferencias | propio | propio | propio | propio (`for all`, `usuario_id = auth.uid()`) |
| notificacion_silencio | propio | propio | propio | propio (`for all`, `usuario_id = auth.uid()`) |
| ceria_modelo_activo | cualquier rol conocido | admin (`for all`) | admin | admin |

Nota de estilo (07/09/2026): `notificacion_estado_usuario`/
`notificacion_preferencias`/`notificacion_silencio` usan las 3 una
única política `for all using/with check (usuario_id = auth.uid())` —
no hay policies separadas por operación, a diferencia del resto de la
tabla.

La pantalla de fábrica no lee `parte`: lee vistas (owner). Desde
24/08 `pantalla` sí tiene SELECT en `usuario` e `historial_ciclos`.

Nota: el comentario final de `20260101000010_rls.sql` ("rol pantalla
sin login, service_role desde el backend") describe un diseño
descartado — el real es con login (`10`). La migración no se edita.

## Extensiones y otras notas de seguridad (26/08/2026)

- `pg_trgm` vive en el esquema `public` (lint `extension_in_public`).
  Cosmético — pendiente decidir si se mueve a un esquema `extensions`
  dedicado (`07`).
- `auth_leaked_password_protection` (comprobación de contraseñas
  filtradas contra HaveIBeenPwned) está desactivado en Supabase Auth.
  Toggle en el panel, sin código — pendiente de decidir (`07`).

Otros avisos del linter el 03/10/2026 (resumen completo en `00`): `function_search_path_mutable`
en 7 funciones (`calidad_lote_por_fecha`, `calidad_linea_por_fecha`, `calidad_modelo_por_fecha`,
`produccion_linea_por_fecha`, `fn_parte_validar_correccion`,
`fn_incidencia_produccion_restringir_columnas_update`, `fn_almacen_pedido_linea_recibida`) y
`rls_enabled_no_policy` en las tablas de copia ya borradas el 06/10/2026 (respaldo en
`privado/backups/squash/`); el lint ya no las marca.

## Referencias cruzadas

- `15-notificaciones-chat.md` — detalle completo del sistema de
  notificaciones in-app y chat (fases de la sesión 07/09/2026,
  historia del vaivén de `fn_notificar_telegram`, pantallas).
- `11-ceria.md` — `ceria_modelo_activo` y `fn_chat_acceso` aplicado a
  `tipo_chat='ceria'`.

## Rol mecánico (sesión 16/09/2026)

`rol_usuario` gana el valor `mecanico` (migración propia, `alter type
... add value`, separada de las políticas que lo usan — mismo cuidado
que con `jefe_rectificado`).

### Tablas

**incidencia_produccion** — ampliada con respuesta del mecánico:
`respuesta_texto`, `respuesta_fotos text[]`, `respuesta_sin_intervencion
boolean default false`, `respuesta_mecanico_id → usuario`,
`respuesta_fecha`. `estado` es columna **generada**
(`generated always as ... stored`, `'pendiente'`/`'contestada'` según
`respuesta_fecha`) — nunca editable a mano. Sin tabla de respuesta
aparte: es 1:1 y sin reapertura (la propia RLS de UPDATE lo impide,
ver tabla de políticas).

**almacen_categoria** — árbol máquina/submáquina para el almacén de
repuestos: `clave` (única, patrón punteado tipo
`ceria_documentacion_maquina`), `maquina`, `submaquina`, `nombre`,
`orden`. Fila sembrada `clave = 'por_catalogar'` como categoría
comodín — nunca un estado especial ni un campo nulo en `almacen_repuesto`.

**almacen_proveedor** — proveedores de repuestos: `nombre` (único),
`contacto`.

**almacen_repuesto** — `categoria_id → almacen_categoria` (**not
null**, siempre), `nombre`, `descripcion`, `imagen_url`, `created_by`.
Sin columna de stock — se lee de `v_almacen_stock`.

**almacen_repuesto_referencia** — una fila por proveedor/fabricante
que vende el repuesto con su propio código: `repuesto_id`,
`proveedor_id`, `codigo`. Hace también de relación repuesto↔proveedor
(no hay tabla ni columna separada para "proveedor(es) del repuesto").

**almacen_movimiento** — histórico de stock, nunca se pisa un número:
`repuesto_id`, `tipo` (`entrada`/`salida`/`ajuste`), `cantidad`
(entero con signo, `check (cantidad <> 0)`), `fecha`, `mecanico_id`,
`pedido_linea_id` (nullable, FK a `almacen_pedido_linea` — añadida
después de crear esa tabla por dependencia circular en la migración),
`nota`. Índice único parcial
`almacen_movimiento_pedido_linea_unico` sobre `pedido_linea_id where
not null`: garantiza en esquema que la recepción de una línea de
pedido nunca duplica el movimiento de entrada.

**almacen_pedido** — cabecera: `proveedor_id`, `fecha`, `created_by`.
Sin columna de estado — se deriva en `v_almacen_pedido_estado`.

**almacen_pedido_linea** — `pedido_id`, `repuesto_id`,
`cantidad_pedida` (`check > 0`), `recibido boolean default false`,
`fecha_recepcion`. Trigger `trg_almacen_pedido_linea_recibida`
(`before update`, ver Funciones) genera el movimiento de entrada
automáticamente al marcar `recibido = true`.

**engrase_punto** — lista editable (solo admin) de puntos a
engrasar/revisar, **la misma para todas las líneas**: `nombre`,
`orden`, `activo` (baja lógica — nunca se borra de verdad para no
romper `engrase_parte` históricos que lo referencian).

**engrase_parte** — un "parte" de revisión, mismo espíritu que `parte`
de producción: `linea_id`, `fecha`, `mecanico_id` (not null).

**engrase_parte_punto** — qué puntos se marcaron en ese parte:
`(parte_id, punto_id)` como PK compuesta. Marcado parcial = solo se
insertan filas de los puntos hechos; no hay columna `marcado boolean`
por punto.

**unidad_intercambiable** — piezas concretas e identificables (no
fungibles como el almacén de repuestos): `tipo` (`check in
('cabezal_flejado', 'calderin_cola_cera')`), `identificador`,
`nombre`, `activo`; `unique (tipo, identificador)`.

**unidad_movimiento** — historial de eventos, nunca un campo de
ubicación actual que se sobrescribe: `unidad_id`, `tipo_evento`
(`check in ('sale_a_reparar', 'vuelve_montada')`), `fecha`, `linea_id`
(nullable, pero `check (tipo_evento <> 'vuelve_montada' or linea_id is
not null)` — obliga a línea cuando vuelve montada), `nota`,
`mecanico_id`. Sin coste/factura en ninguna columna — fuera de alcance
a propósito.

### Vistas

**v_almacen_stock** — `repuesto_id, stock` = suma de
`almacen_movimiento.cantidad` por repuesto (`left join` desde
`almacen_repuesto`, para que un repuesto sin movimientos salga con
stock 0 en vez de no aparecer).

**v_almacen_pedido_estado** — `pedido_id, estado`:
`'recibido_completo'` si todas las líneas están recibidas,
`'parcial'` si alguna sí y alguna no, `'pendiente'` si ninguna —
tercer valor añadido por decisión propia al construir, sin
confirmación explícita de sesión; revisar si en la práctica solo hacen
falta los dos estados originales del plan.

**v_unidad_ubicacion_actual** — `distinct on (unidad_id)` sobre
`unidad_movimiento` ordenado por `fecha desc`: `estado`
(`'montada'`/`'en_reparacion'`) + `linea_id` + `desde`, siempre a
partir del último movimiento — nunca columna propia en
`unidad_intercambiable`.

### Funciones

| Función | Notas |
|---|---|
| `fn_almacen_pedido_linea_recibida()` | trigger `before update` en `almacen_pedido_linea`: si `recibido` pasa de `false` a `true`, fija `fecha_recepcion` (si no venía) e inserta el movimiento de `entrada` en `almacen_movimiento` con `pedido_linea_id = new.id`. El índice único parcial de `almacen_movimiento` es la barrera real contra duplicados, no la lógica del trigger. |

### Políticas RLS — filas nuevas para la tabla de `06`

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| incidencia_produccion | (se SUMA) `mecanico` | — | `mecanico` solo si `respuesta_fecha is null` (`using`), y solo puede dejar `respuesta_mecanico_id = auth.uid()` (`with check`) — la propia policy impide reabrir: tras la respuesta, `respuesta_fecha` deja de ser null y ningún mecánico puede volver a hacer `update` | — |
| almacen_categoria, almacen_proveedor, almacen_repuesto, almacen_repuesto_referencia, almacen_movimiento, almacen_pedido, almacen_pedido_linea | `mecanico`, `administrador` | `mecanico`, `administrador` | `mecanico`, `administrador` | `mecanico`, `administrador` |
| engrase_punto | `mecanico`, `administrador` | — | `administrador` (`for all`) | `administrador` (`for all`) |
| engrase_parte | `mecanico`, `administrador` | `mecanico` con `mecanico_id = auth.uid()` | — | — |
| engrase_parte_punto | hereda de `engrase_parte` vía join en la app; sin RLS propia (⚠️ pendiente de revisar si hace falta una policy directa, hoy no tiene) | | | |
| unidad_intercambiable, unidad_movimiento | `mecanico`, `administrador` | `mecanico`, `administrador` | `mecanico`, `administrador` | `mecanico`, `administrador` |

Todas las políticas son aditivas (`create policy` envuelta en `do $$
... exception when duplicate_object then null; end $$;`), como el
resto del proyecto — ninguna migración anterior se tocó.

**`jefe` queda fuera a propósito** de almacén, engrase y unidades
(decisión 16/09/2026) — a diferencia de incidencias, donde `jefe` ya
tenía SELECT desde antes y lo conserva.

### Pendiente de esta sesión

- `engrase_parte_punto` sin política RLS propia — confirmar si hace
  falta antes de que el frontend la consulte directamente en vez de
  vía `engrase_parte`.
- Estado `'pendiente'` de `v_almacen_pedido_estado` para pedidos con
  cero líneas recibidas: confirmar si es el comportamiento deseado o
  si debe colapsar a `'parcial'`.
- Vistas exactas de producción para que el mecánico detecte anomalías
  de máquina (`v_produccion_turno`, `get_partes`...) — sin resolver,
  ver `17-rol-mecanico-plan.md`.

## Programación (03/10/2026)

Descripción funcional, flujos y decisiones en `20` y `22`. Aquí, solo el esquema.

### Tablas

**programacion_orden** — id, `numero_orden` (unique; es la clave de negocio, el horno es un
dato de la orden), `horno` smallint (1-4), `posicion`, modelo, metros numeric, acabado, cep
boolean, caja, tono, calibre, created_at, updated_at, `fecha_alta` date (null en las filas
anteriores al 02/10/2026; la fija `confirmar_programacion` al insertar). Trigger
`trg_programacion_orden_updated_at` (`set_updated_at_programacion_orden`). RLS: SELECT
(`programacion_orden_select`) para jefe, responsable, produccion y administrador; sin
políticas de escritura. Privilegios: solo `SELECT` para `authenticated`. Contenido actual: la
programación cargada con el Excel real del 03/10/2026 (53 órdenes).

**programacion_orden_historico** — id, `snapshot` jsonb, `creado_en`, `creado_por`. Foto de
`programacion_orden` antes de cada `confirmar_programacion`; `deshacer_ultima_programacion`
restaura la más reciente y la consume (es una pila). RLS: SELECT para jefe y administrador
(`programacion_orden_historico_select`) y para responsable y produccion
(`..._select_ampliada`). Privilegios: solo `SELECT` para `authenticated` (cerrado el 03/10/2026,
`20261003033056`: antes tenía los siete privilegios abiertos para `anon` y `authenticated`).
Solo la escriben `confirmar_programacion` y `deshacer_ultima_programacion` (security definer).

**programacion_nota** — id, `numero_orden` (SIN FK a `programacion_orden`: las notas sobreviven
si la orden sale de programación), `texto` (1-500), `creado_por` (FK a `usuario`, `on delete set
null`), created_at, updated_at. Varias notas por orden. Trigger `trg_programacion_nota_updated_at`.
RLS: SELECT para jefe, responsable, produccion y administrador; sin escritura directa
(solo `anadir_nota_ordenes`, `editar_nota`, `borrar_nota`). Solo `SELECT` para `authenticated`.

**programacion_nota_frase** — id, `texto` (único, 1-200), `activa`, `orden`. Siembra: «guardar 2
palets y una caja», «recordar sacar palet de revisión», «cuidado diseño UGL». Mismas RLS y
privilegios que la anterior; se escribe solo con `guardar_frase` (administrador).

**admin_notas** — id, `tipo` ('programacion' o 'nota'), fecha, titulo, `contenido`, `num_filas`,
`creado_por`, created_at, updated_at. Espacio de trabajo del administrador: tipo `programacion`
guarda el texto crudo del Excel/CSV diario (una fila por fecha, índice único parcial) y tipo
`nota` las notas sueltas (también `muestra_excel: …`, de `guardar_muestra_excel`). RLS: solo
administrador (`admin_notas_admin_todo`, `for all`); el jefe escribe a través de las RPC.

Las copias `programacion_orden_bak_20261002` y `programacion_orden_historico_bak_20261002`
(02/10/2026) se **borraron el 06/10/2026** (respaldo en `privado/backups/squash/`; ver `23`).

### Vista

**programacion_con_estado** — `programacion_orden` + `LEFT JOIN lote` por `numero_orden`;
estado `pendiente` (no hay lote) / `iniciado` / `finalizado` calculado en vivo. Filtra por rol
dentro de la propia vista (jefe, responsable, produccion, administrador): sin sesión o con otro
rol devuelve 0 filas. Expone `fecha_alta`.

### Funciones

Todas `security definer`, `search_path = public`, guarda de rol con `coalesce(fn_rol_actual()::text,'')`,
`EXECUTE` solo para `authenticated` (y `service_role`) salvo que se indique.

| Función | Rol | Qué hace |
|---|---|---|
| `existe_csv_programacion(fecha)` | jefe, administrador | ¿hay texto guardado para esa fecha? |
| `guardar_programacion_csv(fecha, contenido)` | jefe, administrador | upsert en `admin_notas` (tipo `programacion`) |
| `parse_programacion(fecha)` | jefe, administrador | lee el texto: cabeceras, horno por orden de cabecera, número de 6-8 cifras en la 2.ª columna; METROS con `fn_metros_entero`. Solo la llama `diff_programacion` |
| `diff_programacion(fecha)` | jefe, administrador | compara `parse_programacion` con la tabla por `numero_orden`; `repetida` sin multiplicar filas |
| `validar_programacion(fecha)` | jefe, administrador | avisos `repetida` / `incompleta` / `descartada` con los campos crudos; **reimplementa la lectura de líneas de `parse_programacion`**: cualquier cambio de formato, en las dos |
| `confirmar_programacion(fecha, filas jsonb)` | jefe, administrador | reemplazo completo con snapshot previo; rechaza repetidos, filas sin número/horno y **lista vacía** |
| `deshacer_ultima_programacion()` | jefe, administrador | restaura la última foto del historial y la consume |
| `actualizar_tono_calibre(numero_orden, tono, calibre)` | jefe, administrador | edita tono/calibre; vacío = null; ≤ 20 caracteres |
| `cruzar_orden_captura(numero_orden)` | responsable, suplente, jefe, produccion, administrador | solo lectura: `lote` (modelo + `objetivo_m2`), `programacion` (modelo crudo) y todas las órdenes a un dígito (sin límite; máx. 63) (lotes con marca y formato; programación sin ellos) como jsonb; para el cruce de la Foto 1 (`02`). Rol nulo/otros: «No autorizado»; número no 7 dígitos: error |
| `anadir_nota_ordenes(ordenes[], texto)` | jefe, administrador | la misma nota en varias órdenes, todo o nada (máx. 200) |
| `editar_nota(id, texto)` / `borrar_nota(id)` | jefe, administrador | |
| `guardar_frase(id, texto, activa, orden)` | solo administrador | alta (`id` nulo) o edición; baja lógica |
| `guardar_muestra_excel(titulo, contenido)` | jefe, administrador | guarda una muestra como `admin_notas` tipo `nota` (≤ 2 MB) |
| `fn_metros_entero(texto)` | **solo `service_role`** (la llaman funciones definer) | quita todo lo que no sea un dígito; sin dígitos o > 18 → null; nunca lanza excepción; inmutable, `search_path = pg_catalog` |
| `set_updated_at_programacion_orden()` / `set_updated_at_programacion_nota()` | triggers | `updated_at = now()` |

## Otros objetos no descritos arriba (revisión 03/10/2026)

Objetos que existen en la BD y que ninguna parte de este archivo recogía (algunos se explican en
su archivo de área).

- **ceria_tool_logs** (`11`) — una fila por herramienta ejecutada en cada pregunta a Ceria:
  conversacion_id, user_id, herramienta, args jsonb, filas, filas_totales, limitado, duracion_ms,
  error, created_at. RLS: inserta solo `service_role`; cada usuario ve sus propios logs.
  Vista **v_ceria_uso_herramientas**: ranking de uso (frecuencia, duración media, filas medias, errores).
- **v_alimentacion_turno_linea** (`21`) — por turno+línea: piezas, minutos reales y tres cocientes
  (`piezas_min_plena`, `piezas_min_turno`, `pct_plena`), con `formatos`/`formatos_distintos`. Para
  agregar varios turnos: `SUM(piezas)/SUM(minutos)`, nunca promediar los cocientes.
- **v_rectificado_turno** y **v_rectificado_modelo** (`13`) — Vista Rápida y Vista Detallada de
  `jefe_rectificado`: tiempos en 3 bloques y calidad como cuadre/descuadre de calibre.
- **v_lote_pendiente** — objetivo_m2 menos lo ya producido por el lote (NULL sin objetivo; 0 = ya
  completado; clamp a 0 si se produjo de más). La usa `lib/lote.ts`.
- **v_puntos_piezas_operario_ciclo**, **v_puntos_limpieza_operario_ciclo** y las tres
  `v_puntos_{piezas,rendimiento,limpieza}_operario_total_vida` (`04`) — desglose por categoría del
  ciclo en vivo y de por vida para la tarjeta de Inicio.
- **calidad_lote_por_fecha**, **calidad_modelo_por_fecha**, **calidad_linea_por_fecha** y
  **produccion_linea_por_fecha** (`11`) — funciones de lectura (no definer, `STABLE`) que usan las
  herramientas de Ceria para filtrar con precisión por `turno.fecha`. Sin `search_path` fijo (lint).
- **fn_parte_validar_correccion** (trigger `BEFORE INSERT` en `parte`) — blindaje en la BD de las
  reglas de corrección de partes (`02`). **fn_incidencia_produccion_restringir_columnas_update**
  (trigger `BEFORE UPDATE` en `incidencia_produccion`) — qué columnas puede tocar cada rol (`17`).
  Las dos sin `search_path` fijo (lint).
- **fn_set_nombre_normalizado_marca** / **fn_set_nombre_normalizado_modelo** — triggers
  (`BEFORE INSERT OR UPDATE OF nombre`) que rellenan `nombre_normalizado` con `fn_normalizar_texto`.
- `stg_migracion_operario_v2` — staging del import v2, **borrada el 06/10/2026** (ver arriba, «Tablas temporales»).
