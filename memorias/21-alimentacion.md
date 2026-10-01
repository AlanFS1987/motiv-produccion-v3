# 21 — Vista Alimentación (rendimiento vs velocidad)

Pestaña "Alimentación" (sesión 01/10/2026). Objetivo: ver cómo se
relacionan la velocidad a la que trabaja cada línea (piezas/min a
plena), el tiempo que pasa a plena y lo que realmente sale del turno,
para acercarse al punto óptimo de alimentación.

Componente autocontenido y sin props (`alimentacion/AlimentacionPanel.tsx`,
mismo patrón que `InformesScreen`): se monta igual en `JefeApp`,
`AdminApp` y `ProduccionApp`. Eje de **producción**, sin calidad.

## Métricas (nada nuevo que capturar)

- **Piezas/min a plena** = `piezas_entradas` ÷ `minutos_plena`. Se usa
  como "consigna efectiva": es lo que la máquina CONSIGUE, no lo que se
  le pidió. La consigna real (la que se fija en la máquina) NO se
  captura: es una foto de un instante, cada línea tiene la suya y se
  decidió no depender de ella.
- **Piezas/min del turno** = `piezas_entradas` ÷ `minutos_total`
  **reales, sin el suelo de 480**. El suelo es correcto para el %
  de rendimiento oficial, pero aquí penalizaría turnos cortos sin que
  haya un problema de alimentación.
- **% a plena** = 100 × `minutos_plena` ÷ `minutos_total`. **No es el
  % de rendimiento oficial** (aquel suma también `minutos_no_alimentada`
  y aplica el suelo de 480).
- Identidad: piezas/min del turno = piezas/min a plena × % a plena.
  Por eso las dos nubes se leen juntas.
- Al agrupar varios turnos (día, semana): **sumar piezas y minutos y
  dividir al final**, nunca promediar cocientes.

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

## Qué turnos entran

- Solo turnos+línea con **un único formato** (los partes pequeños de un
  turno pueden ser de formatos distintos, poco habitual). Los mixtos se
  descartan y se cuentan aparte.
- Solo minutos totales dentro de `RANGO_MINUTOS_VALIDOS` (360–540,
  PROVISIONAL) y con minutos a plena > 0. Por encima suele ser una
  estadística de apiladores sin resetear (ver `08`).
- El panel muestra siempre "N incluidos · M excluidos por mezcla · K por
  minutos fuera de rango".
- Efecto a tener en cuenta: los turnos mixtos suelen ser los que más
  tiempo pierden, así que al excluirlos el % a plena sale algo más alto
  que el real. Esta pantalla sirve para comparar turnos limpios entre
  sí, **no como dato oficial** de rendimiento (para eso, Vista Rápida).

## Pantalla

Filtros comunes: formato (obligatorio, por defecto 600x1200), hasta 4
líneas (solo las que han producido ese formato) y periodo de las nubes
(90 / 180 / 365 días).

1. Nube: piezas/min del turno vs % a plena, con tendencia, r y
   referencias de horno (12,15) y Griffon (11,9).
2. Nube: piezas/min a plena vs % a plena, con Griffon y consigna
   propuesta (13).
3. Evolución con selector 3 días (un punto por turno) / semana (por
   día) / mes (4 semanas + la actual) / trimestre (12 + la actual).
   Cada línea y periodo lleva dos puntos unidos por una raya: arriba
   (relleno) piezas/min a plena, abajo (hueco) piezas/min del turno. La
   raya es lo que se pierde por el tiempo que no está a plena. Los
   periodos sin turnos válidos quedan como hueco, nunca como cero. La
   semana en curso se marca con `*`.

Al pasar el ratón (o tocar en móvil) sobre un punto sale la ficha: fecha
y turno (o periodo), línea, formato, piezas, minutos, % a plena, las dos
velocidades y el % de saturación y de no alimentada.

Sin zoom por ahora (ver Pendiente). Las referencias de piezas/min viven
en `REFERENCIAS_PIEZAS_MIN`, un único sitio.

## Qué se puede y qué no se puede inferir

- Como la "consigna" es el resultado de la división y cada línea trabaja
  con una consigna casi fija, **dentro de una línea la velocidad apenas
  varía**. Comparar líneas entre sí mezcla el efecto de la consigna con
  todo lo demás (estado de las máquinas, empaquetadora, posición
  respecto al Griffon).
- Lo que sí se ve: cuánto tiempo a plena se pierde a cada velocidad, y
  si ese tiempo perdido es saturación (aguas abajo) o no alimentada
  (aguas arriba) — dato en la ficha de cada punto.
- Para atribuir un cambio de velocidad a la consigna hace falta el
  histórico de cambios de consigna de una línea (antes/después en la
  misma línea) o anotar un número al empezar el parte.

## Pendiente

- Confirmar el rango de minutos válidos (360–540 es provisional).
- Confirmar los valores de `REFERENCIAS_PIEZAS_MIN` (tomados de la
  gráfica de trabajo).
- Zoom en las nubes, solo escritorio (arrastrar rectángulo + botón de
  restablecer; sin zoom en móvil). Fase 2.
- Saber si alguna línea ha cambiado de consigna en el histórico.
- Decidir si algún día se anota la consigna real al empezar el parte.
- Posible: clic en un punto abre ese turno en la Vista Detallada.
- Verificar que cada parte pequeño tiene un único formato (la vista ya
  tolera mezcla a nivel de turno+línea, pero no a nivel de parte).
