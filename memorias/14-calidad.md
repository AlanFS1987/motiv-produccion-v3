# 14 — App de calidad

Rol `calidad`: shell propio de **una sola vista, sin pestañas**
(`calidad/CalidadApp.tsx` → `CalidadLotesScreen.tsx`), construido y
probado en acceso el 27/08/2026 (sin datos reales todavía). Ya tenía
RLS de lectura sobre `parte` e `incidencia_calidad` desde el diseño
original — no hizo falta tocar RLS ni crear vistas SQL nuevas, todo
sale de `v_calidad_lote` (ya existente) más consultas directas a
`parte`/`incidencia_calidad`/`modelo` para lo que esa vista no cubre.

Sin gamificación, sin Ceria, sin Incidencias (ámbar) de jefe — es una
pantalla propia, no una pestaña compartida con `JefeApp`.

## Qué muestra

**Últimos 15 lotes** (abiertos o cerrados, sin filtrar por `estado`),
una tarjeta por lote, ordenados por `ultima_produccion`. Cada tarjeta:

- 2 donuts SVG (mismo patrón sin librería que `PantallaCarrusel.tsx`,
  no importado de allí para no acoplar shells):
  - **Completa**: 1ª / comercial / contenedor. **Eco no se usa en
    esta sección** — se ignora del todo, no se combina con
    contenedor ni se muestra.
  - **Oficial**: 1ª / comercial (misma métrica que el resto de la
    app).
- Al hacer click, se expande el **desglose por tono** de ese lote
  (consulta directa a `parte` agrupada en cliente por `tono`, con las
  mismas fórmulas completa/oficial recalculadas por tono).
- Si el lote tiene alguna incidencia de calidad, aparece un botón
  ámbar con el recuento; al abrirlo lista **todas** las incidencias
  (no solo la última) con foto y texto.

## Buscador

Un filtro activo a la vez (no se combinan): por fecha, por número de
orden, o por modelo (autocompletado por substring — `ILIKE '%texto%'`
contra `modelo.nombre`, encuentra "SL MARMOL LISO" escribiendo solo
"marmol"). Con búsqueda activa, se mantiene el límite de 15 — los 15
más recientes que coincidan, no todos los que coincidan.

**Limitación conocida del filtro de fecha**: `v_calidad_lote` agrega
todo el histórico de un lote sin fecha por fila (solo
`primera_produccion`/`ultima_produccion`). El filtro comprueba
`primera_produccion <= fecha <= ultima_produccion` — un lote que
estuvo parado semanas y se retomó puede aparecer en fechas donde no
se tocó realmente. Si esto molesta en real, hace falta una vista
nueva que una por `turno.fecha`.

## Archivos

- `lib/dashboard-calidad.ts` — consultas a `v_calidad_lote`,
  desglose por tono, conteo/listado de incidencias, autocompletado
  de modelo.
- `components/calidad/CalidadApp.tsx` — shell (cabecera + una vista).
- `components/calidad/CalidadLotesScreen.tsx` — buscador + tarjetas +
  desglose + panel de incidencias.
- Bifurcación en `App.tsx`: `usuario.rol === "calidad"` →
  `<CalidadApp />`.

## Reutilización

`CalidadLotesScreen.tsx` se reutiliza tal cual (sin props nuevos) como
5ª pestaña de `jefe/JefeApp.tsx` y `admin/AdminApp.tsx` — decisión de
sesión 27/08/2026: "exactamente igual" a como lo ve `calidad`. Ver
`08-dashboard-jefe.md`. No hizo falta ampliar RLS: jefe/admin ya
tenían SELECT sobre `parte`/`incidencia_calidad`/`modelo`.

## Pendiente

Sin verificar con datos reales de calidad todavía.