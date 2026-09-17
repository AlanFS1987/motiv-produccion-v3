# 01 — Dominio: entidades y reglas de negocio

## Jerarquía del catálogo

```
modelo ─┐
marca  ─┼─► producto ─► lote ─► parte
formato ┘
```

- **modelo** y **marca** se crean solos la primera vez que el OCR lee
  un nombre nuevo. Se guarda `nombre` (literal) y `nombre_normalizado`
  (mayúsculas, espacios colapsados, símbolos raros fuera). La búsqueda
  al resolver usa similitud `pg_trgm` sobre el normalizado, umbral 0,4:
  por encima se enlaza al existente, por debajo se crea uno nuevo. Nunca
  se pregunta ni se bloquea; los duplicados los fusiona el administrador
  después (pantalla no construida).
- **formato** es catálogo cerrado de 7 filas; el nombre son las medidas
  en mm (`600x1200` = 0,72 m² por pieza). No se auto-crea: si el OCR lee
  un formato que no existe, `resolver-catalogo` devuelve error 422.
- **producto** = (modelo, marca, formato), único. Sin datos propios.
- **lote**: identidad = `numero_orden` (texto, único, nunca se
  reutiliza aunque se vuelva a fabricar el mismo producto). Lleva los
  datos de la hoja de partida: acabado (código/tipo/nombre), espesor
  (`9mm` si el modelo lleva prefijo SL, si no `11mm`), tipo de palet,
  piezas por caja, objetivo en m² (orientativo, nunca dispara nada),
  cuatro códigos de barras (caja, pieza, UPEC, SASO), observaciones,
  y los textos crudos de modelo/marca para auditar fusiones. Estado
  `iniciado` / `finalizado`: etiqueta de gestión, **nunca bloquea** que
  sigan entrando partes. Si entra un parte contra un lote finalizado,
  el lote vuelve solo a `iniciado` (trigger) y se limpia
  `resumen_calidad_enviado_at` para que vuelva a salir en el digest.
- **parte**: lote + línea + turno + tono (+ calibre). Es lo que se
  captura. Un turno en una línea puede tener varios partes (cambio de
  lote, de tono o de calibre). Un lote puede estar en varias líneas a
  la vez. Tono y calibre viven en el parte, no en el lote, porque
  varían dentro del mismo lote.

## Tono y calibre

- Tono: letra + dígitos (`M10`). En la hoja de partida el campo
  `TONO ANT.` viene sin prefijo; en caja y pieza viene con prefijo de
  fábrica (`5M10`, la 5 es esta planta). Al comparar se quita el prefijo
  y se corrigen confusiones de OCR en los dígitos (O→0, I/L→1).
  La sugerencia de tono al abrir un lote nuevo es `tono_ant + 1`
  (`M09` → `M10`), editable por el responsable.
- Calibre: texto libre; se compara numéricamente (`03` = `3`).
- Entrada manual de ambos: solo `[A-ZÑ0-9]`, sin espacios.

## Turno y rotación

- Tres tipos: **M** 06–14, **T** 14–22, **N** 22–06 (hora de Madrid).
  `turno` se identifica por (`fecha`, `tipo`); para N, `fecha` es el
  día en que empieza.
- **Rotación calculada**, no tabla: patrón fijo de 28 días por letra
  (7 N, 2 descanso, 7 T, 2 descanso, 7 M, 3 descanso), letras A/B/C/D
  desfasadas 0/7/14/21 días, desde el lunes
  `configuracion.fecha_inicio_rotacion`. Cada día hay exactamente una
  letra en cada tipo y una descansando.

  **Valor real: `configuracion.fecha_inicio_rotacion` = 2026-02-16**
  (lunes). Esta fecha es a la vez el ancla de la rotación y la del
  cálculo de ciclos de gamificación (`fn_ciclo_id`, ver `04`). Estaba
  en 31/08/2026 (lanzamiento de v3) y se movió en la sesión 23/08/2026
  al migrar los datos de v2, para que sus ciclos quedaran numerados
  1..6 sin `cycle_id` negativos. Como se movió exactamente 7×28 días,
  el 31/08/2026 sigue siendo el inicio del ciclo 7 y la rotación no se
  alteró. Reglas si alguna vez hay que moverla: debe seguir siendo
  lunes, moverse en múltiplos de 28 días, y repetir después el ajuste
  manual de letras del admin (`09`) para que la rotación calculada
  vuelva a coincidir con la fábrica.
  Función SQL
  `fn_turno_de_letra(fecha, letra)` y su inversa `fn_letra_de_turno`.
  La rotación **nunca se pausa**, ni en el cierre anual de fábrica.
- **Estado del turno** (calculado en cliente, `lib/rotacion.ts`):
  `antes` (hasta 1 h antes de la franja) → `abierto` (desde 1 h antes
  hasta el fin) → `en_revision` (1 h después del fin) → `cerrado`.
  `descanso` si a la letra no le toca hoy. Para el turno N se mira
  también la fecha de ayer. `turno.cerrado_at` (manual o automático)
  prevalece sobre el cálculo.
- **Quién puede abrir un turno**: un responsable solo el que le toca
  por su letra (política RLS lo comprueba con `fn_turno_de_letra`). La
  política también deja abrir cualquier turno dentro de la franja a un
  rol `suplente`, pero esa vía queda sin uso en la práctica — ver más
  abajo, "Suplente y refuerzo".
- **Cierre de fábrica** (`cierre_fabrica`, fecha inicio/fin): trigger
  impide insertar turnos en ese rango, gestionado desde
  `admin/CierreFabricaScreen.tsx` (`09`). Como la rotación nunca se
  pausa (ver arriba), un responsable al que le toca turno por rotación
  durante el cierre seguía viendo "estado: abierto" en el cliente —
  bug real detectado en sesión 26/08/2026: `TurnoScreen.tsx` intentaba
  crear el turno, chocaba con el trigger de BD, y el responsable veía
  el error crudo de Postgres en vez de un aviso claro. Corregido:
  `TurnoScreen.tsx` comprueba `estaFabricaCerrada(fecha)`
  (`lib/turno.ts`, espejo en cliente de `fn_fabrica_cerrada`) ANTES de
  llamar a `obtenerOCrearTurno`, y muestra una pantalla de "Fábrica
  cerrada (periodo de vacaciones)" en su lugar — mismo patrón visual
  que la pantalla de "día de descanso".
## Suplente y refuerzo

- **Cuenta compartida `suplente`: descartada** (decisión cerrada,
  sesión 25/08/2026). No se creará ninguna cuenta ficticia para cubrir
  turnos. El rol `suplente` sigue existiendo como valor del enum
  `rol_usuario` en BD (inofensivo, sin usarse activamente; no hay
  necesidad de quitarlo del esquema), y la política RLS de `turno` que
  le daría vía libre dentro de la franja también sigue ahí sin uso —
  simplemente no hay ni habrá ninguna fila con ese rol en `usuario`.
- **Cobertura por fuerza mayor** (procedimiento, no código): cuando uno
  o dos responsables cubren a otro — tanto si el titular tiene que
  abandonar un turno ya empezado como si no llega a incorporarse desde
  el principio — **siempre se usan las credenciales del titular que se
  está cubriendo**, nunca una cuenta aparte ni las credenciales propias
  de quien cubre. En el caso de abandono a mitad de turno, quien cubre
  simplemente sigue con la sesión ya abierta del titular en el
  dispositivo — no cierra sesión ni entra con otra cuenta. Como
  `parte.responsable_id` no cambia, el UPDATE de los partes pendientes
  nunca choca con la política RLS (`responsable_id = auth.uid()`). Si
  la sesión del titular caduca o se cierra sola mientras está ausente,
  o si el titular no llega a incorporarse desde el principio, quien
  cubre debe entrar **con las credenciales del titular** para no romper
  la continuidad de `responsable_id` en los partes. Dentro de un tramo
  cubierto así no se distingue qué persona física capturó cada
  parte — la trazabilidad sigue siendo `turno.abierto_por` y
  `parte.responsable_id`, ambos con la identidad del titular.
- **Refuerzo** (operario): tabla `refuerzo_operario_turno`. El
  responsable da de alta a un operario que no es de su letra; solo
  entonces aparece en el desplegable de asignación a línea y el
  operario "pertenece" a ese turno en su app.

## Asignación operario → línea

`asignacion_operario_linea` (turno, línea, operario), única por
(turno, línea), la crea/edita el responsable durante el turno. Una
línea en producción tiene exactamente un operario; sin operario = fuera
de producción.

Es puramente la **semilla**: al crear un parte se copia el operario
vigente en ese momento a `parte.operario_id` (nullable), y a partir de
ahí `asignacion_operario_linea` deja de leerse — ni "Mi línea" ni el
cálculo de puntos vuelven a consultarla. Todo lo que "cuenta" (quién
puede verificar el parte, a quién se atribuyen los puntos) usa siempre
`parte.operario_id` (decisión sesión 19/08/2026; cómo se reparten los
puntos entre varios operarios en `04`). Si se reasigna la línea a mitad de turno, los
partes ya creados no cambian de dueño: siguen con el operario que
tenían cuando se crearon; el nuevo operario solo queda vinculado a los
partes que se creen a partir de ese momento.

## Ciclo de vida del parte

1. Se crea al resolver el lote (o al confirmar tono/continuar), con
   piezas y minutos a 0, `completado = false`, `vigente = true`.
2. Se van rellenando verificación de caja, códigos de barras, y por
   último piezas/minutos (Foto 3) → `completado = true`,
   `completado_at = now()`.
3. También puede cerrarse "sin producción" (lote cancelado, línea
   equivocada): `completado = true` con todo a 0.
4. **Corrección**: nunca se edita un parte completado. Se inserta otro
   con `corrige_a_parte_id` apuntando al original; un trigger pone el
   original `vigente = false`. Todo cálculo filtra `vigente = true`.
   El responsable puede corregir sus propios partes durante 1 h desde
   `completado_at` (política RLS); después, solo el administrador,
   sin límite de tiempo (pantalla y permisos en `09`).

   El formulario de corrección (`FotoPantallaMaquina` modo
   `"corregir"`) aplica las mismas dos reglas bloqueantes que la
   captura inicial (`piezas_entradas > 0`, `minutos_total > 0`) — por
   eso no se puede guardar una corrección con todo a 0 usando el botón
   normal "Guardar corrección". Para el caso real "este parte no debió
   tener producción, hay que corregirlo a cero" existe un botón
   separado, **"Corregir a sin producción (todo a 0)"**, visible solo
   en modo corrección: pide confirmación explícita y salta esas dos
   validaciones, pero sigue insertando la corrección igual que
   siempre (`corrige_a_parte_id`, nunca un UPDATE). No aplica a la
   captura inicial (`modo="completar"`): un parte pendiente sin
   producción real se cierra con **Cerrar sin producción** (punto 3),
   no con este botón.

## Validaciones antes de completar un parte (cliente)

- Bloqueante: `piezas_entradas > 0` y
  `1ª + comercial + eco + contenedor` entre 98 % y 102 % de
  `piezas_entradas` (descuadre y planar comercial son subconjuntos de
  comercial, no suman aparte).
- Bloqueante: `minutos_total > 0` y la suma de los 5 minutos
  detallados dentro de ±2 % de `minutos_total`.
- Aviso no bloqueante: `minutos_total > 600` (contador de la máquina
  probablemente sin resetear). El parte se guarda igual.
- `calibre_com_pct = descuadre_com / entradas × 100` lo calcula un
  trigger en BD (lo que envíe el cliente se pisa); `calibre_std_pct`
  es columna generada (100 − com).

## m²

`m² = piezas × ancho_mm × alto_mm / 1.000.000`, con ancho/alto sacados
del nombre del formato. Existe en dos sitios que deben dar lo mismo:
- Cliente y Deno: `lib/formato.ts` y `_shared/formato.ts` (informe de
  turno, pestaña Resumen, captura).
- SQL: columna `formato.area_m2` (derivada del nombre) — la usan las
  vistas del dashboard (`08`) y de gamificación (`04`). Confirmado en
  BD (24/08/2026): los 7 formatos con el valor correcto.

## Dos modos de calidad (siempre se muestran juntos)

- Con descarte: `1ª / (1ª + comercial + contenedor)` — coincide con el
  % Abs de la pantalla de la máquina.
- Sin descarte (u "oficial"): `1ª / (1ª + comercial)`.
- `eco` queda fuera de ambos mientras no se use en producción.
## Rol mecánico (sesión 16/09/2026)

Nuevo rol `mecanico`. Solo 2 personas cubren el rol — no hay turnos de
mecánico (a diferencia de operario/responsable); la identificación de
quién hizo cada cosa es simplemente cuál de los 2 la hizo, capturado
porque es gratis, no porque haya cuadrante que respetar.

### Incidencias de producción — respuesta

`incidencia_produccion` (`01`, hasta ahora solo creación por
responsable/jefe y lectura por jefe/Ceria) gana concepto de respuesta:

- El mecánico contesta con texto libre + imágenes, igual que se crea
  la incidencia.
- **Sin reapertura**: el flujo es `pendiente → contestada`, lineal. Si
  el problema vuelve a ocurrir, se crea una incidencia nueva — nunca
  se reabre la contestada. No hay histórico de varias respuestas por
  incidencia.
- Una incidencia que no requiere intervención física se marca como tal
  **en la propia respuesta** (campo, no un tipo de incidencia distinto
  ni un caso aparte).
- Queda registrado qué mecánico contestó — útil más adelante ("¿quién
  tocó esto la última vez?"), aunque no haya turnos formales.
- Quien ya podía ver la incidencia sigue viendo la respuesta junto a
  ella (misma fila, sin política de visibilidad separada).

### Almacén de repuestos

Submódulo propio, más grande que el resto de bloques.

- **Árbol**: máquina → submáquina → repuesto, con el mismo patrón
  jerárquico que `ceria_documentacion_maquina` (claves punteadas), en
  tabla propia (no la misma tabla — es un catálogo distinto). "Por
  catalogar" es una categoría real del árbol, no un estado especial ni
  un campo nulo: un repuesto **siempre** pertenece a una categoría.
- **Referencias, no proveedor(es) como campo separado**: un repuesto
  puede tener varias referencias, una por proveedor/fabricante que lo
  vende con su propio código. La lista de proveedores de un repuesto
  es la lista de proveedores distintos de sus referencias — no se
  duplica en ningún otro sitio.
- **Stock siempre calculado**, nunca editable a mano: suma de sus
  movimientos (entrada / salida / ajuste). Cada movimiento es una fila
  propia, nunca se pisa un número.
- **Negativos permitidos** — mismo tratamiento tanto si el stock real
  era más bajo de lo que la BD creía como si el repuesto se da de alta
  al vuelo al usarlo (nace en 0, la primera salida lo deja en -1). Un
  repuesto en negativo simplemente aparece marcado hasta que un pedido
  lo compensa; no son dos flujos separados.
- **Pedidos**: cabecera (fecha, proveedor) + líneas (repuesto,
  cantidad pedida, recibido sí/no, fecha de recepción). El estado de
  la cabecera (parcial / recibido completo) es **derivado de sus
  líneas, nunca editable a mano** — los pedidos llegan por fascículos,
  así que un estado manual acabaría desincronizado. Marcar una línea
  como recibida genera automáticamente el movimiento de entrada; no se
  registra por duplicado en dos sitios.
- **Alta "sobre la marcha"**: un único formulario de "nuevo repuesto",
  reutilizado desde el almacén o desde un pedido — no dos versiones.
  La categoría (máquina/submáquina) es obligatoria siempre; si no se
  sabe con certeza, se asigna "por catalogar" y se reclasifica después
  (reclasificar = simple cambio de categoría).

### Mantenimiento preventivo — checklist de engrase

Digitalización literal de un proceso hoy mental (cada ~3 meses,
engrase + revisión visual de ciertos puntos por línea):

- La checklist es **la misma para todas las líneas**.
- La lista de puntos vive en tabla propia, editable solo por el admin
  — hoy provisional, se espera que se estabilice pronto.
- El registro de una revisión es un **"parte" más**, al mismo estilo
  que los partes de producción (`01`): línea + fecha + qué mecánico +
  qué puntos se marcaron esa vez.
- **Marcado parcial permitido**: si de N puntos solo da tiempo a
  marcar algunos, el parte se guarda igual; los demás quedan sin
  marcar en ese registro concreto. No hay seguimiento independiente
  por punto — el seguimiento es por parte completo.
- **Sin disparador**: no hay alertas de "toca revisión". La
  periodicidad de 3 meses la gestionan los mecánicos de memoria; el
  sistema solo deja registro de cuándo se hizo cada vez.

### Unidades intercambiables (cabezales de flejado, calderines de cola-cera)

Distinto del almacén de repuestos (bloque anterior): un repuesto
normal es *fungible* (no importa cuál de las N idénticas se usa);
estas unidades son *concretas e identificables* — cada una tiene su
propia identidad e historial, aunque varias sean del mismo modelo.

- Piezas de quita-y-pon: cuando el fabricante repara una, se monta la
  unidad de repuesto del almacén y la estropeada se manda fuera; al
  volver, pasa a ocupar el lugar de repuesto (o se monta en otra
  línea).
- Volumen real: 7 cabezales de flejado (6 montados + 1 de repuesto),
  20 calderines de cola-cera (18 montados + 2 de repuesto) — volumen
  bajo, cada unidad merece ficha propia, no stock genérico.
- **No maneja dinero**: sin coste ni factura de reparación, en ningún
  punto de la app.
- **Historial de movimientos**, no un campo de "ubicación actual" que
  se sobrescribe — necesario para poder calcular cuánto duró cada
  reparación restando fechas entre el evento de salida y el de vuelta.
  La ubicación actual se calcula siempre a partir del último
  movimiento, nunca se guarda como campo aparte.
- Solo hace falta que quede registrado (consulta/historial); no hace
  falta alerta ni que NORA/Ceria sepan en tiempo real qué unidad
  concreta está montada.

### Reglas transversales del rol mecánico

- Nada de lo anterior maneja dinero.
- Donde hace falta saber "cuánto duró algo" (reparación externa), se
  registra como historial de eventos con fecha — nunca un campo que se
  sobrescribe.
- Donde un valor se puede derivar de otros datos ya registrados
  (estado de un pedido, stock de un repuesto, ubicación actual de una
  unidad), se calcula — no se guarda ni edita a mano por separado.
- Visibilidad, por ahora: **solo `mecanico` + `administrador`** ven
  almacén, engrase y unidades intercambiables — `jefe` queda fuera a
  propósito (decisión 16/09/2026, a diferencia del resto de bloques
  del proyecto donde `jefe` suele tener SELECT amplio).