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
  `configuracion.fecha_inicio_rotacion` (= 31/08/2026). Cada día hay
  exactamente una letra en cada tipo y una descansando. Función SQL
  `fn_turno_de_letra(fecha, letra)` y su inversa `fn_letra_de_turno`.
  La rotación **nunca se pausa**, ni en el cierre anual de fábrica.
- **Estado del turno** (calculado en cliente, `lib/rotacion.ts`):
  `antes` (hasta 1 h antes de la franja) → `abierto` (desde 1 h antes
  hasta el fin) → `en_revision` (1 h después del fin) → `cerrado`.
  `descanso` si a la letra no le toca hoy. Para el turno N se mira
  también la fecha de ayer. `turno.cerrado_at` (manual o automático)
  prevalece sobre el cálculo.
- **Quién puede abrir un turno**: un responsable solo el que le toca
  por su letra (política RLS lo comprueba con `fn_turno_de_letra`); el
  `suplente` cualquiera dentro de la franja.
- **Cierre de fábrica** (`cierre_fabrica`, fecha inicio/fin): trigger
  impide insertar turnos en ese rango. No tiene pantalla; se gestiona
  por SQL.

## Suplente y refuerzo

- **Suplente** (responsable): una única cuenta ficticia `rol=suplente`,
  sin letra, exenta del candado de rotación (política RLS de `turno`:
  el suplente puede abrir cualquiera dentro de la franja). Se mantiene
  como cuenta compartida (decisión cerrada, sesión 19/08/2026): no se
  amplía a que cualquier responsable pueda abrir turno de otra letra.
  Dentro de un tramo cubierto por suplente no se distingue qué persona
  física capturó cada parte — la trazabilidad es `turno.abierto_por` y
  `parte.responsable_id`.
- **Cobertura por fuerza mayor** (procedimiento, no código — cierra
  `07-pendientes.md` "relevo a media jornada"): si el titular tiene
  que abandonar el turno ya empezado, quien cubre **sigue con la
  sesión ya abierta del titular** en el dispositivo — no cierra sesión
  ni entra con otra cuenta. Como `parte.responsable_id` no cambia, el
  UPDATE de los partes pendientes nunca choca con la política RLS
  (`responsable_id = auth.uid()`). Si el titular no llega a incorporarse
  desde el principio, el turno se abre directamente con la cuenta
  `suplente`. Si la sesión del titular caduca o se cierra sola mientras
  está ausente, quien cubre debe volver a entrar **con las credenciales
  del titular** (no con las suyas propias ni con `suplente`) para no
  romper la continuidad de `responsable_id` en los partes ya abiertos.
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
`parte.operario_id` (decisión sesión 19/08/2026, ver `CLAUDE.md` y
`04-gamificacion.md`). Si se reasigna la línea a mitad de turno, los
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
   `completado_at` (política RLS); después, solo el administrador
   (sin pantalla, y hoy sin permiso real de UPDATE en `parte` — ver
   `07-pendientes.md`).

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
del nombre del formato. Implementado en `lib/formato.ts` (cliente) y
`_shared/formato.ts` (Deno). No existe en SQL: las vistas de BD dejan
`m2_total` en null.

## Dos modos de calidad (siempre se muestran juntos)

- Con descarte: `1ª / (1ª + comercial + contenedor)` — coincide con el
  % Abs de la pantalla de la máquina.
- Sin descarte (u "oficial"): `1ª / (1ª + comercial)`.
- `eco` queda fuera de ambos mientras no se use en producción.