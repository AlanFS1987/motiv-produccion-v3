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
```
denominador = max(480, Σ minutos_total)            -- por línea+turno
numerador   = Σ (minutos_plena + minutos_no_alimentada)
%           = numerador / denominador
```
El suelo de 480 absorbe el tiempo sin parte y diluye un contador sin
resetear sin necesidad de detectarlo. Tabla `puntos_rendimiento`
(operario, máx. 15):

| % | Puntos |
|---|---|
| 0,00–24,79 | 1 |
| 25,00–37,29 | 2 |
| 37,50–49,79 | 5 |
| 50,00–62,29 | 9 |
| 62,50–74,79 | 12 |
| 75,00–100,00 | 15 |

Bug conocido: los tramos no son contiguos (24,80–24,99 etc. dan 0
puntos). Ver `07-pendientes.md`.

**Piezas** — tabla `puntos_piezas` (7 formatos × 5 tramos, 2/5/9/12/15
puntos), por piezas totales de la línea+turno **y formato** (si cambia
el formato a mitad, cada formato se puntúa aparte y se suman). Sin vista
que lo calcule. Los tramos tienen tope superior: por encima del último
tramo, 0 puntos (bug conocido).

| Formato | 2 | 5 | 9 | 12 | 15 |
|---|---|---|---|---|---|
| 200x1200 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | 12.000–13.999 | 14.000–20.000 |
| 300x1200 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | 12.000–15.000 |
| 600x1200 | 2.000–2.999 | 3.000–3.999 | 4.000–4.999 | 5.000–5.999 | 6.000–8.000 |
| 1200x1200 | 1.000–1.249 | 1.250–1.749 | 1.750–1.999 | 2.000–2.249 | 2.250–3.500 |
| 300x600 | 10.000–13.999 | 14.000–16.999 | 17.000–19.999 | 20.000–21.999 | 22.000–28.000 |
| 600x600 | 4.000–5.999 | 6.000–7.999 | 8.000–9.999 | 10.000–11.999 | 12.000–16.000 |
| 900x900 | 1.500–2.199 | 2.200–2.999 | 3.000–3.799 | 3.800–4.499 | 4.500–6.000 |

**Limpieza** — 1 punto por ítem de `operario_checklist` (máx. 6 por
línea+turno). Atribuida directamente por `operario_checklist.operario_id`
(quien marcó el ítem), sin relación con la asignación de línea ni con
el reparto anterior — cualquier operario del turno puede limpiar
cualquier línea. Sin vista que lo sume.

**Total del operario** = piezas + rendimiento + limpieza.
