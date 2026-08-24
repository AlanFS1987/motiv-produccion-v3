> ⚠️ **DOCUMENTO HISTÓRICO — NO REFLEJA EL ESTADO ACTUAL.** Este
> README describe la PRIMERA entrega del esquema (enero 2026) y
> contiene información obsoleta: las Edge Functions SÍ existen (con
> otros nombres — es `ceria`, no `ceria-chat`; el cierre de ciclo es
> `fn_cerrar_ciclos_pendientes` en SQL + cron, no una Edge Function
> `cerrar-ciclo`), la fecha ancla ya no es la que se menciona, y la
> mayoría de "pendientes" están cerrados. **La verdad vive en
> `memorias/`** (entrada: `memorias/CLAUDE.md`). Se conserva solo
> como contexto de las migraciones 0001–0010.

# Memorias — índice

Documentación del estado actual de la app. Describe qué hace y por qué
está así; no recoge el historial de cómo se llegó a cada decisión.
Cuando algo cambie, se edita el archivo correspondiente, no se añade
una entrada "sesión de tal día".

| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | Entrada: qué es, stack, estado de un vistazo, convenciones, mapa de archivos |
| `01-dominio.md` | Entidades y reglas de negocio: catálogo, lote, parte, turno, rotación, corrección |
| `02-responsable.md` | Comportamiento real de la app del responsable: turno, captura, verificación, incidencias, resumen, lotes |
| `03-operario.md` | App del operario: pertenencia al turno, Mi línea, limpieza, historial |
| `04-gamificacion.md` | Modelo de puntos, ciclos, niveles — qué hay en BD y qué está solo diseñado |
| `05-automatismos.md` | Telegram, cron, triggers, Edge Functions, Cloudinary |
| `06-esquema-bd.md` | Tablas, columnas, políticas RLS, funciones, vistas |
| `07-pendientes.md` | Solo lo abierto: bugs conocidos, decisiones por tomar, trabajo por hacer |
| `08-dashboard-jefe.md` | Dashboard del jefe: Vista Rápida, Vista Detallada, Incidencias, fórmulas de m²/rendimiento/calidad |
| `09-administrador.md` | Panel de administrador: qué está construido (rotación) y qué falta |
| `10-pantalla.md` | Pantalla de fábrica: carrusel, rol `pantalla`, las 5 diapositivas |
| `11-ceria.md` | Ceria: herramientas, decisiones de proveedor, reglas de separación producción/calidad |
| `12-temas.md` | Sistema de temas: los 5 temas, qué pantallas están migradas y cuáles no |

Marcas usadas en los archivos:
- `[VERIFICAR]` — descrito a partir de migraciones/código, no contrastado con la BD real.
- `[DECISIÓN PENDIENTE]` — hay dos opciones válidas y nadie ha elegido.
- **Construido** / **Diseñado** — existe código desplegado / solo existe la decisión.

## Glosario mínimo

| Término | Qué es |
|---|---|
| modelo | Nombre del diseño (ej. "Milena Nuez"). Auto-creado por OCR. |
| marca | Ej. Argenta, Cifre. Auto-creada. |
| formato | Medidas de la pieza en mm, catálogo cerrado de 7 (`200x1200` … `900x900`). |
| producto | modelo + marca + formato. Auto-creado. |
| lote | Un pedido de producción concreto. Identidad = número de orden (único, nunca se reutiliza). |
| parte | Tramo de producción: lote + línea + turno. Lo que se captura por OCR. |
| turno | Fecha + tipo (M/T/N). Quién trabaja lo dice la rotación. |
| letra | Grupo de rotación A/B/C/D del usuario. |
| línea | 6 líneas fijas de la sección. |
| tono | Letra + dígitos (ej. `M10`). En caja/pieza lleva prefijo de fábrica (`5M10`) que se ignora al comparar. |
| calibre | Texto libre, normalmente numérico. |
| ciclo | 28 días desde `fecha_inicio_rotacion`, base del ranking. |
