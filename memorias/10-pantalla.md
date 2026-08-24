# 10 — Pantalla de fábrica (carrusel)

Shell propio (`pantalla/PantallaCarrusel.tsx`), se muestra cuando
`usuario.rol = 'pantalla'`. **Con login** (usuario/contraseña, como
cualquier otro rol) — decisión de sesión: no se puede abrir la URL
desde cualquier sitio y ver datos de producción sin autenticarse. El
rol ya existía en BD (1 usuario real, de los 27 cargados) antes de
construir esta pantalla; solo hacía falta el shell y la bifurcación
en `App.tsx`.

Pensada para un monitor/TV físico en la fábrica: pantalla completa,
tema oscuro por defecto pero temable igual que el resto de la app
(ver `12-temas.md` — Pantalla no es un caso especial, es la primera
pantalla migrada al sistema de temas).

## Carrusel — 5 diapositivas, rotación automática cada 12s

Puntos de navegación abajo (clic para saltar directo), reloj en vivo
en la cabecera, mismo concepto que v2 mostraba en su pantalla
equivalente.

1. **Producción del ciclo** — REAL. 28 barras (2 columnas de 14),
   calcula solo en JS en qué ciclo de 28 días está la fecha actual
   (misma fórmula que `fn_ciclo_id`, replicada aquí porque es solo
   para pintar fechas, ningún cálculo de puntos depende de esto).
   Cada barra: % del objetivo diario de m² (`configuracion.objetivo_m2_dia`,
   valor de partida 35.000, editable por SQL hoy), con segmentos de
   1ª/comercial. Total del ciclo abajo.
2. **Últimos modelos en producción** — REAL. Los 9 productos con
   producción más reciente (`v_calidad_modelo` ordenada por
   `ultima_produccion`), donut de calidad completa y donut de calidad
   oficial por modelo, igual concepto que v2.
3. **Últimos turnos — KPI1 & KPI2** — REAL. Fórmulas cerradas en
   sesión:
   - **KPI1**: excluye `no_alimentada` y `fuera_producción` del
     cálculo (no son responsabilidad de esta línea/turno). Denominador
     = `plena + saturación + banco + máquina`. Solo 2 colores
     (verde=plena, rojo=alarma).
   - **KPI2**: turno completo, 4 categorías sobre `minutos_total`
     (plena, alarma = saturación+banco+máquina, no_alimentada, fuera
     de producción).
   - **fuera_producción** no se captura como dato — se infiere:
     `minutos_total − (plena+no_alimentada+saturación+banco+máquina)`,
     igual que el hueco "sin reportar" que ya existía en Vista Rápida.
4. **Ranking de operarios** — PLACEHOLDER ("zona en obras"). Toda la
   mecánica existe (`v_puntos_operario_ciclo`, `historial_ciclos` con
   ciclos 0..6 migrados de v2, `v_avatar_activo_operario`); falta solo
   la diapositiva.
5. **Reyes del formato** — PLACEHOLDER. El concepto ya está diseñado y
   construido en el Ranking del operario (`v_rey_formato_historico`,
   `v_rey_formato_actual`, ver `04`); falta solo adaptarlo a
   diapositiva.

## Archivos

`lib/pantalla-carrusel.ts` (datos: ciclo actual, últimos modelos,
últimos turnos con KPI1/KPI2 calculados en cliente a partir de los
minutos crudos de `v_produccion_turno` — no hizo falta vista SQL
nueva para esto) + `components/pantalla/PantallaCarrusel.tsx`
(las 5 diapositivas, donut SVG propio sin librería externa).
