# 04 — Gamificación

Estado: las **tablas de tramos y las vistas de puntos de rendimiento
del ciclo actual existen en BD**. No hay ninguna pantalla que los
muestre, no se suman piezas ni limpieza, no existe el cierre de ciclo
ni nada de lo que depende de él. Todo lo demás de este archivo está
**diseñado** y se documenta de forma compacta.

## Principios (cerrados)

- Los datos crudos del parte (piezas, minutos) **nunca se corrigen ni
  se recalculan** para gestión; el jefe los ve tal cual. Solo la capa
  de puntos aplica fórmulas.
- Los puntos **no se guardan resueltos por parte**: se calculan al
  consultar, agregando los partes vigentes por línea+turno. Evita el
  total desincronizado de v2.
- Totales de por vida = suma de "fotos" de ciclos cerrados
  (`historial_ciclos`) + ciclo actual en vivo. La foto la escribe
  `cerrar-ciclo` (no construido) y la puede regenerar el admin.

## Ciclo

28 días desde `fecha_inicio_rotacion`, `fn_ciclo_id(fecha)` =
`floor((fecha − inicio)/28)`. Nunca se pausa. Primer cierre: 28/09/2026.

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

Tramos contiguos, sin huecos — el "bug conocido" de tramos no
contiguos que constaba aquí ya no existe, la tabla real en BD no lo
tiene (confirmado 22/08/2026).

**Piezas** — tabla `puntos_piezas` (7 formatos × 5 tramos, 2/5/9/12/15
puntos), por piezas totales de la línea+turno **y formato** (si cambia
el formato a mitad, cada formato se puntúa aparte y se suman). Mismo
reparto igualitario que rendimiento si hay más de un operario en esa
línea+turno. Sin vista que lo calcule todavía. El último tramo de cada
formato tiene `max = null` (sin límite superior) — el "bug conocido"
de tope superior que constaba aquí ya no existe, confirmado contra la
tabla real en BD (22/08/2026).

| Formato | 2 | 5 | 9 | 12 | 15 (sin límite) |
|---|---|---|---|---|---|
| 200x1200 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | 12.000–13.999 | ≥14.000 |
| 300x1200 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | ≥12.000 |
| 600x1200 | 2.000–2.999 | 3.000–3.999 | 4.000–4.999 | 5.000–5.999 | ≥6.000 |
| 1200x1200 | 1.000–1.249 | 1.250–1.749 | 1.750–1.999 | 2.000–2.249 | ≥2.250 |
| 300x600 | 10.000–13.999 | 14.000–16.999 | 17.000–19.999 | 20.000–21.999 | ≥22.000 |
| 600x600 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | ≥12.000 |
| 900x900 | 1.500–2.199 | 2.200–2.999 | 3.000–3.799 | 3.800–4.499 | ≥4.500 |

**Limpieza** — puntos según `checklist_items.puntos` de cada ítem
marcado en `operario_checklist` (no siempre 1 fijo por ítem — cada
ítem tiene su propio valor). Atribuida directamente por
`operario_checklist.operario_id` (quien marcó el ítem), sin relación
con la asignación de línea ni con el reparto anterior — cualquier
operario del turno puede limpiar cualquier línea. Se agrega **por
turno completo**, no por línea (un operario puede limpiar varias
líneas distintas de las suyas). Sin vista que lo sume todavía.

**Total del operario** (por turno) = piezas (por línea) + rendimiento
(por línea) + limpieza (del turno completo, sin línea).

## Puntos del responsable (por turno completo, nunca por línea)

**Metros** — tabla `puntos_metros`, sobre m² totales del turno (todas
las líneas juntas, ya disponible en `v_produccion_turno.m2_total`),
máx. 45 puntos, último tramo sin límite superior (`21000, null, 45`).
Sin vista que lo calcule todavía.

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

Confirma la decisión abierta de `07-pendientes.md` ("confirmar escala
de `puntos_rendimiento_responsable`") — **queda cerrada**.
**Rendimiento del responsable** — tabla `puntos_rendimiento_responsable`,
mismo mecanismo de suelo que el operario (ver más arriba: `max()` en
las dos direcciones, absorbe tanto turnos con poco reportado como
contadores sin resetear) pero con denominador 2880 min (6 líneas × 480,
el turno completo) y escala propia, hasta 45 puntos, 10 tramos:

**Total del responsable** (por turno) = metros + rendimiento. Sin
limpieza — esa capa es solo del operario.

## Niveles (9, compartidos por operario y responsable)

Tabla única `niveles` — 9 niveles reales (contenido de v2, sembrados
22/08/2026): nombre, descripción, umbrales de puntos totales, color de
marco, nº de estrellas, efecto de aura, y dos prompts (`prompt_base`,
`prompt_imagen`) pensados para la generación del personaje RPG.

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