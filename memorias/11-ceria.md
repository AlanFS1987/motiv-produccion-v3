# 11 — Ceria (asistente de producción)

Edge Function `supabase/functions/ceria/` (`index.ts` + `tools.ts`),
accesible desde la pestaña Ceria en `jefe/` y `admin/` (mismo
componente `ceria/CeriaScreen.tsx`, reutilizado). Adaptación de un
diseño de v2 (mismo patrón de 3 fases) al esquema real de v3.

## Decisiones de sesión

- **Proveedor: GPT-5-mini**, no DeepSeek (v2 usaba DeepSeek; la
  empresa confía en GPT). Modelo de razonamiento — gasta tokens
  internos antes de responder, invisibles pero contados contra
  `max_completion_tokens`. Bug real visto: con 500 tokens en fase 1,
  el modelo podía agotar el presupuesto razonando y devolver
  `tool_calls` vacío pese a `tool_choice: "required"`. Corregido: 1200
  tokens + `reasoning_effort: "low"` en fase 1, 3000 + `"low"` en
  fase 3.
- **Sin gamificación** — el jefe no la usa, Ceria nunca menciona
  puntos/ranking/niveles.
- **Sin electromecánica** (`get_averias`/`get_ajustes` de v2)
  descartadas por ahora — si algún día se añaden, aparte.
- **Producción y calidad son ejes separados**, nunca se mezclan ni se
  implica causalidad (regla de negocio explícita: un paro de máquina
  no afecta a la calidad, un defecto de calidad no afecta a la
  producción). `get_partes` trae ambos bloques del mismo parte pero
  siempre en secciones separadas.
- **Todas las sumas las hace Postgres** (vistas), nunca el modelo —
  v2 sí le pedía a DeepSeek sumar filas de una tabla markdown en
  algún prompt, riesgo real de error.
- **Transparencia en datos truncados**: las consultas de detalle
  (`get_partes`, las de incidencias) devuelven `limitado: true` +
  `filas_totales` si el resultado se recortó; el system prompt obliga
  a avisarlo explícitamente en vez de sonar como si fuera el total.

## Herramientas (9)

Mecanismo: `get_identidad`, `ask_user`, `get_datos_historial`.

Producción: `get_produccion_turno` (agregado por turno,
`v_produccion_turno`), `get_partes` (detalle, con límite+aviso),
`get_incidencias_produccion`.

Calidad: `get_calidad_modelo` (histórico por producto,
`v_calidad_modelo`), `get_calidad_lote` (por lote concreto O modo
ranking sin `numero_orden`, ordenado por `pct_1a_oficial`),
`get_incidencias_calidad`.

## Tablas propias

`ceria_prompts` (prompt de interpretación por herramienta, editable
sin redesplegar), `ceria_conversaciones`/`ceria_mensajes` (historial
por usuario — jefe o admin —, RLS: cada uno ve solo las suyas).

## Frontend

`lib/ceria.ts` (`preguntarCeria`, `cargarConversacion`),
`components/ceria/CeriaScreen.tsx`: chat con 5 accesos rápidos (Fin
de semana, Ayer, Alertas calidad, Incidencias, Resumen semanal),
`conversacion_id` persistido en `localStorage` para sobrevivir a que
la pestaña se recargue sola (Chrome "Ahorro de memoria" descargando
pestañas inactivas, o el sistema operativo en móvil) — al montar,
recupera el historial de Supabase si hay un id guardado. Botón "Nueva
conversación" para empezar de cero a propósito.

## Prueba

`fecha_referencia` (parámetro opcional del body, YYYY-MM-DD) permite
simular "qué día es hoy" para pruebas — solo para uso manual por
curl/Postman, no expuesto en la UI. Útil mientras la fábrica está
parada y los únicos datos son de fechas de prueba concretas.
