# 08 — Dashboard del jefe

Shell propio (`jefe/JefeApp.tsx`), se muestra cuando `usuario.rol =
'jefe'`. Cuatro pestañas: **Vista Rápida**, **Vista Detallada**,
**Incidencias**, **Ceria** (ver `11-ceria.md`). Sin gamificación —
el jefe no quiere ver puntos/ranking/niveles, esa parte no aparece
aquí bajo ningún concepto.

## Regla que atraviesa todo el dashboard

Producción y calidad son **ejes independientes**, nunca se mezclan ni
se implica causalidad entre ellos (un paro de máquina no "explica" un
defecto de calidad, ni al revés) — misma regla que en Ceria. Se
cruzan solo por fecha/turno para pintarlos juntos en Vista Rápida,
nunca se combinan en una sola cifra.

## Fórmulas cerradas (todas en vistas SQL, nunca las calcula el cliente ni un LLM)

- **m²** = piezas × `formato.area_m2` (misma fórmula que en TS, `01`).
- **% rendimiento** (turno): suelo de 480 min **por línea**, luego se
  suman numeradores/denominadores ya resueltos entre líneas — nunca
  un suelo único al turno completo (mismo criterio que
  el rendimiento de gamificación, `04`).
- **Calidad completa**: cada categoría (1ª/comercial/eco/contenedor)
  sobre el total de `piezas_entradas`.
- **Calidad oficial** (métrica empresa): solo 1ª+comercial,
  recalculadas entre sí — eco y contenedor se excluyen del
  denominador, tratados como descarte. Siempre más alta que la
  completa. Las dos métricas se muestran **siempre juntas**, nunca
  una sola.
- Para agregar varios turnos (semana, mes) sin promediar porcentajes
  ya redondeados: `v_produccion_turno` expone también
  `rendimiento_numerador`/`rendimiento_denominador` crudos.

## Vistas SQL

- `v_produccion_turno` — por turno completo: piezas, m², tiempos,
  `pct_rendimiento` + numerador/denominador crudos.
- `v_calidad_turno` — por turno+fecha: piezas y m² por categoría,
  ambas métricas de calidad. Usada para cruzar con producción por
  fecha (Vista Rápida) y por la pantalla de fábrica.
- `v_calidad_modelo` / `v_calidad_lote` — histórico agregado por
  producto o por lote (sin fecha por defecto) — las usa también Ceria.
  `v_calidad_lote` sin `numero_orden` = modo ranking, varios lotes
  ordenados por `pct_1a_oficial`.

## Vista Rápida (`jefe/VistaRapidaScreen.tsx`, `lib/dashboard-jefe.ts`)

5 tarjetas KPI de los últimos 7 días (rendimiento, m², piezas, 1ª
completa, 1ª oficial) + gráfica de barras apiladas por tiempos
(plena/no_alimentada/saturación/banco/máquina), con calidad 1ª oficial
del turno debajo de cada barra en azul (separado visualmente).
Responsive por CSS, no JS: escritorio ve la semana completa (hasta 21
barras), móvil un día a la vez con flechas ← →, mismos datos.

## Vista Detallada (`jefe/VistaDetalladaScreen.tsx`, `lib/dashboard-detallada.ts`)

Acordeón de 3 niveles turno → línea → parte (no tabla ancha de
columnas fijas, no funciona en móvil). Filtros: fecha desde/hasta,
turno, línea, responsable. Cada parte, al expandir, muestra TODO lo
capturado y todo lo calculable, en secciones: Lote, Piezas
capturadas, Calibres cal_1-8 (solo si hay alguno), m² por categoría
(calculado), calidad completa (calculado), calidad oficial
(calculado), Tiempos, Verificaciones (4: caja/códigos ×
responsable/operario), Metadatos, Incidencias de calidad del parte.
Cada línea muestra sus incidencias de producción propias; cada turno,
las generales (`linea_id = null`).

## Incidencias (`jefe/IncidenciasScreen.tsx`, `lib/dashboard-incidencias.ts`)

Dos bloques **separados** (nunca combinados en una lista), con fondo
de color distinto para que no se puedan confundir ni visualmente:
producción (rojo) y calidad (ámbar). Mismo filtro de fechas para
ambos, consultas independientes.

## Panel de administrador

Ve las mismas 4 pestañas del jefe (`admin/AdminApp.tsx` reutiliza los
componentes de `jefe/`, no los duplica) más sus propias pestañas de
gestión — ver `09-administrador.md`.
