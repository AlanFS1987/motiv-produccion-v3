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

## Stats — el cuarto (vida) y el snapshot por nivel

Los stats pasan de 3 a **4**: fuerza, resistencia, velocidad y
**vida**. Vida no es un cálculo nuevo — es un alias directo de los
puntos totales de vida (los mismos que deciden el nivel), expuesto
con el nombre que le toca dentro del grupo de 4 para que la pantalla
de Stats trate a los 4 de forma uniforme.

### Problema de diseño: cartas ligadas al pasado, no al presente

Decisión de sesión 23/08/2026: cuando se genera una carta de
personaje para un nivel ya alcanzado, sus stats mostrados deben ser
los que tenía el usuario **cuando alcanzó ese nivel**, no los stats en
vivo del momento de generar — así una carta de nivel 1 generada
semanas tarde (la generación es siempre manual, puede retrasarse
cualquier cantidad de tiempo) sigue mostrando el pasado del operario,
no un presente inflado por producción posterior.

Esto exige un snapshot de stats por nivel, separado de la generación
de la carta (que puede no ocurrir nunca para un nivel dado).

### Por qué NO es un trigger reactivo a los puntos

Se descartó un trigger que se disparase "al cruzar X puntos" porque
recrearía el mismo patrón de contador mutable que la lección de v2 ya
enseñó a evitar (ver "Fuerza / resistencia / velocidad" arriba): los
puntos no tienen un único punto de mutación (vienen de `parte`,
`operario_checklist` y el cierre de ciclo), así que un contador
persistido de puntos necesitaría triggers en 3 sitios distintos, y
cualquier corrección de parte que no re-disparase el trigger
correspondiente desincronizaría el contador para siempre sin que
nadie lo note — exactamente el bug de v2, aplicado ahora a niveles.

### Solución: el administrador es el disparador manual

En vez de detección automática, el administrador otorga el bonus a
mano desde la vista de usuarios (ampliada con puntos totales, puntos
para el siguiente nivel, y un botón "otorgar generaciones"). Sin
ventana de tiempo que se cierre: el botón queda disponible
indefinidamente hasta que se pulsa, así que un despiste del admin
retrasa el bonus pero nunca lo pierde — y es poco probable que el
admin no entre a la app al menos una vez al día.

Construido en `20260823100000_personaje_stats_nivel_bonus.sql`:

- **`personaje_stats_nivel`** — snapshot de los 4 stats por
  `(usuario_id, nivel_id)`, con `unique (usuario_id, nivel_id)`. La
  **existencia de la fila ES el estado "ya otorgado"** — sin columna
  de control aparte, nada que sincronizar en dos sitios. El UNIQUE de
  paso previene doble clic sin lógica extra.
- **`fn_otorgar_bonus_nivel(usuario_id)`** — llamada por el botón del
  admin. Orden deliberado: primero persiste el snapshot de stats,
  DESPUÉS otorga las 3 generaciones (`fn_otorgar_generaciones_por_nivel`,
  que ya existía pero hasta ahora no la llamaba nada con este
  propósito — solo se usaba para devolver 1 generación si fallaba la
  API externa). Si el nivel actual ya tenía fila, no hace nada y
  devuelve `otorgado=false` — idempotente.
- **`v_admin_usuarios_gamificacion`** — una fila por operario/
  responsable con puntos totales, nivel actual, puntos que faltan
  para el siguiente nivel, y `bonus_nivel_actual_otorgado` (booleano
  listo para el `disabled` del botón en el frontend).

| **`fn_otorgar_bonus_nivel(uuid)`** | **nueva 23/08/2026**, security definer. Botón del admin: guarda el snapshot de stats del nivel actual y, solo la primera vez para ese nivel, otorga +3 generaciones. Idempotente. |

**Pendiente** (no incluido en esta migración, a propósito — no
mezclar cambios): la Edge Function `generar-personaje` sigue leyendo
`v_stats_vida` en vivo. Falta cambiarla para que lea de
`personaje_stats_nivel` (el snapshot del nivel de la carta) y guarde
esos 4 valores en `personaje_rpg` en el momento de generar.

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

**Construido 23/08/2026 — Ranking, Stats+Avatar, Logros** (las 3
sub-vistas que faltaban dentro de Inicio, ver `03-operario.md`):

- **Ranking** (`RankingOperarioScreen.tsx`, `lib/ranking.ts`): toggle
  ciclo actual/anterior, podio 1º-2º-3º + 4º-5º listados + "tú" si
  quedas fuera del top 5 (sin revelar posiciones intermedias). Debajo,
  **Reyes del formato**: histórico (récord absoluto de un solo parte,
  con TODOS los empates si los hay) y actual (más piezas acumuladas
  en el ciclo, sumando líneas/turnos), más "tu marca" en cada uno de
  los 7 formatos. El histórico se resuelve barato gracias a
  `parte.formato_id` denormalizado (trigger `trg_parte_set_formato_id`)
  + índice `idx_parte_formato_record` — sin eso habría que escanear
  `parte` entera por cada consulta.
- **Stats+Avatar fusionados en una sola pestaña** (decisión de
  sesión — iban a ser 2 separadas): 4 barras SIEMPRE EN VIVO
  (fuerza/resistencia/velocidad/vida, `v_stats_vida` + puntos
  totales), con 6 tramos logarítmicos (10/100/1.000/10.000/100.000/
  1.000.000) para fuerza/resistencia/vida y rango simple 6-11 para
  velocidad — colores fijos por stat (roja/naranja/azul/verde), no
  por tramo. Debajo, la tarjeta del avatar activo + su historia +
  gestión (elegir entre generados / generar nuevo).
- **Logros** (`LogrosOperarioScreen.tsx`, `lib/logros.ts`): motor
  100% GENÉRICO que lee `logros_definicion` y resuelve cada fila según
  `condicion_tipo` — nada hardcodeado por nombre de logro. **`logros_
  definicion` sigue vacía** (los 19 datos del CSV de v2 nunca se
  sembraron) — la pantalla funciona pero no muestra nada hasta que se
  siembren, usando exactamente los `condicion_tipo` documentados al
  principio de `lib/logros.ts`. Bloqueado = icono apagado + "???".
  Desbloqueado (tramo) = contador ×N + barra hacia el siguiente tramo.
  Desbloqueado (ciclo: bestia/legendario/rey de reyes) = solo contador
  ×N, sin barra (no hay "siguiente tramo" progresivo).

**Desglose de puntos de por vida** (`20260823110000_desglose_puntos_
historial_ciclos.sql`): `historial_ciclos` ganó 3 columnas
(`puntos_piezas`, `puntos_rendimiento`, `puntos_limpieza`, aportación
de ESE ciclo) — antes solo se guardaba `puntos_ciclo` ya sumado, así
que no se podía calcular "puntos piezas totales de por vida" para
ciclos ya cerrados. `fn_cerrar_ciclos_pendientes` las rellena ahora.
Vistas nuevas: `v_puntos_piezas_operario_total_vida`,
`v_puntos_rendimiento_operario_total_vida`,
`v_puntos_limpieza_operario_total_vida`. `v_stats_vida` ganó
`m2_total_vida`/`horas_plena_vida` en crudo (ya se calculaban
internamente, solo faltaba exponerlos).

**Generaciones ligadas a CADA NIVEL, no un contador plano**
(`20260823150000_generaciones_por_nivel.sql`, reemplaza el diseño
anterior de `usuario.generaciones_disponibles`): cada fila de
`personaje_stats_nivel` lleva su propio `generaciones_usadas` (0-3).
El operario elige PARA QUÉ NIVEL de los que ya alcanzó quiere generar
— la Edge Function usa las stats CONGELADAS de `personaje_stats_nivel`
de ese nivel (nunca `fn_nivel_actual`/`v_stats_vida` en vivo) tanto
para la imagen como para la historia. RPCs RPCs `fn_consumir_generacion_nivel`/`fn_devolver_generacion_nivel`
(`p_usuario_id, p_nivel_id`) — **[CORREGIDO 23/08/2026, fix real tras
desplegar]**: el primer diseño usaba `auth.uid()` como
`fn_seleccionar_personaje`, pero se llaman desde DENTRO de
`generar-personaje` con el cliente `supabaseAdmin` (`service_role`) —
con `service_role`, `auth.uid()` siempre es `null` (no lleva el JWT
del usuario), así que lanzaban "No hay sesión activa" en producción
pese a que el usuario sí tenía sesión válida. Corrección: vuelven a
recibir `p_usuario_id` como parámetro (como la `fn_consumir_
generacion` original), pero con el permiso de ejecución RESTRINGIDO a
`service_role` (`revoke ... from public, authenticated, anon`) — así
ningún cliente puede llamarlas directamente con el `usuario_id` de
otra persona. Mismo nivel de seguridad que `auth.uid()`, solo que la
barrera la impone Postgres (quién puede ejecutar la función) en vez
de la función misma. Vista `v_niveles_disponibles_generar` para el
selector del frontend. `usuario.generaciones_disponibles` queda SIN
USO (columna sin borrar, inofensiva).

`fn_seleccionar_personaje` es DISTINTA y sigue con `auth.uid()` sin
cambios — esa sí la llama el cliente directamente con su propia
sesión (no pasa por una Edge Function con `service_role`), ahí
`auth.uid()` es el patrón correcto.

**Historia con DeepSeek** (`_shared/deepseek_historia.ts`, integrada
en `generar-personaje`): existía en v2 pero no estaba documentado
aquí. Antes, `historia` se rellenaba con `niveles.prompt_base` tal
cual (genérico, igual para todos en ese nivel). Ahora: prompt de
sistema con reglas de estilo heredadas de v2 (máximo 3 frases
completas y CORTAS — no un párrafo narrativo comprimido, cada frase
una pincelada suelta, máximo 1 máquina/problema por frase; humor de
fábrica; nada de poesía barata; contexto real de máquinas y
problemas de la fábrica) + `prompt_base` + `prompt_imagen` + los 4
stats (congelados del nivel que se está generando) + texto libre del
operario. Si DeepSeek falla, la función NUNCA lanza — devuelve `null`,
`generar-personaje` guarda igual (imagen + stats correctos, historia
`null`), y responde `historia_pendiente: true` para que el frontend
avise "tu historia se está preparando" — el administrador la rellena
a mano en la BD, sin mecanismo de reintento automático todavía.
Secret nuevo: `DEEPSEEK_API_KEY`.

**Migración de datos reales de v2** (script de un solo uso, no
migración de esquema — `scripts/migrar_v2_historial.sql` o donde lo
guardaras): 19 operarios reales (de 20 en el CSV; `operario1` era
cuenta de pruebas, se quedó fuera aposta) migrados desde datos en
bruto de v2 (parte a parte), RECALCULANDO puntos con las fórmulas
reales de v3 (no copiando los puntos ya calculados en v2) — cruce por
`username`, nunca por id (los ids de v2 y v3 no coinciden). Insertados
en `historial_ciclos` con `cycle_id` negativo (anterior a
`fecha_inicio_rotacion`, nunca choca con ciclos reales). `personaje_
stats_nivel` reconstruido simulando cronológicamente cuándo cruzó cada
operario cada umbral — nadie pasa de nivel 3, coherente con lo
esperado. Nivel 1 (Aprendiz) explícitamente EXCLUIDO de estas filas
(no es una "subida", todos empiezan ahí) tras corregir un error real
del primer intento del script (si ves código o docs que lo contradigan,
están desactualizados). Cada nivel migrado quedó con 3/3 generaciones
sin gastar (`generaciones_usadas` default 0), listas para usar con el
selector nuevo.
### Renumeración de ciclos (sesión 23/08/2026, el mismo día de la migración)

Al migrar, `fn_ciclo_id` calculó cycle_id NEGATIVOS para los datos de
v2 (sus fechas son anteriores al 31/08/2026, la fecha ancla de
entonces) — funcionaban bien para sumar "puntos totales", pero
quedaban invisibles para el toggle de Ranking (que solo mira el ciclo
de hoy y el inmediatamente anterior) y, más grave: **hoy mismo, antes
de que arrancara el ciclo real, `fn_ciclo_id(hoy)` también daba
negativo** (-1) — el mismo cajón que la migración más reciente.

Se corrigió con dos UPDATE, sin tocar ninguna fórmula ni vista:

```sql
update historial_ciclos set cycle_id = cycle_id + 7 where cycle_id < 0;
update configuracion set valor = '2026-02-16' where clave = 'fecha_inicio_rotacion';
```

Resultado: los ciclos migrados pasaron de -6..-1 a 0..6 (bien, ya no
son negativos, y sin descuadres — este SEGUNDO update). El "+7" no es
arbitrario: son exactamente 7 ciclos de 28 días, así que el ciclo 7
sigue arrancando el 31/08/2026 (la fecha ancla original) — el plan de
lanzamiento no cambió, solo se renumeró lo anterior para que quede en
la misma línea temporal creciente. Hoy (23/08/2026) es el **ciclo 6**
en vivo — cerrado en `historial_ciclos` (por la migración), sin datos
en vivo todavía porque no ha habido ningún `parte` real de v3 (solo
pruebas de gamificación/personaje) — normal, no es un bug.

**Aviso sobre el cierre del ciclo 6**: como el ciclo 6 ya tiene fila
en `historial_ciclos` (por la migración), `fn_cerrar_ciclos_
pendientes` lo saltará sin más cuando llegue el ciclo 7 (el `not
exists` del loop es a nivel de cycle_id, no por operario) — si
hubiera producción real de v3 durante el ciclo 6 (23-30/08/2026), se
perdería de "puntos totales" al cerrar, porque nunca se escribiría en
`historial_ciclos`. Confirmado en sesión: la fábrica está parada
hasta el turno de mañana del lunes (ya en ciclo 7), así que no aplica
— pero si alguna vez se necesita producción real ANTES de que empiece
un ciclo nuevo tras una migración/renumeración así, hay que cerrar
ese ciclo a mano (fuera del loop automático) antes de que el cron lo
dé por bueno solo por tener fila.

**IMPORTANTE para cualquier sesión futura**: `fecha_inicio_rotacion`
NO es solo el ancla de los ciclos de puntos — es la MISMA fecha que
decide el patrón de rotación real de turnos (M/T/N/descanso por
letra). Cualquier cambio futuro de esta fecha exige repetir el ajuste
manual de letras del admin para que la rotación calculada vuelva a
coincidir con la realidad — es un paso manual, no automático, y hay
que avisar de que hace falta cada vez.

**Alcance exacto de la migración de v2** (por si se pregunta en otra
sesión): SOLO dos tablas, `historial_ciclos` (104 filas, puntos/stats
por operario+ciclo) y `personaje_stats_nivel` (niveles cruzados con
stats congeladas, sin Aprendiz). Ninguna otra tabla se tocó — ni
`parte`, ni `lote`/`producto`, ni ningún catálogo. La tabla de
staging `stg_migracion_v2` fue temporal y ya se borró.
**Pendiente**: Inicio/gamificación del **responsable** — no
construido (solo el operario tiene las 4 sub-vistas). Reutilizaría
`frontend/src/lib/gamificacion.ts` y buena parte del patrón de
`inicio-gamificacion.ts`/`ranking.ts`/`stats-avatar.ts`, pero el
responsable no tiene aún desglose puntos_piezas/rendimiento/limpieza
por categoría (solo metros+rendimiento, sin piezas/limpieza — fase 2),
ni logros propios (`logros_definicion.rol` está listo para
`'responsable'` pero sin datos), ni Reyes del formato (concepto
pensado solo para operario). Requiere diseño propio, no es un simple
"copiar y cambiar el rol".