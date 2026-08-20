# 06 — Esquema de base de datos

Contrastado con la BD real el 19/08/2026 (enums, políticas RLS,
triggers, funciones, vistas, cron). Las columnas de `parte`, `turno`,
`usuario`, `producto`, `refuerzo_operario_turno`, `operario_*`,
`personaje_rpg` y `puntos_*` vienen de las migraciones (el volcado de
columnas se cortó en 100 filas). Para regenerar: `information_schema.columns`,
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

**niveles** (9 filas: nombre, umbral_min/max, color, estrellas,
efecto_aura, descripcion, prompt_base, prompt_imagen),
**niveles_responsable** (nivel_id, umbral_min, umbral_max).

**logros_definicion**, **operario_logro** (usuario, logro, nivel_actual,
primera_vez_at, ultima_vez_at; unique), **personaje_rpg** (usuario,
nivel_en_generacion, imagen_url, historia, seleccionada),
**historial_ciclos** (usuario, rol, cycle_id, fecha_cierre,
puntos_ciclo, fuerza, resistencia, velocidad, m2_total, piezas_total,
tiempo_*, piezas_por_formato jsonb; unique (usuario, cycle_id)).
Todas vacías salvo catálogos.

## Vistas (confirmadas; sin `security_invoker`: se evalúan como el dueño, no aplican RLS)

- `operario_ledger`: partes vigentes y completados, operario vía
  `parte.operario_id` directamente (sin JOIN a `asignacion_operario_linea`,
  desde 19-20/08/2026).
- `v_rendimiento_operario_por_turno`, `v_puntos_rendimiento_operario_ciclo`,
  `v_rendimiento_responsable_por_turno`, `v_puntos_rendimiento_responsable_ciclo`,
  `v_puntos_operario_total_vida` (histórico + rendimiento del ciclo actual).

## Funciones

| Función | Notas |
|---|---|
| `fn_rol_actual()` | security definer, stable, `search_path = public` (corregido 20/08/2026) |
| `fn_parte_restringir_columnas_update()` | trigger before update en `parte`, no security definer; ver `05-automatismos.md` |
| `fn_es_responsable_de_turno(uuid)` | security definer; en la práctica devuelve true para cualquier responsable/suplente; no la usa ninguna política |
| `fn_normalizar_texto(text)` | immutable |
| `fn_turno_de_letra(date, letra)`, `fn_ciclo_id(date)`, `fn_ciclo_rango(int)`, `fn_letra_de_turno` | todas stable (corregido 20/08/2026) |
| `fn_fabrica_cerrada(date)`, `fn_bloquear_turno_en_cierre()` | cierre anual |
| `fn_reabrir_lote_si_finalizado(uuid)` | estado → iniciado, limpia resumen_calidad_enviado_at |
| `fn_marcar_corregido_no_vigente()` | trigger de parte, security definer (20/08/2026) |
| `fn_parte_reabre_lote()` | trigger de parte, no security definer |
| `fn_buscar_modelo_similar`, `fn_buscar_marca_similar` | pg_trgm, top 5 |
| `fn_calcular_calibre_com_pct()` | trigger before insert/update en parte |
| `fn_ciclo_rango(int)` | inicio/fin de un ciclo; immutable leyendo configuracion |
| `fn_otorgar_generaciones_por_nivel(uuid, int)`, `fn_consumir_generacion(uuid)` | existen, nada las llama todavía |
| `fn_notificar_telegram()`, `fn_disparar_resumen_turno(uuid)`, `fn_disparar_resumen_calidad()` | security definer, leen app_secrets, `net.http_post` |
| `fn_encolar_resumenes_turno_pendientes()` | cierre automático + reintento |

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
| historial_ciclos, operario_logro | propio; jefe; admin | — | — | — |
| modelo, marca, formato, producto, linea, checklist_items, logros_definicion, puntos_*, niveles*, cierre_fabrica | autenticados | admin | admin | admin |
| app_secrets | ninguno (revoke) | | | |

No hay políticas para `pantalla` ni `jefe_rectificado`; `parte_select`
los excluye (lista explícita de roles). El administrador **no** tiene
UPDATE en `parte`.
