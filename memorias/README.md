# Memorias — índice

Documentación del estado actual de la app. Describe qué hace y por qué
está así; no recoge el historial de cómo se llegó a cada decisión.
Cuando algo cambie, se edita el archivo correspondiente, no se añade
una entrada "sesión de tal día". Cada tema vive en UN archivo; el resto
solo remite a él con el número (`ver 04`).

| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | Entrada: qué es, stack, estado de un vistazo, fechas clave, convenciones, mapa de archivos |
| `01-dominio.md` | Entidades y reglas de negocio: catálogo, lote, parte, turno, rotación (fecha ancla), operario del parte, corrección, m² |
| `02-responsable.md` | App del responsable: turno, captura, verificación, incidencias, resumen, lotes |
| `03-operario.md` | App del operario: pertenencia al turno, Inicio, Mi línea, historial, limpieza |
| `04-gamificacion.md` | Puntos, ciclos, niveles, logros, stats, personaje RPG, datos migrados de v2 |
| `05-automatismos.md` | Edge Functions, Telegram, cron, triggers, Cloudinary, secrets |
| `06-esquema-bd.md` | Tablas, vistas, funciones (patrón de seguridad de RPCs), políticas RLS |
| `07-pendientes.md` | Solo lo abierto: bugs, verificaciones, decisiones, trabajo por hacer |
| `08-dashboard-jefe.md` | Dashboard del jefe: Vista Rápida, Detallada, Incidencias, fórmulas |
| `09-administrador.md` | Panel de administrador: construido, por construir, descartado, bug de cámara |
| `10-pantalla.md` | Pantalla de fábrica: carrusel, rol `pantalla`, las 5 diapositivas |
| `11-ceria.md` | Ceria: herramientas, proveedor, reglas producción/calidad |
| `12-temas.md` | Sistema de temas: los 5 temas, qué pantallas están migradas |
| `13-rectificado.md` | App de `jefe_rectificado`: Vista Rápida, Vista Detallada, vistas SQL propias |
| `14-calidad.md` | App de `calidad`: últimos 15 lotes, desglose por tono, incidencias |

Marcas usadas:
- `[VERIFICAR]` — descrito a partir de migraciones/código, no contrastado con la BD real.
- `[DECISIÓN PENDIENTE]` — hay dos opciones válidas y nadie ha elegido.

(Si existe un README histórico de la primera entrega del esquema de
enero 2026, vive en `supabase/migrations/`, no aquí.)

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
| letra | Grupo de rotación A/B/C/D de responsables y operarios. |
| línea | 6 líneas fijas de la sección. |
| tono | Letra + dígitos (ej. `M10`). En caja/pieza lleva prefijo de fábrica (`5M10`) que se ignora al comparar. |
| calibre | Texto libre, normalmente numérico. |
| ciclo | 28 días desde `fecha_inicio_rotacion`, base del ranking y del cierre de puntos. |
