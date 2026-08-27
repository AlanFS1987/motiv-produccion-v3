# 13 — App de jefe_rectificado

Rol `jefe_rectificado`: sección de **rectificado**, la etapa anterior
a clasificación (no es una variante de `jefe` pese al nombre heredado
del enum — nombre mantenido a propósito, ver decisión 26/08/2026).
Construido 26/08/2026, pendiente de verificar con datos reales
(vacío hoy: cuenta creada y acceso probado, sin partes de esta sección
todavía).

Sin operario ni responsable propios (esa sección no los tiene dentro
de esta app), sin Incidencias, sin Ceria, sin gamificación. Reutiliza
la tabla `parte` tal cual — sin tablas nuevas.

## Datos que usa (reducidos a propósito)

- **Tiempos**, en 3 bloques en vez de los 5 de `v_produccion_turno`:
  - Pleno rendimiento = `minutos_plena`
  - Paradas propias = `minutos_no_alimentada`
  - Paradas ajenas = `minutos_saturacion + minutos_maquina + minutos_banco`
  - Mismo suelo que el resto del proyecto: 480 min/línea (2880 si se
    suma el turno completo con las 6 líneas).
- **Calidad**: cuadre/descuadre de calibre (`calibre_com_pct` /
  `calibre_std_pct`, ya existentes en `parte`), no 1ª/comercial/eco/
  contenedor — a rectificado esas categorías no le aplican. Se
  presenta en piezas + m² + %.
- **Piezas/minuto**: piezas totales del turno ÷ minutos en pleno
  rendimiento. Métrica nueva, añadida también a `v_produccion_turno`
  (jefe a secas) el mismo día.

## Vistas SQL (`20260826150000_jefe_rectificado.sql`)

- `v_rectificado_turno` — por turno+línea, para Vista Rápida.
- `v_rectificado_modelo` — añade desglose por modelo, para el
  desglose de calidad de la Vista Detallada.

Ambas son propias, no reutilizan `v_produccion_turno`/`v_calidad_turno`
del jefe a secas (agregación distinta).

## RLS

Política aditiva `parte_select_jefe_rectificado` (SELECT únicamente,
sin INSERT/UPDATE/DELETE — el rol no gestiona ningún dato). `turno`,
`linea`, `configuracion`, `usuario` ya eran legibles por cualquier
autenticado/rol conocido, no hizo falta tocarlos.

## Frontend

- `components/rectificado/RectificadoApp.tsx` — shell propio, 2
  pestañas (Vista Rápida, Vista Detallada), mismo patrón de cabecera
  que `JefeApp.tsx`.
- `VistaRapidaRectificadoScreen.tsx` — responsive por CSS: 21 turnos
  en escritorio, 3 en móvil con flechas ← →, igual que el jefe.
- `VistaDetalladaRectificadoScreen.tsx` — acordeón turno → línea, con
  tabla de calidad por modelo al expandir. Filtros: fecha desde/hasta,
  turno, línea (sin responsable).
- `lib/dashboard-rectificado.ts` — funciones de consulta a las dos
  vistas.
- Bifurcación en `App.tsx`: `usuario.rol === "jefe_rectificado"` →
  `<RectificadoApp />`.

## Pendiente

Sin verificar todavía con datos reales de producción (falta que
entren los primeros partes de esta sección).