# 10 — Rol mecánico: frontend

Continuación de `17-rol-mecanico-plan.md` (decisiones de producto) y
de las actualizaciones de `01-dominio.md`/`06-esquema-bd.md` (esquema
ya construido y verificado). Este archivo registra qué pantallas
existen ya y cuáles siguen pendientes, para no perder el hilo entre
sesiones.

Shell propio: `mecanico/MecanicoApp.tsx`, montado en `App.tsx` cuando
`usuario.rol === 'mecanico'`. Cuatro pestañas: Incidencias, Almacén,
Engrase, Unidades.

## Construido

- **Incidencias** (`mecanico/IncidenciasScreen.tsx`,
  `lib/mecanico-incidencias.ts`) — cola compartida entre los 2
  mecánicos (decisión de sesión: cualquiera contesta cualquiera
  pendiente, sin reparto por quién la creó). Lista con filtro
  "solo pendientes", cada tarjeta con la incidencia original y, si
  existe, la respuesta debajo (misma fila, sin política de
  visibilidad separada — quien ve la incidencia ve la respuesta).
  Responder reutiliza `FormularioIncidencia.tsx` (texto + fotos) tal
  cual, con el checkbox "no requiere intervención" añadido por fuera,
  sin modificar ese componente compartido. Sin reapertura: la propia
  política RLS de `UPDATE` (`respuesta_fecha is null`) es lo que lo
  impide, la pantalla solo deja de ofrecer el botón "Responder".

- **Engrase** (`mecanico/EngraseScreen.tsx`, `lib/mecanico-engrase.ts`)
  — "Nuevo parte": elegir línea (reutiliza `listarLineas()` de
  `lib/turno.ts`), checklist de `engrase_punto` con checkboxes,
  marcado parcial permitido (solo se insertan filas de los puntos
  hechos). Historial filtrable por línea. La checklist en sí la
  rellena el admin desde su propia pantalla (`09-administrador.md`,
  "Puntos de engrase") — sin eso, la pestaña del mecánico se ve vacía
  y no se puede crear ningún parte (le pasó justo esto en la sesión
  de construcción: faltaba dar de alta los puntos antes de poder
  probar el formulario).

- **Almacén** (`mecanico/AlmacenScreen.tsx`, `lib/almacen.ts`) —
  construido en piezas:
  1. Árbol (acordeón máquina → categoría → repuestos, mismo patrón
     visual que `VistaDetalladaScreen` del jefe) + ficha de repuesto
     (stock de `v_almacen_stock`, referencias, historial de
     movimientos). Solo lectura.
  2. Alta de repuesto (`NuevoRepuestoForm.tsx`) — formulario único,
     categoría siempre obligatoria ("por catalogar" preseleccionada).
     Incluye "+ Proveedor nuevo" y "+ Categoría nueva" inline en sus
     respectivos desplegables, sin salir del formulario ni necesitar
     una pantalla de gestión del árbol aparte. La categoría nueva
     genera su propia `clave` (slug + sufijo aleatorio para unicidad,
     `crearCategoria()` en `lib/almacen.ts`) — no sigue el patrón
     punteado exacto de Ceria, solo garantiza ser única.
  3. Movimientos manuales (`MovimientoRepuestoForm.tsx`, dentro de la
     ficha) — salida (el mecánico introduce positivo, se guarda en
     negativo) y ajuste (el mecánico introduce el signo real). Sin
     función de "entrada manual" a propósito: la entrada siempre sale
     de marcar recibida una línea de pedido (pieza 4, pendiente) —
     para cargar el stock inicial de algo que ya tenéis físicamente,
     se usa un ajuste positivo con nota, no hace falta un tipo nuevo.

  Foto del repuesto: categoría Cloudinary `almacen-repuestos`, preset
  `motiv_v3_almacen_repuestos`. **Importante para despliegues
  futuros**: las variables `VITE_*` de Vercel se configuran en su
  dashboard (`Settings → Environment Variables`) y **no** se leen de
  ningún archivo del repo — `.env.local` es solo para desarrollo
  local y está en `.gitignore` a propósito. Cambiar/añadir una
  variable ahí requiere además un **Redeploy** manual (o un push
  nuevo); el deploy ya existente no la recoge solo.

## Pendiente

- **Almacén, pieza 4 — Pedidos**: crear pedido, añadir líneas, marcar
  línea como recibida (dispara el movimiento de entrada solo, vía
  `fn_almacen_pedido_linea_recibida`). Bloqueado por una decisión sin
  cerrar: qué hacer con el estado de un pedido con cero líneas
  recibidas todavía (ver `06-esquema-bd.md`, sección de este bloque —
  hoy `v_almacen_pedido_estado` lo resuelve como `'pendiente'`, un
  tercer estado añadido por decisión propia sin confirmar con el
  plan original).

- **Unidades intercambiables** — pestaña entera sin construir, sigue
  en placeholder ("en construcción").

- **Vistas de producción para el mecánico** (detectar anomalías de
  máquina) — ni siquiera tiene pantalla asignada dentro de las 4
  pestañas actuales; sigue exactamente donde lo dejó
  `17-rol-mecanico-plan.md`.

- **Revisar `v_almacen_stock` bajo RLS** — señalado al construir la
  pieza 1 del almacén y nunca verificado: las vistas en
  Postgres/Supabase se ejecutan por defecto con los permisos de quien
  las creó, no de quien consulta, así que podría estar leyéndose sin
  pasar por la política de `almacen_movimiento`. Fix si hiciera falta:
  `alter view v_almacen_stock set (security_invoker = true);`.

- **Migración a temas** (`12-temas.md`) — `MecanicoApp.tsx` y todas
  sus pantallas usan `slate-*`/`text-[var(--texto)]` mezclados, sin
  pasar limpiamente por el sistema de temas — mismo estado que
  `AjustarLetrasScreen.tsx`, no es una regresión de esta sesión, es
  que nunca se migró.

# Rol mecánico — plan de implementación

Documento de organización previo a construir nada. Recoge las decisiones
tomadas en la sesión de planificación (16/09/2026), antes de escribir
migraciones ni código. Solo somos 2 mecánicos, no hay turnos de mecánico
(a diferencia de operario/responsable) — la identificación es simplemente
quién de los dos hizo cada cosa.

Cinco bloques, con acoplamiento distinto a la BD actual:

1. Incidencias de producción (toca una tabla que ya existe)
2. Rol de usuario `mecanico` (toca el panel de administrador)
3. Almacén de repuestos (nuevo, aislado)
4. Mantenimiento preventivo — checklist de engrase (nuevo, aislado)
5. Unidades intercambiables — cabezales de flejado y calderines de
   cola-cera (nuevo, aislado)

---

## 1. Incidencias de producción

Hoy `incidencia_produccion` solo permite crear (responsable/jefe) y leer
(jefe, Ceria). No tiene concepto de respuesta ni estado.

**Decisión de sesión:** el mecánico contesta con texto libre + imágenes,
igual que se crea la incidencia. Hay incidencias que no requieren ninguna
intervención física (el mecánico solo necesita decir "esto no es cosa
mía" o similar) — debe poder marcarse así en la propia respuesta, no
tratarse como un caso aparte.

**Flujo:** `pendiente → contestada`. Sin reapertura. Si el problema
vuelve a ocurrir después de contestada, se crea una incidencia nueva, no
se reabre la anterior. Esto simplifica el estado a algo lineal — no hace
falta histórico de varias respuestas por incidencia.

**Queda registrado:** qué mecánico contestó (de los 2), aunque no haya
turnos formales de mecánico — es gratis de capturar y puede ser útil más
adelante ("¿quién tocó esto la última vez?").

**Pendiente de decidir al construir:** cómo se le muestran al mecánico
las incidencias pendientes (¿lista propia en su rol, filtrada por
`pendiente`?) — no se ha hablado de la pantalla en sí, solo del dato.

---

## 2. Rol de usuario `mecanico`

Nuevo rol, se añade a la creación de usuarios ya existente en el panel
de administrador (mismo patrón que los roles actuales: responsable,
operario, jefe, calidad...). El admin (que es la misma persona que uno
de los 2 mecánicos) se creará su propia cuenta con este rol.

**Pendiente de decidir al construir:** permisos/RLS exactos del rol
(qué tablas puede leer/escribir) — se definirá junto con cada bloque de
abajo, no de golpe aquí.

---

## 3. Almacén de repuestos

Es, con diferencia, el bloque más grande — casi un sub-módulo propio.

### 3.1. Árbol de organización

`máquina → submáquina → repuesto`, reutilizando el mismo patrón
jerárquico que ya existe en `ceria_documentacion_maquina` (claves tipo
`bs08.divisor.pieza...`), para que el mecánico navegue el almacén con la
misma lógica que ya usa en la documentación de NORA.

**Categoría "por catalogar":** categoría real más dentro del árbol (una
máquina/submáquina "comodín"), no un estado especial ni un campo nulo.
Un repuesto siempre pertenece a una categoría del árbol, sin excepción —
así toda la lógica de "repuestos por máquina" funciona igual sin tener
que contemplar el caso "sin categoría" aparte. Reclasificar un repuesto
más adelante es un simple cambio de categoría.

### 3.2. Ficha de repuesto

- Nombre/descripción, imagen
- Proveedor(es) — puede haber más de uno
- **Referencias** — tabla propia aparte, no un campo de texto: un mismo
  repuesto puede tener varias referencias, una por proveedor/fabricante
  que lo vende con su propio código
- Stock actual — **campo calculado**, no editable directamente (ver 3.3)

### 3.3. Movimientos de stock

Cada entrada o salida es una fila propia, nunca se pisa un número
directamente. Tipos de movimiento:

- **Entrada** — normalmente generada por la recepción de una línea de
  pedido (ver 3.4), no un formulario aparte
- **Salida** — se usó el repuesto (en una intervención de mantenimiento
  correctivo, por ejemplo)
- **Ajuste** — recuento físico que no cuadra con lo calculado; también
  es un movimiento, no una edición directa del campo de stock

El stock actual del repuesto se calcula sumando sus movimientos.

**Negativos permitidos.** Puede saltar por dos motivos distintos, que se
tratan igual (un repuesto en negativo simplemente aparece marcado en el
almacén hasta que un pedido lo compensa — no hay dos flujos separados):

1. El repuesto ya existía en el catálogo pero el stock real es más bajo
   de lo que la BD cree (algo no se registró bien antes)
2. El repuesto se da de alta al vuelo en el momento de usarlo, sin
   catálogo previo — nace en 0 y la primera salida ya lo deja en -1

### 3.4. Pedidos

- **Cabecera:** fecha, proveedor, estado
- **Estado de cabecera es derivado, nunca editable a mano** — se calcula
  de sus líneas: si alguna línea sigue sin recibir, la cabecera está
  "parcial"; si todas están recibidas, "recibido completo". Necesario
  porque los pedidos llegan por fascículos (piezas sueltas en distintos
  envíos), y un estado editable a mano acabaría desincronizado
- **Líneas de pedido:** repuesto + cantidad pedida + recibido (sí/no) +
  fecha de recepción de esa línea concreta
- Marcar una línea como recibida genera automáticamente el movimiento de
  entrada de stock de ese repuesto — no se registra por duplicado en dos
  sitios distintos

### 3.5. Alta de repuestos "sobre la marcha"

Como no hay nada registrado todavía, debe ser posible dar de alta un
repuesto nuevo **desde cualquier punto de la app** donde tenga sentido:
desde el almacén (al ir catalogando lo que ya hay físicamente) o desde
un pedido (al pedir algo que aún no está en el catálogo).

**Decisión de sesión:** un único formulario de "nuevo repuesto"
reutilizado desde ambos sitios, no dos versiones. La ubicación en el
árbol (máquina/submáquina) **es obligatoria siempre**, nunca opcional —
si en el momento de crearlo no se sabe con certeza dónde encaja, se le
asigna la categoría "por catalogar" (ver 3.1) y se reclasifica más
adelante desde el almacén.

---

## 4. Mantenimiento preventivo — checklist de engrase

Hoy es un proceso mental: cada ~3 meses toca engrasar y revisar
visualmente ciertos puntos de cada línea. Se digitaliza tal cual, sin
inventar mecanismos nuevos que hoy no existen.

**Decisión de sesión:**

- La checklist de puntos a engrasar/revisar es **la misma para todas las
  líneas**
- La lista de puntos vive en **su propia tabla, editable** (no fija en
  el código) — hoy la lista es provisional y es probable que se añadan
  puntos según se vaya implantando en la app, aunque se espera que se
  estabilice pronto. Edición reservada al admin
- El registro de una revisión se trata como un **"parte" más**, al
  mismo estilo que los partes de producción: línea + fecha + qué
  mecánico lo hizo + qué puntos de la lista se marcaron esta vez
- **Marcado parcial permitido** — si de N puntos solo da tiempo a
  marcar algunos, el parte se guarda igual con esos marcados; los demás
  quedan simplemente sin marcar en ese registro concreto. No hay
  seguimiento independiente por punto ("última vez que se hizo EL punto
  X"), el seguimiento es por parte completo
- **Sin disparador.** No hay alertas ni avisos automáticos de "toca
  revisión". La periodicidad de 3 meses es aproximada y la gestionáis
  vosotros de memoria — el sistema solo necesita dejar registro de
  cuándo se hizo cada vez, no recordároslo

---

## 5. Unidades intercambiables (cabezales de flejado, calderines de cola-cera)

Esto es distinto del almacén de repuestos del bloque 3: un repuesto
normal es *fungible* (no importa cuál de las N juntas idénticas se usa,
solo cuántas quedan). Estas unidades son *concretas e identificables* —
cada una tiene su propia identidad y su propio historial, aunque varias
sean del mismo modelo.

**Contexto:** son piezas de quita-y-pon. Cuando una máquina necesita que
el fabricante repare/revise una de estas partes, no se queda la línea
sin ella — se monta la unidad de repuesto que hay en el almacén, y la
que se estropeó se manda fuera. Cuando vuelve reparada, pasa a ocupar el
lugar de repuesto (o se monta en otra línea si hace falta).

**Volumen real:** 7 cabezales de flejado en total (6 montados + 1 de
repuesto), 20 calderines de cola-cera (18 montados + 2 de repuesto).
Volumen bajo, cada unidad merece ficha propia — no tratarlo como stock
genérico.

**No maneja dinero.** Sin coste ni factura de la reparación — eso queda
fuera de la app por completo, ni aquí ni en ningún otro punto.

**Decisión de sesión — modelo de datos:** hace falta **historial de
movimientos** (una fila por evento), no solo un campo de "ubicación
actual" que se sobrescribe. Motivo explícito: se necesita registrar
tanto cuándo sale a reparación como cuándo vuelve y se remonta en una
línea, para poder calcular cuánto duró cada reparación restando fechas
entre ambos eventos — con un único campo de estado actual esa duración
se perdería en cuanto se sobrescribe.

Cada fila de movimiento, como mínimo: unidad, tipo de evento (sale a
reparar / vuelve y se monta), fecha, línea en la que queda montada
cuando vuelve. La ubicación actual de una unidad se calcula siempre a
partir de su último movimiento, nunca se guarda como campo aparte.

**Visibilidad:** solo hace falta que quede registrado (consulta /
historial). No hace falta alerta ni que otras partes de la app (NORA,
diagnóstico) sepan en tiempo real qué unidad concreta está montada.

---

## Resumen de decisiones transversales

- Nada de esto maneja dinero (ni costes, ni facturas, en ningún bloque)
- Donde hace falta saber "cuánto duró algo" (reparación externa), el
  dato se registra como historial de eventos con fecha, nunca como un
  campo que se sobrescribe
- Donde un valor puede derivarse de otros datos ya registrados (estado
  de un pedido, stock de un repuesto, ubicación actual de una unidad),
  se calcula — no se guarda ni se edita a mano por separado, para evitar
  que se desincronice
- Reutilizar patrones ya existentes en la app en vez de inventar nuevos:
  el árbol máquina/submáquina de Ceria para organizar el almacén, el
  concepto de "parte" de producción para el registro de engrase

## Permisos del rol `mecanico` (decisión de sesión, 16/09/2026)

- **Lectura — incidencias de producción:** acceso a todo lo necesario
  para entenderlas (no limitado a las suyas ni a las pendientes)
- **Lectura — datos de producción:** acceso a la producción por
  máquina/línea (mismo tipo de datos que hoy consulta el jefe), con un
  fin explícito: poder detectar anomalías de la máquina que nadie ha
  reportado todavía como incidencia. Falta concretar en la siguiente
  fase a qué vistas exactas necesita acceso (`v_produccion_turno`,
  `get_partes`...) — de momento la intención es "ver cuánto produce
  cada máquina", no necesariamente todo lo que ve el jefe
- **Escritura — incidencias:** solo sus propias respuestas (texto +
  imágenes), no puede editar la incidencia original ni las respuestas
  de otras incidencias
- **Escritura — repuestos:** acceso completo de escritura a todo el
  bloque de almacén (altas de repuesto, movimientos de stock, pedidos y
  sus líneas) — es su terreno propio, sin restricción adicional

## Pendiente para la siguiente fase (diseño técnico / migraciones)

- Concretar qué vistas/tablas de producción exactamente necesita leer
  el mecánico (ver nota arriba)
- RLS de mantenimiento preventivo y unidades intercambiables (no se ha
  hablado explícitamente, pero por coherencia con lo de arriba
  probablemente sea lectura+escritura completa igual que repuestos)
- Pantalla(s) de incidencias pendientes para el mecánico
- Esquema SQL concreto de cada bloque (tablas, claves, índices)
- Decidir si el almacén y las unidades intercambiables comparten sección
  de navegación en la UI o van separados
