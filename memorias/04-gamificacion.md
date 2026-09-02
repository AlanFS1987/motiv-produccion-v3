# 04 — Gamificación

Estado: **operario y responsable construidos y probados en real**
(puntos, niveles, cierre de ciclo, stats, logros, personaje/avatar,
datos de v2 migrados). El operario tiene 19 logros; el responsable, 18
propios, sembrados en la sesión 25/08/2026 (antes no existían — v2 no
tenía gamificación de responsable). Ver "Pendiente" al final para lo
que queda suelto.

## Principios (cerrados)

- Los datos crudos del parte (piezas, minutos) **nunca se corrigen ni
  se recalculan** para gestión; el jefe los ve tal cual. Solo la capa
  de puntos aplica fórmulas.
- Los puntos **no se guardan resueltos por parte**: se calculan al
  consultar, agregando los partes vigentes por línea+turno. Evita el
  total desincronizado de v2.
- Totales de por vida = suma de "fotos" de ciclos cerrados
  (`historial_ciclos`) + ciclo actual en vivo.
- Nada se acumula con `+=` en un contador mutable (lección de v2):
  todo se recalcula desde totales, y `historial_ciclos` guarda la
  aportación de cada ciclo, nunca un acumulado.
- **Reparto igualitario vs. atribución directa**: los **puntos**
  (rendimiento, piezas) de una línea+turno se reparten a partes
  iguales entre los `parte.operario_id` distintos de esa línea+turno
  (normalmente uno; puede haber más si el responsable reasignó a
  mitad de turno). Se descartó ponderar por minutos: es infrecuente y
  nunca tan desigual como para justificar la complejidad. Las
  **cantidades en bruto** (m², piezas, tiempos) que alimentan logros y
  stats NO se reparten: cada parte es de su `operario_id`. Regla de
  quién es el operario del parte en `01`.

## Ciclo

28 días desde `configuracion.fecha_inicio_rotacion` (valor y reglas en
`01`), `fn_ciclo_id(fecha)` = `floor((fecha − inicio)/28)`. Nunca se
pausa. Como 28 es múltiplo de 7 y el ancla es lunes, cada ciclo termina
en domingo y el siguiente arranca en lunes — base del cron de cierre.
Lanzamiento 31/08/2026 = ciclo 7; primer cierre real 28/09/2026.

## Puntos del operario (por línea+turno)

**Rendimiento** (`v_rendimiento_operario_por_turno`,
`v_puntos_rendimiento_operario_ciclo`, base `operario_ledger` que ya
resuelve el operario por `parte.operario_id`):

```
denominador = max(480, Σ minutos_total)          -- por línea+turno
numerador   = Σ (minutos_plena + minutos_no_alimentada)
% = numerador / denominador
```
El `max()` funciona en las dos direcciones: si se reportan menos de
480 min, el tiempo no reportado cuenta en contra; si se reportan más
(contador de máquina sin resetear, el caso del aviso de 600 min de
`validaciones-parte.ts`), el denominador real diluye el % en vez de
dispararlo. Una línea sin ningún parte en el turno no genera fila.

Tabla `puntos_rendimiento` (máx. 15), 6 tramos contiguos:

| % | Puntos |
|---|---|
| 0,00–24,99 | 1 |
| 25,00–37,49 | 2 |
| 37,50–49,99 | 5 |
| 50,00–62,49 | 9 |
| 62,50–74,99 | 12 |
| 75,00–100,00 | 15 |

**Piezas** (`v_piezas_formato_linea_turno` → `v_puntos_piezas_linea_turno`
→ `v_puntos_piezas_operario_por_linea_turno`), tabla `puntos_piezas`
(7 formatos × 5 tramos), por piezas totales de la línea+turno **y
formato** (si cambia el formato a mitad, cada formato se puntúa aparte
y se suman antes de repartir). Último tramo sin límite (`max = null`).

| Formato | 2 | 5 | 9 | 12 | 15 (sin límite) |
|---|---|---|---|---|---|
| 200x1200 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | 12.000–13.999 | ≥14.000 |
| 300x1200 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | ≥12.000 |
| 600x1200 | 2.000–2.999 | 3.000–3.999 | 4.000–4.999 | 5.000–5.999 | ≥6.000 |
| 1200x1200 | 1.000–1.249 | 1.250–1.749 | 1.750–1.999 | 2.000–2.249 | ≥2.250 |
| 300x600 | 10.000–13.999 | 14.000–16.999 | 17.000–19.999 | 20.000–21.999 | ≥22.000 |
| 600x600 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | ≥12.000 |
| 900x900 | 1.500–2.199 | 2.200–2.999 | 3.000–3.799 | 3.800–4.499 | ≥4.500 |

**Limpieza** (`v_puntos_limpieza_operario_por_turno`): 1 punto por
ítem marcado en `operario_checklist` (`checklist_items.puntos`),
atribuido a quien lo marcó, agregado por turno completo (no por
línea; cualquier operario del turno limpia cualquier línea).

**Total** (por turno) = piezas + rendimiento + limpieza. Por vida:
`v_puntos_operario_total_vida`, y por categoría
`v_puntos_{piezas,rendimiento,limpieza}_operario_total_vida`
(histórico cerrado + ciclo en vivo). Por ciclo:
`v_puntos_operario_ciclo` (cualquier ciclo, lleva `username` horneado
porque PostgREST no puede resolver embeds sobre una vista con UNION).

## Puntos del responsable (por turno completo, nunca por línea)

**Metros** (`v_metros_responsable_por_turno` →
`v_puntos_metros_responsable_por_turno`), tabla `puntos_metros` sobre
m² totales del turno, máx. 45, último tramo sin límite. Mismo filtro
que rendimiento (solo `vigente=true`, sin `completado=true`) a
propósito; si se cambia uno, cambiar el otro.

**Rendimiento** (`v_rendimiento_responsable_por_turno`,
`v_puntos_rendimiento_responsable_ciclo`): mismos principios, denominador
2880 min (6 × 480), tabla `puntos_rendimiento_responsable`, máx. 45:

| % | Puntos |
|---|---|
| 0,00–20,82 | 2 |
| 20,83–29,16 | 5 |
| 29,17–37,49 | 8 |
| 37,50–45,82 | 12 |
| 45,83–58,32 | 16 |
| 58,33–66,66 | 21 |
| 66,67–74,99 | 26 |
| 75,00–83,32 | 32 |
| 83,33–91,66 | 38 |
| 91,67–100,00 | 45 |

**Total** = metros + rendimiento (sin limpieza). Por vida:
`v_puntos_responsable_total_vida`; por ciclo:
`v_puntos_responsable_ciclo`.

## Gamificación del responsable — feature completa (sesión 25/08/2026)

Antes de esta sesión el responsable solo tenía Turno/Resumen/Lotes, sin
ninguna pantalla de gamificación (puntos y niveles ya existían en BD,
pero no había dónde verlos). Ahora tiene navegación, ranking propio,
stats/avatar reutilizados, pestaña de equipo, 18 logros propios e
historial de partes propio.

### Navegación — pestaña "Progreso"

**Nombre de cara al usuario: "Progreso"**, no "Gamificación".

Pestañas de arriba del responsable, ahora **Turno · Resumen · Lotes ·
Historial** (Historial es nuevo, ver más abajo). Además, un **botón
flotante "Progreso"** fijo abajo del todo (`position: fixed`, `z-50`)
— primer patrón de navegación de la app que no es una pestaña fija
arriba (hasta ahora toda la navegación de operario/jefe/admin/
responsable son pestañas superiores).

Comportamiento: un toque lo abre; el panel ocupa todo el espacio de
contenido disponible por debajo de la cabecera y las 4 pestañas de
arriba, sin taparlas (`<main>` de `App.tsx` es `flex-1` dentro de un
contenedor `flex min-h-screen flex-col`, el panel usa `absolute
inset-0` dentro de ese `<main>`). Dentro hay 5 sub-pestañas; cambiar de
sub-vista no cierra el panel. Otro toque en el propio botón (icono
Sparkles ↔ X) lo colapsa entero.

Las 5 sub-vistas, en este orden:
1. **Ranking** (de operarios) — reutiliza `RankingOperarioScreen` tal cual.
2. **Ranking resp.** (de responsables) — nuevo, ver "Ranking de
   responsables" más abajo.
3. **Stats** — reutiliza `StatsAvatarOperarioScreen` tal cual; ya
   soportaba `rol="responsable"` de fábrica.
4. **Equipo** — nuevo, ver más abajo.
5. **Logros** — reutiliza `LogrosOperarioScreen`, con `usuario.rol`
   pasado a `obtenerLogros` (antes solo soportaba operario por
   defecto).

Componente: `frontend/src/components/responsable/ProgresoFlotante.tsx`.

### `historial_ciclo_responsable` — tabla separada de `historial_ciclos`

**Decisión clave**: se descartó seguir metiendo al responsable en
`historial_ciclos` (la tabla compartida con operario) y se creó
`historial_ciclo_responsable` aparte. Motivo: mezclar los dos roles
dejaba columnas siempre `NULL` para responsable (`piezas_total`,
`piezas_por_formato` — el formato no es una métrica del responsable,
que supervisa varias líneas a la vez) y complicaba razonar qué columna
aplica a quién; con tablas separadas, si alguien cambia de rol en su
carrera, cada etapa cae sola en la tabla que le toca, sin lógica
especial.

Columnas: `id, usuario_id, cycle_id, fecha_cierre, puntos_ciclo,
m2_total, m2_contenedor, m2_com, m2_std, minutos_plena,
minutos_no_alimentada, minutos_saturacion, minutos_banco,
minutos_maquina, verificaciones_codbar, puntos_equipo_ciclo,
operario_gano_ciclo, turnos_trabajados, fuerza, resistencia, velocidad`
— unique (usuario_id, cycle_id). A propósito llevan el prefijo
`minutos_*` (no `tiempo_*` como en `historial_ciclos` de operario): son
tablas con vocabulario distinto, y `lib/logros.ts` sabe leer de una u
otra según el rol.

RLS: `select` para `usuario_id = auth.uid()` o `fn_rol_actual() in
('responsable', 'jefe', 'administrador', 'pantalla')` — cualquier
responsable ve las de los demás (para su propio Ranking), sin necesitar
el SELECT amplio del jefe. Escritura solo vía
`fn_cerrar_ciclos_pendientes` (security definer) o backfill manual.

Efecto colateral: se borraron las 23 filas de responsable que habían
quedado en `historial_ciclos` de la migración de v2 original. La
columna `rol` de `historial_ciclos` queda redundante (siempre
`'operario'` desde ahora) — limpieza pendiente, sin prisa (`07`).

### Vistas nuevas de agregación (responsable)

Mismo patrón del proyecto: sin `security_invoker`, calculables para
cualquier `cycle_id` (cerrado o en curso).

- `v_metros_responsable_ciclo` (ampliada) — ahora también m² por
  categoría (`m2_contenedor`, `m2_com`, `m2_std`), no solo `m2_total`.
- `v_tiempo_responsable_ciclo` (ampliada) — los 5 tiempos por
  separado, no solo el total combinado.
- `v_verificaciones_codbar_responsable_ciclo` — cuenta partes con
  `verificacion_codbar_estado in ('completo','parcial','manual')`
  (excluye `no_realizada`), por `responsable_id, cycle_id`.
- `v_operarios_de_responsable_ciclo` — operarios con al menos un parte
  con `responsable_id` = este responsable en ese ciclo (relación real
  de trabajo vía `parte.operario_id`+`parte.responsable_id`, **nunca
  por letra** — ver "Por qué no usan letra" más abajo).
- `v_puntos_equipo_responsable_ciclo` — a partir de la anterior, suma
  de puntos de esos operarios y si alguno ganó el ranking de ese ciclo.
- `v_partes_operario_ciclo` (para operario) — partes completados y
  vigentes por `operario_id, cycle_id`; cuenta doble a propósito si el
  mismo día trabaja 2 líneas (2 filas de `parte`).
- `v_turnos_responsable_ciclo` — cuenta `turno` por
  `turno.abierto_por, cycle_id`. Literal, no partes.
- `v_equipo_avatar_stats` — junta `personaje_rpg` (avatar activo) con
  `personaje_stats_nivel` (stats **congeladas** del nivel de esa
  carta) — primera vista del proyecto que expone stats congeladas en
  vez de en vivo. Si el nivel de la carta activa aún no tiene fila en
  `personaje_stats_nivel`, sale `null` en las 4 stats (se trata como
  "sin avatar" en la UI).
- `v_ganador_por_ciclo_responsable` + `v_veces_lider_indiscutible` —
  equivalentes de responsable a `v_ganador_por_ciclo`/
  `v_veces_rey_de_reyes` del operario; base del logro "Líder
  indiscutible".

### Backfill de datos históricos desde v2 (responsable)

v2 guardaba el detalle por turno en `responsable_ledger` (una fila por
turno, m² por categoría + 5 tiempos por separado); se exportó completo
(393 filas, 4 responsables: hectorn/radu/valentina/joaquina — el 5º
usuario de v2, literalmente llamado "responsable", no se migró) y se
recalculó el `cycle_id` real de cada fila con `fn_ciclo_id()` (sin
asumir ningún offset fijo entre la numeración de v2 y v3: los ciclos de
v2 no se correspondían 1:1 con los de v3 por fechas). Resultado: **23
filas** (6 ciclos × 4 responsables, menos 1 — a joaquina le falta el
ciclo 1 porque sus turnos en v2 empezaron después de que ese ciclo ya
hubiera cerrado; correcto). `cycle_id` de 1 a 6, nunca 0 ni 7. Después,
backfill aparte de `turnos_trabajados` para esas mismas 23 filas
(contando filas del CSV agrupadas por usuario+ciclo).

**No se pudo recuperar de v2** (quedan a 0/false en los ciclos 1-6,
correcto que así sea): `verificaciones_codbar`, `puntos_equipo_ciclo`,
`operario_gano_ciclo` — v2 no tenía `lote`/`parte` a nivel de fila
equivalente a v3. Empiezan a contar de verdad desde el ciclo 7. Mismo
problema para operario con cualquier métrica basada en `parte`: v3.parte
no tiene filas anteriores al 23/08/2026.

### Pestaña "Equipo"

**"Tus operarios"** = los de tu **misma letra fija** (A/B/C/D), no los
del turno de hoy (la letra es estable, el turno cambia a diario). El
responsable aparece él mismo a la cabeza de la lista (👑). Cada uno
muestra avatar + las 4 barras **congeladas del nivel de la carta
activa** (no en vivo) — primera pantalla de la app con stats congeladas
en vez de en vivo, pintadas en miniatura sobre la propia imagen. Sin
avatar generado: icono genérico + nombre + nivel, sin barras.

Archivos: `frontend/src/lib/equipo.ts`,
`frontend/src/components/responsable/EquipoScreen.tsx`.

### Historial de partes propio

Reutiliza `VistaDetalladaScreen` del jefe tal cual (mismo acordeón
turno → línea → parte), con el filtro de responsable fijado al propio
usuario y oculto (prop opcional `responsableFijo?: string`, `undefined`
por defecto para no afectar a jefe/admin). No hizo falta RLS nueva: el
responsable ya tenía el mismo SELECT amplio que el jefe sobre
`parte`/`turno`/`incidencia_*`. Vive como 4ª pestaña de arriba
("Historial"), no dentro del panel de Progreso — es dato de trabajo, no
de gamificación.

Archivo: `frontend/src/components/responsable/HistorialResponsableScreen.tsx`
(envoltorio de una línea sobre `VistaDetalladaScreen`).

### Ranking de responsables

Mismo componente visual que el del operario (podio 1º-3º + resto
listado), pero con solo 4 personas el podio siempre se llena entero
(nunca "quedas fuera del top 5"). **Sin Reyes del formato** — el
responsable no tiene desglose por formato.

Archivo: `frontend/src/components/responsable/RankingResponsableScreen.tsx`.
Funciones nuevas en `lib/ranking.ts`:
`obtenerPodioResponsablesCicloActual`/`obtenerPodioResponsablesCicloAnterior`
(mismo patrón que las de operario, sobre `v_puntos_responsable_ciclo`
en vivo / `historial_ciclo_responsable` cerrado).

### Ranking — partes/turnos + "pts por unidad" (paridad con v2)

Añadido a ambos rankings (operario y responsable): bajo los puntos de
cada entrada (podio, 4º+, y "Tú") se muestra:
- Operario: `{cantidad} partes · {pts/p} pts/p` — cantidad = partes
  completados ese ciclo (cuenta doble si un día trabaja 2 líneas).
- Responsable: `{cantidad} turnos · {pts/t} pts/t` — cantidad = turnos
  abiertos ese ciclo (`turno.abierto_por`, literal).

`pts/p` o `pts/t` = puntos del ciclo / cantidad, `null` si cantidad es
0. `EntradaPodio` (`lib/ranking.ts`) ganó `cantidad: number` y
`ptsPromedio: number | null`; las 4 funciones de podio los rellenan.

## Niveles (9, compartidos)

Tabla `niveles` (contenido de v2): nombre, descripción, umbrales,
color, estrellas, aura, `prompt_base`, `prompt_imagen`. El responsable
usa los mismos 9 niveles con umbrales **×1,5** — columnas generadas
`umbral_min_responsable`/`umbral_max_responsable` (no hay tabla aparte:
evita que se editen unos umbrales y se olviden los otros). Motivo del
×1,5: el responsable suma ~60 pts/turno frente a ~33,5 del operario;
sube algo más rápido (~450 turnos a Leyenda vs ~537) pero no
desproporcionado.

| Nivel | Operario | Responsable |
|---|---|---|
| 1. Aprendiz | 0–499 | 0–749 |
| 2. Operario | 500–1.499 | 750–2.249 |
| 3. Especialista | 1.500–2.999 | 2.250–4.499 |
| 4. Veterano | 3.000–4.999 | 4.500–7.499 |
| 5. Maestro | 5.000–7.499 | 7.500–11.249 |
| 6. Elite | 7.500–10.499 | 11.250–15.749 |
| 7. Supremo | 10.500–13.999 | 15.750–20.999 |
| 8. Titan | 14.000–17.999 | 21.000–26.999 |
| 9. Leyenda | 18.000–∞ | 27.000–∞ |

`fn_nivel_actual(usuario_id)` resuelve nivel actual según rol.

## Logros del operario — 19, 100 % por consulta

`logros_definicion` con los 19 logros reales de v2 (sembrados
23/08/2026, `20260823170000_seed_logros_definicion.sql`, confirmado en
real 24/08). Motor genérico en `lib/logros.ts` que resuelve cada fila
por `condicion_tipo`; nada hardcodeado por nombre. No hay tabla de
progreso (`operario_logro` se eliminó): solo importa cuántas veces se
tiene / en qué tramo va.

- **16 de tramo** (acumulado de por vida, se repite cada N):
  `sum(columna)/condicion_valor` sobre `historial_ciclos` + ciclo
  actual en vivo (`v_produccion_operario_ciclo`). m² total, 5 tiempos,
  m² por categoría ×3, piezas por formato ×7 (`formato_nombre`).
- **3 de ciclo**: Bestia del Ciclo (600+ pts), Ciclo Legendario
  (1.000+ pts — sustituye al "Turno Legendario" de v2), Rey de Reyes
  (1º del ranking del ciclo, `v_ganador_por_ciclo` /
  `v_veces_rey_de_reyes`, sin `condicion_valor`).

## Logros del responsable — 18, sembrados y funcionando

Mismo motor genérico (`logros_definicion`, columna `rol` ya prevista
desde el 22/08/2026) y mismo `lib/logros.ts`, con una rama completa
para `rol='responsable'` además de la de operario.

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

| Nombre | `condicion_tipo` | Umbral | Icono |
|---|---|---|---|
| Bestia del Ciclo | `bestia_ciclo_responsable` | 650 pts | ⚡ |
| Ciclo Legendario | `ciclo_legendario_responsable` | 780 pts | 🔥 |
| Líder indiscutible | `lider_indiscutible` | (sin umbral, 1º del ranking) | 👑 |

**Ciclo — umbral de una columna cruda en un solo ciclo** (mecánica
nueva, no existía para operario):

| Nombre | `condicion_tipo` | Columna comparada | Umbral |
|---|---|---|---|
| El Manitas | `manitas_ciclo` | `minutos_plena` | 54.000 (900h) |
| El salvador | `salvador_ciclo` | `m2_total` | 400.000 |

**Equipo** (cruce con los operarios reales de ese ciclo, nunca por letra):

| Nombre | `condicion_tipo` | Umbral |
|---|---|---|
| Creador de Héroes | `creador_de_heroes` | (sin umbral, columna `operario_gano_ciclo`) |
| El Equipo A | `equipo_a` | 3.000 pts (columna `puntos_equipo_ciclo`) |

**18 en total** (11 de tramo + 5 de ciclo/puntos + 2 de equipo).

**Umbrales calibrados con datos reales**, no copiados del operario: con
6 ciclos de backfill, m2_std ya rondaba 950k-1,12M en los 4
responsables; m2_com solo 32k-46k; m2_contenedor 50k-62k — categorías
naturalmente muy distintas entre sí como fracción de la producción
total. Se subió El Rey de la Calidad a 2M (con 1M, 2 de los 4 ya lo
habrían tenido el día 1) y se bajaron Magnate Comercial/Destructor a
150k cada uno (con 1M tardarían 8-12 años). La fábrica lleva meses a
medio gas (un horno parado por precio del gas/bajada de ventas); con
los 4 hornos a pleno estos umbrales serán menos desproporcionados de
lo que parecen ahora.

**Por qué "Creador de Héroes"/"El Equipo A" no usan letra**: el primer
diseño comparaba contra la letra ACTUAL del operario/responsable, pero
si alguien cambia de letra con el tiempo eso atribuiría retroactivamente
logros a quien no correspondía en su momento (ej. un operario que se
une a una letra DESPUÉS de haber ganado un ciclo en otra, "regalaría"
el logro al nuevo responsable). Solución: `puntos_equipo_ciclo` y
`operario_gano_ciclo` en `historial_ciclo_responsable` se **congelan al
cerrar cada ciclo**, calculadas a partir de con quién trabajó de
verdad ese responsable ese ciclo (`parte.responsable_id` +
`parte.operario_id`, la relación real de trabajo), no de la letra que
tengan hoy. Mostrar los logros de un responsable nunca vuelve a tocar
`parte` — solo el ciclo en vivo (aún sin cerrar) consulta la vista
correspondiente, igual que el resto de métricas.

## Cierre de ciclo

`fn_cerrar_ciclos_pendientes()` — recorre todo `cycle_id` anterior al
actual y escribe la foto del ciclo: para operarios en
`historial_ciclos` (puntos totales y por categoría,
fuerza/resistencia/velocidad, m², piezas, tiempos, m² por categoría,
piezas por formato), para responsables en `historial_ciclo_responsable`
(m² por categoría, los 5 tiempos, verificaciones_codbar,
puntos_equipo_ciclo, operario_gano_ciclo, turnos_trabajados,
fuerza/resistencia/velocidad — todas las columnas de la sección
"Gamificación del responsable" de más arriba). El bloque de operario no
cambió al separar las tablas (sesión 25/08/2026); solo el de
responsable, que ahora apunta a su tabla propia. Idempotente en los dos
bloques (`on conflict do update`): la misma llamada sirve para
"recalcular ciclo anterior" (`09`). Disparada por el cron
`cerrar-ciclos-pendientes` (lunes 8:00 Madrid, detalle en `05`); si el
cron falla un lunes, el siguiente cierra lo que falte.

**Ojo (revisado 26/08/2026)**: la versión final de la función (tras
las reescrituras del 25/08 al añadir columnas a
`historial_ciclo_responsable`) ya **no tiene ningún `not exists`**: el
bucle recorre todo `cycle_id` anterior al actual con datos en las
vistas en vivo, y el `on conflict do update` sobrescribe la fila
exista o no. Ya no distingue "cerrar por primera vez" de "recalcular
un ciclo a propósito" — ambos casos hacen lo mismo.

En la práctica esto no es un riesgo: para que se sobrescriba un ciclo
migrado de v2 (1-6) haría falta que alguien abra el cierre de fábrica
antes de tiempo, se complete un parte con fecha ≤ 30/08, y corra la
función antes de borrar ese parte — `fn_bloquear_turno_en_cierre`
bloquea la creación de turnos (y por tanto de partes) en cualquier
rango de `cierre_fabrica`, admin incluido, así que no puede ocurrir
por accidente mientras el cierre esté activo. A partir del 31/08 el
ciclo actual siempre será ≥7, así que el bucle no vuelve a tocar los
ciclos 1-6 en ningún caso futuro.

Si algún día se quiere blindar estructuralmente (para que
"recalcular ciclo anterior" nunca pueda alcanzar un ciclo migrado),
la opción más simple es restringir el bucle a
`v_cycle_id = v_ciclo_actual - 1`. No implementado, prioridad baja.

**Nota de tipos**: la inicialización interna
`v_ciclo_actual := fn_ciclo_id(now()::date)` necesita el cast explícito
— `fn_ciclo_id` espera `date`, no `timestamptz`, y sin el cast la
función falla con `function fn_ciclo_id(timestamp with time zone) does
not exist` (bug real encontrado y corregido en la sesión 25/08/2026,
introducido al reconstruir la función de memoria en un paso
intermedio; en el resto del proyecto siempre se llama con
`fn_ciclo_id(t.fecha)` o `fn_ciclo_id(current_date)`, nunca con
`now()` a pelo).

## Stats: fuerza / resistencia / velocidad / vida

- `fuerza = m2_total / 1000`, `resistencia = (tiempo_plena +
  tiempo_no_alimentada) / 100` — como v2, sin techo.
- `velocidad = m2_total / tiempo_plena` (m²/min de máquina
  produciendo). Corrige a v2, que usaba una media ponderada arbitraria
  y la sumaba parte a parte. Nunca se suma: se recalcula desde totales
  (por ciclo al cerrar; de por vida en `v_stats_vida` sumando m² y
  `tiempo_plena` por separado).
- `vida` = puntos totales de por vida (los que deciden el nivel),
  expuesto con ese nombre para tratar los 4 stats uniformemente.

`v_stats_vida` (histórico + ciclo en vivo, cualquier rol) expone
además `m2_total_vida` y `horas_plena_vida` en crudo. Para el
responsable: `v_tiempo_responsable_ciclo`.

**Fix 02/09/2026**: mismo bug que `v_puntos_responsable_total_vida`
(25/08), pero en `v_stats_vida` — el CTE `historico` seguía sumando
solo sobre `historial_ciclos`, vacío de filas de responsable desde la
separación a `historial_ciclo_responsable`. Efecto real: para un
responsable, la parte histórica de fuerza/resistencia daba 0 — "vida"
reflejaba solo el ciclo en vivo actual. Como fuerza y resistencia se
mueven en proporciones parecidas dentro de un único ciclo, las dos
barras se veían casi iguales entre sí (síntoma reportado: "parece que
se hubieran promediado"). Arreglo: `historico` ahora une
`historial_ciclos` (operario) + `historial_ciclo_responsable`
(responsable, con su propio vocabulario de columnas — `minutos_plena`/
`minutos_no_alimentada` en vez de `tiempo_plena`/`tiempo_no_alimentada`).

**Ratio fuerza responsable vs operario (verificado 02/09/2026, no es
bug)**: con el reparto real de la fábrica (~48.000 m²/día entre 12-14
operarios vs 3 responsables), el ratio medio observado es ~4,75x —
coherente con lo esperado. `fuerza` del responsable es un agregado del
equipo bajo su supervisión (`v_metros_responsable_ciclo`), no una
cifra per cápita — decisión consciente, no una fórmula distinta a la
del operario (ambas dividen entre 1000; solo cambia el origen del
`m2_total`).

## Snapshot de stats por nivel y generaciones

**Problema**: la carta de personaje de un nivel debe mostrar los stats
que tenía el usuario **al alcanzar ese nivel**, no los del momento de
generar (la generación es manual y puede retrasarse semanas).

**Solución** (`20260823100000` + `20260823150000`): tabla
`personaje_stats_nivel` — una fila por `(usuario_id, nivel_id)` con los
4 stats congelados y `generaciones_usadas` (0–3). **La existencia de
la fila es el estado "nivel otorgado"**, y cada nivel alcanzado lleva
sus propias 3 generaciones de personaje. No hay contador plano
(`usuario.generaciones_disponibles` queda sin significado; ver `07`).

Se descartó un trigger que detectase "cruzar X puntos": los puntos no
tienen un único punto de mutación (parte, checklist, cierre de ciclo)
y un contador persistido volvería a desincronizarse como en v2. En su
lugar **el administrador otorga el nivel a mano**: `fn_otorgar_bonus_nivel(usuario_id)`
guarda el snapshot del nivel actual (idempotente; si ya tenía fila,
`otorgado=false`). Vista de apoyo `v_admin_usuarios_gamificacion`
(puntos, siguiente nivel, `bonus_nivel_actual_otorgado`). Pantalla
construida y probada en real (`admin/GamificacionScreen.tsx` +
`lib/admin-gamificacion.ts`, sesión 24/08/2026; botón verificado con
un responsable el 25/08 tras el fix de `#variable_conflict`).

**Estado de la función tras la reparación de la sesión 25/08/2026**
(migración `20260825100000_fix_bonus_nivel.sql` +
`20260825200000_fix_ambiguedad_nivel_id.sql`):
- Las stats que congela siguen siendo las **en vivo del momento en que
  el admin pulsa** (`v_stats_vida` + puntos totales), no las del
  instante exacto en que el usuario cruzó el umbral. Se da por
  mitigado en la práctica: el administrador entra a diario, así que el
  desfase entre cruzar el umbral y otorgar el nivel nunca es mayor de
  un día.
- La llamada muerta a `fn_otorgar_generaciones_por_nivel` (escribía en
  el contador plano `usuario.generaciones_disponibles`, sin uso) se
  quitó del cuerpo de la función.
- `velocidad` ahora se inserta con `coalesce(v_velocidad, 0)`, igual
  que los otros 3 stats — ya no se congela un `null` para un usuario
  con `tiempo_plena = 0`.
- **Bug encontrado y reparado aparte** (preexistente desde el
  23/08/2026, sin relación con el refactor anterior): la función
  declara `returns table (otorgado boolean, nivel_id uuid, nivel_nombre
  text)`, y el parámetro de salida `nivel_id` colisiona de nombre con
  la columna `personaje_stats_nivel.nivel_id` usada dentro del propio
  `INSERT`/`ON CONFLICT` — PL/pgSQL no podía decidir a cuál de los dos
  te referías (`column reference "nivel_id" is ambiguous`, Postgres
  `42702`). Nadie lo había disparado hasta la sesión del 25/08 porque
  nunca se había pulsado el botón "otorgar nivel" para nadie (los
  operarios ya traían generaciones desde el seed/backfill inicial).
  Arreglo: `#variable_conflict use_column;` como primera línea del
  cuerpo, antes de `declare` — le dice a PL/pgSQL que ante esa
  ambigüedad prefiera siempre la columna de la tabla; dentro del
  cuerpo nunca se usa el parámetro de salida por su nombre pelado, solo
  la variable local `v_nivel_id`, así que es seguro al 100 %.
  Verificado en real con un responsable; pendiente confirmar también
  con un operario (probablemente nunca se había disparado ahí tampoco,
  por el mismo motivo — no confirmado explícitamente).

## Personaje RPG

**Proveedor**: GPT Image 2 (`gpt-image-2`, `images/edits` con imagen
de referencia). Constantes en `_shared/openai_images.ts`: `IMAGE_SIZE`
672x1008, `IMAGE_QUALITY` medium — 2-5 céntimos por generación,
calidad muy por encima de lo esperado. **Historia** con DeepSeek
(`_shared/deepseek_historia.ts`).

**Flujo** (pantalla Stats+Avatar, `StatsAvatarOperarioScreen.tsx`,
`lib/stats-avatar.ts`, función `generarPersonajeParaNivel`):
1. El operario elige **el nivel** (de los ya alcanzados con
   generaciones restantes, `v_niveles_disponibles_generar`) y
   **cualquier imagen de su galería** (no se le pide foto en fábrica,
   "les incomoda") + texto libre opcional.
2. Cliente: `procesarFotoLibre` (1024 px, WebP) → Cloudinary preset
   `motiv_v3_personajes`.
3. Edge Function `generar-personaje` (`05`): consume 1 generación de
   ese nivel (`fn_consumir_generacion_nivel`), lee los stats congelados
   de `personaje_stats_nivel`, compone el prompt = `niveles.prompt_imagen`
   + `PROMPT_ESTILO_Y_SEGURIDAD` (código) + texto del operario, llama
   a GPT Image 2, sube a Cloudinary, genera la historia con DeepSeek
   (`prompt_base` + `prompt_imagen` + 4 stats + texto; máx. 3 frases
   cortas, humor de fábrica) y guarda con `fn_guardar_personaje_generado`
   (atómico: el nuevo pasa a `seleccionada`). Si DeepSeek falla no
   lanza: guarda historia `null` y responde `historia_pendiente: true`
   (el admin la rellena a mano; sin reintento). Si falla la imagen,
   devuelve la generación (`fn_devolver_generacion_nivel`).
4. `fn_seleccionar_personaje` (cliente, `auth.uid()`) permite cambiar
   entre los ya generados.

`PROMPT_ESTILO_Y_SEGURIDAD` pide retrato vertical **fotorrealista** de
la persona convertida en personaje RPG, con fidelidad de rasgos y
coherencia con la progresión de niveles; excluye logos/IP de la foto
y contenido sexual/violento. (Una versión antigua de este doc decía
"estilo ilustrado, nunca fotorrealismo" — no es lo que hace el prompt.)

**Generación siempre manual**: nunca se dispara sola al subir de nivel.

## Pantallas del operario (sub-vistas de Inicio, ver `03`)

- **Ranking** (`RankingOperarioScreen.tsx`, `lib/ranking.ts`): toggle
  ciclo actual/anterior; podio 1º-3º (con avatar del personaje activo
  vía `v_avatar_activo_operario`) + 4º-5º + "tú" si quedas fuera del
  top 5. Debajo **Reyes del formato**: histórico (récord de un solo
  parte, `v_rey_formato_historico`, con empates; apoyado en
  `parte.formato_id` denormalizado + `idx_parte_formato_record`),
  actual (más piezas en el ciclo, `v_rey_formato_actual`) y "tu marca"
  por formato (`v_mi_mejor_parte_por_formato`).
- **Stats+Avatar** (`StatsAvatarOperarioScreen.tsx`): 4 barras en vivo
  (`v_stats_vida` + puntos), 6 tramos logarítmicos (10 … 1.000.000)
  para fuerza/resistencia/vida y rango 6-11 para velocidad, color fijo
  por stat. Debajo, avatar activo + historia + gestión (elegir /
  generar) — la imagen lleva overlay de stats CONGELADAS (icono +
  número + barra, `v_equipo_avatar_stats`) superpuesto sobre la propia
  carta (02/09/2026, mismo patrón que `BarritasOverlay` de Equipo; no
  se pinta si el nivel de la carta activa aún no tiene fila en
  `personaje_stats_nivel` — mismo criterio en toda la app).
- **Logros** (`LogrosOperarioScreen.tsx`): bloqueado = icono apagado
  + "???"; tramo = contador ×N + barra al siguiente; ciclo = solo ×N.

## Datos migrados de v2

Script de un solo uso (`scripts/migrar_v2_historial.sql`), más los
backfills puntuales de responsable de la sesión 25/08/2026.
- **Operarios** (23/08): 19 reales (`operario1` era de pruebas),
  recalculados parte a parte con fórmulas de v3, cruzados por
  `username`. 100 filas en `historial_ciclos`. `personaje_stats_nivel`
  reconstruido simulando cuándo cruzó cada uno cada umbral (nadie pasa
  de nivel 3; Aprendiz excluido, no es una "subida"; 3/3 generaciones).
- **Responsables — versión final (25/08)**: las 23 filas que se habían
  migrado el 24/08 a `historial_ciclos` (desde `turnos` de v2,
  recalculando solo `puntos_metros` + rendimiento) se borraron al
  crear `historial_ciclo_responsable`, y se rehizo el backfill desde
  `responsable_ledger` de v2 — que sí guardaba el detalle fino por
  turno (m² por categoría + 5 tiempos por separado) — con el `cycle_id`
  real recalculado por `fn_ciclo_id()` en vez de asumir un offset fijo
  (los ciclos de v2 no se correspondían 1:1 con los de v3 por fechas).
  `hectorn`, `radu`, `valentina`, `joaquina` (la cuenta genérica
  `responsable` de v2, un 5º usuario, se dejó fuera). Resultado: **23
  filas** en `historial_ciclo_responsable` (6 ciclos × 4 responsables,
  menos 1 — a joaquina le falta el ciclo 1 porque sus turnos en v2
  empezaron después de que ese ciclo ya hubiera cerrado; correcto).
  Backfill aparte de `turnos_trabajados` para esas mismas 23 filas
  (contando filas del CSV agrupadas por usuario+ciclo). No se pudieron
  recuperar de v2 (quedan a 0/false en los ciclos 1-6, correcto):
  `verificaciones_codbar`, `puntos_equipo_ciclo`, `operario_gano_ciclo`
  — v2 no tenía `lote`/`parte` a nivel de fila equivalente a v3.
  `personaje_stats_nivel` reconstruido para los 4 responsables reales
  (`hectorn`, `radu`, `valentina`, `joaquina`) — sesión 26/08/2026,
  mismo criterio que los operarios: se recorren los ciclos 1-6 ya
  migrados de `historial_ciclo_responsable` en orden, y por cada nivel
  cuyo umbral (`umbral_min_responsable`) queda cruzado por el
  acumulado tras un ciclo, se inserta el snapshot con los totales
  acumulados HASTA ESE CICLO (no los de hoy) — fuerza/resistencia/
  velocidad recalculadas desde los acumulados, vida = puntos
  acumulados, 3/3 generaciones. Verificado en real: los 4 ya
  disponían de sus generaciones por nivel desde su propio perfil.
- **Renumeración**: con el ancla en 31/08 los ciclos de v2 salían
  negativos (y `fn_ciclo_id(hoy)` también). Se hizo
  `update historial_ciclos set cycle_id = cycle_id + 7 where cycle_id < 0`
  (y el equivalente sobre el backfill de responsable) y se movió el
  ancla a 2026‑02‑16 (7 ciclos antes). Ciclos migrados resultantes:
  **1..6** (no hay ciclo 0), 100 filas de operario en `historial_ciclos`
  y 23 de responsable en `historial_ciclo_responsable` — comprobado en
  BD 25/08/2026. `fn_ciclo_id('2026-08-31') = 7` y
  `fn_ciclo_id('2026-08-30') = 6`: el ciclo 7 (el primero realmente en
  vivo) arranca justo el día del relanzamiento, nada que ajustar en el
  ancla. Consecuencias sobre la rotación en `01`.

## Pendiente (detalle en `07`)

- Pantalla del admin para otorgar niveles (`fn_otorgar_bonus_nivel` y
  `v_admin_usuarios_gamificacion` ya listos en BD).
- `personaje_stats_nivel` reconstruido para los 4 responsables
  migrados de v2
- Limpiar la columna `rol` de `historial_ciclos` (queda redundante,
  siempre `'operario'` desde que el responsable se separó a su propia
  tabla) — no urgente.
- Confirmar que el botón "otorgar generaciones" también funciona para
  operarios tras el fix de `#variable_conflict` de
  `fn_otorgar_bonus_nivel` (probablemente sí — nunca se había
  disparado el bug con ellos porque ya venían con generaciones desde
  el seed inicial — no confirmado explícitamente).
