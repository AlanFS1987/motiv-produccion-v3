# 12 — Sistema de temas

`context/ThemeContext.tsx` + `components/ThemeSwitcher.tsx`. Único
sistema para toda la app (Operario, Responsable, Jefe, Administrador,
Pantalla) — construido a raíz de que Pantalla se había hecho con tema
oscuro fijo; en vez de revertirla a claro, se decidió construir el
sistema para todos a la vez.

## Diseño

5 temas (`TemaId`): **Oscuro**, **Claro**, **Naturaleza** (verde),
**Cielo** (azul), **Sistema** (sigue `prefers-color-scheme` del SO en
vivo, con listener a cambios). Persistencia en `localStorage`
(`motiv_tema`) — si el usuario elige "Sistema", se guarda esa
elección, no el tema resuelto en ese momento, para que siga siguiendo
al SO aunque cambie.

Variables CSS (`index.css`, bloque `[data-tema="..."]`): `--fondo`,
`--superficie`, `--superficie-alt`, `--texto`, `--texto-secundario`,
`--texto-tenue`, `--borde`, `--acento`, `--acento-texto`. Los
componentes las usan con sintaxis de valor arbitrario de Tailwind v4:
`bg-[var(--fondo)]`, `text-[var(--texto)]`, etc.

`<ThemeProvider>` envuelve `<App />` en `main.tsx` (junto a
`AuthProvider`, orden entre ambos indistinto). `<ThemeSwitcher />` es
un componente de 5 puntos de color, se coloca en la cabecera de
cualquier shell.

## Estado de la migración (importante — no todo está migrado)

**Marco exterior migrado a variables** (selector cambia algo visible
de verdad):
- `pantalla/PantallaCarrusel.tsx` — completo, incluidas las 3
  diapositivas reales (tarjetas, textos).
- `admin/AdminApp.tsx`, `jefe/JefeApp.tsx` — cabecera y barra de
  pestañas.
- `App.tsx` (shell de responsable) y `operario/OperarioApp.tsx` —
  cabecera y barra de pestañas (aplicado por instrucciones de
  edición puntual, confirmar que se aplicaron).

**Sin migrar todavía** (contenido interior con colores `slate-*`
fijos — el marco cambia pero por dentro sigue en claro):
`jefe/VistaRapidaScreen.tsx`, `jefe/VistaDetalladaScreen.tsx`,
`jefe/IncidenciasScreen.tsx`, `ceria/CeriaScreen.tsx`,
`admin/AjustarLetrasScreen.tsx`, y todo lo que ya existía antes de
hoy (`TurnoScreen.tsx`, pantallas de `operario/`, `ResumenScreen.tsx`,
`GestionLotes.tsx`). Migrar cada una es mecánico (cambiar
`bg-white`→`bg-[var(--superficie)]`, `text-slate-900`→`text-[var(--texto)]`,
etc.) pero son bastantes archivos — pendiente, sin fecha.
