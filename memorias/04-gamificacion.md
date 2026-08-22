# 04 — Gamificación

Estado (actualizado 22/08/2026): **construido y probado en real** —
vistas de puntos completas (rendimiento + piezas + limpieza, operario
y responsable), cierre de ciclo (`fn_cerrar_ciclos_pendientes` + cron
semanal), niveles sembrados, `fuerza`/`resistencia`/`velocidad`,
generación de personaje RPG (GPT Image 2), y la pantalla de Inicio del
operario que muestra todo lo anterior. Queda por construir: la
pantalla de Inicio del **responsable** (mismo patrón, reutilizando
`frontend/src/lib/gamificacion.ts` tal cual), Ranking/Stats/Logros
como pestañas propias, y logros del responsable (fase 2, aplazado a
propósito). El resto de este archivo describe cómo funciona todo lo
ya construido.

## Principios (cerrados)

- Los datos crudos del parte (piezas, minutos) **nunca se corrigen ni
  se recalculan** para gestión; el jefe los ve tal cual. Solo la capa
  de puntos aplica fórmulas.
- Los puntos **no se guardan resueltos por parte**: se calculan al
  consultar, agregando los partes vigentes por línea+turno. Evita el
  total desincronizado de v2.
- Totales de por vida = suma de "fotos" de ciclos cerrados
  (`historial_ciclos`) + ciclo actual en vivo. La foto la escribe
  `fn_cerrar_ciclos_pendientes` (construida, ver sección "Cierre de
  ciclo" más abajo) y la puede regenerar el admin llamando a la misma
  función a mano (es idempotente).
- **Reparto igualitario vs. atribución directa** (decisión de sesión
  22/08/2026): los **puntos** (rendimiento, piezas) se reparten a
  partes iguales entre los `operario_id` de una línea+turno cuando hay
  más de uno, porque hace falta combinar primero para poder resolver
  UN tramo no-lineal sobre el % o la cantidad conjunta. Las
  **cantidades en bruto** que alimentan los logros de tramo (m²,
  piezas, tiempos) NO se reparten — se atribuyen **directamente** por
  `parte.operario_id`, porque cada parte ya es de quien es y no hay
  ningún tramo que combinar antes. Es lo correcto que no vayan
  cambiando de operario a cada rato.

## Ciclo

28 días desde `fecha_inicio_rotacion`, `fn_ciclo_id(fecha)` =
`floor((fecha − inicio)/28)`. Nunca se pausa. Primer cierre: 28/09/2026.

Como 28 es múltiplo exacto de 7 y `fecha_inicio_rotacion` es un lunes,
**cada ciclo termina siempre en domingo y el siguiente arranca siempre
en lunes** — propiedad matemática permanente, no coincidencia de este
ciclo. Es la base del cron de cierre (ver más abajo).

## Puntos del operario (por línea+turno, repartidos entre quien trabajó ahí)

**Fuente del operario: `parte.operario_id`, siempre** (decisión sesión
19/08/2026, ver `CLAUDE.md`). `asignacion_operario_linea` no interviene
en el cálculo de puntos — es solo la semilla que copia el responsable
al crear cada parte. `operario_ledger`, la vista base de todo este
cálculo, **hoy todavía hace JOIN con `asignacion_operario_linea`** para
resolver el operario; migrarla a `parte.operario_id` es trabajo
pendiente (`07-pendientes.md` #5).

Rendimiento y piezas se calculan agregados por línea+turno exactamente
igual que hasta ahora (fórmulas más abajo, sin cambios). El cambio está
en el último paso, la atribución: en vez de dar el resultado a "el"
operario de la línea+turno, se reparte a **partes iguales** entre los
`operario_id` distintos que tengan algún parte en esa línea+turno —
normalmente uno solo; si el responsable reasignó la línea a mitad de
turno, puede haber dos o más, y cada uno se lleva la misma fracción.

Se decidió no ponderar el reparto por minutos/tiempo trabajado:
reasignar una línea a mitad de turno es poco frecuente en la operativa
real y nunca tan desigual (p. ej. 7 h uno, 1 h otro) como para
justificar la complejidad de prorratear contra el suelo de 480 min del
cálculo de rendimiento (ver más abajo). El reparto plano es una
aproximación suficientemente justa para el caso excepcional, y mucho
más simple de mantener y de explicar en planta.

**Rendimiento** — construido en BD (`v_rendimiento_operario_por_turno`,
`v_puntos_rendimiento_operario_ciclo`):

```
denominador = max(480, Σ minutos_total) -- por línea+turno
numerador = Σ (minutos_plena + minutos_no_alimentada)
% = numerador / denominador
```
El `max()` funciona en las dos direcciones, no solo hacia abajo:

- **Si se reportan MENOS de 480 min** (línea sin parte durante parte
  del turno, tiempo muerto sin registrar): el denominador no baja de
  480, así que ese tiempo "invisible" cuenta en contra igual que si
  hubiera sido tiempo parado — evita que dividir solo entre lo poco
  reportado infle el % artificialmente.
- **Si se reportan MÁS de 480 min** (contador de la máquina sin
  resetear entre turnos — mismo caso que dispara el aviso no
  bloqueante `UMBRAL_MINUTOS_ATIPICO = 600` en
  `validaciones-parte.ts`, que se guarda igual): el denominador crece
  con el dato real y **diluye** el % hacia abajo, en vez de disparar
  un porcentaje absurdo. El suelo matemático absorbe la anomalía sin
  que haga falta detectarla ni corregirla a mano.

En ambos casos el resultado es el mismo objetivo: un % ajustado a la
realidad de un turno de 8h, tanto si se reportó de menos como de más.
Solo aplica cuando ya existe al menos un parte para esa línea+turno —
si una línea no tuvo ningún parte en todo el turno, no genera fila en
`operario_ledger` (no es que salga con 0%, es que no entra en el
cálculo).

Tabla `puntos_rendimiento` (operario, máx. 15), 6 tramos:

| % | Puntos |
|---|---|
| 0,00–24,99 | 1 |
| 25,00–37,49 | 2 |
| 37,50–49,99 | 5 |
| 50,00–62,49 | 9 |
| 62,50–74,99 | 12 |
| 75,00–100,00 | 15 |

Tramos contiguos, sin huecos.

**Piezas** — construida (`v_puntos_piezas_operario_por_linea_turno`,
`20260822150000_vistas_puntos_metros_piezas_limpieza.sql`), tabla
`puntos_piezas` (7 formatos × 5 tramos, 2/5/9/12/15 puntos), por
piezas totales de la línea+turno **y formato** (si cambia el formato a
mitad, cada formato se puntúa aparte y se suman ANTES de repartir
entre operarios). Mismo reparto igualitario que rendimiento si hay más
de un operario en esa línea+turno. El último tramo de cada formato
tiene `max = null` (sin límite superior).

| Formato | 2 | 5 | 9 | 12 | 15 (sin límite) |
|---|---|---|---|---|---|
| 200x1200 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | 12.000–13.999 | ≥14.000 |
| 300x1200 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | ≥12.000 |
| 600x1200 | 2.000–2.999 | 3.000–3.999 | 4.000–4.999 | 5.000–5.999 | ≥6.000 |
| 1200x1200 | 1.000–1.249 | 1.250–1.749 | 1.750–1.999 | 2.000–2.249 | ≥2.250 |
| 300x600 | 10.000–13.999 | 14.000–16.999 | 17.000–19.999 | 20.000–21.999 | ≥22.000 |
| 600x600 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | ≥12.000 |
| 900x900 | 1.500–2.199 | 2.200–2.999 | 3.000–3.799 | 3.800–4.499 | ≥4.500 |

**Limpieza** — construida (`v_puntos_limpieza_operario_por_turno`),
puntos según `checklist_items.puntos` de cada ítem marcado en
`operario_checklist` (no siempre 1 fijo por ítem — cada ítem tiene su
propio valor). Atribuida directamente por `operario_checklist.operario_id`
(quien marcó el ítem), sin relación con la asignación de línea ni con
el reparto anterior — cualquier operario del turno puede limpiar
cualquier línea. Se agrega **por turno completo**, no por línea (un
operario puede limpiar varias líneas distintas de las suyas).

**Total del operario** (por turno) = piezas (por línea) + rendimiento
(por línea) + limpieza (del turno completo, sin línea). Sumado en
`v_puntos_operario_total_vida` (ampliada 22/08/2026 para incluir
piezas y limpieza, antes solo rendimiento).

## Puntos del responsable (por turno completo, nunca por línea)

**Metros** — construida (`v_puntos_metros_responsable_por_turno` +
`v_metros_responsable_por_turno`), tabla `puntos_metros`, sobre m²
totales del turno (todas las líneas juntas), máx. 45 puntos, último
tramo sin límite superior (`21000, null, 45`). Mismo filtro que
`v_rendimiento_responsable_por_turno` (solo `vigente=true`, sin
`completado=true`) **a propósito** — para que "metros + rendimiento"
del responsable sigan contando exactamente el mismo conjunto de
partes. Si algún día se añade `completado=true` a una, hay que
añadirlo a la otra a la vez.

**Rendimiento** — construido en BD (`v_rendimiento_responsable_por_turno`,
`v_puntos_rendimiento_responsable_ciclo`), mismos principios que el
operario pero denominador 2880 min (6 líneas × 480) y escala propia,
máx. 45 puntos, 10 tramos:

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

**Total del responsable** (por turno) = metros + rendimiento. Sin
limpieza — esa capa es solo del operario. Sumado en
`v_puntos_responsable_total_vida` (nueva, 22/08/2026, análoga a la del
operario — hasta hoy solo existía la del operario).

## Niveles (9, compartidos por operario y responsable)

Tabla única `niveles` — 9 niveles reales (contenido de v2, sembrados
22/08/2026): nombre, descripción, umbrales de puntos totales, color de
marco, nº de estrellas, efecto de aura, y dos prompts (`prompt_base`,
`prompt_imagen`) usados para la generación del personaje RPG (ver más
abajo).

El responsable usa **los mismos 9 niveles** (mismo nombre, color,
estrellas, prompts), pero sus umbrales de puntos son **×1,5** los del
operario — decisión de sesión 22/08/2026: viendo que en v2 operario y
responsable progresaban a ritmo parecido, y que el responsable
consigue más puntos por turno de forma constante (60 vs. ~33,5 de
media del operario con la rotación entre líneas), un ×1,5 hace que el
responsable suba **sensiblemente más rápido pero no desproporcionado**
(sube en ~450 turnos hasta Leyenda, frente a ~537 del operario).

No existe una tabla `niveles_responsable` — se probó ese diseño y se
descartó: los umbrales del responsable no son datos independientes,
son siempre `umbral × 1,5` de forma fija, así que guardarlos en una
tabla aparte solo crearía el riesgo de que alguien edite un umbral del
operario y se olvide de actualizar el del responsable. En vez de eso,
`niveles` tiene dos columnas generadas (`umbral_min_responsable`,
`umbral_max_responsable`, `stored`, se recalculan solas) — mismo
patrón que `parte.calibre_std_pct`.

| Nivel | Umbral operario | Umbral responsable (×1,5) |
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

`fn_nivel_actual(usuario_id)` (nueva, 22/08/2026) devuelve el nivel
actual de cualquier operario o responsable, resolviendo sola qué
vista de puntos y qué columna de umbral usar según el rol.

## Logros — 19 del operario, 100% por consulta, sin tabla de progreso

Solo operario por ahora — logros del responsable son fase 2,
aplazados a propósito hasta tener estos 19 funcionando en real.

Con "Ciclo Legendario" (48 pts/turno → 1.000 pts/ciclo) sustituyendo a
"Turno Legendario" del CSV original de v2, los 19 logros no necesitan
ningún motor que escriba nada — se calculan siempre al vuelo. Por eso
**`operario_logro` (tabla de progreso guardado) se eliminó entera**
(20260822140000_logros_sin_motor.sql) — con todo por consulta, no
había nada que esa tabla necesitara guardar (ni siquiera "cuándo se
consiguió por primera vez": solo importa cuántas veces se tiene / en
qué tramo va).

Dos categorías (no tres — "turno" ya no existe):

- **16 de tramo** (acumulado de por vida, se repite cada N unidades):
  `sum(columna) / condicion_valor` sobre `historial_ciclos` (cerrados)
  + `v_produccion_operario_ciclo` filtrada al ciclo actual (en vivo).
  m² total, 5 tiempos, m² por categoría ×3, piezas por formato ×7.
- **3 de ciclo** (se evalúan sobre un ciclo entero): Bestia del Ciclo
  (600+ pts), Ciclo Legendario (1.000+ pts) — `count(*)` de
  `historial_ciclos`/`v_puntos_operario_ciclo` que cumplen la
  condición; Rey de Reyes (1º del ranking del ciclo) — comparando
  `puntos_ciclo` agrupado por `cycle_id`, sin `condicion_valor`
  numérico.

`logros_definicion` ganó 3 columnas para poder cargar el CSV real de
v2: `rol` (default `operario`, prepara el terreno para la fase 2),
`formato_nombre` (solo la usan los 7 logros de piezas por formato), y
`condicion_valor` pasó a nullable (Rey de Reyes no tiene umbral
numérico). Los 19 datos del CSV en sí (contenido) siguen sin sembrar
en BD — solo el esquema está listo.

Vistas de apoyo construidas: `v_produccion_operario_ciclo` (equivalente
a `historial_ciclos` pero para el ciclo aún sin cerrar, para
CUALQUIER ciclo), `v_puntos_operario_ciclo` (puntos totales por
operario+ciclo, cualquier ciclo).

## Cierre de ciclo

`fn_cerrar_ciclos_pendientes()` (`20260822170000_cerrar_ciclo_cron.sql`,
ampliada en `20260822180000_fuerza_resistencia_velocidad.sql`) — la
pieza que faltaba, con fecha límite 28/09/2026 (primer cierre real),
ya construida y con margen de sobra.

- **Disparador puro calendario**: gracias a que el ciclo dura 28 días
  desde un lunes, cada ciclo termina siempre en domingo y el
  siguiente arranca siempre en lunes. El cron (`cerrar-ciclos-pendientes`)
  corre **solo los lunes** (`0 * * * 1`, cada hora en punto UTC), con
  la condición interna `extract(hour from now() at time zone
  'Europe/Madrid') = 8` — nunca cierra antes de las 8:00 Madrid, que
  da margen de sobra sobre el cierre automático del turno N (07:00) y
  la ventana de corrección de 1h del responsable.
- **Autocontenida y con red de seguridad**: recorre TODO `cycle_id`
  anterior al actual sin fila en `historial_ciclos` (no solo "el que
  acaba de terminar") — si el cron falla un lunes, el siguiente cierra
  lo que falte.
- **Idempotente** (`on conflict (usuario_id, cycle_id) do update`) —
  la misma función sirve para "recalcular ciclo anterior"
  (`09-administrador.md`), ya no bloqueado.
- Escribe filas para operario Y responsable (usa
  `v_metros_responsable_ciclo`, `v_puntos_metros_responsable_ciclo`,
  `v_puntos_responsable_ciclo`, construidas para esto).

## Fuerza / resistencia / velocidad

Construido a partir del código real de v2 (compartido en sesión),
corrigiendo dos problemas que tenía:

- `fuerza = m2_total / 1000`, `resistencia = (tiempo_plena +
  tiempo_no_alimentada) / 100` — igual que v2, sin techo (crecen para
  siempre, coherente con puntos/niveles). La proporción real
  m²/minutos no cambia según se acumule por turno, ciclo o vida
  entera, así que los mismos divisores siguen equilibrando ambas
  medidas a cualquier escala.
- **Velocidad, corregida**: v2 la calculaba como media ponderada
  arbitraria (`fuerza*0.6 + resistencia*0.4`, "por poner algo") y la
  acumulaba SUMANDO el valor de cada parte — doble error, porque
  sumar una tasa ya calculada la infla cuantos más partes haya. Ahora:
  `velocidad = m2_total / tiempo_plena` (m² por minuto de máquina
  realmente produciendo, sin diluir con `tiempo_no_alimentada`, que sí
  cuenta para resistencia/rendimiento pero no representa producción
  real). Y **nunca se suma** en ningún nivel — se recalcula siempre
  desde los totales (por ciclo al cerrar; de toda la vida en
  `v_stats_vida`, sumando m² y `tiempo_plena` por separado y dividiendo
  al final, nunca promediando ratios ya hechos).
- Se guardan en `historial_ciclos` como la aportación de ESE ciclo
  (delta), igual que `m2_total`/`piezas_total` — nunca como un
  contador mutable actualizado con `+=` (el patrón de v2 que
  `07-arquitectura.md 9.3` documenta evitar a propósito).
- Se calcula también para el responsable (`v_tiempo_responsable_ciclo`
  nueva, con `tiempo_plena` y `minutos_rendimiento` por separado).

`v_stats_vida` — fuerza/resistencia/velocidad de toda la vida
(histórico + ciclo en vivo), para cualquier usuario y rol. Sin
pantalla que lo muestre todavía (pendiente, ver `07-pendientes.md`).

## Personaje RPG

**Proveedor: GPT Image 2** (`gpt-image-2`, salió el 21/04/2026 —
posterior al corte de conocimiento del asistente, confirmado por
búsqueda web en sesión). Constante única en
`supabase/functions/_shared/openai_images.ts`, junto con `IMAGE_SIZE`
(`672x1008`) e `IMAGE_QUALITY` (`medium`) — probado en real: coste
2-5 céntimos por generación, calidad muy por encima de lo esperado
para esos parámetros "baratos".

**Flujo (igual que v1/v2, NO texto→imagen puro)**: `images/edits` de
OpenAI, con imagen de referencia:

1. El operario elige **cualquier imagen de su galería** (fotos
   normales de móvil — playa, fiesta, terraza; no se le pide que se
   haga una foto en fábrica, "les incomoda").
2. Se procesa en cliente (`procesarFotoLibre`, reutilizada de
   incidencias — reducida a 1024px de ancho máximo, WebP) antes de
   subir a Cloudinary (preset `motiv_v3_personajes`, el mismo preset
   unsigned sirve para el lado cliente y para el servidor).
3. La Edge Function `generar-personaje` compone el prompt final en 3
   partes, en este orden: `niveles.prompt_imagen` (BD, el "qué" —
   marco, aura, entorno del nivel actual) + prompt fijo de estilo y
   seguridad (código, `PROMPT_ESTILO_Y_SEGURIDAD`) + texto libre
   opcional del operario.
4. Llama a `images/edits` con esa imagen + ese prompt, sube el
   resultado a Cloudinary, y guarda con `fn_guardar_personaje_generado`
   (atómico: desmarca el `seleccionada` anterior, inserta el nuevo ya
   seleccionado — el personaje recién generado pasa a ser
   automáticamente el que se ve).

**Prompt de estilo y seguridad** — pide **fidelidad de rasgos** con
quien sube la foto (es su alter ego dentro del juego, no un genérico)
DENTRO del estilo ilustrado de cada nivel (nunca foto-realismo puro,
que chocaría con "cyberpunk retrofuturista"), y excluye
explícitamente a cualquier tercero, marca o logo que pueda aparecer de
fondo en la foto (las fotos de playa/fiesta casi siempre tienen más
gente al lado, sin que esa gente haya dado permiso).

**Generación siempre manual** (decisión de sesión): el usuario pulsa
un botón, nunca se dispara sola al subir de nivel. Si ya tiene un
personaje del nivel anterior, se queda con él hasta que pida uno
nuevo a mano.

Infraestructura reutilizada sin cambios (ya existía desde antes de
esta sesión): `usuario.generaciones_disponibles`, `fn_consumir_generacion`
(atómico, falla si no quedan), `fn_otorgar_generaciones_por_nivel`
(+3 al subir de nivel), el índice único `uq_personaje_rpg_seleccionada`.
Si la generación falla DESPUÉS de consumir el crédito (fallo de la API
externa), la Edge Function lo devuelve automáticamente — el usuario no
pierde una generación por un fallo que no es suyo.

## Pantallas

**Inicio del operario** — construida y probada en real
(`InicioOperarioScreen.tsx`): nivel + estrellas + barra de progreso al
siguiente nivel + puntos totales + personaje (imagen + historia) +
selector de imagen de referencia + texto libre + botón generar +
contador de generaciones disponibles.

`frontend/src/lib/gamificacion.ts` (nuevo) es genérico para operario Y
responsable — decide sola qué vista de puntos y qué columna de umbral
usar según `usuario.rol`, listo para reutilizar en la pantalla de
Inicio del responsable sin duplicar lógica.

Pendiente: Inicio del responsable, Ranking, Stats, Logros (las 4
pestañas de gamificación que faltan, ver `07-pendientes.md`).
