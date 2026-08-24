# 05 — Automatismos: Edge Functions, Telegram, cron, Cloudinary

## Edge Functions (`supabase/functions/`)

| Función | Quién la llama | Auth | Qué hace |
|---|---|---|---|
| `ocr-parte` | Frontend | JWT de sesión validado con `auth.getUser` | Recibe `foto_tipo` (`hoja_partida` / `caja` / `pantalla`) + 1-2 URLs de imagen, llama a GPT-4o-mini con el prompt de `prompts.ts` y cae a Claude Haiku si falla (timeout 25 s cada uno; `extraido_con: "gpt" | "claude"` en la respuesta), devuelve el JSON. No escribe en BD. |
| `resolver-catalogo` | Frontend, tras `ocr-parte` de hoja | JWT validado; `created_by` sale del token; escribe con service_role | Resuelve/crea modelo (pg_trgm ≥ 0,4, nombre cortado en el primer `(`), marca, producto, lote (número de orden exacto); reabre lote finalizado. Devuelve ids y flags `lote_creado`/`lote_reabierto`. |
| `generar-personaje` | Frontend (Stats+Avatar) | JWT validado; RPCs y escritura con service_role | Genera imagen (GPT Image 2) e historia (DeepSeek) del personaje para un `nivel_id` ya alcanzado. Flujo completo en `04`. |
| `ceria` | Frontend (jefe/admin) | JWT validado | Asistente de producción sobre GPT-5-mini, 3 fases + 9 herramientas. Ver `11`. |
| `notificar-telegram` | BD vía `pg_net` | header `x-webhook-secret` | `tipo` ∈ incidencia_calidad / incidencia_produccion / nuevo_lote. Enriquece con consulta y envía al grupo correspondiente, con fotos si hay. |
| `generar-resumen-turno` | BD vía `pg_net` | `x-webhook-secret` | Compila el informe del turno (misma estructura que la pestaña Resumen), lo parte en mensajes < 3.500 caracteres, envía, marca `turno.resumen_enviado_at`. |
| `notificar-telegram-resumen-calidad` | BD vía `pg_net` | `x-webhook-secret` | Digest de lotes `finalizado` con `resumen_calidad_enviado_at null`: m² 1ª / comercial / contenedor, calidad oficial y completa, tonos; marca cada lote justo tras confirmarse su mensaje. Si no hay lotes, no envía. |

Secrets de Edge Functions (`[VERIFICAR]` nombres con `supabase secrets
list`): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (OCR y GPT Image 2),
`DEEPSEEK_API_KEY` (historia del personaje), `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_INCIDENCIAS_CALIDAD`,
`TELEGRAM_CHAT_INCIDENCIAS_PRODUCCION`, `TELEGRAM_CHAT_NUEVOS_LOTES`,
`TELEGRAM_CHAT_RESUMEN_TURNO`, `TELEGRAM_CHAT_RESUMEN_CALIDAD`,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_PRESET_PERSONAJES`. `SUPABASE_URL`
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

## Cron (`pg_cron`, horario en UTC — confirmado en `cron.job`)

| Job | Schedule | Qué hace |
|---|---|---|
| `resumenes-turno-pendientes` | `0 * * * *` | `fn_encolar_resumenes_turno_pendientes()`: (1) marca `cerrado_at/como_cerro='automatico'` en turnos cuya franja + 1 h ya pasó (hora Madrid) y nadie cerró; ese UPDATE dispara el trigger de envío. (1b) cierra "sin producción" cualquier parte que quedó `completado=false` en esos turnos (20/08/2026). (2) Reintenta `fn_disparar_resumen_turno` para turnos cerrados hace > 5 min sin `resumen_enviado_at`. |
| `resumen-calidad-diario` | `0 * * * *` | Solo si la hora de Madrid es 7, 15 o 23 → `fn_disparar_resumen_calidad()`. |
| `cerrar-ciclos-pendientes` | `0 * * * 1` (solo lunes) | Solo si la hora de Madrid es 8 → `fn_cerrar_ciclos_pendientes()` (`04`). Lunes porque cada ciclo de 28 días desde un lunes acaba en domingo; las 8:00 dan margen sobre el cierre automático del turno N (07:00) y la ventana de corrección de 1 h. |

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
| parte | before update (`trg_parte_restringir_columnas`) | Restringe qué columnas puede tocar cada UPDATE según quién lo hace: operario (`operario_id = auth.uid()`) solo las 5 columnas `*_operario`; responsable en ventana de 1h no puede cambiar `completado`/`completado_at`/`vigente`; administrador sin restricción. Diff genérico OLD/NEW por jsonb. |

## Cloudinary

Subida unsigned desde el navegador, preset por categoría, carpeta
fija en el preset: `motiv_v3_partes` → `motiv-produccion/partes`
(prefijos `hoja_`, `caja_`, `pantalla_`), `motiv_v3_incidencias_calidad`,
`motiv_v3_incidencias_produccion`, `motiv_v3_limpieza` (`antes_`,
`despues_`), `motiv_v3_personajes` (prefijos `referencia_` desde el
navegador y `personaje_` desde la Edge Function — el único preset usado
desde los dos lados). Retención acordada: 18 meses (no automatizada).

## Variables de entorno del frontend (`.env.local`)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_PRESET_PARTES`,
`VITE_CLOUDINARY_PRESET_INCIDENCIAS_CALIDAD`,
`VITE_CLOUDINARY_PRESET_INCIDENCIAS_PRODUCCION`,
`VITE_CLOUDINARY_PRESET_LIMPIEZA`, `VITE_CLOUDINARY_PRESET_PERSONAJES`.
Todas públicas por diseño (también en `frontend/.env.example`).


Seguridad de cuenta (Settings → Security, 20/08/2026): Resource list y
el resto de tipos de entrega no usados (Authenticated, Private, Fetched
URL, redes sociales, etc.) marcados como restringidos — solo "Uploaded"
sin restringir. Fetch de vídeo restringido. Strict Transformations
(imagen y vídeo) activado. PDF/ZIP delivery desactivado. Unsigned
actions (auto-chaptering/transcription/video details) sin activar.
Cada preset con `Allowed formats` (jpg/png/webp, sin SVG), tamaño
máximo de archivo, y `Overwrite` desactivado. `[VERIFICAR]` que
`motiv_v3_personajes` (creado después de esta revisión) tiene los
mismos ajustes.