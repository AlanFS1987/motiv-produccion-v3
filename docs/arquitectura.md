# Arquitectura de la app, explicada para un jefe de planta

Este documento explica cómo está montada la app de partes de producción de la
sección de clasificación, sin tecnicismos. Se escribió leyendo el código del
repositorio (carpetas `frontend`, `supabase`, `memorias`) el 09/10/2026.

**Cómo leer las marcas de fiabilidad:**

- Lo que no lleva marca lo he comprobado leyendo el código o las migraciones.
- **[SOLO DOCUMENTADO]** significa que lo dice la documentación (`memorias/`)
  pero no tengo forma de comprobarlo desde el repositorio (por ejemplo, lo que
  hay configurado en el panel de Supabase, Cloudinary o Telegram).
- **[NO CONFIRMADO]** significa que no lo he podido confirmar y no quiero
  suponerlo.

No he podido hablar con la base de datos real, con Telegram ni con Cloudinary.
Todo lo que sigue sale de leer archivos, no de ver la app funcionando.

---

## 1. Mapa de piezas

Piensa en la app como una fábrica pequeña con cuatro zonas:

| Zona | Dónde está | Qué es, en cristiano |
|---|---|---|
| **La pantalla que usa la gente** | `frontend/` | La app que se abre en el móvil o la tablet. Cada rol (responsable, operario, jefe, etc.) ve una app distinta dentro de la misma. Es la "cara". |
| **El almacén de datos y las reglas** | `supabase/migrations/` y `supabase/seed.sql` | La base de datos (Postgres, alojada en Supabase). Guarda todos los partes, turnos, lotes, usuarios, puntos. También contiene muchas reglas que se cumplen solas, aunque la pantalla falle. |
| **Los ayudantes con tareas especiales** | `supabase/functions/` | Programas pequeños que viven en la nube de Supabase ("Edge Functions"). Hacen lo que la pantalla no puede o no debe hacer sola: leer una foto con inteligencia artificial, mandar un mensaje a Telegram, crear un usuario. |
| **El manual de la casa** | `memorias/` | Documentación escrita a mano: 24 archivos numerados (`00` a `23`) más `CLAUDE.md` (entrada) y `README.md` (índice). Es la fuente de las decisiones de negocio. |

### Carpeta por carpeta

**`frontend/`** (la app)
- `src/App.tsx`: el "portero". Mira qué rol tiene quien entró y le muestra la
  app que le toca. Es el punto donde se reparten los roles (líneas 64-96).
- `src/components/`: las pantallas, separadas por rol: `captura-parte/` (el
  asistente de fotos del responsable), `operario/`, `jefe/`, `admin/`,
  `calidad/`, `rectificado/`, `produccion/`, `mecanico/`, `pantalla/` (la pantalla
  de fábrica), `ceria/` y `nora/` (los asistentes de IA), `alimentacion/`.
- `src/lib/`: la "lógica de oficina" de la pantalla: cálculo de turnos
  (`rotacion.ts`), de ciclos (`ciclo.ts`), creación y corrección de partes
  (`parte.ts`), validaciones (`validaciones-parte.ts`), subida de fotos
  (`cloudinary.ts`, `captura-imagen.ts`), etc.
- `src/context/`: quién ha iniciado sesión (`AuthContext.tsx`) y el tema visual.
- `tests/`: 3 archivos de pruebas automáticas (ver sección 6).
- `public/`: lo que permite instalar la app en el móvil (`manifest.json`, `sw.js`).
- `vercel.json`: configuración del servidor web donde se publica el frontend y
  su lista de "a qué sitios puede hablar la app" (seguridad del navegador).

**`supabase/`** (el servidor)
- `migrations/`: **la verdad actual de la base de datos**. Son 3 archivos: una
  "foto completa" (`20261006204519_baseline.sql`, ~8.000 líneas) y dos cambios
  posteriores. Se ejecuta en orden para reconstruir la base de datos.
- `migrations_archivo/`: las 173 migraciones antiguas. Son historia; el sistema
  ya no las lee. Solo sirven para averiguar por qué algo es como es.
- `functions/`: las 11 Edge Functions (sección 2) y `_shared/`, código común.
- `seed.sql`: datos de arranque (formatos, líneas, tablas de puntos, niveles).
  Solo se usa al montar una base de datos local de pruebas.
- `scripts/`: consultas de ayuda para comparar la base local con la real.

**`memorias/`** (documentación). Empieza por `CLAUDE.md` y `README.md`.

**`privado/`** (no está en el repositorio): carpeta local con copias de
seguridad y parches. Está en `.gitignore`, así que **no se sube a git**.
Que exista solo en tu ordenador es a la vez una ventaja (los datos no se
publican) y un riesgo (si se pierde el ordenador, se pierden las copias).

**Otros:** `arbol.txt` y `exit` (en la raíz) parecen restos sin función; no
he encontrado nada que los use. [NO CONFIRMADO que se puedan borrar].

---

## 2. Cómo se conectan las piezas

```
 ┌────────────────────────────┐
 │  MÓVIL / TABLET (la app)   │   React, publicada en Vercel
 │  frontend/                 │
 └───┬───────────┬────────────┘
     │           │
     │ (1) fotos │ (2) datos y órdenes, siempre con la sesión de la persona
     ▼           ▼
 ┌─────────┐  ┌──────────────────────────────────────────────────────┐
 │Cloudinary│  │                    SUPABASE                         │
 │ (guarda  │  │  ┌────────────┐   ┌───────────────────────────┐    │
 │  las     │  │  │ Login      │   │ BASE DE DATOS (Postgres)  │    │
 │  fotos)  │  │  │ (Auth)     │   │ tablas + reglas + permisos│    │
 └─────────┘  │  └────────────┘   │ triggers y tareas con reloj│    │
     ▲        │                    └───────┬───────────────────┘    │
     │        │   ┌────────────────────────┴───────────┐            │
     │        │   │  EDGE FUNCTIONS (11 ayudantes)     │            │
     │        │   └──┬─────────────┬───────────────┬───┘            │
     │        └──────┼─────────────┼───────────────┼────────────────┘
     │               │             │               │
     │               ▼             ▼               ▼
     │        ┌──────────┐  ┌──────────┐   ┌──────────────┐
     └────────│ OCR:     │  │ Telegram │   │ Otros servicios de IA:│
  (los PDF    │ Anthropic│  │ (avisos  │   │ OpenAI (Ceria, NORA,  │
   de informe │ (Haiku)  │  │  a       │   │ imagen del personaje),│
   también    │ y OpenAI │  │  grupos) │   │ DeepSeek (historia)   │
   se suben)  │ de reserva│ └──────────┘   └──────────────┘
              └──────────┘
```

Tres ideas que explican casi todo:

1. **La pantalla nunca guarda "a escondidas".** Cada vez que alguien guarda
   algo, la app habla con la base de datos usando la sesión de esa persona. La
   base de datos decide si puede (esto se llama RLS: "seguridad por filas").
   Aunque alguien manipulara la pantalla, la base de datos le diría que no.
2. **Las fotos y los datos viajan por caminos distintos.** La foto va a
   Cloudinary (que solo guarda imágenes). Lo que se lee de la foto va a
   Supabase. La base de datos solo guarda la dirección web de la foto.
3. **La base de datos también "da órdenes".** Cuando se cierra un turno o
   entra una incidencia, la propia base de datos avisa a una Edge Function
   para que mande el mensaje de Telegram. Y hay tareas con reloj (cron) que
   revisan cada hora si hay algo pendiente.

### Las 11 Edge Functions (los ayudantes)

| Ayudante | Quién lo llama | Para qué sirve |
|---|---|---|
| `ocr-parte` | la app | Lee una foto (hoja de partida, caja o pantalla de la máquina) y devuelve los datos. No guarda nada. |
| `resolver-catalogo` | la app, tras leer la hoja | Busca o crea el modelo, la marca, el producto y el lote. |
| `generar-personaje` | la app | Crea el personaje del operario (imagen + historia). |
| `ceria` | la app (jefe/admin) | Asistente de preguntas sobre producción. |
| `nora` | la app | Copiloto de averías por voz. |
| `admin-crear-usuario` | la app (solo admin) | Da de alta usuarios. |
| `admin-cambiar-password` | la app (solo admin) | Cambia contraseñas. |
| `notificar-telegram` | la base de datos | Avisa de incidencias y de lotes nuevos. |
| `generar-resumen-turno` | la base de datos | Compone y envía el informe de cierre de turno. |
| `notificar-telegram-resumen-calidad` | la base de datos (cron) | Resumen de calidad de lotes terminados. |
| `generar-informe-periodo` | `generar-resumen-turno` y cron | Informes diario/semanal en PDF. |

### Servicios externos

| Servicio | Para qué | Dónde se usa |
|---|---|---|
| **Supabase** | Base de datos, login, ayudantes | todo |
| **Vercel** | Publicar la app web | `frontend/vercel.json` |
| **Cloudinary** | Guardar fotos (y PDF de informes) | `lib/cloudinary.ts`, `_shared/cloudinary.ts` |
| **Anthropic (Haiku)** | Leer las fotos (principal) | `_shared/anthropic.ts` |
| **OpenAI** | OCR de reserva, Ceria, NORA, imagen del personaje | `_shared/openai.ts`, `ceria/`, `nora/` |
| **DeepSeek** | Historia del personaje | `_shared/deepseek_historia.ts` |
| **Telegram** | Avisos y resúmenes a grupos | `notificar-telegram/` y otras |

> **Aviso de documentación desactualizada.** `memorias/05-automatismos.md`
> dice que el OCR usa primero GPT y cae a Claude Haiku si falla. **El código
> hace lo contrario**: `supabase/functions/ocr-parte/index.ts` llama primero a
> Claude (Haiku) y solo si falla usa GPT. Lo mismo dice `memorias/CLAUDE.md`,
> que es la versión correcta. Si lees `05` ten esto en cuenta.

---

## 3. Los flujos más importantes, de principio a fin

### Flujo A — Foto de la hoja de partida → lote → parte abierto

Es el arranque de un parte nuevo. Lo hace el **responsable** (el operario nunca
captura partes).

| Paso | Qué pasa | Archivo | Si falla |
|---|---|---|---|
| 1 | El responsable hace la foto con la cámara del móvil. La app la recorta, la comprime (WebP) y la prepara. | `lib/captura-imagen.ts`, `components/captura-parte/FotoHojaPartida.tsx` | Mensaje de error en la pantalla; puede repetir la foto. |
| 2 | **En paralelo**: la foto se sube a Cloudinary y se manda a leer a `ocr-parte`. | `FotoHojaPartida.tsx` (líneas ~143-144), `lib/cloudinary.ts`, `lib/supabase-functions.ts` | Si **cualquiera de las dos** falla, falla el paso entero (se usa `Promise.all`): aunque el OCR haya funcionado, no se aprovecha. La pantalla muestra el error y permite reintentar. |
| 3 | `ocr-parte` comprueba la sesión (con tope de 10 s), elige el texto de instrucciones según el tipo de foto y pregunta a Claude Haiku. Si Haiku falla, lo intenta con GPT. | `functions/ocr-parte/index.ts`, `prompts.ts`, `_shared/anthropic.ts`, `_shared/openai.ts` | Si fallan los dos, devuelve error 500 y la app muestra el mensaje. **No se escribe nada en la base de datos.** |
| 4 | El responsable **revisa y corrige** lo leído (orden, tono, calibre, objetivo). Nada se guarda sin su visto bueno. | `FotoHojaPartida.tsx` | — |
| 5 | La app valida el número de orden (formato) y lo cruza con la programación de hornos. | `lib/validar-orden.ts` (copia en Deno: `_shared/validacion-orden.ts`), `lib/cruce-orden.ts` → función SQL `cruzar_orden_captura` | El número de orden inválido bloquea (error 422 en `resolver-catalogo`). El cruce con la programación solo informa: si falla, la pantalla sigue sin cruce (`setCruce(... null)`). |
| 6 | `resolver-catalogo` busca el modelo y la marca por parecido de nombre (umbral 0,4); si no existen, los crea. Crea o reutiliza el lote por **número de orden**. Si el lote estaba finalizado, lo reabre. | `functions/resolver-catalogo/index.ts` | Si el **formato** (p. ej. 600x1200) no está en el catálogo cerrado de 7, devuelve error 422: **no inventa formatos**. Errores de base de datos devuelven 500. |
| 7 | La app crea el **parte vacío** (piezas y minutos a 0, `completado = false`) y lo deja abierto. El operario asignado a la línea se copia al parte. | `lib/parte.ts → crearParteInicial` | Si falla este paso, el lote ya existe en el catálogo pero el parte no. Se vería error en pantalla y habría que repetir; el lote reutilizado es el mismo (por número de orden), así que no se duplica. [NO CONFIRMADO: no he probado este caso concreto]. |

Esto significa que el parte **se puede dejar a medias** y retomar después
desde la tarjeta de la línea: el parte abierto es la "memoria".

### Flujo B — Verificar la caja y cerrar el parte con la pantalla de la máquina

Continúa el flujo A, sobre el mismo parte.

| Paso | Qué pasa | Archivo | Si falla |
|---|---|---|---|
| 1 | Foto de la **caja** (cámara en vivo con guía de encuadre). `ocr-parte` la lee y la app compara marca, modelo, tono y calibre con el lote. Resultado: `correcto`, `incorrecto`, `no_verificable` o `verificado_manual`. | `FotoCajaVerificacion.tsx`, `lib/verificacion-caja.ts` | Si el OCR falla, el responsable puede confirmar a mano ("verificado_manual"). La verificación nunca bloquea la producción. |
| 2 | Al guardar la verificación, la **base de datos** (trigger) manda un aviso al grupo de Telegram de nuevos lotes. | trigger `trg_notificar_telegram_nuevo_lote` → `fn_notificar_telegram` → `notificar-telegram` | Si Telegram falla, **no se reintenta** (ver sección 6). El parte no se ve afectado. |
| 3 | Escaneo de códigos de barras de la caja y la pieza. | `EscaneoCodigosBarras.tsx`, `lib/verificacion-codbar.ts` | Puede quedar "parcial", "manual" o "no_realizada". Tampoco bloquea. |
| 4 | Foto de la **pantalla de la máquina**: `ocr-parte` extrae piezas (1ª, comercial, eco, contenedor…) y minutos (plena, no alimentada, saturación, banco, máquina). | `FotoPantallaMaquina.tsx` | Si falla el OCR, la pantalla muestra el error y un botón de reintentar la foto. No he encontrado un camino para teclear todo desde cero sin foto [NO CONFIRMADO que no exista]. Si el OCR funciona, todos los campos son editables antes de guardar. |
| 5 | **Validaciones antes de guardar** (bloqueantes): piezas entradas > 0; la suma 1ª + comercial + eco + contenedor debe estar entre el **98 % y el 102 %** de las piezas entradas; minutos total > 0; la suma de los 5 tipos de minutos debe estar a ±2 % del total. Aviso (no bloquea) si el total supera **600 minutos**. | `lib/validaciones-parte.ts` | Mensaje en pantalla; no deja guardar hasta corregir. |
| 6 | Se guarda: la app actualiza el parte con las cifras y lo marca `completado = true` con la hora. | `lib/parte.ts → completarParte` | Si falla, error en pantalla y el parte sigue abierto. |
| 7 | La base de datos hace lo suyo sola: calcula el % de calibre comercial (`trg_parte_calibre_pct`) y **si el lote ya ha producido todo su objetivo en m², lo marca como finalizado** (`trg_parte_z_cerrar_lote_completo`, solo si el objetivo está entre 100 y 50.000 m²). | baseline SQL, `fn_cerrar_lote_si_completo` | Está diseñado para que **nunca impida guardar un parte**: si falla, solo deja un aviso interno. |

**Detalle importante sobre la hora.** `completado_at` se escribe desde el
**reloj del dispositivo** (`new Date()` en `completarParte`), no desde el
servidor. La ventana de corrección de 1 hora (ver flujo C) la mide luego el
servidor con su propio reloj. Si el reloj del móvil va adelantado o atrasado,
la ventana real puede ser distinta de 1 hora. [NO CONFIRMADO si ha habido casos
reales; es una consecuencia de leer el código].

### Flujo C — Corregir un parte ya cerrado (ventana de 1 hora)

Un parte cerrado **nunca se edita**. Se crea otro nuevo que lo sustituye.

| Paso | Qué pasa | Archivo | Si falla |
|---|---|---|---|
| 1 | El responsable pulsa "corregir" sobre un parte suyo. La app solo ofrece el botón si han pasado menos de 60 minutos desde `completado_at`. | `lib/parte.ts` (`VENTANA_CORRECCION_MS`, línea 431) | Si ya pasó la hora, la pantalla no lo ofrece. |
| 2 | La app **inserta** un parte nuevo con `corrige_a_parte_id` apuntando al original. | `lib/parte.ts → corregirParte` | Error en pantalla; nada cambia. |
| 3 | La **base de datos** verifica las reglas antes de aceptarlo (esta es la barrera real, no la pantalla): el original debe estar vigente y completado; el responsable no puede cambiar; solo el dueño puede corregir; y debe estar dentro de 1 hora. El administrador se salta el límite de tiempo. | `fn_parte_validar_correccion` en el baseline SQL | Error "Ya ha pasado la ventana de 1 hora para corregir este parte" (el servidor manda). |
| 4 | Un trigger marca el original como `vigente = false`. Todos los cálculos (puntos, informes, dashboards) solo miran partes vigentes. | `trg_parte_corregir` → `fn_marcar_corregido_no_vigente` | Si no se marcara, habría **dos partes vigentes** del mismo tramo. La app lo comprueba después y avisa con un mensaje explícito (`lib/parte.ts` ~líneas 648-661). |
| 5 | Se cierra el circuito para el corregido. | — | — |

Además, hay **una segunda protección**: una política de la base de datos
permite al responsable "editar" un parte suyo completado durante 1 hora, pero un
trigger (`fn_parte_restringir_columnas_update`) le prohíbe tocar `completado`,
`completado_at` y `vigente` por esa vía. La única forma de cambiar cifras es
por corrección.

### Flujo D — Del parte al cierre de turno, informe y puntos

| Paso | Qué pasa | Archivo | Si falla |
|---|---|---|---|
| 1 | Termina el turno. El responsable puede cerrarlo a mano, o el sistema lo cierra solo **1 hora después del fin de la franja** (hora de Madrid). | cron `resumenes-turno-pendientes` → `fn_encolar_resumenes_turno_pendientes` | Si el cron no corre, el turno queda sin cerrar hasta la siguiente hora en punto. |
| 2 | Al cerrar, el cron también cierra "sin producción" cualquier parte que quedó a medias en ese turno. | misma función | — |
| 3 | El cambio de `cerrado_at` dispara un trigger que llama a `generar-resumen-turno` con una contraseña compartida. | `trg_turno_resumen_cierre` → `fn_disparar_resumen_turno` | Si la llamada falla, el cron lo reintenta cada hora mientras `resumen_enviado_at` siga vacío y hayan pasado más de 5 minutos. |
| 4 | `generar-resumen-turno` compone el informe, lo parte en mensajes de menos de 3.500 caracteres, lo envía a Telegram y marca `resumen_enviado_at`. En el turno de noche añade enlaces a los PDF de informe diario (y semanal los domingos). | `functions/generar-resumen-turno/index.ts` | Si el envío tiene éxito pero falla el marcado final, queda registrado en logs y podría reenviarse. Ya hubo un resumen duplicado el 01/10/2026 [SOLO DOCUMENTADO, `memorias/05`]. |
| 5 | **Los puntos no se guardan por parte.** Se calculan en el momento de consultar, sumando los partes vigentes (vistas SQL `v_puntos_*`). | baseline SQL; explicado en `memorias/04` | Como se recalcula siempre desde los datos, un fallo no deja puntos "descuadrados". |
| 6 | Cada lunes a las 8:00 (hora de Madrid) se **cierra el ciclo** de 28 días que acaba de terminar: se guarda una foto de los puntos de cada persona en `historial_ciclos` (operarios) e `historial_ciclo_responsable`. | cron `cerrar-ciclos-pendientes` → `fn_cerrar_ciclos_pendientes` | La función se puede repetir sin riesgo (si ya existe la fila, la actualiza). |

---

## 4. Reglas de negocio importantes y dónde viven

| Regla | Valor | Dónde vive |
|---|---|---|
| **Turnos** | M 06-14, T 14-22, N 22-06, hora de Madrid. | Cliente: `frontend/src/lib/rotacion.ts` (`FRANJAS`). Servidor: dentro de `fn_encolar_resumenes_turno_pendientes` (en SQL). **Duplicado en dos sitios.** |
| **Rotación** | Ciclo de 28 días por letra: 7 noches, 2 descanso, 7 tardes, 2 descanso, 7 mañanas, 3 descanso. Las letras A/B/C/D van desfasadas 0/7/14/21 días. Cada día hay exactamente una letra en cada turno. | Solo en SQL: `fn_turno_de_letra` y `fn_letra_de_turno`. La app la consulta (`rotacion.ts → tipoTurnoDeLetra`). **Una sola fuente.** |
| **Fecha ancla** | `2026-02-16` (un lunes). De ella cuelgan la rotación y la numeración de ciclos. No se debe "corregir" a 31/08/2026. | Tabla `configuracion`, clave `fecha_inicio_rotacion` (en `seed.sql`). `ciclo.ts` y `pantalla-carrusel.ts` tienen además `2026-02-16` escrito a mano como valor de reserva si no se puede leer. |
| **Ciclo de 28 días** | `ciclo = floor((fecha − ancla) / 28)`. Termina siempre en domingo. | SQL: `fn_ciclo_id`, `fn_ciclo_rango`. Cliente: `frontend/src/lib/ciclo.ts` (copia, solo para saber qué ciclo filtrar). |
| **Estados del turno en pantalla** | `antes` → `abierto` (desde 1 h antes) → `en_revision` (1 h tras el fin) → `cerrado`. | `rotacion.ts` (`MARGEN_ANTES_MS`, `MARGEN_REVISION_MS`). Usa el **reloj del dispositivo**. |
| **Cierre automático del turno** | 1 hora después del fin de franja. | SQL, `fn_encolar_resumenes_turno_pendientes` (cron cada hora). |
| **Ventana de corrección** | 1 hora desde `completado_at`; el admin sin límite. | Tres sitios: política `parte_update_vigente_responsable_ventana`, trigger `fn_parte_validar_correccion` (ambos en el baseline SQL) y la constante `VENTANA_CORRECCION_MS` en `parte.ts`. |
| **Parte vigente / corrección** | Un parte completado no se edita; se inserta otro con `corrige_a_parte_id`. Todo cálculo filtra `vigente = true`. | SQL (`trg_parte_corregir`) + `parte.ts`. |
| **Puntos de rendimiento (operario)** | `% = (min. plena + min. no alimentada) / max(480, min. total)` por línea y turno. 6 tramos: 1, 2, 5, 9, 12 y 15 puntos (15 a partir del 75 %). | Vistas SQL `v_rendimiento_linea_turno`, `v_puntos_rendimiento_*`; tabla `puntos_rendimiento` (datos en `seed.sql`). Valores verificados en el seed. |
| **Puntos por piezas (operario)** | Por piezas totales de la línea y turno, **por formato**; 5 tramos (2, 5, 9, 12, 15). | Tabla `puntos_piezas` (seed) + vistas `v_puntos_piezas_*`. |
| **Puntos de limpieza** | 1 punto por ítem marcado en la lista de limpieza. | Vistas `v_puntos_limpieza_*`, tabla `checklist_items`. [SOLO DOCUMENTADO el valor de 1 punto: el valor real está en el dato de `checklist_items`]. |
| **Puntos del responsable** | Metros del turno (máx. 45) + rendimiento sobre 2.880 min (máx. 45). | Tablas `puntos_metros` y `puntos_rendimiento_responsable` + vistas. |
| **Reparto de puntos** | Si una línea tuvo varios operarios en un turno, los puntos se reparten **a partes iguales** (no por minutos). | Vistas SQL `v_puntos_*_operario_*` (según `memorias/04`). |
| **Quién hizo un parte** | `parte.operario_id` es la única fuente. Se copia de la asignación al crear el parte; un trigger lo rellena después si estaba vacío, pero **nunca pisa** uno ya puesto. | Trigger `trg_asignacion_rellena_operario` (migración `20261006230657`). |
| **Tolerancias de validación** | 98-102 % de calidad, ±2 % de tiempos, aviso a >600 min. | `lib/validaciones-parte.ts`. **Solo en el cliente.** La base de datos **no** repite estas comprobaciones. [NO CONFIRMADO que exista otra barrera en SQL; no la he encontrado.] |
| **Lote** | Identidad = número de orden, no se reutiliza. `iniciado` ↔ `finalizado` es solo etiqueta. Se finaliza solo al cumplir el objetivo; se reabre solo si entra otro parte. | `resolver-catalogo`, `fn_cerrar_lote_si_completo`, `fn_reabrir_lote_si_finalizado`. |
| **m² de una pieza** | `piezas × ancho × alto / 1.000.000`, sacado del nombre del formato. | Cliente: `lib/formato.ts`. Servidor: `_shared/formato.ts`. SQL: columna `formato.area_m2`. **Tres copias.** |
| **Formatos válidos** | Catálogo cerrado de 7. | Tabla `formato` (seed). |
| **Calidad** | Dos cifras siempre juntas: con descarte `1ª/(1ª+com.+cont.)` y oficial `1ª/(1ª+com.)`. | `memorias/01`; implementada en vistas del dashboard. [SOLO DOCUMENTADO que las vistas coinciden]. |

Hay textos de las reglas que viven **duplicados a propósito** porque el
servidor (Deno) no puede importar código de la pantalla: normalización de
nombres, formato/m² y el informe de turno existen en `frontend/src/lib/` y en
`supabase/functions/_shared/`. Si se cambia uno, hay que cambiar el otro a mano.

---

## 5. Claves, permisos y roles

### Los roles (10)

Definidos en el tipo `rol_usuario` del baseline SQL (línea 92) y repartidos en
la pantalla en `frontend/src/App.tsx`:

| Rol | Qué ve / hace |
|---|---|
| `responsable` | Abre turno, asigna operarios, captura y corrige partes, cierra turno. 4 cuentas, una por letra. |
| `operario` | Mi línea, historial, limpieza, ranking, avatar. Verifica cajas. |
| `jefe` | Dashboard (vistas, incidencias, calidad, alimentación, informes, programación, Ceria, chat). |
| `produccion` | Parecido al jefe, con su propia app. |
| `calidad` | Solo lectura: últimos lotes e incidencias. |
| `administrador` | Todo, incluida la gestión de usuarios, correcciones sin límite de tiempo. |
| `pantalla` | Cuenta de la pantalla de fábrica (carrusel). |
| `jefe_rectificado` | Sección anterior (rectificado). |
| `mecanico` | Incidencias de producción, almacén, engrase. |
| `suplente` | Existe en el tipo y en algunas políticas, pero **la decisión es no usarlo** (se cubre con las credenciales del titular). Ojo: `admin-crear-usuario` **sí permite** crear usuarios con ese rol (`ROLES_ASIGNABLES`, línea 47). |

Cifras de usuarios (34 cuentas el 03/10/2026) [SOLO DOCUMENTADO].

### Dónde se decide qué puede hacer cada rol

1. **En la base de datos (la barrera real):** el baseline SQL tiene 114
   políticas de seguridad por fila (`CREATE POLICY`), todas apoyadas en la
   función `fn_rol_actual()`. Por ejemplo, la tabla `parte` tiene 7: el admin lo
   puede todo; el responsable solo puede insertar, completar su parte pendiente
   y editar la hora siguiente; el operario solo puede tocar sus propias
   columnas de verificación.
2. **En la pantalla** (`App.tsx`): decide qué app mostrar. Es comodidad, no
   seguridad.
3. **En las Edge Functions:** `admin-crear-usuario` exige que el que llama sea
   administrador y solo acepta una lista de roles; `ceria` y `nora` comprueban
   el rol contra la tabla `chat_acceso`.

### Cómo inician sesión

El usuario escribe solo su **nombre de usuario**. La app lo convierte
internamente en un correo falso `usuario@motivproduccion.local` que nunca recibe
correo (`frontend/src/lib/auth.ts`). El registro público de cuentas está
desactivado desde el 03/10/2026 [SOLO DOCUMENTADO: es un ajuste del panel de
Supabase, no está en el repositorio]. La cuenta de administrador solo se crea a
mano en SQL; un trigger impide ascender a alguien a administrador desde la app.

### Las claves y dónde están

| Clave | Es secreta | Dónde está |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | **No** (públicas por diseño) | `frontend/.env.local` (no en git); plantilla en `frontend/.env.example`. Se incrustan en la app. |
| `VITE_CLOUDINARY_*` (nombre de la nube y "presets") | No (públicas) | Igual. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` | **Sí** | Secretos de Edge Functions en Supabase. No en el repositorio. |
| `TELEGRAM_BOT_TOKEN` y los `TELEGRAM_CHAT_*` | **Sí** | Secretos de Edge Functions. |
| `TELEGRAM_WEBHOOK_SECRET` | **Sí** | Secreto de Edge Functions **y** copia en la tabla `app_secrets` de la base de datos. Las dos deben coincidir exactamente. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí, la más delicada** (salta todos los permisos) | La inyecta Supabase en cada Edge Function. |
| Clave `anon` | No | Pública, con la que cualquiera puede llamar a la API. Lo que la protege son las políticas de la base de datos. |

**`app_secrets`:** tabla que guarda la "contraseña compartida" entre la base de
datos y los ayudantes. Desde `20261007000722` tiene la seguridad por filas
activada **sin ninguna política**, es decir, nadie con la clave pública ni los
usuarios normales la puede leer. Solo la leen funciones internas del propio
sistema.

**Comprobación de secretos en git:** el `.gitignore` excluye `.env*`, `privado/`
y carpetas `.temp`. En los archivos que miré no he visto claves reales escritas.
No he hecho una búsqueda exhaustiva de secretos en todo el historial de git.
[NO CONFIRMADO]. La documentación dice que el historial se reinició el
20/08/2026 por un secreto filtrado, ya rotado.

### Qué Edge Functions exigen sesión (verificación JWT)

La documentación dice cuáles se despliegan sin verificar el JWT y cuáles con
él (`memorias/CLAUDE.md`, "Despliegue"). **Esto no se puede confirmar desde el
repositorio**: no existe `supabase/config.toml` en git y la opción se pone al
desplegar con la línea de comandos. [SOLO DOCUMENTADO]. Dentro del código, lo
que sí se ve es:
- `ocr-parte` y `resolver-catalogo` validan la sesión por dentro.
- `notificar-telegram`, `generar-resumen-turno`, `notificar-telegram-resumen-calidad` exigen la contraseña compartida en la cabecera `x-webhook-secret`.
- `generar-informe-periodo` acepta esa contraseña **o** la clave `service_role` como Bearer.

### Reglas de oro de seguridad de la base de datos

(Todas descritas en `memorias/CLAUDE.md` y `memorias/00-seguridad.md`.)

- Las **vistas** (`v_*`) se ejecutan con permisos del propietario, a propósito:
  es lo que deja que el ranking y la pantalla de fábrica lean totales sin dar
  acceso a las tablas. La única protección de una vista es a quién se le da
  `SELECT`. No se debe "arreglar" activando `security_invoker`.
- Las **tablas y vistas nuevas nacen abiertas** (por defecto de Supabase). Cada
  migración que cree una tabla debe cerrarla ella misma. Según `00-seguridad`,
  53 de 58 tablas conservan todos los privilegios para `anon`/`authenticated` y
  dependen solo de las políticas de fila [SOLO DOCUMENTADO a 03/10/2026].

---

## 6. Puntos frágiles y lo que no tiene pruebas

### Lo que más se rompería si alguien cambia algo

1. **La fecha ancla (`fecha_inicio_rotacion`).** De ella cuelgan la rotación,
   la numeración de ciclos y el cierre de ciclo. Cambiarla mal desajusta
   quién trabaja cada día y qué ciclo es. Además, la reserva `2026-02-16`
   escrita a mano en `ciclo.ts` y `pantalla-carrusel.ts` no se actualizaría
   sola. Reglas de movimiento en `memorias/01`.
2. **Reglas duplicadas en varios sitios.** Tres: las franjas de turno (cliente
   `rotacion.ts` y SQL del cron), la ventana de 1 hora (política SQL, trigger
   SQL y constante del cliente) y el cálculo de m² (cliente, Deno y columna
   SQL). Cambiar una y olvidar las otras produce comportamientos distintos
   según dónde se mire.
3. **La contraseña compartida `telegram_webhook_secret`.** Si el valor en
   `app_secrets` y el secreto de las Edge Functions no coinciden byte a byte,
   **todos los avisos y resúmenes dejan de salir sin ningún error visible para
   los usuarios** (las funciones responden 401).
4. **URLs del proyecto escritas dentro de funciones SQL.** `fn_notificar_telegram`,
   `fn_disparar_informe_periodo` y similares tienen la dirección
   `https://boyphawxerstehngbhfe.supabase.co/functions/v1/...` escrita a mano. Si
   algún día se monta otro entorno (pruebas, otro proyecto), esas funciones
   seguirán llamando al proyecto original.
5. **Los triggers de `parte`.** Hay 8 triggers en esa tabla (calibre, corrección,
   reabrir lote, cerrar lote, columnas restringidas, formato, validar
   corrección, aviso de Telegram) y otro en `asignacion_operario_linea` que rellena `operario_id`. El orden y la interacción importan:
   el nombre `trg_parte_z_cerrar_lote_completo` lleva una `z` a propósito para
   ejecutarse el último. [Deducido del nombre; la documentación no lo explica].
6. **El orden de los cambios de seguridad.** El propio `20261007000722`
   advierte que quitar un permiso sin antes pasar el trigger a `security
   definer` haría que **cerrar un turno fallara con "permission denied"**.
7. **La política "UPDATE que no da error".** Supabase no avisa cuando una
   actualización no cambia ninguna fila por culpa de la seguridad. Si el código
   no comprueba cuántas filas cambió, un guardado puede parecer correcto sin serlo
   (advertido en `memorias/CLAUDE.md`).
8. **Las tablas y vistas nuevas nacen abiertas.** Olvidar el cierre de
   permisos en una migración nueva expone datos a la clave pública.
9. **`TurnoScreen.tsx`** (785 líneas, ~20 estados) es la pantalla principal del
   responsable y la documentación la llama "monolítica". Tocarla es delicado.

### Fallos silenciosos que he visto en el código

- **`notificar-telegram` no comprueba la respuesta de Telegram**
  (`supabase/functions/notificar-telegram/index.ts`, función `enviarTelegram`:
  hace `fetch` y no mira si fue bien). Si Telegram rechaza el mensaje, la
  función responde "OK" igualmente, y **no hay reintento** para incidencias ni
  lotes nuevos (solo existe reintento para resumen de turno, informes y resumen
  de calidad).
- **El aviso de Telegram sale de un trigger de base de datos con
  `net.http_post`**, que es "dispara y olvida": si la llamada se pierde, nada
  lo recuerda. [Comportamiento general de `pg_net`; no lo he probado].
- **`notificar-telegram` sigue leyendo `asignacion_operario_linea`** para
  decir qué operario trabajaba (función `buscarOperario`), mientras la regla
  oficial dice que la fuente única es `parte.operario_id`. En el mensaje de
  Telegram puede salir un operario distinto o "—" si se reasignó la línea.
  [Deducido del código; no lo he visto en un mensaje real].
- **Las validaciones del parte (98-102 %, ±2 %) solo están en la pantalla.**
  Un cliente manipulado podría guardar cifras incoherentes. [NO CONFIRMADO que
  no haya otra barrera en SQL; no la he encontrado.]
- **La política de inserción de `parte`** (`parte_insert_responsable`) solo
  comprueba el rol, no que `responsable_id` sea quien inserta. No he verificado
  si hay otra barrera que lo impida. [NO CONFIRMADO]. Se usa a propósito para que
  el admin cree partes a nombre del titular.
- **Los relojes del móvil importan** en el estado del turno que ve el usuario
  y en `completado_at` (ver flujo B).

### Lo que no tiene pruebas automáticas

Hay **3 archivos de pruebas** en `frontend/tests/` (≈217 líneas), que usan la
herramienta de pruebas incorporada de Node (`node --test frontend/tests/`),
**no están enlazados en `package.json`** (no hay `npm test`) y no he podido
ejecutarlos para este documento:

| Prueba | Qué cubre |
|---|---|
| `lote-logica.test.ts` | Textos y porcentajes de la pantalla de gestión de lotes. |
| `cruce-orden.test.ts` | Cruce del número de orden con la programación. |
| `validar-orden.test.ts` | Formato del número de orden. |

Esto significa que **no tiene ninguna prueba automática**:

- El cálculo de **turnos y rotación** (`rotacion.ts`, `fn_turno_de_letra`).
- La **ventana de corrección** de 1 hora (política SQL, trigger, cliente).
- Las **validaciones del parte** (`validaciones-parte.ts`).
- Los **puntos, ciclos y cierre de ciclo** (todas las vistas `v_puntos_*` y
  `fn_cerrar_ciclos_pendientes`).
- **Ninguna Edge Function**: OCR, `resolver-catalogo`, Telegram, informes.
- **Ninguna política de seguridad** (RLS) ni trigger de la base de datos. La
  documentación dice que se probaron a mano en transacciones revertidas
  [SOLO DOCUMENTADO], pero no queda ningún script de pruebas en el repositorio.
- Las pantallas (no hay pruebas de interfaz).
- La compatibilidad entre local y producción (hay scripts de comparación en
  `supabase/scripts/`, pero se ejecutan a mano).

`memorias/CLAUDE.md` dice "Sin framework de tests"; es cierto en cuanto a
framework, pero las 3 pruebas existen.

### Otras fragilidades de organización

- **Documentación con partes desactualizadas.** Ya vimos el caso del OCR en
  `05`; las memorias también mencionan el panel de administrador con 21
  pestañas y otras cifras que cambian. Ante la duda, manda el código.
- **`.env.example` incompleto.** El código usa además `VITE_CLOUDINARY_PRESET_PERSONAJES`,
  `_CHAT` y `_ALMACEN_REPUESTOS`, que no aparecen en la plantilla; y la plantilla
  menciona `_INFORMES_TURNO`, que el código del frontend no usa (sí lo usa una
  Edge Function con otro nombre). Quien monte el proyecto de cero se
  encontrará con subidas de fotos que fallan.
- **Sin modo sin conexión.** Decisión cerrada: si no hay red, no hay datos.
- **Copias de seguridad.** Las de la base de datos que he visto están en
  `privado/backups/` (solo en el ordenador, fuera de git). No he encontrado
  ningún proceso automático de copias; el de Supabase depende del plan
  contratado. [NO CONFIRMADO].
- **Realtime a medias.** La pantalla de fábrica no se refresca sola: la
  documentación indica que el componente que lo haría no existe
  (`memorias/CLAUDE.md`).

---

## Apéndice: por dónde empezar a leer

1. `memorias/CLAUDE.md` — el resumen de todo (pero compruébalo con el código).
2. `frontend/src/App.tsx` — cómo se reparte cada rol.
3. `frontend/src/components/captura-parte/CapturaParteScreen.tsx` — el asistente de partes.
4. `supabase/functions/ocr-parte/index.ts` — la lectura de fotos.
5. `supabase/migrations/20261006204519_baseline.sql` — toda la base de datos
   (busca por `fn_` para reglas, `CREATE POLICY` para permisos, `CREATE TRIGGER`
   para automatismos).
6. `memorias/04-gamificacion.md` — puntos y ciclos.
7. `memorias/07-pendientes.md` — lo que el equipo sabe que está abierto.
