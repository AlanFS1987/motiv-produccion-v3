# 18 — Rol mecánico: frontend

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
