# 06 — Esquema de base de datos

Contrastado con la BD real el 19/08/2026 (enums, políticas RLS,
triggers, funciones, vistas, cron). Actualizado 22/08/2026 con lo
construido en la sesión de gamificación (cierre de ciclo, stats,
personaje RPG). Las columnas de `parte`, `turno`, `usuario`,
`producto`, `refuerzo_operario_linea`, `operario_*`, `personaje_rpg` y
`puntos_*` vienen de las migraciones (el volcado de columnas se cortó
en 100 filas). Para regenerar: `information_schema.columns`,
`pg_policies`, `pg_proc`, `cron.job`.

Extensiones: `pg_trgm`, `pgcrypto`, `pg_cron`, `pg_net`.

## Enums

- `rol_usuario`: responsable, jefe, produccion, calidad, operario,
  administrador, suplente, pantalla, jefe_rectificado (los dos últimos
  existen en la BD pero no en ninguna migración).
- `letra_turno`: A, B, C, D. `tipo_turno`: M, T, N.
- `estado_lote`: iniciado, finalizado.

## Tablas

**configuracion** (clave PK, valor, nota). Fila `fecha_inicio_rotacion = 2026-08-31`. Sin políticas RLS propias.

Usuarios reales (19/08/2026): 6 responsables (A/B/C/D + **2 sin
letra**), 17 operarios (4/5/4/4), 1 jefe, 1 administrador, 1 suplente,
1 pantalla. Total 27.

**app_secrets** (key PK, value). Sin acceso para anon/authenticated. Fila `telegram_webhook_secret`.

**usuario** — id PK = `auth.users.id`, username unique, rol, letra (null
para admin/jefe/produccion/calidad/suplente), generaciones_disponibles
int ≥ 0 default 0, created_at. Índice único parcial: una sola fila con
rol = suplente.

**modelo / marca** — id, nombre, nombre_normalizado (trigger), created_at. Índice GIN trgm.

**formato** — id, nombre unique (7 filas).

**producto** — id, modelo_id, marca_id, formato_id, created_at; unique (modelo, marca, formato).

**lote** — id, numero_orden unique, producto_id, acabado_codigo/tipo/nombre,
espesor check ('9mm','11mm'), tipo_palet, pza_caja, objetivo_m2,
codbar_caja, codbar_pieza, cod_upec, codbar_saso, observaciones_material,
observaciones_orden, texto_crudo_modelo, texto_crudo_marca,
estado estado_lote default iniciado, resumen_calidad_enviado_at,
created_by, created_at.

**linea** — id, nombre unique (Línea 1…6).

**turno** — id, fecha date, tipo, cerrado_at, como_cerro
('manual'/'automatico'), resumen_enviado_at, abierto_por, created_at;
unique (fecha, tipo).

**asignacion_operario_linea** — id, turno_id, linea_id, operario_id, created_at; unique (turno, línea).

**refuerzo_operario_turno** — id, turno_id, operario_id, habilitado_por, created_at; unique (turno, operario).

**parte** — id, turno_id, linea_id, lote_id, responsable_id,
operario_id (nullable), tono, calibre,
verificacion_caja_estado (correcto/incorrecto/no_verificable/verificado_manual),
fotos_caja text[], verificacion_caja_detalle jsonb,
verificacion_codbar_estado (completo/parcial/manual/no_realizada),
verificacion_codbar_detalle jsonb,
verificacion_caja_estado_operario, fotos_caja_operario,
verificacion_caja_detalle_operario, verificacion_codbar_estado_operario,
verificacion_codbar_detalle_operario,
piezas_1a, piezas_comercial, piezas_eco, piezas_descuadre_com,
piezas_planar_com, piezas_contenedor, piezas_entradas (int default 0),
cal_1…cal_8, minutos_total, minutos_plena, minutos_no_alimentada,
minutos_saturacion, minutos_banco, minutos_maquina (int default 0),
hora_captura_pantalla timestamptz, hora_captura_pantalla_texto_crudo,
calibre_com_pct numeric (la rellena el trigger `trg_parte_calibre_pct`
a partir de descuadre_com/entradas, pisa lo que envíe el cliente),
calibre_std_pct numeric generada,
vigente bool default true, corrige_a_parte_id FK parte,
completado bool default false, completado_at, created_at.

**incidencia_calidad** — id, parte_id, descripcion, fotos text[], created_by, created_at.

**incidencia_produccion** — id, turno_id, linea_id (nullable = todo el turno), descripcion, fotos, created_by, created_at.

**cierre_fabrica** — id, fecha_inicio, fecha_fin (check fin ≥ inicio).

**checklist_items** — id, nombre, puntos default 1, activo. 6 filas sembradas.

**operario_checklist** — id, linea_id, turno_id, checklist_item_id, operario_id, fotos_antes text[], fotos_despues text[], created_at; unique (línea, turno, ítem).

**puntos_rendimiento** (pct_min, pct_max, puntos — 6 filas),
**puntos_rendimiento_responsable** (10 filas), **puntos_piezas**
(formato, min, max, puntos — 35 filas), **puntos_metros** (m2_min,
m2_max, puntos — 10 filas).

**niveles** (9 filas: nombre, umbral_min/max, descripcion, color,
estrellas, efecto_aura, prompt_base, prompt_imagen, orden, +
`umbral_min_responsable`/`umbral_max_responsable` generadas ×1,5).
Sin tabla `niveles_responsable` — descartada (22/08/2026), ver
`04-gamificacion.md`.

**logros_definicion** — **3 columnas nuevas 22/08/2026**: `rol` (text
not null default 'operario'), `formato_nombre` (text, solo para los
logros de piezas por formato), `condicion_valor` pasó a **nullable**
(Rey de Reyes no tiene umbral numérico). Los 19 datos reales del CSV
de v2 siguen sin sembrar.

**~~operario_logro~~ — eliminada entera (22/08/2026)**. Con los 19
logros pasando a calcularse 100% por consulta (ver `04-gamificacion.md`),
esta tabla de progreso guardado (usuario, logro, nivel_actual,
primera_vez_at, ultima_vez_at) se quedó sin ninguna función — nadie la
escribía ni la leía. Dropeada en
`20260822140000_logros_sin_motor.sql`. **Si ves referencias a ella en
documentación más antigua, están desactualizadas.**

**personaje_rpg** (usuario, nivel_en_generacion, imagen_url, historia,
seleccionada — sin cambios de esquema hoy, pero ya en uso real:
`generar-personaje` la escribe vía `fn_guardar_personaje_generado`).

**historial_ciclos** (usuario, rol, cycle_id, fecha_cierre,
puntos_ciclo, fuerza, resistencia, velocidad, m2_total, piezas_total,
tiempo_*, piezas_por_formato jsonb, **+ `m2_contenedor`, `m2_com`,
`m2_std` numeric default 0, añadidas 22/08/2026** para los 3 logros de
m² por categoría; unique (usuario, cycle_id)). Sigue vacía hasta el
primer cierre real de ciclo (28/09/2026) — el mecanismo que la rellena
(`fn_cerrar_ciclos_pendientes`) ya está construido y probado
manualmente.

## Vistas (confirmadas; sin `security_invoker`: se evalúan como el dueño, no aplican RLS)

Ya existían antes de hoy:
- `operario_ledger`: partes vigentes y completados, operario vía
  `parte.operario_id` directamente (sin JOIN a `asignacion_operario_linea`,
  desde 19-20/08/2026).
- `v_rendimiento_operario_por_turno`, `v_puntos_rendimiento_operario_ciclo`,
  `v_rendimiento_responsable_por_turno`, `v_puntos_rendimiento_responsable_ciclo`.

**Nuevas 22/08/2026 (sección 7 del diseño — piezas/metros/limpieza):**
- `v_piezas_formato_linea_turno` → `v_puntos_piezas_linea_turno` →
  `v_puntos_piezas_operario_por_linea_turno` (cadena de 3 pasos: piezas
  por formato → tramo → reparto igualitario entre operarios).
- `v_puntos_limpieza_operario_por_turno`.
- `v_metros_responsable_por_turno` → `v_puntos_metros_responsable_por_turno`.

**Nuevas 22/08/2026 (vistas en vivo del ciclo actual, para logros):**
- `v_piezas_operario_formato_ciclo` → `v_produccion_operario_ciclo`
  (equivalente a `historial_ciclos` pero para CUALQUIER ciclo, incluido
  el que aún no cerró — atribución directa por `operario_id`, sin
  reparto igualitario).
- `v_puntos_piezas_operario_ciclo`, `v_puntos_limpieza_operario_ciclo`
  → `v_puntos_operario_ciclo` (puntos totales por operario+ciclo, para
  cualquier ciclo).

**Nuevas 22/08/2026 (soporte del responsable para cierre de ciclo y stats):**
- `v_metros_responsable_ciclo`, `v_puntos_metros_responsable_ciclo` →
  `v_puntos_responsable_ciclo`.
- `v_tiempo_responsable_ciclo` (tiempo_plena + minutos_rendimiento por
  ciclo, para fuerza/resistencia/velocidad del responsable).
- `v_puntos_responsable_total_vida` (análoga a la del operario, no
  existía hasta hoy).

**Nuevas 22/08/2026 (stats):**
- `v_stats_vida` — fuerza/resistencia/velocidad de toda la vida
  (histórico + ciclo en vivo), para cualquier usuario y rol.

**Nuevas 23/08/2026:**
- `personaje_stats_nivel` — snapshot de fuerza/resistencia/velocidad/
  vida por (usuario_id, nivel_id), la existencia de la fila es el
  estado "bonus ya otorgado".
- `v_admin_usuarios_gamificacion` — apoyo para la vista de usuarios
  del admin (puntos, siguiente nivel, si el bonus del nivel actual ya
  se otorgó).

**Ampliada 22/08/2026:**
- `v_puntos_operario_total_vida` — ahora suma piezas y limpieza además
  de rendimiento (antes solo rendimiento).

## Funciones

| Función | Notas |
|---|---|
| `fn_rol_actual()` | security definer, stable, `set search_path = public` (confirmado 20/08/2026) |
| `fn_parte_restringir_columnas_update()` | trigger before update en `parte`, no security definer; ver `05-automatismos.md` |
| `fn_normalizar_texto(text)` | immutable |
| `fn_turno_de_letra(date, letra)`, `fn_ciclo_id(date)`, `fn_ciclo_rango(int)`, `fn_letra_de_turno` | todas stable (corregido 20/08/2026) |
| `fn_fabrica_cerrada(date)`, `fn_bloquear_turno_en_cierre()` | cierre anual |
| `fn_reabrir_lote_si_finalizado(uuid)` | estado → iniciado, limpia resumen_calidad_enviado_at |
| `fn_marcar_corregido_no_vigente()` | trigger de parte, security definer (20/08/2026) |
| `fn_parte_reabre_lote()` | trigger de parte, no security definer |
| `fn_buscar_modelo_similar`, `fn_buscar_marca_similar` | pg_trgm, top 5 |
| `fn_calcular_calibre_com_pct()` | trigger before insert/update en parte |
| `fn_otorgar_generaciones_por_nivel(uuid, int)`, `fn_consumir_generacion(uuid)` | ya existían; **ahora en uso real** por `generar-personaje` |
| `fn_notificar_telegram()`, `fn_disparar_resumen_turno(uuid)`, `fn_disparar_resumen_calidad()` | security definer, leen app_secrets, `net.http_post` |
| `fn_encolar_resumenes_turno_pendientes()` | cierre automático + reintento |
| **`fn_cerrar_ciclos_pendientes()`** | **nueva 22/08/2026**, security definer. Recorre todo `cycle_id` anterior al actual sin fila en `historial_ciclos` y las cierra (operario+responsable, con fuerza/resistencia/velocidad). Idempotente (`on conflict do update`) — también sirve para "recalcular ciclo anterior". Disparada por el cron `cerrar-ciclos-pendientes` (ver `05-automatismos.md`). |
| **`fn_nivel_actual(uuid)`** | **nueva 22/08/2026**, security definer, stable. Nivel actual (id de `niveles`) de un operario o responsable, según puntos totales y el umbral de su rol. |
| **`fn_guardar_personaje_generado(uuid, uuid, text, text)`** | **nueva 22/08/2026**, security definer. Guardado atómico del personaje generado: desmarca el `seleccionada` anterior, inserta el nuevo ya seleccionado. Usada por la Edge Function `generar-personaje`. |

`fn_es_responsable_de_turno(uuid)` — **eliminada 21/08/2026** (sin uso
real, bug de diseño). Si ves referencias a ella en documentación más
antigua, están desactualizadas.

## Políticas RLS (confirmadas contra `pg_policies`; permisivas, se combinan con OR)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| usuario | propia; admin todas; responsable/suplente las de rol operario | — | admin | — |
| parte | cualquier rol conocido | responsable, suplente, admin (no exige responsable_id = uid) | propio & `completado=false`; propio & completado & vigente & `completado_at > now()-1h` (with check solo responsable_id = uid); operario si `operario_id = uid`; administrador cualquier fila (20/08/2026) | administrador (vía política ALL, 20/08/2026) |
| turno | autenticados | responsable solo si `tipo = fn_turno_de_letra(fecha, su letra)`; suplente cualquiera; admin | responsable/suplente cualquiera; admin | admin |
| asignacion_operario_linea | autenticados | responsable/suplente; admin | responsable/suplente; admin | responsable/suplente; admin |
| refuerzo_operario_turno | autenticados | responsable/suplente/admin con `habilitado_por = uid` | — | responsable/suplente/admin |
| lote | autenticados | admin (Edge Function con service_role) | responsable/suplente; admin | admin |
| incidencia_calidad | responsable, suplente, jefe, calidad, admin | responsable, suplente, admin | — | — |
| incidencia_produccion | responsable, suplente, jefe, produccion, admin | responsable, suplente, admin | — | — |
| operario_checklist | propio; jefe; admin | propio; admin | — | — |
| personaje_rpg | propio; jefe; admin | propio; admin | propio | — |
| historial_ciclos | propio; jefe; admin | — | — | — |
| modelo, marca, formato, producto, linea, checklist_items, logros_definicion, puntos_*, niveles, cierre_fabrica | autenticados | admin | admin | admin |
| app_secrets | ninguno (revoke) | | | |

No hay políticas para `pantalla` ni `jefe_rectificado`; `parte_select`
los excluye (lista explícita de roles). El administrador **no** tiene
UPDATE en `parte`.

`operario_logro` eliminada de esta lista (tabla dropeada, ver arriba).

**historial_ciclos** — **3 columnas nuevas 23/08/2026**: `puntos_piezas`,
`puntos_rendimiento`, `puntos_limpieza` (int default 0, aportación de
ESE ciclo) — antes solo se guardaba `puntos_ciclo` ya sumado, sin
desglose por categoría, así que no se podía calcular "puntos piezas
totales de por vida" para ciclos ya cerrados. `fn_cerrar_ciclos_
pendientes` las rellena ahora (solo para operarios — los responsables
no tienen aún este desglose, fase 2).

**personaje_stats_nivel** — **1 columna nueva 23/08/2026**:
`generaciones_usadas` (int not null default 0, check 0-3). Sustituye
al modelo de `usuario.generaciones_disponibles` (contador plano) —
ahora cada nivel alcanzado lleva sus propias 3 generaciones.

**usuario.generaciones_disponibles** — **SIN USO desde 23/08/2026**.
Columna no borrada (inofensiva ahí parada) pero ningún código la lee
ni la escribe ya — ver `personaje_stats_nivel.generaciones_usadas`.

**parte** — **1 columna nueva 23/08/2026**: `formato_id` (uuid
references formato, nullable), denormalizado desde
`producto.formato_id` vía `lote` en el momento de crear el parte
(trigger `trg_parte_set_formato_id`, solo BEFORE INSERT — el formato
de un parte no cambia después). Existe solo para poder indexar
directamente sobre `parte` sin pasar por `lote`/`producto` en cada
consulta — ver `idx_parte_formato_record` más abajo. Backfill
aplicado a los partes ya existentes al migrar.

- `v_puntos_piezas_operario_total_vida`, `v_puntos_rendimiento_operario_total_vida`,
  `v_puntos_limpieza_operario_total_vida` — desglose de puntos de por
  vida por categoría (histórico cerrado + ciclo en vivo), análogas a
  `v_puntos_operario_total_vida` pero de una sola categoría cada una.
  Alimentan la tarjeta resumen de Inicio.
- `v_stats_vida` — **ampliada**: gana `m2_total_vida` y
  `horas_plena_vida` en crudo (ya se calculaban internamente para
  derivar fuerza/velocidad, solo faltaba exponerlos) — para "metros
  totales"/"tiempo plena total" de la tarjeta de Inicio.
- `v_rey_formato_historico` — récord absoluto de piezas de un formato
  en un solo `parte` (un operario, un turno, una línea), con TODOS
  los empates si los hay. Apoyada en `idx_parte_formato_record`
  (`parte(formato_id, vigente, completado, piezas_entradas desc)`) —
  resuelve el MAX por formato sin escanear `parte` entera.
- `v_rey_formato_actual` — más piezas de un formato acumuladas en el
  ciclo EN CURSO por operario (sobre `v_piezas_operario_formato_ciclo`,
  que ya suma todas las líneas/turnos). Mismo criterio de empates.
- `v_mi_mejor_parte_por_formato` — mejor parte histórico de CADA
  operario en cada formato, para que Ranking muestre "tu mejor parte"
  aunque no seas ninguno de los dos reyes.
- `v_ganador_por_ciclo` — ranking de CADA ciclo (cerrados +
  el actual en vivo), `posicion=1` el ganador. Base del logro "Rey de
  Reyes".
- `v_veces_rey_de_reyes` — cuántos ciclos ha ganado cada operario
  (`posicion=1` en `v_ganador_por_ciclo`), agregada.
- `v_niveles_disponibles_generar` — niveles alcanzados por usuario con
  generaciones restantes (de 3) y si ya hay carta generada para ese
  nivel — apoyo directo del selector de la pantalla Avatar.

| `fn_parte_set_formato_id()` | trigger before insert en `parte`, no security definer — copia `producto.formato_id` vía `lote` |
| `fn_seleccionar_personaje(p_personaje_id uuid)` | security definer. Elegir avatar entre los ya generados. Usa `auth.uid()` internamente — NUNCA recibe `usuario_id` como parámetro (sería explotable al saltarse RLS) |
| `fn_consumir_generacion_nivel(p_usuario_id uuid, p_nivel_id uuid)` | security definer, **ejecución restringida a service_role** (revocada a authenticated/anon) — corregido 23/08/2026, ver `04-gamificacion.md`. Llamada solo desde `generar-personaje` (ya validó el JWT por su cuenta) |
| `fn_devolver_generacion_nivel(p_usuario_id uuid, p_nivel_id uuid)` | igual criterio que la anterior — solo service_role |

**Patrón de seguridad para RPCs `security definer` llamadas directamente
por el cliente** (no vía Edge Function): NUNCA reciben `usuario_id`
como parámetro — siempre resuelven `auth.uid()` internamente. Al ser
`security definer` se saltan RLS, así que confiar en un `usuario_id`
que manda el cliente sería explotable (cualquiera podría pasar el id
de otra persona). Ejemplo: `fn_seleccionar_personaje` (la llama el cliente directamente
con su propia sesión).

**Patrón contrario, igual de válido**: RPCs llamadas desde DENTRO de
una Edge Function con `service_role` (nunca directamente por el
cliente) — ahí `auth.uid()` NO funciona (siempre da `null` con
`service_role`, no lleva el JWT del usuario). En ese caso SÍ hay que
recibir `p_usuario_id` como parámetro, pero restringiendo el permiso
de ejecución a `service_role` (`revoke execute ... from public,
authenticated, anon; grant execute ... to service_role;`) para que
ningún cliente pueda llamarla directamente con un id ajeno. Ejemplos:
`fn_consumir_generacion_nivel`, `fn_devolver_generacion_nivel` — error
real: se diseñaron primero con `auth.uid()` como si el cliente las
llamara, se desplegaron, y fallaron en real ("No hay sesión activa")
porque en verdad las llama `generar-personaje` con `service_role`.
Corregido en sesión 23/08/2026 tras el fallo — la lección: el patrón
de seguridad correcto depende de QUIÉN llama a la función (cliente
directo vs. Edge Function con service_role), no es el mismo siempre.