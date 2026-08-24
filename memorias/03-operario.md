# 03 — App del operario (comportamiento real)

Shell propio (`operario/OperarioApp.tsx`), se muestra cuando
`usuario.rol = 'operario'`. Cuatro pestañas: **Inicio**, **Mi línea**,
**Historial**, **Limpieza**. Dentro de Inicio hay una segunda barra
(solo visible ahí) con 4 sub-vistas: **Inicio** (turno + tarjeta
resumen), **Ranking**, **Stats+Avatar**, **Logros** — las tres últimas
son toda la gamificación del operario, descritas en `04`.

## Turno y pertenencia

Se calculan dos cosas distintas:
- **Turno personal** (rotación de su letra): solo para el mensaje de
  Inicio ("hoy es tu descanso", "tu turno empieza a las…").
- **Turno activo por reloj** (letra-agnóstico, misma función que el
  suplente): determina qué `turno_id` cargan Mi línea y Limpieza.

El operario **pertenece** al turno activo si su letra coincide con la
letra que trabaja ese turno, o si está dado de alta en
`refuerzo_operario_turno` para ese turno. Si no pertenece, Mi línea y
Limpieza muestran "pide al responsable que te añada como refuerzo" en
vez de datos de un turno ajeno.

## Inicio

`InicioOperarioScreen.tsx`. Dos bloques:
- Mensaje de estado del turno personal.
- Tarjeta resumen de gamificación, solo lectura
  (`ResumenGamificacionMini`, datos de `lib/inicio-gamificacion.ts`):
  avatar, nivel, puntos totales, progreso al siguiente nivel, desglose
  ciclo/piezas/rendimiento/limpieza, metros y tiempo plena totales.
  La generación del personaje no está aquí sino en Stats+Avatar (`04`).

Estilo: colores `slate-*` fijos como el resto de `operario/`, sin
migrar al sistema de temas (`12`).

## Mi línea

Fuente única: `parte.operario_id` (regla en `01`, "Asignación
operario → línea"). La tarjeta por línea se construye con los partes
de este turno cuyo `operario_id` es el operario logueado, agrupados
por línea; `asignacion_operario_linea` no se consulta. Consecuencias:
- Una línea asignada pero sin ningún parte creado todavía no aparece.
- Si el responsable reasigna la línea a mitad de turno, el parte ya
  abierto sigue siendo del operario saliente (lo ve y puede
  verificarlo); el entrante solo ve la línea desde el siguiente parte.

Cada tarjeta muestra el parte activo de la línea (lote, modelo, marca,
formato, tono, calibre — solo lectura) y el estado de **su propia**
verificación de caja y de códigos de barras (columnas `*_operario`,
independientes de las del responsable).

- Mientras el parte está `completado = false` puede verificar: foto de
  caja por cámara (sin galería, sin confirmación manual) → OCR →
  comparación idéntica a la del responsable → guarda
  `verificacion_caja_estado_operario`, `_detalle_operario`,
  `fotos_caja_operario`; y escáner de códigos →
  `verificacion_codbar_estado_operario` (`completo/parcial/no_realizada`).
- Cuando el parte se completa, los estados quedan en solo lectura; no
  hay ventana posterior.
- Solo puede hacerlo el operario cuyo `id = parte.operario_id`
  (política RLS). Si el parte se creó con la línea sin operario,
  `operario_id` es null y nadie puede verificar desde Mi línea.
- Sin parte activo (o sin ningún parte suyo en el turno): la línea
  simplemente no aparece en la lista.

## Historial
Lista de turnos de los últimos 15 días con sus partes (modelo, piezas,
tiempo). Solo lectura.

## Limpieza
Las 6 líneas con contador "N/6" de ítems hechos este turno. Desplegar
una línea (estado de UI, no escribe nada) muestra los 6 ítems de
`checklist_items` activos; cada uno libre o "hecho por X a las HH:MM".
Cualquier operario que pertenezca al turno puede limpiar cualquier
línea, esté o no asignado a ella.

Marcar un ítem: foto de **antes** (cámara, obligatoria) → foto de
**después** (obligatoria) → INSERT en `operario_checklist`. La
restricción UNIQUE (línea, turno, ítem) resuelve la concurrencia: si
otro lo marcó antes, el INSERT falla y la app avisa "ya lo hizo un
compañero". Fotos a Cloudinary carpeta `limpieza`, prefijos `antes_` /
`despues_`. Cada ítem vale 1 punto (columna `checklist_items.puntos`,
editable por el admin, hoy todas a 1); cómo suma en `04`.
