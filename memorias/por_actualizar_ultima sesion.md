Resumen de la sesión

Repasamos los 6 bugs abiertos de 07-pendientes.md, uno a uno. Los 6 quedan cerrados:

#	Bug	Resolución
1	Cuenta suplente no existe	Descartada — decisión: cuando uno o dos responsables cubran a otro (incluido el caso "el titular no llega desde el principio"), siempre usan las credenciales del titular, nunca una cuenta compartida. Actualizar 01-dominio.md, sección "Suplente y refuerzo".
2	Migración RLS sin confirmar aplicada	Confirmado con tu db push — "Remote database is up to date". La parte de testing con cuentas reales de operario/jefe queda fusionada con el punto 10 de verificaciones.
3	generarPersonaje() código muerto en gamificacion.ts	Reparado — archivo reescrito de ~150 a 31 líneas: se borraron obtenerResumenGamificacion(), generarPersonaje() y sus interfaces (nadie las llamaba, y generarPersonaje() ni siquiera mandaba nivel_id). Se quedan solo NivelInfo y PersonajeInfo, que sí se usan en el resto de la app. Pendiente menor que quedó anotado: limpiar también obtenerGeneracionesDisponibles() en stats-avatar.ts y el campo generaciones_disponibles en AuthContext.tsx.
4	fn_otorgar_bonus_nivel (3 problemas)	Reparado — migración 20260825100000_fix_bonus_nivel.sql aplicada: (a) quitada la llamada muerta a fn_otorgar_generaciones_por_nivel, (c) velocidad ahora con coalesce(..., 0) como los otros 3 stats. (b) el snapshot en vivo se da por mitigado porque entras a la app a diario — sin desfase real.
5	ceria/index.ts — historialLimpio.slice(0, -1)	Reparado (ya lo tenías aplicado) — el slice cortaba la última respuesta de Ceria del turno anterior (no un duplicado, como parecía a primera vista: la pregunta actual aún no está guardada en BD en ese punto). Se quitó el slice.
6	Reintento automático si falla DeepSeek	Descartado — se mantiene el flujo actual (el admin rellena la historia a mano si falla).

Pendiente de que tú apliques (instrucciones ya dadas, no confirmadas todavía):

Borrar obtenerGeneracionesDisponibles() en stats-avatar.ts y su mención en el comentario de al lado
Quitar generaciones_disponibles del select y de PerfilUsuario en AuthContext.tsx
Actualizar 01-dominio.md (decisión suplente) y 04-gamificacion.md (párrafo de bonus de nivel) en las memorias

07-pendientes.md — borrar los 6 bugs enteros (sección "Bugs y huecos conocidos" queda vacía o desaparece hasta que surja el próximo).

01-dominio.md — en "Suplente y refuerzo", cambiar la frase de la cuenta suplente como fallback por la decisión de usar siempre las credenciales del titular (te la di completa hace unas respuestas).

04-gamificacion.md — sustituir el párrafo de "Tres cosas comprobadas en el código real de la función (24/08/2026)" por la versión cerrada (snapshot en vivo mitigado por tu entrada diaria; las otras dos ya no aplican porque están reparadas).

06-esquema-bd.md (si documenta funciones) — si en algún sitio menciona fn_otorgar_generaciones_por_nivel como parte activa del flujo, vale la pena una nota de que ya no se llama desde fn_otorgar_bonus_nivel (queda huérfana pero no borrada).
# Sesión 25/08/2026 — resumen completo para actualizar memorias

Este documento resume TODO lo hablado y aplicado en la sesión del
25/08/2026, para que se traslade a las memorias reales del proyecto
(`memorias/01-dominio.md`, `04-gamificacion.md`, `06-esquema-bd.md`,
`07-pendientes.md`, y cualquier otra que corresponda). Está pensado
para que otra sesión de Claude, con solo los `.md` delante, pueda
acondicionar el contenido sin tener que reconstruir el razonamiento.

Todo lo descrito aquí **ya está aplicado y probado en real** salvo que
se diga explícitamente lo contrario en la sección 8.

---

## 1. Los 6 bugs de `07-pendientes.md` — todos cerrados

Repaso uno a uno, con la resolución final de cada uno. **Estas 6
entradas deben desaparecer de `07-pendientes.md`.**

### 1.1 Cuenta `suplente` — descartada (decisión de dominio)

No se creará ninguna cuenta compartida `suplente`. Cuando uno o dos
responsables cubran a otro (incluido el caso "el titular no llega a
incorporarse desde el principio"), **siempre se usan las credenciales
del titular que se está cubriendo**, nunca una cuenta aparte ni las
credenciales propias de quien cubre.

**Acción sobre memorias**: en `01-dominio.md`, sección "Suplente y
refuerzo", sustituir cualquier mención a que el turno se abre con una
cuenta `suplente` por esta regla única. El rol `suplente` como valor
de enum en BD se queda (es inofensivo, no se usa activamente, no hay
necesidad de quitarlo del esquema).

### 1.2 Migración RLS — confirmada aplicada

`supabase db push` confirmó que todas las migraciones pendientes ya
estaban aplicadas. La verificación de Ranking/Vista Detallada con
cuentas reales de operario/jefe queda pendiente como parte de las
verificaciones generales (ver punto 10 de las verificaciones ya
existentes en `07-pendientes.md`, sin cambios).

### 1.3 Código muerto en `gamificacion.ts` — reparado

`frontend/src/lib/gamificacion.ts` se reescribió de ~150 líneas a 31:
se eliminaron `obtenerResumenGamificacion()`, `ResumenGamificacion`,
`generarPersonaje()` y `RespuestaGenerarPersonaje` (nadie los llamaba;
`generarPersonaje()` además no mandaba `nivel_id`, obligatorio en la
Edge Function — habría fallado con 400 si algo lo hubiera llamado). El
archivo se queda solo con los tipos `NivelInfo` y `PersonajeInfo`, que
sí se usan en el resto de la app.

De paso se limpiaron los dos flecos relacionados:
- `frontend/src/lib/stats-avatar.ts`: se borró `obtenerGeneracionesDisponibles()`
  (leía el contador plano `usuario.generaciones_disponibles`, sin uso
  desde el rediseño de generaciones-por-nivel del 23/08/2026).
- `frontend/src/context/AuthContext.tsx`: se quitó
  `generaciones_disponibles` de la interfaz `PerfilUsuario` y del
  `select` que trae el perfil. La columna sigue existiendo en la tabla
  `usuario` (inofensiva, no se toca el esquema).

### 1.4 `fn_otorgar_bonus_nivel` — 3 problemas reparados (esta sesión) + 1 más encontrado después (ver 4.3)

En la reparación original de esta sesión:
- (a) Se quitó la llamada muerta a `fn_otorgar_generaciones_por_nivel`
  (escribía en el contador plano `usuario.generaciones_disponibles`,
  sin uso).
- (b) El snapshot en vivo (las stats se congelan en el momento en que
  el admin pulsa el botón, no en el instante real en que se cruzó el
  umbral) se da por mitigado en la práctica: el administrador entra a
  diario, así que el desfase nunca es mayor de un día.
- (c) `velocidad` ahora se inserta con `coalesce(v_velocidad, 0)`,
  igual que los otros 3 stats (antes un usuario con `tiempo_plena = 0`
  se quedaba con `velocidad = null` congelado para siempre en esa
  carta).

**Importante**: se encontró un CUARTO bug en esta misma función,
preexistente desde el 23/08/2026 y sin relación con el refactor de
hoy — ver sección 4.3, "ambigüedad nivel_id".

### 1.5 `ceria/index.ts` — reparado

`historialSinUltimo = historialLimpio.slice(0, -1)` se quitó. El
recorte no eliminaba un duplicado (la pregunta actual del usuario aún
no está guardada en BD en el punto donde se ejecuta `cargarHistorial`,
se guarda al final de las 3 fases) — eliminaba **la última respuesta
de Ceria** del turno anterior, degradando el contexto de conversación
en cada intercambio. Ahora la fase 1 usa `historialLimpio` directamente
sin ningún slice.

### 1.6 Reintento automático si falla DeepSeek — descartado

Se mantiene el flujo actual: si DeepSeek falla al generar la historia
del personaje, se guarda `historia: null` y el admin la rellena a
mano. Sin cambios de código.

---

## 2. Gamificación del responsable — feature completa

Antes de esta sesión, el responsable no tenía ninguna pantalla de
gamificación (solo Turno/Resumen/Lotes). Ahora tiene todo el sistema
completo: navegación nueva, ranking propio, stats/avatar reutilizados,
equipo, logros propios (18), e historial de partes propio.

### 2.1 Navegación — pestaña "Progreso" (nuevo patrón de UI)

**Decisión de nombre**: se llama "Progreso", no "Gamificación" (más
de cara al usuario).

**Pestañas de arriba del responsable** (antes: Turno · Resumen ·
Lotes): ahora **Turno · Resumen · Lotes · Historial** (Historial es
nuevo, ver 2.7).

**Botón flotante "Progreso"**: fijo abajo del todo, siempre visible
(`position: fixed`, `z-50`). Es el **primer patrón de navegación de la
app que no es una pestaña fija arriba** — hasta ahora toda la
navegación (operario, jefe, admin, el propio responsable) es pestañas
en la parte superior.

Comportamiento (decidido tras dos iteraciones de diseño en esta
sesión, la primera no cuadró):
- Un toque en el botón lo abre. El panel que aparece **ocupa todo el
  espacio de contenido disponible por debajo de la cabecera y las 4
  pestañas de arriba** (nunca las tapa) — técnicamente: el `<main>`
  de `App.tsx` pasó a ser `flex-1` dentro de un contenedor
  `flex min-h-screen flex-col`, y el panel usa `absolute inset-0`
  dentro de ese `<main>` (así se ajusta exactamente al hueco
  disponible, tenga la pestaña de fondo mucho o poco contenido).
- Dentro del panel hay una fila de 5 sub-pestañas; cambiar de
  sub-vista NO cierra el panel.
- Otro toque en el propio botón "Progreso" (que cambia de icono
  Sparkles a X cuando está abierto) colapsa el panel entero.

**Las 5 sub-vistas, en este orden**:
1. **Ranking** (de operarios) — reutiliza `RankingOperarioScreen` tal
   cual, sin ningún cambio de componente.
2. **Ranking resp.** (de responsables) — nuevo, ver 2.8.
3. **Stats** — reutiliza `StatsAvatarOperarioScreen` tal cual; ya
   soportaba `rol="responsable"` de fábrica (llama a
   `obtenerStatsEnVivo(usuario.id, usuario.rol)` internamente), cero
   cambios de código necesarios ahí.
4. **Equipo** — nuevo, ver 2.6.
5. **Logros** — reutiliza `LogrosOperarioScreen`, con un cambio de una
   línea (pasar `usuario.rol` a `obtenerLogros`, que antes solo
   soportaba operario por defecto).

Componente nuevo: `frontend/src/components/responsable/ProgresoFlotante.tsx`.

### 2.2 `historial_ciclo_responsable` — tabla separada de `historial_ciclos`

**Decisión clave de esta sesión**: se descartó seguir usando
`historial_ciclos` (la tabla compartida operario+responsable) para el
responsable, y se creó `historial_ciclo_responsable` aparte.

**Motivo**: mezclar los dos roles en una tabla dejaba columnas
siempre `NULL` para responsable (`piezas_total`, `piezas_por_formato`
— el formato nunca es una métrica del responsable, que supervisa
varias líneas a la vez), y complicaba razonar sobre qué columnas
aplicaban a quién. Además, si un operario pasa a ser responsable (o al
revés) en algún momento de su carrera, con tablas separadas sus ciclos
de cada etapa simplemente caen en la tabla que corresponda a ese rol
en ese momento — sin conflicto ni necesidad de lógica especial.

**Esquema de `historial_ciclo_responsable`** (todas las columnas que
tiene, en el estado final tras toda la sesión):

```
id                    uuid primary key default gen_random_uuid()
usuario_id            uuid not null references usuario(id)
cycle_id              integer not null
fecha_cierre          timestamptz not null default now()

puntos_ciclo          numeric not null default 0
m2_total              numeric not null default 0
m2_contenedor         numeric not null default 0
m2_com                numeric not null default 0
m2_std                numeric not null default 0

minutos_plena         numeric not null default 0
minutos_no_alimentada numeric not null default 0
minutos_saturacion    numeric not null default 0
minutos_banco         numeric not null default 0
minutos_maquina       numeric not null default 0

verificaciones_codbar numeric not null default 0
puntos_equipo_ciclo   numeric not null default 0
operario_gano_ciclo   boolean not null default false
turnos_trabajados     numeric not null default 0

fuerza                numeric
resistencia           numeric
velocidad             numeric

unique (usuario_id, cycle_id)
```

**Importante — nomenclatura de columnas**: a propósito llevan el
prefijo `minutos_*` (no `tiempo_*` como en `historial_ciclos` de
operario). Son tablas distintas con vocabulario distinto; el motor de
logros (`lib/logros.ts`) sabe leer de una u otra según el rol.

**RLS**: `select` para `usuario_id = auth.uid()` o
`fn_rol_actual() in ('responsable', 'jefe', 'administrador', 'pantalla')`
— cualquier responsable puede ver las de los demás (para su propio
Ranking), sin necesitar el SELECT amplio del jefe. Escritura solo vía
`fn_cerrar_ciclos_pendientes` (security definer) o backfill manual
puntual.

**Efecto colateral en `historial_ciclos`**: se borraron las 23 filas
de responsable que habían quedado ahí de la migración de v2 original
(`delete from historial_ciclos where rol = 'responsable'`). La columna
`rol` de `historial_ciclos` queda redundante (siempre `'operario'`
desde ahora) — se puede quitar en una limpieza aparte, sin prisa, no
se ha hecho todavía.

### 2.3 Vistas nuevas de agregación (responsable)

Todas siguen el patrón ya establecido en el proyecto: sin
`security_invoker` (corren como el owner, saltan RLS), calculables
para CUALQUIER `cycle_id` (cerrado o en curso), lo que permite
reutilizarlas tanto para congelar el snapshot al cerrar ciclo como
para leer el ciclo en vivo.

- **`v_metros_responsable_ciclo`** (ampliada) — ahora da m² por
  categoría (`m2_contenedor`, `m2_com`, `m2_std`) además de
  `m2_total`, agrupado por `responsable_id, cycle_id`, mismo criterio
  de categorías que `v_calidad_turno`.
- **`v_tiempo_responsable_ciclo`** (ampliada) — los 5 tiempos por
  separado (antes solo daba el total combinado).
- **`v_verificaciones_codbar_responsable_ciclo`** — cuenta partes con
  `verificacion_codbar_estado in ('completo','parcial','manual')`
  (excluye `no_realizada`), por `responsable_id, cycle_id`.
- **`v_operarios_de_responsable_ciclo`** — operarios que tuvieron al
  menos un parte con `responsable_id` = este responsable en ese ciclo
  (relación real de trabajo vía `parte.operario_id`+`parte.responsable_id`,
  **no por letra** — ver el porqué en 2.6).
- **`v_puntos_equipo_responsable_ciclo`** — a partir de la anterior,
  suma de puntos de esos operarios (`puntos_equipo`) y si alguno de
  ellos ganó el ranking de ese ciclo (`operario_gano_ciclo`, vía
  `v_ganador_por_ciclo`).
- **`v_partes_operario_ciclo`** (nueva, para OPERARIO) — cuenta
  `parte` completados y vigentes por `operario_id, cycle_id`. Cuenta
  doble a propósito si el mismo día trabaja 2 líneas (son 2 filas de
  `parte`).
- **`v_turnos_responsable_ciclo`** — cuenta `turno` por
  `turno.abierto_por, cycle_id`. Literal, no partes (varias líneas en
  el mismo turno NO deben multiplicar el conteo).
- **`v_equipo_avatar_stats`** — junta `personaje_rpg` (avatar activo)
  con `personaje_stats_nivel` (stats CONGELADAS del nivel de esa
  carta, vía `nivel_en_generacion`) — primera vista del proyecto que
  expone stats congeladas en vez de en vivo. Si el nivel de la carta
  activa todavía no tiene fila en `personaje_stats_nivel` (el admin no
  le otorgó ese nivel todavía), sale `null` en las 4 stats — se trata
  igual que "sin avatar" en la UI (sin barras).
- **`v_ganador_por_ciclo_responsable`** + **`v_veces_lider_indiscutible`**
  — equivalentes a `v_ganador_por_ciclo`/`v_veces_rey_de_reyes` del
  operario, pero sobre `historial_ciclo_responsable` +
  `v_puntos_responsable_ciclo`. Base del logro "Líder indiscutible".

### 2.4 `fn_cerrar_ciclos_pendientes` — estado final

Se reescribió varias veces a lo largo de la sesión (cada vez que se
añadía una columna nueva a `historial_ciclo_responsable`). **El
bloque de operario nunca cambió** en todo el proceso — solo el de
responsable, que en su estado final rellena TODAS las columnas de la
sección 2.2 (m², tiempos, verificaciones_codbar, puntos_equipo_ciclo,
operario_gano_ciclo, turnos_trabajados, fuerza/resistencia/velocidad).
Sigue siendo idempotente (`on conflict do update`).

**Nota de tipos**: la inicialización interna
`v_ciclo_actual integer := fn_ciclo_id(now()::date)` necesita el cast
explícito a `date` — `fn_ciclo_id` no acepta `timestamptz`, y sin el
cast la función falla con `function fn_ciclo_id(timestamp with time
zone) does not exist` (bug real encontrado y corregido en esta
sesión, ver 4.2).

### 2.5 Backfill de datos históricos desde v2

**Para responsable**: v2 sí guardaba el detalle fino por turno en su
tabla `responsable_ledger` (una fila por turno, con m² por categoría y
los 5 tiempos por separado) — la migración original de v2 a v3 (antes
de esta sesión) no lo había usado, prefirió la tabla `turnos`
(agregada). Se exportó `responsable_ledger` completo (393 filas, 4
responsables: hectorn/radu/valentina/joaquina — el 5º usuario de v2,
literalmente llamado "responsable", no se migró) y se recalculó el
`cycle_id` real de cada fila con `fn_ciclo_id()` (no se asumió ningún
offset fijo entre numeración de v2 y v3, se descubrió que los ciclos
de v2 ni siquiera se correspondían 1:1 con los de v3 por fechas).

Resultado: **23 filas** en `historial_ciclo_responsable` (6 ciclos ×
4 responsables, menos 1 — a joaquina le falta el ciclo 1 porque sus
turnos en v2 no empezaron hasta después de que ese ciclo ya hubiera
cerrado; correcto, no es un fallo). `cycle_id` va de 1 a 6, nunca 0 ni
7 (7 es el ciclo en curso ahora mismo, sin cerrar — verificado que
ninguna fecha de v2 cae ahí).

Después, en un backfill aparte, se rellenó también `turnos_trabajados`
para esas mismas 23 filas (contando filas del mismo CSV agrupadas por
usuario+ciclo — cada fila de `responsable_ledger` es 1 turno).

**Columnas que NO se pudieron recuperar de v2** (se quedan a
0/false en los ciclos 1-6, y es correcto que así sea):
`verificaciones_codbar`, `puntos_equipo_ciclo`, `operario_gano_ciclo`
— v2 no tenía tabla `lote` ni `parte` a nivel de fila equivalente a
v3, así que no hay de dónde recuperar estos 3 datos para ciclos
anteriores al lanzamiento de v3. Empiezan a contar de verdad desde el
ciclo 7 en adelante.

**Para operario**: cualquier métrica nueva basada en `parte` (partes
completados, etc.) tampoco se puede reconstruir para ciclos anteriores
al 23/08/2026 — v3.`parte` no tiene filas de antes de esa fecha (los
operarios se migraron agregados directamente a `historial_ciclos`, sin
backfillear filas de `parte` históricas).

### 2.6 Pestaña "Equipo"

**Definición de "tus operarios"**: los de tu **misma letra fija**
(A/B/C/D), no los del turno de hoy — decisión explícita: la letra es
estable, el turno cambia a diario. El responsable aparece él mismo a
la cabeza de la lista (marcado con 👑 en la UI).

**Qué se muestra de cada uno**: avatar + las 4 barras (fuerza/
resistencia/velocidad/vida) **congeladas del nivel de la carta activa**
(no en vivo) — primera vez que la app muestra stats congeladas en vez
de en vivo en cualquier pantalla. Las barras se pintan en miniatura
superpuestas sobre la propia imagen (franja semitransparente en la
parte inferior de la carta). Si el operario no ha generado ningún
avatar todavía: icono genérico + nombre + nivel, sin barras.

Archivos nuevos: `frontend/src/lib/equipo.ts`,
`frontend/src/components/responsable/EquipoScreen.tsx`.

### 2.7 Historial de partes propio

Reutiliza `VistaDetalladaScreen` del jefe **tal cual** (mismo acordeón
turno → línea → parte), con el filtro de responsable fijado al propio
usuario y oculto (nuevo prop opcional `responsableFijo?: string`,
`undefined` por defecto para no afectar al jefe/admin). No hizo falta
ninguna RLS nueva: el responsable ya tenía el mismo `SELECT` amplio
que el jefe sobre `parte`/`turno`/`incidencia_*` desde el esquema
original (`parte_select_todos` ya incluía el rol `responsable`).

Vive como **4ª pestaña de arriba** ("Historial"), no dentro del panel
de Progreso — es un dato de trabajo, no de gamificación.

Archivo nuevo: `frontend/src/components/responsable/HistorialResponsableScreen.tsx`
(envoltorio de una línea sobre `VistaDetalladaScreen`).

### 2.8 Ranking de responsables

Mismo componente visual que el del operario (podio 1º-3º + resto
listado debajo), pero con solo 4 personas el podio **siempre se llena
entero** (nunca hay "quedas fuera del top 5"). **Sin Reyes del
formato** — el responsable no tiene desglose por formato (supervisa
varias líneas, el formato no es una métrica suya).

Archivo nuevo: `frontend/src/components/responsable/RankingResponsableScreen.tsx`.

Funciones nuevas en `lib/ranking.ts`:
`obtenerPodioResponsablesCicloActual`/`obtenerPodioResponsablesCicloAnterior`
(mismo patrón que las del operario, sobre `v_puntos_responsable_ciclo`
en vivo / `historial_ciclo_responsable` cerrado).

### 2.9 Ranking — partes/turnos + "pts por unidad" (paridad con v2)

Añadido a **ambos** rankings (operario y responsable), a partir de
una captura de pantalla de cómo lo mostraba v2: bajo los puntos de
cada entrada (podio, lista de 4º+, y "Tú"), se muestra:
- Operario: `{cantidad} partes · {pts/p} pts/p` — cantidad = partes
  completados ese ciclo (cuenta doble si un mismo día trabaja 2
  líneas, porque son 2 filas de `parte`).
- Responsable: `{cantidad} turnos · {pts/t} pts/t` — cantidad =
  turnos abiertos ese ciclo (literal, `turno.abierto_por`).

`pts/p` o `pts/t` = puntos del ciclo / cantidad, `null` si cantidad es
0 (se muestra "—" o se omite, evitando división por cero).

Cambios: `EntradaPodio` (en `lib/ranking.ts`) ganó dos campos:
`cantidad: number` y `ptsPromedio: number | null`. `construirPodio()`
los calcula. Las 4 funciones de podio (operario actual/anterior,
responsable actual/anterior) los rellenan desde las vistas/columnas
correspondientes.

---

## 3. Logros del responsable — 18 en total, sembrados y funcionando

Mismo motor genérico (`logros_definicion`, columna `rol` ya prevista
desde el 22/08/2026) y mismo archivo `lib/logros.ts`, ahora con una
rama completa para `rol='responsable'` además de la de operario.

### 3.1 Lista completa

**Tramo** (acumulado de por vida, se repite cada `condicion_valor`
unidades — histórico `historial_ciclo_responsable` + ciclo en vivo):

| Nombre | `condicion_tipo` | Umbral | Icono |
|---|---|---|---|
| El Relojero | `minutos_plena` | 60.000 (1.000h) | ⏰ |
| El Paciente | `minutos_no_alimentada` | 60.000 | 😌 |
| Sin remedio | `minutos_saturacion` | 60.000 | 🤷 |
| El paciente del taller | `minutos_banco` | 60.000 | 🔄 |
| ¿Dónde está el mecánico? | `minutos_maquina` | 60.000 | 🔧 |
| El Rey de la Calidad | `m2_std` | 2.000.000 | 🏅 |
| El Magnate Comercial | `m2_com` | 150.000 | ✨ |
| Destructor | `m2_contenedor` | 150.000 | 🗻 |
| El Coloso | `m2_total` | 3.000.000 | 🗿 |
| Argos | `lotes_creados` | 1.000 | 👁️ |
| El detallista | `verificaciones_codbar` | 1.000 | 🔍 |

**Ciclo — umbral de puntos, sin progreso hacia el siguiente**:

| Nombre | `condicion_tipo` | Umbral |Icono |
|---|---|---|---|
| Bestia del Ciclo | `bestia_ciclo_responsable` | 650 pts | ⚡ |
| Ciclo Legendario | `ciclo_legendario_responsable` | 780 pts | 🔥 |
| Líder indiscutible | `lider_indiscutible` | (sin umbral, 1º del ranking) | 👑 |

**Ciclo — umbral de una COLUMNA cruda en un solo ciclo (mecánica
nueva de esta sesión, no existía para operario)**:

| Nombre | `condicion_tipo` | Columna comparada | Umbral |
|---|---|---|---|
| El Manitas | `manitas_ciclo` | `minutos_plena` | 54.000 (900h) |
| El salvador | `salvador_ciclo` | `m2_total` | 400.000 |

**Equipo (cruce con los operarios reales de ese ciclo, no letra)**:

| Nombre | `condicion_tipo` | Umbral |
|---|---|---|
| Creador de Héroes | `creador_de_heroes` | (sin umbral, columna `operario_gano_ciclo`) |
| El Equipo A | `equipo_a` | 3.000 pts (columna `puntos_equipo_ciclo`) |

**18 logros en total** (11 tramo + 5 ciclo-puntos/tramo-simple + 2
equipo).

### 3.2 Umbrales calibrados con datos reales, no copiados a ciegas del operario

Los umbrales de m² por categoría se ajustaron con los totales reales
de los 4 responsables tras 6 ciclos del backfill (m2_std ya rondaba
950k-1,12M; m2_com solo 32k-46k; m2_contenedor 50k-62k) — muy
distintos entre sí porque cada categoría es naturalmente una fracción
distinta de la producción total. Se subió El Rey de la Calidad a 2M
(con 1M, 2 de los 4 ya lo habrían tenido desbloqueado el día 1) y se
bajaron Magnate Comercial/Destructor a 150k cada uno (con 1M
tardarían ~8-12 años en desbloquearse). El usuario confirmó que estos
ritmos están además afectados por que la fábrica lleva meses a medio
gas (un horno parado por precio del gas/bajada de ventas) — con los 4
hornos a pleno los ritmos serán más rápidos y estos umbrales menos
desproporcionados de lo que parecen ahora mismo.

### 3.3 Por qué "Creador de Héroes"/"El Equipo A" NO usan letra

Primer diseño (descartado): comparar contra la letra ACTUAL del
operario/responsable. Problema detectado por el propio usuario: si
alguien cambia de letra con el tiempo, comparar contra la letra de HOY
atribuiría retroactivamente logros a quien no correspondía en su
momento (ej. un operario que se une a una letra DESPUÉS de haber
ganado un ciclo en otra letra, "regalaría" el logro al nuevo
responsable).

**Solución final**: 2 columnas nuevas en `historial_ciclo_responsable`
(`puntos_equipo_ciclo`, `operario_gano_ciclo`) que se **congelan al
cerrar cada ciclo**, calculadas a partir de con quién trabajó de
verdad ese responsable ese ciclo (`parte.responsable_id` +
`parte.operario_id`, la relación real de trabajo), no de la letra que
tengan hoy. Mostrar los logros de un responsable nunca vuelve a tocar
`parte` — solo el ciclo en vivo (aún sin cerrar) consulta la vista
correspondiente, exactamente igual que el resto de métricas.

---

## 4. Bugs encontrados y corregidos DURANTE la implementación de todo lo anterior

Tres regresiones/bugs reales, todos corregidos y verificados en real
por el usuario.

### 4.1 `v_puntos_responsable_total_vida` seguía apuntando a la tabla vieja

Al separar `historial_ciclo_responsable` (sección 2.2), se borraron
las filas de responsable de `historial_ciclos` — pero la vista
`v_puntos_responsable_total_vida` (creada el 22/08/2026, antes de esta
sesión) seguía sumando `historial_ciclos where rol='responsable'`,
ahora vacío. Efecto: **todos los responsables aparecían con 0 puntos
de vida**, y en cascada sin nivel correcto ni generaciones — porque
`fn_nivel_actual()` y `v_admin_usuarios_gamificacion` dependen de esa
misma vista.

Arreglo: `v_puntos_responsable_total_vida` reescrita para sumar
`historial_ciclo_responsable` en vez de `historial_ciclos`. Se
verificó que ningún otro objeto de BD había quedado apuntando a la
tabla vieja para responsable — este era el único punto de fallo.

Nota técnica: el primer intento de este fix falló con
`cannot change data type of view column "puntos_totales" from bigint
to numeric` porque `historial_ciclo_responsable.puntos_ciclo` es
`numeric` (frente a `historial_ciclos.puntos_ciclo`, que es `int`) —
se resolvió con un cast `::bigint` al resultado final de la vista.

### 4.2 `fn_ciclo_id(now())` — tipo incorrecto

`fn_cerrar_ciclos_pendientes()` inicializaba
`v_ciclo_actual := fn_ciclo_id(now())` — pero `fn_ciclo_id` espera
`date`, no `timestamptz`, y Postgres no hace ese cast implícito en
llamada a función. Arreglado con `fn_ciclo_id(now()::date)`. En todo
el resto del proyecto la función siempre se llamaba con
`fn_ciclo_id(t.fecha)` o `fn_ciclo_id(current_date)` — nunca con
`now()` a pelo; el bug lo introdujo esta sesión al reconstruir la
función de memoria en un paso intermedio.

### 4.3 `fn_otorgar_bonus_nivel` — "column reference nivel_id is ambiguous"

**Bug preexistente desde el 23/08/2026, sin relación con el refactor
de hoy** — simplemente nadie había pulsado el botón "otorgar
generaciones" para NADIE (ni operario ni responsable) hasta esta
sesión (los operarios ya tenían generaciones desde el seed/backfill
inicial, sin pasar nunca por este botón).

Causa: `fn_otorgar_bonus_nivel` declara
`returns table (otorgado boolean, nivel_id uuid, nivel_nombre text)`
— el parámetro de salida `nivel_id` tiene el mismo nombre que la
columna `personaje_stats_nivel.nivel_id`, usada dentro del `INSERT` y
del `ON CONFLICT` de la propia función. PL/pgSQL no puede decidir a
cuál de los dos te refieres (código Postgres `42702`).

Arreglo: se añadió `#variable_conflict use_column;` como primera línea
del cuerpo de la función (antes de `declare`) — le dice a PL/pgSQL que
ante esa ambigüedad prefiera siempre la columna de la tabla. Es seguro
al 100 %: dentro del cuerpo nunca se usa el parámetro de salida por su
nombre pelado, siempre la variable local `v_nivel_id`.

Verificado en real con un responsable tras el fix — funcionó. Pendiente
de que el usuario lo pruebe también con un operario (probablemente
nunca se había disparado tampoco ahí, por el mismo motivo — se
recomienda probarlo para descartarlo del todo, no se ha confirmado
explícitamente en esta sesión).

---

## 5. Archivos nuevos creados esta sesión

```
frontend/src/lib/equipo.ts
frontend/src/components/responsable/EquipoScreen.tsx
frontend/src/components/responsable/RankingResponsableScreen.tsx
frontend/src/components/responsable/ProgresoFlotante.tsx
frontend/src/components/responsable/HistorialResponsableScreen.tsx
```

Migraciones (todas aplicadas, en este orden):

```
20260825110000_historial_ciclo_responsable.sql
20260825120000_seed_logros_responsable.sql
20260825130000_lider_indiscutible.sql
20260825140000_logros_responsable_equipo.sql
20260825150000_seed_logros_responsable_equipo.sql
20260825160000_fix_fn_ciclo_id_cast.sql
20260825170000_equipo_avatar_stats.sql
20260825180000_fix_puntos_responsable_total_vida.sql
20260825190000_conteo_partes_turnos_ranking.sql
20260825200000_fix_ambiguedad_nivel_id.sql
```

Scripts de backfill puntuales (ejecutados una vez desde el SQL Editor
de Supabase, no son migraciones versionadas):

```
backfill_historial_responsable.sql   (23 filas iniciales, m²/tiempos/puntos)
backfill_turnos_responsable.sql      (turnos_trabajados sobre esas mismas 23 filas)
```

## 6. Archivos modificados esta sesión

```
frontend/src/lib/gamificacion.ts          — reducido a 2 interfaces (NivelInfo, PersonajeInfo)
frontend/src/lib/stats-avatar.ts          — quitada obtenerGeneracionesDisponibles()
frontend/src/context/AuthContext.tsx      — quitado generaciones_disponibles
supabase/functions/ceria/index.ts         — quitado el slice historialSinUltimo
frontend/src/lib/logros.ts                — reescrito: soporta rol operario+responsable
frontend/src/lib/ranking.ts               — +EntradaPodio.cantidad/ptsPromedio, +2 funciones de responsable
frontend/src/components/operario/LogrosOperarioScreen.tsx    — pasa usuario.rol a obtenerLogros
frontend/src/components/operario/RankingOperarioScreen.tsx   — muestra partes+pts/p (podio, resto, "Tú")
frontend/src/components/jefe/VistaDetalladaScreen.tsx        — +prop opcional responsableFijo
frontend/src/App.tsx                      — +pestaña Historial, +<ProgresoFlotante/>, layout flex-col/flex-1
```

## 7. Verificación de ciclos — hecha, correcta

Se confirmó con `fn_ciclo_id('2026-08-31')` = 7 y
`fn_ciclo_id('2026-08-30')` = 6 — el ciclo 7 (el primero realmente en
vivo desde el relanzamiento) arranca exactamente el 31/08/2026, el día
del reinicio de producción. Nada que ajustar en el ancla de rotación
(`2026-02-16`, ciclos de 28 días).

---

## 8. Lo que queda pendiente (NO resuelto en esta sesión)

- Limpiar la columna `rol` de `historial_ciclos` (queda redundante,
  siempre `'operario'` — no urgente).
- Confirmar que el botón "otorgar generaciones" también funciona bien
  para operarios tras el fix de `#variable_conflict` (probablemente
  sí, nunca se había disparado el bug con ellos porque ya venían con
  generaciones desde el seed inicial — no confirmado explícitamente).
- Las verificaciones generales que ya estaban en `07-pendientes.md`
  antes de esta sesión (cron de resúmenes de turno, primer cierre de
  ciclo real el 28/09, "continuar mismo lote+tono", secrets, bug de
  cámara Xiaomi) — no se tocaron en esta sesión, siguen igual.
- Las decisiones pendientes que ya estaban anotadas (modelo de OCR,
  umbral de minutos atípicos, mover el modelo de OCR a config, squash
  de migraciones) — tampoco se tocaron.