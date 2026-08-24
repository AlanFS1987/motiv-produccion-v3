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
gamificación (puntos, niveles, ranking, personaje RPG) para operarios
y responsables.

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
- **Generación de imagen (personaje RPG)**: GPT Image 2 (`gpt-image-2`),
  vía `images/edits` con imagen de referencia — proveedor distinto del
  usado para el OCR. Constante `MODEL` en
  `supabase/functions/_shared/openai_images.ts`. Ver `04-gamificacion.md`.
- **Imágenes**: Cloudinary, cloud `dugiquak1`, 5 presets unsigned con
  carpeta fija cada uno (partes / incidencias-calidad /
  incidencias-produccion / limpieza / **personajes**, este último
  usado tanto desde el navegador como desde una Edge Function).
- **Notificaciones**: un bot de Telegram, 5 grupos.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 +
  lucide-react + @zxing (códigos de barras). Sin framework de tests.
- **Ceria** (asistente del jefe/admin): construido sobre GPT-5-mini
  (ver `11-ceria.md`).

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
| Operario: Inicio (con gamificación completa), Mi línea (verificación propia), Historial, Limpieza | Construido |
| Gamificación: puntos completos (rendimiento+piezas+limpieza, operario y responsable), niveles, cierre de ciclo, fuerza/resistencia/velocidad, logros (100% por consulta, sin datos sembrados todavía), personaje RPG (GPT Image 2) | **Construido y probado en real (22/08/2026)** — falta pantalla de Inicio del responsable, Ranking/Stats/Logros como pestañas, y logros del responsable (fase 2). Ver `04-gamificacion.md`. |
| Dashboard del jefe (Vista Rápida, Detallada, Incidencias) | **Construido** (ver `08-dashboard-jefe.md`) |
| Panel de administrador (Rotación + rol, corrección sin límite, cierre fábrica, checklist, recalcular ciclo) | **Construido** (ver `09-administrador.md`); solo falta fusión de catálogo, pendiente de Edge Function con `service_role` |
| Pantalla de fábrica (carrusel, rol `pantalla`) | **Construido** (ver `10-pantalla.md`); 2 de 5 diapositivas en placeholder (ya no bloqueadas por falta de mecánica de gamificación, solo falta la diapositiva en sí) |
| Ceria | **Construido** sobre GPT-5-mini (ver `11-ceria.md`) |
| Sistema de temas (5 temas) | **Construido** (arquitectura + marco de todos los shells); contenido interior de la mayoría de pantallas sin migrar (ver `12-temas.md`) |
| Base de conocimiento de averías | No construido |

Fecha ancla de rotación y ciclos: `configuracion.fecha_inicio_rotacion`
= **2026-02-16** (lunes) desde la renumeración de ciclos del
23/08/2026 — NO es la fecha de lanzamiento. El lanzamiento de v3 sigue
siendo el **31/08/2026**, que es exactamente donde empieza el ciclo 7
(16/02 + 7×28 días). Primer cierre de ciclo real: **28/09/2026**
(cierre del ciclo 7).

⚠️ NO "corregir" este valor a 31/08/2026 aunque parezca desactualizado:
la renumeración fue deliberada (alinear la numeración con los ciclos
migrados de v2 sin cycle_id negativos — ver `04-gamificacion.md`,
"Renumeración de ciclos", y `01-dominio.md`). Esta fecha decide A LA
VEZ el patrón de rotación de turnos y la numeración de ciclos: si
alguna vez hay que moverla, tiene que seguir siendo lunes, moverse en
múltiplos de 28 días para no romper la rotación, y repetirse después
el ajuste manual de letras del admin (`AjustarLetrasScreen`).

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
  `resolver-catalogo`, `generar-personaje`) no.
- **RLS**: helper `fn_rol_actual()`. Las políticas son permisivas y se
  suman con OR: para dar un permiso nuevo se crea una política nueva,
  nunca se amplía una existente. PostgREST **no da error** cuando un
  UPDATE no afecta filas por RLS: al escribir, comprobar filas
  afectadas, no solo `error`.
- **Secretos**: nunca en migraciones ni en el repo. Secreto compartido
  BD↔Edge Functions en tabla `app_secrets` (sin acceso para
  anon/authenticated) y en los secrets de Edge Functions; deben
  coincidir byte a byte.
  - **Historial de git**: reiniciado el 20/08/2026 (un secreto de
  Telegram, ya rotado, había quedado en un commit antiguo de un repo
  que salió de la máquina local). Si necesitas algo de antes de esa
  fecha, no está — se documentó lo relevante en estos `.md` antes de
  reiniciar.
- **Fotos**: recorte a proporción fija en cliente (`captura-imagen.ts`)
  → WebP → Cloudinary (unsigned) → se pasa la URL a `ocr-parte` (o a
  `generar-personaje`, en el caso de la imagen de referencia del
  personaje — sin recorte forzado ahí, solo `procesarFotoLibre`).
  Nombre `{prefijo_}{identificador}_{timestamp}`. El operario nunca
  tiene selector de galería en la captura de parte; el responsable sí
  (cámara o galería). La imagen de referencia del personaje es la
  única excepción: ahí el operario SÍ elige de su galería a propósito
  (ver `04-gamificacion.md`).
- **Horas**: las franjas de turno son hora de Madrid. El cliente usa
  el reloj del dispositivo; los crons disparan en UTC cada hora en
  punto y deciden dentro con `at time zone 'Europe/Madrid'`. El cron
  de cierre de ciclo además restringe el propio cron a los lunes
  (`0 * * * 1`), no solo la condición interna — ver `05-automatismos.md`.
- **Texto duplicado a propósito**: `normalizacion`, `formato` y el
  informe de turno existen en frontend y en `_shared/` de Deno porque
  Deno no importa del frontend. Si se cambia uno, cambiar el otro.
- **Probar en real**: cada cambio en SQL/funciones/fechas se prueba
  con datos reales o Postgres local antes de darlo por bueno.

- **Vistas y RLS**: todas las vistas del proyecto corren con permisos
  del owner (comportamiento por defecto de Postgres) — es lo que
  permite que Ranking, Reyes del formato y la pantalla de fábrica
  lean datos agregados de tablas cuya RLS no cubre a esos roles.
  NUNCA poner `security_invoker = on` a una vista existente "por
  buenas prácticas": romperías pantalla, ranking y logros a la vez.

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
    gamificacion.ts            puntos/nivel/personaje — genérico operario+responsable (nuevo 22/08/2026)
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
    operario/                  OperarioApp, Inicio (con gamificación), MiLinea, Historial, Limpieza, Verificacion*
supabase/
  migrations/                  ~35 archivos, 20260101000001 … 20260822190000
  functions/
    _shared/                   anthropic.ts, openai.ts, openai_images.ts, cors.ts, cloudinary.ts, normalizacion.ts, formato.ts
    ocr-parte/                 fotos → JSON (prompts.ts)
    resolver-catalogo/         modelo/marca/producto/lote (service_role)
    generar-personaje/         imagen de referencia + prompt → personaje RPG (GPT Image 2, service_role)
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
  **[AMPLIADO 22/08/2026]**: este reparto igualitario es solo para
  PUNTOS. Las cantidades en bruto que alimentan los logros de tramo
  (m², piezas, tiempos) se atribuyen SIN repartir, directamente por
  `parte.operario_id` — ver `04-gamificacion.md`, sección "Principios".
- Las políticas de UPDATE en `parte` para responsables exigen
  `responsable_id = auth.uid()`: un suplente no puede completar un
  parte abierto por el titular (ni al revés). Ver `07-pendientes.md`.
- Las 2 filas de `usuario` sin letra son `suplente` (sin letra por
  diseño, exenta del candado de rotación) y `test` (cuenta de
  pruebas) — no hay ningún responsable real bloqueado. Queda
  pendiente decidir el rol de `test` para que no aparezca mezclada en
  listados que filtren por `rol = 'responsable'`; se borra a mano
  desde Supabase cuando ya no haga falta.
- **`operario_logro` fue eliminada (22/08/2026)** — si ves referencias
  a ella en migraciones antiguas o documentación de sesiones
  anteriores, están desactualizadas. Ver `04-gamificacion.md` y
  `06-esquema-bd.md`.
- Pendientes ordenados en `07-pendientes.md`.
