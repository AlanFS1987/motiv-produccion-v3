# 12 — Sistema de temas

`context/ThemeContext.tsx` + `components/ThemeSwitcher.tsx`. Único
sistema para toda la app (Operario, Responsable, Jefe, Administrador,
Pantalla) — construido a raíz de que Pantalla se había hecho con tema
oscuro fijo; en vez de revertirla a claro, se decidió construir el
sistema para todos a la vez.

## Diseño

5 temas (`TemaId`): **Oscuro**, **Claro**, **Naturaleza** (verde, con
fondo de blobs orgánicos), **Cyberpunk** (neón magenta/cian sobre
fondo oscuro con rejilla + scanline), **Sistema** (sigue
`prefers-color-scheme` del SO en vivo, con listener a cambios).
Persistencia en `localStorage` (`motiv_tema`) — si el usuario elige
"Sistema", se guarda esa elección, no el tema resuelto en ese
momento, para que siga siguiendo al SO aunque cambie.

**Historia**: el diseño original tenía "Cielo" (paleta azul plana)
en vez de Cyberpunk — se sustituyó (sesión 28/08/2026) porque era
visualmente casi idéntico a "Claro" (mismo patrón de fondo claro +
superficie blanca, solo cambiaba el matiz del acento) y un
responsable comentó que la app en general se veía "seria y nada
divertida". Cyberpunk introduce el primer tema con fondo con textura
real (rejilla + glow + scanline animado) en vez de un color plano.

Variables CSS (`index.css`, bloque `[data-tema="..."]`): `--fondo`,
`--superficie`, `--superficie-alt`, `--texto`, `--texto-secundario`,
`--texto-tenue`, `--borde`, `--acento`, `--acento-texto`. Los
componentes las usan con sintaxis de valor arbitrario de Tailwind v4:
`bg-[var(--fondo)]`, `text-[var(--texto)]`, etc.

**Naturaleza y Cyberpunk usan `rgba(...)` con alfa** en `--fondo` (y
en `--superficie`/`--superficie-alt` de Naturaleza) en vez de hex
opaco — necesario porque cada shell pinta un `<div
class="bg-[var(--fondo)] min-h-screen">` encima de todo; si fuera
opaco taparía el fondo con textura puesto en `html[data-tema="..."]`
vía `background-image` (gradientes CSS puros, sin assets ni SVG
externos, coste cero). Los otros 3 temas (Oscuro, Claro, Sistema)
siguen con `--fondo` hex opaco y sin textura — quedó pendiente
decidir si se les añade algo similar más adelante.

### Cyberpunk — parafernalia extra (sesión 28/08/2026)

Por encima de la base (rejilla + glows + `--sombra-neon` en bordes,
superficies y acento vía selectores `[class*="..."]` que enganchan a
las clases arbitrarias de Tailwind sin tocar componentes), tiene dos
animaciones:

- **Pulso de brillo** del fondo entero (`cyberpunk-pulso`, 6s,
  `filter: brightness/saturate`).
- **Scanline** — banda horizontal que se desplaza de arriba a abajo
  (`html[data-tema="cyberpunk"]::after`, `mix-blend-mode: screen`,
  `pointer-events: none` para no interferir con clics). Velocidad
  controlada por el `animation` de `cyberpunk-escaneo`: se probó a
  4.5s (percibido como demasiado agresivo para una pantalla que se
  mira todo el turno) y se dejó fija en **20s** — da vidilla ambiental
  sin cansar la vista. Si se quiere ajustar en el futuro, ese único
  número es el que hay que tocar, nada más de la regla depende de la
  velocidad.

## `<ThemeProvider>` y switcher

`<ThemeProvider>` envuelve `<App />` en `main.tsx` (junto a
`AuthProvider`, orden entre ambos indistinto). `<ThemeSwitcher />` es
un componente de 5 puntos de color, se coloca en la cabecera de
cualquier shell.

**Nota de migración de datos**: el id interno pasó de `"cielo"` a
`"cyberpunk"` — cualquier usuario con `"cielo"` guardado en
`localStorage` simplemente cae a "Claro" la próxima vez que abra la
app (fallback ya existente en `ThemeContext`, no rompe nada; no se
hizo migración explícita del valor guardado).

## Estado de la migración (importante — no todo está migrado)

**Marco exterior migrado a variables** (selector cambia algo visible
de verdad):
- `pantalla/PantallaCarrusel.tsx` — completo, incluidas las 3
  diapositivas reales (tarjetas, textos).
- `admin/AdminApp.tsx`, `jefe/JefeApp.tsx` — cabecera y barra de
  pestañas.
- `App.tsx` (shell de responsable) y `operario/OperarioApp.tsx` —
  cabecera y barra de pestañas.

**Gamificación del operario migrada (sesión 28/08/2026)** — las 3
pantallas reutilizadas tanto en Inicio del operario como en el panel
"Progreso" del responsable:
- `operario/RankingOperarioScreen.tsx` (podio, resto de la lista,
  bloque "Tú" y Reyes del formato — los bloques "Tú" pasaron de azul
  fijo a `var(--acento)`).
- `operario/StatsAvatarOperarioScreen.tsx` (4 barras, tarjeta de
  avatar, picker y generador — selección activa con
  `ring-[var(--acento)]`/`border-[var(--acento)]`).
- `operario/LogrosOperarioScreen.tsx` (contador, barra de progreso,
  tarjetas de logro — el verde de "desbloqueado" y el ámbar/rojo de
  estado se dejaron fijos a propósito, son colores de estado, no de
  tema; los contadores `×N` pasaron de azul fijo a `var(--acento)`).

**Sin migrar todavía** (contenido interior con colores `slate-*`
fijos — el marco cambia pero por dentro sigue en claro):
`jefe/VistaRapidaScreen.tsx`, `jefe/VistaDetalladaScreen.tsx`,
`jefe/IncidenciasScreen.tsx`, `ceria/CeriaScreen.tsx`,
`admin/AjustarLetrasScreen.tsx`, `operario/InicioOperarioScreen.tsx`
(la sub-barra y la tarjeta de resumen de turno, fuera de las 3
sub-vistas ya migradas arriba), `operario/LimpiezaScreen.tsx`, y todo
lo que ya existía antes de la sesión de temas
(`TurnoScreen.tsx`, `ResumenScreen.tsx`, `GestionLotes.tsx`). Migrar
cada una es mecánico (cambiar `bg-white`→`bg-[var(--superficie)]`,
`text-slate-900`→`text-[var(--texto)]`, etc.) pero son bastantes
archivos — pendiente, sin fecha.