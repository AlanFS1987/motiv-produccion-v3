# motiv-produccion-v3 — estado actual

Este archivo lo lee Claude Code al abrir la carpeta. Describe **qué es
y qué hace la app hoy**, no cómo se llegó a ello. Detalle por área en
los archivos `0X-*.md` de esta misma carpeta (índice en `README.md`).
Cada tema se explica en UN solo archivo; los demás solo remiten a él.

## Qué es

App interna para la sección de clasificación de una fábrica de baldosas
cerámicas. Estandariza los **partes de producción** (un parte = un tramo
de producción de un lote en una línea durante un turno) capturándolos
por **OCR de fotos** (hoja de partida, caja impresa, pantalla de la
máquina) en vez de a mano. Sobre esos partes: verificación de que la
caja impresa corresponde al lote, incidencias de calidad/producción,
informe automático de cierre de turno por Telegram, dashboard del jefe,
asistente Ceria, pantalla de fábrica y una capa de gamificación
(puntos, niveles, ranking, logros, personaje RPG).

No tiene acceso a PLCs ni a ningún sistema en tiempo real: todo dato
nace de una foto o de un formulario. No hay modo offline (decisión
cerrada: el OCR necesita red igualmente y la fábrica tiene wifi).

Usuarios: **24 reales cargados** (4 responsables A/B/C/D, 17 operarios
4/5/4/4, jefe, administrador, pantalla), máximo 30. No hay ni habrá
cuenta `suplente`: decisión cerrada (sesión 25/08/2026) de no usar una
cuenta compartida para cubrir turnos — se cubre siempre con las
credenciales del titular (`01`). El rol se queda en el enum, sin uso.
Roles del enum: `responsable`,
`suplente`, `operario`, `jefe`, `produccion`, `calidad`,
`administrador`, `pantalla`, `jefe_rectificado`. Solo responsables y
operarios llevan letra de rotación; el resto no. `jefe_rectificado` es
la sección de rectificado (anterior a clasificación, no una variante
de `jefe`) — shell propio, ver `13-rectificado.md`. `calidad` tiene
shell propio de solo lectura (últimos 15 lotes + incidencias), ver
`14-calidad.md`. `produccion` sigue sin shell — solo tiene permisos
RLS de lectura sobre `incidencia_produccion`, sin pantalla que los use.

## Stack

- **Backend**: Supabase — Postgres + Auth + Edge Functions (Deno/TS) +
  `pg_cron` + `pg_net`. Proyecto `boyphawxerstehngbhfe`.
- **OCR**: GPT (`gpt-4o-mini`) como extractor principal, con fallback
  automático a Anthropic Haiku (`claude-haiku-4-5-20251001`) si falla —
  constantes `MODEL` en `supabase/functions/_shared/openai.ts` y
  `_shared/anthropic.ts`. Ambas llamadas (y la validación de sesión)
  tienen timeout. Cuál queda en firme: decisión abierta (`07`).
- **Generación de imagen (personaje RPG)**: GPT Image 2 (`gpt-image-2`)
  vía `images/edits`; historia del personaje con DeepSeek. Ver `04`.
- **Imágenes**: Cloudinary, cloud `dugiquak1`, 5 presets unsigned con
  carpeta fija cada uno. Ver `05`.
- **Notificaciones**: un bot de Telegram, 5 grupos. Ver `05`.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 +
  lucide-react + @zxing (códigos de barras). Sin framework de tests.
- **Ceria** (asistente del jefe/admin): GPT-5-mini. Ver `11`.

## Qué está construido (resumen de un vistazo)

| Área | Estado |
|---|---|
| Login por username (email sintético `{username}@motivproduccion.local`) | Construido |
| Rotación de turnos calculada (28 días, 4 letras) + franja horaria + estado del turno | Construido |
| Responsable: abrir turno, asignar operarios a línea, operarios de refuerzo | Construido |
| Responsable: captura de parte por OCR, 3 caminos, 6 pasos (`02`) | Construido, probado con datos reales |
| Verificación de caja (OCR) y de códigos de barras (escáner) | Construido |
| Incidencias de calidad (dentro del parte) y de producción (línea / turno) | Construido |
| Corrección de parte por doble entrada, ventana 1 h del responsable; admin sin límite | Construido |
| Cierre manual de turno + informe (pestaña Resumen, botón Copiar) | Construido |
| Cierre automático de turno (cron) + envío del informe a Telegram | Construido; el camino automático **no** se ha visto en real |
| Gestión de lotes (lista, Finalizar/Reabrir) | Construido |
| Telegram: incidencias calidad, incidencias producción, nuevos lotes, resumen de turno, resumen calidad | Construido |
| Operario: Inicio (Inicio / Ranking / Stats+Avatar / Logros), Mi línea, Historial, Limpieza | Construido y probado en real |
| Gamificación operario: puntos (rendimiento+piezas+limpieza), niveles, cierre de ciclo, stats, 19 logros sembrados, personaje RPG, datos de v2 migrados | **Construido** (`04`) |
| Gamificación responsable: puntos (metros+rendimiento), niveles, cierre de ciclo (tabla propia `historial_ciclo_responsable`), pestaña "Progreso" (Ranking, Ranking resp., Stats, Equipo, Logros), 18 logros propios, historial de partes propio | **Construido** (`04`) |
| Dashboard del jefe (Vista Rápida, Detallada, Incidencias) | Construido (`08`) |
| Panel de administrador | Construido (`09`); faltan fusión de catálogo, vista de usuarios con bonus de nivel y botón "recalcular ciclo" |
| Pantalla de fábrica (carrusel, rol `pantalla`) | Construido parcialmente: 3 de 5 diapositivas reales (`10`) |
| Ceria | Construido (`11`) |
| Sistema de temas (5 temas) | Construido en arquitectura y marcos; interior de la mayoría de pantallas sin migrar (`12`) |
| App de `jefe_rectificado` (Vista Rápida, Detallada) | Construido (`13`), sin verificar con datos reales |
| App de `calidad` (últimos 15 lotes, incidencias, tonos) | Construido (`14`), sin verificar con datos reales |
| Base de conocimiento de averías | No construido |

## Fechas clave

- `configuracion.fecha_inicio_rotacion` = **2026-02-16** (lunes). Es
  el ancla A LA VEZ de la rotación de turnos y de la numeración de
  ciclos. ⚠️ NO "corregirla" a 31/08/2026: se movió a propósito al
  migrar los datos de v2. Detalle y reglas para moverla en `01`
  (sección "Turno y rotación").
- Lanzamiento de v3: **31/08/2026** = inicio del ciclo 7.
- Primer cierre real de ciclo: **28/09/2026** (cierre del ciclo 7).

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
  `resolver-catalogo`, `generar-personaje`, `ceria`) no.
- **RLS**: helper `fn_rol_actual()`. Las políticas son permisivas y se
  suman con OR: para dar un permiso nuevo se crea una política nueva,
  nunca se amplía una existente. PostgREST **no da error** cuando un
  UPDATE no afecta filas por RLS: al escribir, comprobar filas
  afectadas, no solo `error`.
- **RPCs `security definer`**: el patrón de seguridad depende de quién
  llama (cliente directo → `auth.uid()`; Edge Function con
  `service_role` → parámetro `p_usuario_id` + ejecución restringida a
  `service_role`). Detalle en `06`, sección "Funciones".
- **Vistas y RLS**: todas las vistas corren con permisos del owner
  (por defecto en Postgres) — es lo que permite que Ranking, Reyes del
  formato y la pantalla de fábrica lean agregados de tablas cuya RLS
  no cubre a esos roles. NUNCA poner `security_invoker = on` a una
  vista existente "por buenas prácticas".
- **Secretos**: nunca en migraciones ni en el repo. Secreto compartido
  BD↔Edge Functions en tabla `app_secrets` (sin acceso para
  anon/authenticated) y en los secrets de Edge Functions; deben
  coincidir byte a byte. Historial de git reiniciado el 20/08/2026 por
  un secreto filtrado (ya rotado); nada anterior a esa fecha existe.
- **Fotos**: recorte a proporción fija en cliente (`captura-imagen.ts`)
  → WebP → Cloudinary (unsigned) → URL a `ocr-parte`. Nombre
  `{prefijo_}{identificador}_{timestamp}`. El operario nunca tiene
  selector de galería en la captura de parte; el responsable sí. La
  imagen de referencia del personaje es la única excepción: el
  operario elige de su galería a propósito, sin recorte forzado
  (`procesarFotoLibre`).
- **Horas**: franjas de turno en hora de Madrid. El cliente usa el
  reloj del dispositivo; los crons disparan en UTC cada hora en punto
  y deciden dentro con `at time zone 'Europe/Madrid'` (`05`).
- **Texto duplicado a propósito**: `normalizacion`, `formato` y el
  informe de turno existen en frontend y en `_shared/` de Deno porque
  Deno no importa del frontend. Si se cambia uno, cambiar el otro.
- **Probar en real**: cada cambio en SQL/funciones/fechas se prueba
  con datos reales o Postgres local antes de darlo por bueno.

## Mapa de archivos

```
frontend/src/
  App.tsx                      shell del responsable (Turno/Resumen/Lotes/Historial +
                               botón flotante Progreso); bifurca por rol a
                               OperarioApp / JefeApp / AdminApp / PantallaCarrusel; RolSinInterfaz para el resto
  main.tsx                     <AuthProvider> + <ThemeProvider>
  context/AuthContext.tsx      sesión + perfil `usuario`
  context/ThemeContext.tsx     temas (12)
  lib/
    rotacion.ts                rotación, franjas, estado del turno, próximo cambio
    turno.ts                   abrir turno, asignaciones, refuerzo, cerrar turno
    parte.ts                   crear/completar/corregir partes, sugerencias, lotes del turno anterior
    lote.ts                    gestión de lotes
    operario.ts                Mi línea, limpieza, verificación del operario
    gamificacion.ts            tipos NivelInfo/PersonajeInfo (reducido 25/08/2026)
    inicio-gamificacion.ts     tarjeta resumen de Inicio del operario
    equipo.ts                  pestaña Equipo del responsable (04)
    ranking.ts / logros.ts / stats-avatar.ts   soportan rol operario+responsable
    dashboard-jefe.ts / dashboard-detallada.ts / dashboard-incidencias.ts
    admin-usuarios.ts / admin-partes.ts / admin-cierre-fabrica.ts / admin-checklist.ts
    pantalla-carrusel.ts / ceria.ts
    incidencias.ts / resumen-turno.ts / validaciones-parte.ts / normalizacion.ts
    verificacion-caja.ts / verificacion-codbar.ts
    captura-imagen.ts / cloudinary.ts / formato.ts
    supabase-client.ts / supabase-functions.ts / auth.ts
  components/
    TurnoScreen.tsx            pantalla principal del responsable (monolítica, ~20 useState)
    ResumenScreen.tsx, GestionLotes.tsx, OperariosRefuerzoCard.tsx, ThemeSwitcher.tsx
    captura-parte/             wizard: hoja, tono, continuar, caja, codbar, pantalla, aviso
    incidencias/
    responsable/               ProgresoFlotante (botón+panel), RankingResponsableScreen,
                               EquipoScreen, HistorialResponsableScreen (04)
    operario/                  OperarioApp, InicioOperarioScreen (+Ranking/StatsAvatar/Logros), MiLinea, Historial, Limpieza, Verificacion*
    jefe/                      JefeApp, VistaRapida, VistaDetallada (+prop responsableFijo), Incidencias
    admin/                     AdminApp, AjustarLetras, CorreccionPartes, PruebaCamara, CierreFabrica, Checklist
    pantalla/                  PantallaCarrusel
    ceria/                     CeriaScreen
supabase/
  migrations/                  20260101000001 … 20260824130000
  functions/
    _shared/                   anthropic.ts, openai.ts, openai_images.ts, deepseek_historia.ts,
                               cors.ts, cloudinary.ts, normalizacion.ts, formato.ts
    ocr-parte/                 fotos → JSON (prompts.ts)
    resolver-catalogo/         modelo/marca/producto/lote (service_role)
    generar-personaje/         imagen de referencia + prompt → personaje RPG
    ceria/                     asistente (index.ts + tools.ts)
    notificar-telegram/        incidencias + nuevo lote
    generar-resumen-turno/     informe de cierre → Telegram
    notificar-telegram-resumen-calidad/
memorias/                      esta carpeta
```

## Cómo se crean usuarios hoy

Dashboard → Authentication → Add user (email sintético) → INSERT en
`usuario` con el mismo UUID, `username`, `rol`, `letra`. No hay
pantalla para ello (descartado a propósito, ver `09`).

## Lo que hay que saber antes de tocar algo

- **`parte.operario_id` es la única fuente** de quién hizo cada parte
  (para "Mi línea", RLS y puntos). `asignacion_operario_linea` es solo
  la semilla al crear el parte. Regla completa en `01`, sección
  "Asignación operario → línea".
- Las políticas de UPDATE en `parte` para responsables exigen
  `responsable_id = auth.uid()`: quien cubre un turno de otro
  responsable no puede completar un parte abierto por el titular con
  su propia cuenta ni al revés — por eso la cobertura siempre se hace
  con las credenciales del titular, nunca con una cuenta aparte.
  Procedimiento completo en `01`, "Suplente y refuerzo".
- Pendientes ordenados en `07-pendientes.md`.
