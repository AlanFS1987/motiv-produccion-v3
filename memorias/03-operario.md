# 03 — App del operario (comportamiento real)

Shell propio (`operario/OperarioApp.tsx`), se muestra cuando
`usuario.rol = 'operario'`. Cuatro pestañas: **Inicio**, **Mi línea**,
**Historial**, **Limpieza**. La barra de gamificación como pestañas
propias (Ranking/Stats/Logros) está diseñada y no construida — pero
ojo, eso no significa que Inicio siga vacía de gamificación: desde
22/08/2026 Inicio ya incluye la tarjeta completa de nivel/puntos/
personaje (ver más abajo), es solo Ranking/Stats/Logros como
**pestañas separadas** lo que sigue sin construir.

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

**Construida y probada en real (22/08/2026)** —
`InicioOperarioScreen.tsx`. Dos bloques:

- Mensaje de estado del turno personal (sin cambios desde antes).
- **Tarjeta de gamificación** (`<GamificacionCard />`, mismo archivo):
  nivel actual con color de marco/estrellas, puntos totales, barra de
  progreso al siguiente nivel, personaje RPG (imagen + historia) si
  ya generó uno, selector de imagen de referencia + texto libre +
  botón "Generar mi personaje" (o "de nuevo"), contador de
  generaciones disponibles. Usa `frontend/src/lib/gamificacion.ts`
  (nuevo, genérico para operario y responsable) y llama a la Edge
  Function `generar-personaje` para la generación en sí — ver
  `04-gamificacion.md` para el detalle del proveedor (GPT Image 2) y
  el flujo completo.

Estilo: se mantuvo igual que el resto de `operario/` (colores
`slate-*` fijos, sin variables de tema) para no mezclar la migración
al sistema de temas con este cambio — ver `12-temas.md`.

## Mi línea

**Fuente única: `parte.operario_id`** (decisión sesión 19/08/2026, ver
`CLAUDE.md`). La tarjeta por línea se construye a partir de los partes
de este turno donde el operario logueado es el `operario_id` —
agrupados por línea —, no a partir de `asignacion_operario_linea`. Esa
tabla ya no se consulta aquí: es solo la herramienta que usa el
responsable para fijar qué operario se copia a `parte.operario_id`
cuando se crea el siguiente parte de esa línea (ver `01-dominio.md`).

Consecuencias de esto:
- Si el responsable asigna a un operario a una línea al abrir turno
  pero todavía no se ha creado ningún parte en ella (turno recién
  abierto, entre lotes), esa línea **no aparece** en Mi línea hasta que
  exista el primer parte con su `operario_id` — no hay un estado
  intermedio "asignado sin parte" que representar; es la ausencia
  natural de resultado en la consulta.
- Si el responsable reasigna la línea a otro operario a mitad de
  turno, el parte que ya estaba abierto **no cambia de dueño**: el
  operario saliente lo sigue viendo (y puede seguir verificándolo) en
  su Mi línea. El operario entrante solo verá esa línea a partir del
  siguiente parte que se cree, que ya llevará su `operario_id`.

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
`despues_`. Cada ítem vale 1 punto (`checklist_items.puntos`), **ya
sumado desde el 22/08/2026** por `v_puntos_limpieza_operario_por_turno`
y agregado al total del operario (`v_puntos_operario_total_vida`) —
ver `04-gamificacion.md`.
