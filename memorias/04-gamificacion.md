# 04 — Gamificación

Estado: **operario construido y probado en real** (puntos, niveles,
cierre de ciclo, stats, 19 logros sembrados, personaje RPG, datos de
v2 migrados). **Responsable**: puntos, niveles, cierre de ciclo y datos
de v2 construidos en BD; sin pantalla de gamificación y sin logros
propios (no existían en v2; hay que crearlos). Ver "Pendiente" al final.

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
`v_puntos_responsable_ciclo`. Sin desglose por categoría en
`historial_ciclos` todavía (fase 2).

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

Columna `rol` (default `operario`) lista para los logros del
responsable, que hay que diseñar desde cero.

## Cierre de ciclo

`fn_cerrar_ciclos_pendientes()` — recorre todo `cycle_id` anterior al
actual **sin fila en `historial_ciclos`** y escribe la foto del ciclo
para operarios y responsables (puntos totales y por categoría,
fuerza/resistencia/velocidad, m², piezas, tiempos, m² por categoría,
piezas por formato). Idempotente (`on conflict do update`): la misma
llamada sirve para "recalcular ciclo anterior" (`09`). Disparada por el
cron `cerrar-ciclos-pendientes` (lunes 8:00 Madrid, detalle en `05`);
si el cron falla un lunes, el siguiente cierra lo que falte.

**Ojo**: el `not exists` es a nivel de `cycle_id`, no por usuario. Si
un ciclo ya tiene alguna fila (p. ej. por migración de datos) el cron
lo salta entero; producción real de ese ciclo habría que cerrarla a
mano. No aplica al ciclo 6 (fábrica parada hasta el 31/08).

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
(puntos, siguiente nivel, `bonus_nivel_actual_otorgado`). La pantalla
del admin que llama a esto **no está construida** (`07`).

Tres cosas comprobadas en el código real de la función (24/08/2026):
- Las stats que congela son las **en vivo del momento en que el admin
  pulsa** (`v_stats_vida` + puntos totales), no las del instante en que
  el usuario cruzó el umbral. Nadie las pierde por un despiste, pero un
  retraso del admin **infla** el snapshot con producción posterior, que
  es justo lo que el diseño quería evitar. Mitigación práctica: otorgar
  a diario.
- Tras insertar la fila llama a `fn_otorgar_generaciones_por_nivel`,
  que escribe en `usuario.generaciones_disponibles`, el contador plano
  que ya no lee nadie. Llamada muerta: las 3 generaciones reales salen
  de `personaje_stats_nivel.generaciones_usadas` (default 0) al crearse
  la fila. Inofensiva pero engañosa (`07`).
- `velocidad` se inserta sin `coalesce`, a diferencia de los otros 3
  stats: un usuario con `tiempo_plena = 0` congelaría un null.

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
  generar).
- **Logros** (`LogrosOperarioScreen.tsx`): bloqueado = icono apagado
  + "???"; tramo = contador ×N + barra al siguiente; ciclo = solo ×N.

## Datos migrados de v2

Script de un solo uso (`scripts/migrar_v2_historial.sql`). Solo dos
tablas tocadas: `historial_ciclos` y `personaje_stats_nivel`.
- **Operarios** (23/08): 19 reales (`operario1` era de pruebas),
  recalculados parte a parte con fórmulas de v3, cruzados por
  `username`. 100 filas en `historial_ciclos`. `personaje_stats_nivel`
  reconstruido simulando cuándo cruzó cada uno cada umbral (nadie pasa
  de nivel 3; Aprendiz excluido, no es una "subida"; 3/3 generaciones).
- **Responsables** (24/08): `hectorn`, `radu`, `valentina`, `joaquina`
  (la cuenta genérica `responsable` de v2 se dejó fuera), desde
  `turnos` de v2 recalculando `puntos_metros` + rendimiento por turno.
  Ciclo 6 incompleto (el export llega al 09/08) y el ciclo 1 solo tiene
  3 de los 4. `personaje_stats_nivel` NO reconstruido para ellos (`07`).
- **Renumeración**: con el ancla en 31/08 los ciclos de v2 salían
  negativos (y `fn_ciclo_id(hoy)` también). Se hizo
  `update historial_ciclos set cycle_id = cycle_id + 7 where cycle_id < 0`
  y se movió el ancla a 2026‑02‑16 (7 ciclos antes). Ciclos migrados
  resultantes: **1..6** (no hay ciclo 0), 100 filas de operario y 23 de
  responsable — comprobado en BD 24/08/2026. Consecuencias sobre la
  rotación en `01`.

## Pendiente (detalle en `07`)

- Gamificación del **responsable** en su app: reutilizaría
  `lib/gamificacion.ts` y el patrón de `inicio-gamificacion`/`ranking`/
  `stats-avatar`, pero necesita diseño propio (sin piezas/limpieza,
  sin Reyes del formato, logros por crear).
- Logros del responsable (`logros_definicion.rol = 'responsable'`).
- Pantalla del admin para otorgar niveles.
