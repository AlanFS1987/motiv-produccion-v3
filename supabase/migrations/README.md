# Esquema Supabase — App de Producción v3

Migraciones en `migrations/`, en orden (`0001`...`0010`). Aplicar con
la CLI de Supabase:

```bash
supabase link --project-ref <tu-project-ref>
supabase db push
```

O directamente con `psql` contra la BD de Supabase, en orden numérico.

Todas las migraciones se han **validado localmente** (Postgres 16):
se aplican limpias de principio a fin, y se ha probado con datos
reales el flujo completo catálogo → lote → turno → parte → vistas de
puntos, la rotación de turnos (cobertura de 1 año sin huecos), la
corrección de partes por doble entrada, la atomicidad de
`generaciones_disponibles` y la restricción de suplente único.

## Edge Functions

Dos funciones nuevas en `functions/`:

- **`ocr-parte`** — recibe 1-2 fotos (`hoja_partida`, `caja` o
  `pantalla`) y las envía a la API de Claude con un prompt de
  extracción estructurada específico para cada tipo. Devuelve el JSON
  ya extraído — no escribe nada en la base de datos.
- **`resolver-catalogo`** — se llama después de `ocr-parte` cuando la
  foto era `hoja_partida` (solo en el camino 3, nuevo lote — ver
  01-rol-responsable.md 3.2). Busca modelo/marca por similitud
  (`pg_trgm`, umbral 0.4 — probado con datos reales), resuelve o crea
  `producto`/`lote`, y reabre automáticamente un lote `finalizado` si
  llega un parte nuevo contra él.

### Desplegar las Edge Functions

```bash
supabase functions deploy ocr-parte
supabase functions deploy resolver-catalogo
```

### Configurar los secretos de OpenAI y Anthropic

```bash
supabase secrets set OPENAI_API_KEY=tu_clave_aqui
supabase secrets set ANTHROPIC_API_KEY=tu_clave_aqui
```

`OPENAI_API_KEY` es el extractor principal (GPT); `ANTHROPIC_API_KEY`
es el fallback (Haiku) si GPT falla.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` no hace falta configurarlos
a mano — Supabase los inyecta automáticamente en toda Edge Function.

### Validado antes de entregar

- Type-check completo de los 5 archivos `.ts` sin errores.
- Normalización de texto (`normalizarTexto`) probada en TypeScript y en
  SQL con el mismo caso ("café ñoño!!") — dan exactamente el mismo
  resultado, corregido un bug real donde se comía las tildes.
- Separación de prefijo de fábrica del tono (`5M10` → `5` + `M10`)
  probada con varios casos, incluido texto que no cumple el formato.
- Búsqueda por similitud (`fn_buscar_modelo_similar`) probada con:
  coincidencia exacta (1.0), typo típico de OCR (0.71), producto sin
  relación (0.08) — el umbral 0.4 separa bien ambos casos.

### Pendiente de confirmar antes de producción

- **Modelo de Claude a usar** (`MODEL` en `_shared/anthropic.ts`) —
  dejado como constante única para poder ajustarlo fácilmente.
- **Umbral de similitud 0.4** — validado con casos sintéticos, conviene
  confirmarlo contra una tanda real de hojas de partida.
- Los prompts de `ocr-parte/prompts.ts` no se han probado contra fotos
  reales todavía (no hay forma de hacerlo sin una clave de API activa y
  fotos reales) — revisar los primeros resultados en cuanto se pruebe
  con el responsable real y ajustar redacción si algún campo sale mal
  sistemáticamente.

## Antes de ir a producción

1. **`configuracion.fecha_inicio_rotacion`** (0001) — ajustar al lunes
   real de arranque de v3. Todo el cálculo de rotación de turnos y de
   ciclos de gamificación depende de esta fecha.
2. **`pg_cron`** — habilitarlo desde el panel de Supabase (Database →
   Extensions) para poder programar `cerrar-ciclo` cada 28 días
   (13.7). La migración no falla si no está disponible, pero sin él
   no hay tarea automática de cambio de ciclo.
3. **Poblar catálogos con contenido real**, no solo estructura:
   - `niveles` (9 niveles del operario: nombres, colores, prompts) —
     esta migración no incluye el contenido, solo la tabla.
   - `niveles_responsable` — una vez `niveles` esté poblado, insertar
     sus 9 filas con umbral ×2 (02-rol-jefe-planta.md 4.6).
   - `checklist_items` (6 ítems), `logros_definicion` (19 iniciales),
     `puntos_piezas` (35 filas, 7 formatos × 5 tramos).
4. **Edge Functions** (`ocr-parte`, `resolver-catalogo`, `cerrar-ciclo`,
   `recalcular-ciclo-anterior`, `generar-personaje`,
   `notificar-telegram-*`, `ceria-chat`) — no están en esta entrega,
   son el siguiente bloque de trabajo. Deben usar `service_role` para
   las operaciones de catálogo (auto-creación/fusión) que no encajan
   en el patrón de RLS por rol de usuario final.

## Decisiones abiertas / a confirmar con el equipo

- **`m²` no tiene columna en `parte`** — la spec menciona m² en Vista
  Rápida, `puntos_metros`, etc., pero la tabla `parte` (11-esquema-
  supabase.md 13.2) solo registra piezas. Falta la fórmula de
  conversión (probablemente depende del formato: superficie de pieza
  × piezas). Las vistas en `0009_vistas.sql` dejan esto marcado como
  pendiente — nada se ha inventado.
- **`puntos_rendimiento` vs `puntos_rendimiento_responsable`** — se
  han mantenido como dos tablas físicas (igual que en 11-esquema-
  supabase.md 13.5) con el mismo contenido de 10 tramos, en vez de una
  única tabla compartida como sugiere 08-pendientes.md literalmente.
  Funcionalmente da igual (cada consulta usa su propio denominador),
  pero si preferís una sola tabla real, es un cambio menor.
- **Base de conocimiento de máquinas/averías** — no incluida (fuera
  de alcance de este bloque, ver 07-arquitectura.md 9.2, dejada
  deliberadamente para el final en la propia spec).

## Qué falta para "esquema completo"

- RLS: el patrón implementado (0010) cubre las tablas principales con
  el criterio de 13.8, pero conviene una pasada tabla por tabla antes
  de producción, sobre todo para `lote`/`producto`/`modelo`/`marca`
  (¿quién puede fusionar? — probablemente solo `administrador` vía
  función RPC dedicada, no vía UPDATE directo con RLS genérico).
- Storage/Cloudinary vive fuera de Supabase — los campos `fotos
  text[]` guardan URLs, la subida es responsabilidad del cliente.
