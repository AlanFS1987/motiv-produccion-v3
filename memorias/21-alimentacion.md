# 21 — Vista Alimentación (velocidad conseguida vs producción)

Pestaña "Alimentación" (sesión 01/10/2026, rehecha el 09/10/2026).
Objetivo: ver qué velocidad de alimentación conviene a cada línea.
Se observa que alimentar más no da más producción (la línea satura más
y pasa menos tiempo a plena), y esta pantalla sirve para demostrarlo
con datos. Informe para el consejo: «Consigna de alimentación: qué
velocidad conviene a cada línea» (Docs).

Componente autocontenido y sin props (`alimentacion/AlimentacionPanel.tsx`,
mismo patrón que `InformesScreen`): se monta igual en `JefeApp`,
`AdminApp` y `ProduccionApp`. Eje de **producción**, sin calidad.

## Conceptos

- **Consigna** = velocidad que se PIDE a la línea (piezas/min). La decide
  la sección anterior; clasificación solo puede verla, y hoy NO se
  registra (pendiente: tabla `consigna`, ver Pendiente).
- **Velocidad conseguida** = `piezas_entradas` ÷ `minutos_plena`. Es lo
  que la máquina consigue, no lo que se pidió: con 16 pedido se
  consiguen unas 14 porque micropausas y recuperaciones se cuentan como
  plena. NO llamarla «consigna» en pantalla ni en informes (el jefe
  confunde consigna instantánea con media).
- **Tiempo alimentable** = `minutos_total` − `minutos_banco` −
  `minutos_maquina`. Banco (cambios de modelo, esperas de material) y
  máquina no dependen de la velocidad de alimentación (comprobado
  09/10/2026: no suben con la velocidad), así que se dejan fuera de la
  comparación. Pero SÍ son lo que más pesa en la producción total de un
  turno: entre el peor y el mejor cuarto de turnos por piezas, más de la
  mitad de la diferencia son minutos de banco y máquina.
- **% a plena (alimentable)** = 100 × `minutos_plena` ÷ tiempo alimentable.
- **Piezas por turno alimentable** = piezas × 480 ÷ tiempo alimentable:
  lo que saldría en 480 min alimentables a ese ritmo. Es un CÁLCULO, no
  un hecho: cada punto es un turno real y la ficha enseña las piezas
  reales y la derivación. Los turnos con menos de 300 min alimentables
  se dibujan pálidos (el equivalente es una extrapolación grande).
- Al agrupar varios turnos: **sumar piezas y minutos y dividir al final**,
  nunca promediar cocientes.

## Datos

- `v_alimentacion_turno_linea` (`20261001120000_vista_alimentacion_turno_linea.sql`):
  una fila por turno+línea, con sumas crudas, los tres cocientes y
  `formatos` / `formatos_distintos`.
- Frontend: `lib/dashboard-alimentacion.ts` (consulta paginada de 1000
  en 1000, tipos y constantes) y `lib/alimentacion-calculos.ts`
  (funciones puras: clasificación, agrupación, regresión).
- Acceso por rol — corrección (01/10/2026): el comentario del `.sql`
  dice que la vista "hereda" la RLS de las tablas base; comprobado
  contra la BD real, eso no es exacto. Como todas las vistas del
  proyecto, corre con permisos del *owner* (ver `CLAUDE.md`, "Vistas y
  RLS") y sus `GRANT` son idénticos a `v_produccion_turno`/
  `v_rectificado_turno`: `SELECT` abierto a `anon`/`authenticated`, sin
  distinción por rol a nivel de Postgres. Que "jefe"/"admin"/
  "produccion" la vean y "jefe_rectificado" no es una frontera **solo
  de frontend** (qué shells montan `AlimentacionPanel`), el mismo
  compromiso ya aceptado para las otras vistas de este dashboard — no
  un hueco nuevo. No se toca el `.sql` ya aplicado en producción por
  esto; queda anotado aquí.
- Índice: `parte` no tiene un índice compuesto `(turno_id, linea_id)`,
  solo `idx_parte_turno` e `idx_parte_linea` por separado (más uno
  parcial para partes pendientes, no aplica aquí). Evaluado y
  descartado por ahora (01/10/2026): ~6.500 turnos-línea/año, de sobra
  para los índices existentes — solo valdría la pena si la vista
  empezara a tardar de forma apreciable.

## Qué turnos entran (`REGLAS_TURNOS`, `lib/alimentacion-calculos.ts`)

Único sitio donde viven las reglas:

- Solo turnos+línea de **un único formato** (los mixtos se descartan y
  se cuentan aparte).
- Hasta **500 minutos totales**; por encima el turno es «excedido»
  (estadística sin resetear). No hay suelo de minutos: los turnos cortos
  entran, con su tiempo alimentable.
- Con minutos a plena > 0 y tiempo alimentable > 0.
- Interruptor **«Solo turnos comparables»** (apagado por defecto):
  460–490 min registrados y como máximo 30 min entre banco y máquina.
  Con la muestra actual (31/08–06/10, 600x1200) quedan 70 de 347
  turnos; crecerá con el tiempo.

## Pantalla

Filtros comunes: formato (por defecto 600x1200), líneas (todas las de la
planta, hasta 6), periodo (90 / 180 / 365 días) y «solo turnos
comparables». Un contador dice cuántos turnos entran y cuántos no y por
qué. Dos gráficas, con la velocidad conseguida en el eje X, todas las
líneas juntas (la línea es solo el color) y una línea negra con tramos
de 0,5 piezas/min:

1. Velocidad conseguida vs piezas por turno alimentable (480 min), con
   una línea horizontal morada: el NIVEL MEDIO de piezas por línea y
   turno que sostiene el horno (ver «Hornos por formato»). Es un nivel
   medio, no un umbral turno a turno: las líneas rotan de modelo. La
   línea del límite Griffon se retiró el 09/10/2026.
2. Velocidad conseguida vs % a plena (alimentable).

En ambas, línea vertical de la «consigna propuesta» (13), que vive en
`REFERENCIAS_PIEZAS_MIN` (`lib/dashboard-alimentacion.ts`,
PROVISIONAL). Al pasar el ratón sobre un punto sale la ficha del turno;
sobre la línea, la del tramo.

Debajo, el balance horno vs clasificación del formato (ver abajo).

## Hornos por formato y balance horno vs clasificación

- Tabla `horno_formato` (migración `20261009130000_horno_formato_balance.sql`):
  por formato y fecha de vigencia, m²/día de CADA horno, nº de hornos y de
  líneas habituales. Lectura por RLS (jefe, responsable, producción,
  administrador); escritura solo por la RPC `guardar_horno_formato`
  (administrador). Pantalla: pestaña «Hornos» del admin
  (`HornosFormatoScreen`). Valores iniciales: 12.600 m²/día en 200x1200,
  300x1200, 600x1200, 300x600 y 600x600; 8.700 en 900x900 y 1200x1200.
  Hornos/líneas habituales: 600x1200 = 2/3, 200x1200 y 300x1200 = 1/2,
  el resto 1/1 (los de 300x1200, 300x600 y 600x600 son supuestos).
- El horno cuece a ritmo constante: un turno = 1/3 del día. Salida
  nominal de UN horno por turno = m²/día ÷ 3. Los «hornos» y «líneas» de
  la tabla son el reparto HABITUAL y solo se usan para el nivel medio por
  línea; el balance infiere los hornos turno a turno (ver abajo).
- Nivel medio por línea = m²/día × hornos ÷ líneas ÷ m² por pieza ÷ 3
  (600x1200: 3.889 piezas por línea y turno). `nivelHornoPorLinea` en
  `lib/balance-horno-calculos.ts`.
- Vista `v_balance_horno_turno_formato`: por turno y formato, piezas y m²
  clasificados entre TODAS las líneas (m² = piezas_entradas ×
  `formato.area_m2`). El balance (`construirBalance`) es la suma corrida
  de (clasificado − horno) turno a turno; el componente es
  `BalanceHornoAlimentacion`. No depende del filtro de líneas.
- **Inferencia de qué horno cuece qué formato** (`inferirHornos`,
  `ESTRUCTURA_HORNOS` en `lib/balance-horno-calculos.ts`; no se registra
  y `programacion_orden` solo guarda la cola actual). Reglas de la
  planta (confirmadas por el usuario el 09/10/2026): 4 hornos; el
  GRANDE cuece 900x900 o 1200x1200 (nunca los dos a la vez); el
  FLEXIBLE cuece 200x1200 o 300x1200 (nunca los dos a la vez; 300x600 y
  600x600, muy raros, se asumen aquí) y a veces 600x1200; los otros DOS
  cuecen 600x1200. Cada horno mantiene su formato hasta que domina otro
  de su familia (así se detecta el cambio: tras muchos partes de
  200x1200, uno de 300x1200 = ese horno cambió). El flexible cuece
  600x1200 los días en que este supera 2,5 hornos equivalentes. Lo que
  aún se clasifica de un formato cuyo horno ya cambió es vaciado de
  stock. Se descartan los días de los extremos con menos del 50 % de la
  mediana de m² de la planta (datos parciales). Serie sin stock previo.
- Comprobación con datos reales (01/09–08/10): la planta se comporta
  como 4 hornos (3,5–4,2 hornos equivalentes al día); 600x1200 ≈ 2
  hornos y, cada ~7 días, 3 durante 2 días (rotación del flexible);
  1200x1200 hasta el 23/09 y 900x900 desde el 24/09 (solo coinciden el
  día del cambio). Balance resultante: 600x1200 ≈ 96 % del nominal,
  200x1200 ≈ 77 %, 1200x1200 ≈ 85 %, 900x900 ≈ 112 % (los dos grandes
  juntos ≈ 96 %); toda la planta ≈ 92 % del nominal. El desfase de
  200x1200 se concentra en los días tras volver el flexible desde
  600x1200 (la clasificación de la línea tarda ~1 día en arrancar).

Se retiraron el 09/10/2026 las dos nubes antiguas (producción del turno
vs % a plena; piezas/min a plena vs % a plena: decían algo obvio y
usaban el tiempo total) y la evolución temporal (difícil de leer).

## Qué se puede y qué no se puede inferir

- Con las cinco primeras semanas (31/08–06/10): por encima de unas 13,5
  piezas/min conseguidas la producción se aplana (rendimientos
  decrecientes) y el % a plena baja. Hay turnos hasta 15,6 piezas/min,
  pero solo 6 pasan de 15 y casi todos son cortos: no se puede fijar un
  tope ahí.
- Un turno completo llega a unas 5.500–5.600 piezas (600x1200); líneas
  con 13,2 y con 14,3 piezas/min conseguidas llegan al mismo techo.
- Comparar líneas mezcla la consigna con el estado de las máquinas, el
  modelo y quién la lleva: no prueba causa. Hace falta la consigna
  registrada y la prueba controlada (informe «Prueba de consigna: plan
  y hoja de anotación»).

## Pendiente

- Tabla `consigna` (id, linea_id, desde, valor piezas/min, created_by,
  created_at; una fila por cambio; la vigente es la última anterior al
  turno), con pantalla de administrador, y ampliar la vista
  `v_alimentacion_turno_linea` con tiempo alimentable, piezas por hora
  alimentable, «excedido» y «comparable». Tabla nueva = nace abierta:
  `enable row level security` + `revoke` en la misma migración.
- Gráfica «dónde se pierde la producción» (minutos medios por estado por
  cuartil de producción, banco y máquina en gris).
- Gráfica de piezas reales del turno vs velocidad conseguida (solo
  turnos comparables).
- Mostrar saturación/no alimentada y número de incidencias de
  producción por turno.
- Sustituir la inferencia de hornos por datos reales cuando se
  autorice: campañas por horno (¿derivables de la posición 1 de
  `programacion_orden` en cada `confirmar_programacion`?) o la
  producción real diaria del horno (informe diario a los encargados).
- Revisar si 8.700 m²/día es la cifra correcta de 900x900 (clasifica
  ≈ 112 % del nominal) y por qué la planta clasifica ≈ 92 % del nominal.
- Confirmar el valor de `REFERENCIAS_PIEZAS_MIN.consignaPropuesta`, los
  hornos/líneas de 300x1200, 300x600 y 600x600, y las reglas de turnos.
