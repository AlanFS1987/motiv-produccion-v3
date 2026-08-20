# motiv-produccion-v3 — estado actual

Este archivo lo lee Claude Code al abrir la carpeta. Describe **qué es
y qué hace la app hoy**, no cómo se llegó a ello. Detalle por área en
los archivos `0X-*.md` de esta misma carpeta (índice en `README.md`).

## Qué es

App interna para la sección de clasificación de una fábrica de baldosas
cerámicas. Estandariza los **partes de producción** (un parte = un tramo
de producción de un lote en una línea durante un turno) capturándolos
por **OCR de fotos** (hoja de partida, caja impresa, pantalla de la
máquina) en vez de a mano. Sobre esos partes: verificación de que la
caja impresa corresponde al lote, incidencias de calidad/producción,
informe automático de cierre de turno por Telegram, y una capa de
gamificación (puntos, niveles, ranking) para operarios y responsables.

No tiene acceso a PLCs ni a ningún sistema en tiempo real: todo dato
nace de una foto o de un formulario. No hay modo offline (decisión
cerrada: el OCR necesita red igualmente y la fábrica tiene wifi).

Usuarios: 27 reales cargados (6 responsables, 17 operarios, jefe, admin, suplente, pantalla), máximo 30. Roles: `responsable`,
`suplente`, `operario`, `jefe`, `produccion`, `calidad`,
`administrador`, `pantalla`, `jefe_rectificado`.

## Stack

- **Backend**: Supabase — Postgres + Auth + Edge Functions (Deno/TS) +
  `pg_cron` + `pg_net`. Proyecto `boyphawxerstehngbhfe`.
- **OCR**: GPT (`gpt-4o-mini`, en prueba de coste/calidad) como
  extractor principal, con fallback automático a Anthropic Haiku
  (`claude-haiku-4-5-20251001`) si falla — constantes `MODEL` en
  `supabase/functions/_shared/openai.ts` y `_shared/anthropic.ts`
  respectivamente. Ambas llamadas (y la validación de sesión) tienen
  timeout para evitar cuelgues.
- **Imágenes**: Cloudinary, cloud `dugiquak1`, 4 presets unsigned con
  carpeta fija cada uno (partes / incidencias-calidad /
  incidencias-produccion / limpieza).
- **Notificaciones**: un bot de Telegram, 5 grupos.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 +
  lucide-react + @zxing (códigos de barras). Sin framework de tests.
- **Ceria** (asistente del jefe): diseñado sobre DeepSeek, sin construir.

## Qué está construido (resumen de un vistazo)

| Área | Estado |
|---|---|
| Login por username (email sintético `{username}@motivproduccion.local`) | Construido |
| Rotación de turnos calculada (28 días, 4 letras) + franja horaria + estado del turno | Construido |
| Responsable: abrir turno, asignar operarios a línea, operarios de refuerzo | Construido |
| Responsable: captura de parte por OCR, 3 caminos, 6 pasos (ver `02-responsable.md`) | Construido, probado con datos reales |
| Verificación de caja (OCR) y de códigos de barras (escáner) | Construido |
| Incidencias de calidad (dentro del parte) y de producción (línea / turno) | Construido |
| Corrección de parte por doble entrada, ventana 1 h del responsable | Construido |
| Cierre manual de turno + informe (pestaña Resumen, botón Copiar) | Construido |
| Cierre automático de turno (cron) + envío del informe a Telegram | Construido; el camino automático **no** se ha visto ocurrir en real todavía |
| Gestión de lotes (lista, Finalizar/Reabrir) | Construido |
| Telegram: incidencias calidad, incidencias producción, nuevos lotes, resumen de turno, resumen calidad | Construido |
| Operario: Inicio, Mi línea (verificación propia), Historial, Limpieza | Construido |
| Gamificación: tablas de tramos, vistas de puntos de rendimiento del ciclo actual, con reparto igualitario entre operarios de una línea+turno | Construido y probado en real (20/08/2026) — falta corregir `crearParteInicial` que no rellenaba `operario_id` (ya corregido), **sin pantalla** y sin piezas/limpieza en el total |
| Cierre de ciclo (`historial_ciclos`), ranking, niveles, personaje RPG, logros | Diseñado, **no construido** |
| Dashboard del jefe, roles producción/calidad, pantalla, jefe_rectificado | Diseñado (pantalla y jefe) / solo enum (los otros), **no construido** |
| Panel de administrador (fusión catálogo, corrección sin límite, cierre fábrica, alta de usuarios) | **No construido** — hoy todo es SQL a mano |
| Ceria, base de conocimiento de averías | No construido |

Fecha de arranque de rotación y ciclos: **31/08/2026** (lunes,
`configuracion.fecha_inicio_rotacion`). Si el arranque se mueve, hay
que cambiar ese valor antes del primer turno y sigue teniendo que ser
lunes.

## Convenciones que hay que respetar

- **Migraciones**: `supabase/migrations/AAAAMMDDHHMMSS_nombre.sql`. No
  se edita una migración ya aplicada: se añade otra. Todo el SQL debe
  ser idempotente (`if not exists`, `create or replace`).
- **Despliegue**: `supabase db push` (migraciones) y
  `supabase functions deploy <nombre>` (funciones), siempre desde la
  raíz del repo. Las funciones que llama la BD vía `pg_net`
  (`notificar-telegram`, `generar-resumen-turno`,
  `notificar-telegram-resumen-calidad`) se despliegan con
  `--no-verify-jwt`; las que llama el navegador (`ocr-parte`,
  `resolver-catalogo`) no.
- **RLS**: helper `fn_rol_actual()`. Las políticas son permisivas y se
  suman con OR: para dar un permiso nuevo se crea una política nueva,
  nunca se amplía una existente. PostgREST **no da error** cuando un
  UPDATE no afecta filas por RLS: al escribir, comprobar filas
  afectadas, no solo `error`.
- **Secretos**: nunca en migraciones ni en el repo. Secreto compartido
  BD↔Edge Functions en tabla `app_secrets` (sin acceso para
  anon/authenticated) y en los secrets de Edge Functions; deben
  coincidir byte a byte.
- **Fotos**: recorte a proporción fija en cliente (`captura-imagen.ts`)
  → WebP → Cloudinary (unsigned) → se pasa la URL a `ocr-parte`.
  Nombre `{prefijo_}{identificador}_{timestamp}`. El operario nunca
  tiene selector de galería; el responsable sí (cámara o galería).
- **Horas**: las franjas de turno son hora de Madrid. El cliente usa
  el reloj del dispositivo; los crons disparan en UTC cada hora en
  punto y deciden dentro con `at time zone 'Europe/Madrid'`.
- **Texto duplicado a propósito**: `normalizacion`, `formato` y el
  informe de turno existen en frontend y en `_shared/` de Deno porque
  Deno no importa del frontend. Si se cambia uno, cambiar el otro.
- **Probar en real**: cada cambio en SQL/funciones/fechas se prueba
  con datos reales o Postgres local antes de darlo por bueno.

## Mapa de archivos

```
frontend/src/
  App.tsx                      shell del responsable (Turno/Resumen/Lotes); bifurca a OperarioApp
  context/AuthContext.tsx      sesión + perfil `usuario`
  lib/
    rotacion.ts                rotación, franjas, estado del turno, próximo cambio
    turno.ts                   abrir turno, asignaciones, refuerzo, cerrar turno
    parte.ts                   crear/completar/corregir partes, sugerencias, lotes del turno anterior
    lote.ts                    gestión de lotes
    operario.ts                Mi línea, limpieza, verificación del operario
    incidencias.ts
    resumen-turno.ts           informe de cierre (versión cliente)
    validaciones-parte.ts      reglas de coherencia piezas/tiempos
    normalizacion.ts           tono (prefijo de fábrica, O/0), calibre, texto
    verificacion-caja.ts / verificacion-codbar.ts
    captura-imagen.ts / cloudinary.ts / formato.ts
    supabase-client.ts / supabase-functions.ts / auth.ts
  components/
    TurnoScreen.tsx            pantalla principal del responsable (monolítica, ~20 useState)
    ResumenScreen.tsx, GestionLotes.tsx, OperariosRefuerzoCard.tsx
    captura-parte/             wizard: hoja, tono, continuar, caja, codbar, pantalla, aviso
    incidencias/
    operario/                  OperarioApp, Inicio, MiLinea, Historial, Limpieza, Verificacion*
supabase/
  migrations/                  ~30 archivos, 20260101000001 … 20260819140000
  functions/
    _shared/                   anthropic.ts, cors.ts, normalizacion.ts, formato.ts
    ocr-parte/                 fotos → JSON (prompts.ts)
    resolver-catalogo/         modelo/marca/producto/lote (service_role)
    notificar-telegram/        incidencias + nuevo lote
    generar-resumen-turno/     informe de cierre → Telegram
    notificar-telegram-resumen-calidad/
memorias/                      esta carpeta
```

## Cómo se crean usuarios hoy

Dashboard → Authentication → Add user (email sintético) → INSERT en
`usuario` con el mismo UUID, `username`, `rol`, `letra`. No hay
pantalla para ello.

## Lo que hay que saber antes de tocar algo

- **Operario del parte — fuente única (decidido e implementado,
  sesión 19/08/2026)**: `asignacion_operario_linea` (turno, línea,
  operario, editable por el responsable durante el turno) **ya no se
  consulta** ni para "Mi línea" ni para los puntos — solo sirve como
  semilla: cuando se crea un parte, se copia el operario vigente en
  ese momento a `parte.operario_id`. A partir de ahí, `parte.operario_id`
  es la única fuente: la RLS y el listado de "Mi línea"
  (`lib/operario.ts`) la usan para decidir qué líneas/partes ve y
  puede verificar cada operario, y los puntos (`operario_ledger` y las
  vistas de rendimiento, migración
  `20260819150000_operario_id_fuente_unica.sql`) la usan para saber a
  quién atribuir cada parte. Si el responsable reasigna la línea a
  mitad de turno, los partes ya creados **no cambian de dueño** —
  siguen con el `operario_id` que tenían. Los puntos de una
  línea+turno se reparten a **partes iguales** entre los `operario_id`
  distintos que tengan algún parte en esa línea+turno (normalmente uno
  solo; excepcional que haya más). Se descartó ponderar por
  minutos/tiempo trabajado: la reasignación a mitad de turno es poco
  frecuente y nunca tan desigual como para justificar prorratear
  contra el suelo de 480 min de rendimiento.
  **[CERRADO 20/08/2026]**: migración desplegada y probada en real —
  reparto igualitario confirmado entre 2 operarios en la misma
  línea+turno. Se encontró y corrigió un bug aparte:
  `crearParteInicial` (lib/parte.ts) no copiaba el operario a
  `parte.operario_id`, quedaba siempre null.
- Las políticas de UPDATE en `parte` para responsables exigen
  `responsable_id = auth.uid()`: un suplente no puede completar un
  parte abierto por el titular (ni al revés). Ver `07-pendientes.md`.
- El enum `rol_usuario` tiene `pantalla` y `jefe_rectificado` en la BD
  real (confirmado) sin migración que los cree: falta la migración.
- Las 2 filas de `usuario` sin letra son `suplente` (sin letra por
  diseño, exenta del candado de rotación) y `test` (cuenta de
  pruebas) — no hay ningún responsable real bloqueado. Queda
  pendiente decidir el rol de `test` para que no aparezca mezclada en
  listados que filtren por `rol = 'responsable'`; se borra a mano
  desde Supabase cuando ya no haga falta.
- Pendientes ordenados en `07-pendientes.md`.