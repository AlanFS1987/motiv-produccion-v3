# 05 — Automatismos: Edge Functions, Telegram, cron, Cloudinary

## Edge Functions (`supabase/functions/`)

| Función | Quién la llama | Auth | Qué hace |
|---|---|---|---|
| `ocr-parte` | Frontend | JWT de sesión validado con `auth.getUser` (20/08/2026) | Recibe `foto_tipo` (`hoja_partida` / `caja` / `pantalla`) + 1-2 URLs de imagen, llama a Claude con el prompt de `prompts.ts`, devuelve el JSON. No escribe en BD. |
| `resolver-catalogo` | Frontend, tras `ocr-parte` de hoja | JWT de sesión validado con `auth.getUser` (20/08/2026); `created_by` sale del token, no del body; usa service_role para escribir | Resuelve/crea modelo (pg_trgm ≥ 0,4, nombre cortado en el primer `(`), marca, producto, lote (número de orden exacto); reabre lote finalizado. Devuelve ids y flags `lote_creado`/`lote_reabierto`. |
| `notificar-telegram` | BD vía `pg_net` | header `x-webhook-secret` | `tipo` ∈ incidencia_calidad / incidencia_produccion / nuevo_lote. Enriquece con consulta y envía al grupo correspondiente, con fotos si hay. |
| `generar-resumen-turno` | BD vía `pg_net` | `x-webhook-secret` | Compila el informe del turno (misma estructura que la pestaña Resumen), lo parte en mensajes < 3.500 caracteres, envía, marca `turno.resumen_enviado_at`. |
| `notificar-telegram-resumen-calidad` | BD vía `pg_net` | `x-webhook-secret` | Digest de lotes `finalizado` con `resumen_calidad_enviado_at null`: m² 1ª / comercial / contenedor, calidad oficial y completa, tonos; marca los enviados. Si no hay lotes, no envía. |

Secrets de Edge Functions: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_INCIDENCIAS_CALIDAD`,
`TELEGRAM_CHAT_INCIDENCIAS_PRODUCCION`, `TELEGRAM_CHAT_NUEVOS_LOTES`,
`TELEGRAM_CHAT_RESUMEN_TURNO`, `TELEGRAM_CHAT_RESUMEN_CALIDAD`
(nombres según el código de las funciones; `[VERIFICAR]` con
`supabase secrets list`). `SUPABASE_URL`
y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase.

Las tres funciones llamadas desde la BD se despliegan con
`--no-verify-jwt`. La URL de cada una está escrita literalmente en las
funciones SQL `fn_notificar_telegram`, `fn_disparar_resumen_turno`,
`fn_disparar_resumen_calidad`.

## Telegram — un bot, cinco grupos

| Grupo | Disparo | Estado |
|---|---|---|
| Incidencias calidad | trigger `AFTER INSERT incidencia_calidad` | Construido, probado |
| Incidencias producción | trigger `AFTER INSERT incidencia_produccion` | Construido, probado |
| Nuevos lotes | trigger `AFTER UPDATE OF verificacion_caja_estado` en `parte`, solo cuando pasa a no-null o cambia | Construido |
| Resumen de turno | trigger `AFTER UPDATE OF cerrado_at` en `turno` (null → valor); cron reintenta si no se confirmó | Construido; cierre manual probado, automático no visto en real |
| Resúmenes calidad | cron, 07/15/23 h Madrid | Construido |

El secreto compartido vive en `app_secrets` (`telegram_webhook_secret`)
y en el secret `TELEGRAM_WEBHOOK_SECRET`; si no coinciden las funciones
devuelven 401 y no envían nada (falla cerrado).

## Cron (`pg_cron`, horario en UTC — confirmado en `cron.job`, ambos activos)

| Job | Schedule | Qué hace |
|---|---|---|
| `resumenes-turno-pendientes` | `0 * * * *` | `fn_encolar_resumenes_turno_pendientes()`: (1) marca `cerrado_at/como_cerro='automatico'` en turnos cuya franja + 1 h ya pasó (hora Madrid) y nadie cerró; ese UPDATE dispara el trigger de envío. (1b) cierra "sin producción" cualquier parte que quedó `completado=false` en esos turnos (20/08/2026). (2) Reintenta `fn_disparar_resumen_turno` para turnos cerrados hace > 5 min sin `resumen_enviado_at`. |
| `resumen-calidad-diario` | `0 * * * *` | Solo si la hora de Madrid es 7, 15 o 23 → `fn_disparar_resumen_calidad()`. |

Disparar cada hora es deliberado: España siempre está a un número
entero de horas de UTC, así que no hay que tocar nada con el cambio de
hora. El cron nunca cierra antes de tiempo: la decisión está en la
consulta, no en el horario.

## Triggers de negocio (no Telegram)

| Tabla | Trigger | Efecto |
|---|---|---|
| modelo / marca | before insert/update of nombre | rellena `nombre_normalizado` |
| parte | after insert (`trg_parte_corregir`) | si `corrige_a_parte_id` no es null, pone el original `vigente=false` (no es security definer: sujeto a RLS de quien inserta) |
| parte | after insert (`trg_parte_reabre_lote`) | `fn_reabrir_lote_si_finalizado(lote_id)` |
| parte | before insert/update (`trg_parte_calibre_pct`) | recalcula `calibre_com_pct` = descuadre_com / entradas × 100 (null si entradas = 0) |
| turno | before insert | bloquea si `fn_fabrica_cerrada(fecha)` |

## Cloudinary

Subida unsigned desde el navegador, preset por categoría, carpeta
fija en el preset: `motiv_v3_partes` → `motiv-produccion/partes`
(prefijos `hoja_`, `caja_`, `pantalla_`), `motiv_v3_incidencias_calidad`,
`motiv_v3_incidencias_produccion`, `motiv_v3_limpieza` (`antes_`,
`despues_`). Retención acordada: 18 meses (no automatizada). Variables
`VITE_CLOUDINARY_CLOUD_NAME` y `VITE_CLOUDINARY_PRESET_*`.

## Variables de entorno del frontend (`.env.local`)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_PRESET_PARTES`,
`VITE_CLOUDINARY_PRESET_INCIDENCIAS_CALIDAD`,
`VITE_CLOUDINARY_PRESET_INCIDENCIAS_PRODUCCION`,
`VITE_CLOUDINARY_PRESET_LIMPIEZA`. Todas públicas por diseño.
