# 11 — Ceria (asistente de producción)

Edge Function `supabase/functions/ceria/` (`index.ts` + `tools.ts` +
`modelos.ts`), accesible desde la pestaña Ceria en `jefe/` y `admin/`
(mismo componente `ceria/CeriaScreen.tsx`) y también desde la pestaña
unificada **Chat** (`chat/ChatHomeScreen.tsx`, ver `15`) para
cualquier rol al que el administrador se lo habilite. Adaptación de
un diseño de v2 (mismo patrón de 3 fases) al esquema real de v3.

## Patrón de 3 fases

1. **Elegir herramienta** — GPT-5-mini, `tool_choice: "required"`.
2. **Ejecutar** — se llaman las herramientas elegidas contra Supabase.
3. **Redactar la respuesta final** — modelo **intercambiable** (ver
   más abajo), a partir de los datos ya obtenidos.

Fases 1 y 2 **no son intercambiables**: ahí el `tool_choice:
"required"` de OpenAI ha sido 100 % fiable en real, y cambiarlas de
proveedor es un experimento aparte más delicado (decisión
05/09/2026) — nunca tocarlas al añadir o probar un modelo nuevo.

## Selector de modelo de Fase 3 (sesión 04-05/09/2026)

Antes fijo en GPT-5-mini. Ahora la Fase 3 es intercambiable entre 7
modelos de 3 proveedores distintos, elegible desde un desplegable en
`CeriaScreen.tsx`:

| id | Proveedor | Modelo real |
|---|---|---|
| `gpt-5-mini` (por defecto) | OpenAI | `gpt-5-mini` |
| `gpt-5.6-luna` | OpenAI | `gpt-5.6-luna` |
| `gpt-5.4-mini` | OpenAI | `gpt-5.4-mini` |
| `claude-haiku-4.5` | Anthropic | `claude-haiku-4-5-20251001` |
| `claude-sonnet-4.6` | Anthropic | `claude-sonnet-4-6` |
| `deepseek-v4-flash` | DeepSeek | `deepseek-v4-flash` |
| `deepseek-v4-pro` | DeepSeek | `deepseek-v4-pro` |

Catálogo fijo en código (`ceria/modelos.ts`, `MODELOS_FASE3`), no en
BD. Los mensajes que le llegan a Fase 3 son **siempre genéricos**
(`role: "user"|"assistant"`, `content: string`, sin el andamiaje de
`tool_calls`/mensajes `tool` de OpenAI) — los datos de las
herramientas viajan como bloque de texto `[DATOS_OBTENIDOS]` dentro
del último mensaje de usuario. Esto es lo que permite intercambiar de
proveedor sin duplicar lógica de conversión por cada uno.
`llamarFase3` despacha al proveedor correcto (`llamarAnthropic` /
`llamarEstiloOpenAI`, este último también sirve para DeepSeek por
compartir forma de API). Timeout 45s. Secrets: `OPENAI_API_KEY`
(ya existía), `ANTHROPIC_API_KEY` (compartido con `ocr-parte`),
`DEEPSEEK_API_KEY` (nuevo, compartido con `generar-personaje`).

**Apagado por el administrador** — tabla `ceria_modelo_activo`
(`modelo_id`, `activo`), convención deliberadamente **opuesta** a
`chat_acceso`: ausencia de fila = modelo **activo** (el catálogo ya
viene fijo en código, el caso base es "todo encendido"); solo se
inserta fila cuando el admin apaga uno en concreto. `resolverModeloFase3`
comprueba esta tabla en el servidor — apagar un modelo también
bloquea su uso si alguien llama a la función directamente, no solo lo
oculta del desplegable. Pantalla: `admin/ChatAccesoScreen.tsx` (misma
pantalla que gestiona `chat_acceso`, ver `15`).

**Primeras pruebas con datos reales**: DeepSeek V4 Pro parecía el más
obediente al prompt (menos preguntas de más, nunca JSON), pero no es
fiable a ciegas todavía — falló en un caso real (ver bug #4 más
abajo; en ese caso concreto el fallo era nuestro, no del modelo, pero
sirve de aviso). Sin default distinto de GPT-5-mini decidido aún.

## Reglas fijas del prompt (`buildSystemPrompt`, `index.ts`)

- **Uso obligatorio de herramienta** — nunca responde directo sin
  llamar a ninguna; si no está claro cuál, `ask_user`.
- **Dos ejes que nunca se mezclan**: PRODUCCIÓN (m², piezas, tiempos
  de máquina, % rendimiento, incidencias operativas) y CALIDAD
  (1ª/comercial/eco/contenedor, defectos). `get_partes` trae ambos
  bloques del mismo parte y **puede y debe** mostrarlos juntos en la
  misma tabla/frase cuando ayude — lo único prohibido es la
  **causalidad** ("esto causó aquello"), no la coexistencia visual.
  (Redacción corregida esta sesión: antes decía "siempre en secciones
  separadas", que prohibía de más.)
- **Antes de elegir `get_partes`, comprobar si ya existe una
  herramienta agregada** que cubra la pregunta — `get_partes` es solo
  para inspección puntual de filas sueltas, nunca para totales,
  agregados ni comparar periodos/líneas/modelos.
- **Calidad, dos métricas, siempre juntas**: completa (cada categoría
  sobre el total de piezas entradas) y oficial (solo 1ª+comercial
  entre sí, métrica de empresa) — nunca elegir solo una.
- **Sin gamificación** — nunca menciona puntos/ranking/niveles/ciclos;
  si preguntan por ranking, `ask_user` para aclarar que no está aquí.
- **Fechas relativas definidas explícitamente** en el prompt: "ayer",
  "hoy", "esta semana" (lunes→hoy), "semana pasada" (lunes→domingo
  anterior), "fin de semana" (sábado+domingo más recientes ya
  transcurridos, nunca el lunes), "este mes", "último mes".
- **Transparencia en datos truncados**: si `limitado: true`, decirlo
  explícitamente con la cifra real (`filas_totales`) en vez de sonar
  como si fuera el total.
- **Nunca decir "sin datos" si alguna llamada trajo filas** — regla
  añadida tras el bug #4 de abajo.
- **Todas las sumas las hace Postgres** (vistas y funciones), nunca
  el modelo.

## Herramientas (12)

Mecanismo: `get_identidad`, `ask_user`, `get_datos_historial`.

- **`get_identidad`**: identidad de Ceria + preguntas de
  **funcionamiento de la sección** (máquinas, flujo de una pieza,
  turnos y personal) — conocimiento del mecánico de sección, nunca
  cifras concretas de un turno/lote real.

Producción:
- `get_produccion_turno` — agregado por turno, rango de fechas
  (`v_produccion_turno`). Expone `rendimiento_numerador`/
  `rendimiento_denominador` crudos para poder sumar varios turnos sin
  promediar % ya redondeados.
- `get_produccion_linea` — **nueva**, una fila por línea con **todo
  un rango de fechas ya sumado** (`produccion_linea_por_fecha`).
  Pensada para comparar dos periodos de la misma línea: se llama dos
  veces, una por rango, y el modelo compara — nunca usar `get_partes`
  para esto. Mismo suelo de 480 min/turno que `v_produccion_turno`,
  aplicado por turno+línea antes de sumar entre turnos.
- `get_partes` — detalle de filas sueltas (con límite 300 +
  aviso `limitado`).
- `get_incidencias_produccion`.

Calidad:
- `get_calidad_modelo` — histórico por producto, ahora también con
  filtro exacto por `fecha_desde`/`fecha_hasta` (función
  `calidad_modelo_por_fecha`, **nueva** esta sesión) además del modo
  histórico completo sin fecha.
- `get_calidad_lote` — por lote concreto o modo ranking sin
  `numero_orden` (ordenado por `pct_1a_oficial`); mismo añadido de
  fecha exacta (`calidad_lote_por_fecha`, **nueva**) en vez de la
  aproximación de `v_calidad_lote` (primera/última producción, ver
  limitación en `14`). **Pendiente**: forzar `NULLS LAST` o filtrar
  `piezas_entradas > 0` en modo ranking.
- `get_calidad_turno` — **nueva**, expone `v_calidad_turno` (existía
  en BD desde el 21/08 para el dashboard del jefe, nunca conectada a
  Ceria). El resumen diario de calidad, el más pedido y el más barato
  de construir.
- `get_calidad_linea` — **nueva**, mismo concepto que
  `get_produccion_linea` pero de calidad (`calidad_linea_por_fecha`);
  siempre las dos métricas juntas (completa + oficial).
- `get_incidencias_calidad`.

Las 3 nuevas (`get_calidad_turno`, `get_produccion_linea`,
`get_calidad_linea`) y las 2 versiones con fecha exacta
(`get_calidad_lote`/`get_calidad_modelo`) siguen el mismo patrón:
**función SQL parametrizada, nunca una vista fija con fecha
aproximada**. Verificadas con datos reales del 2-3/09/2026 contra
consultas SQL independientes (no contra sí mismas).

## Cuatro bugs de datos encontrados y corregidos (sesión 04-05/09/2026)

Todos verificados con SQL directo antes de dar el arreglo por bueno:

1. **`v_produccion_turno` contaba de más** cuando una línea tenía
   varios partes en el mismo turno (JOIN duplicado antes de agregar
   por turno). Corregido con una CTE que agrega primero por turno.
2. **El filtro de fecha no filtraba de verdad** en `get_partes` y
   `get_incidencias_produccion` — problema clásico de PostgREST:
   filtrar sobre una relación anidada sin `!inner` no restringe las
   filas del recurso principal. Con el límite de 300 filas sin filtro
   real, devolvía histórico entero sin que se notara a simple vista.
   Corregido añadiendo `!inner` a la relación `turno:turno_id`.
3. **El propio modelo tenía que sumar filas** cuando se pedía
   "por lote"/"por modelo"/"por línea" de un rango de fechas, porque
   no existía ninguna vista agregada con ese filtro. Probado con 7
   modelos sobre el mismo día: solo el que NO intentó sumar acertó
   las cifras; el resto falló por hasta 13.000 piezas en un lote.
   Cerrado con las 3 herramientas nuevas de arriba.
4. **Bug de sobreescritura en `datosCrudos`** (introducido al
   normalizar Fase 3 multi-proveedor): se guardaba como objeto
   `{ [nombre_herramienta]: datos }` — si la misma herramienta se
   llamaba dos veces en un turno (comparar dos rangos de fechas), la
   segunda pisaba a la primera y Fase 3 solo veía la última.
   Detectado con "línea 3 esta semana vs. la pasada": los 3 modelos
   probados dijeron "sin datos en ningún periodo" cuando "esta
   semana" sí tenía datos. Corregido: `datosCrudos` es ahora un
   **array** de `{ herramienta, argumentos, datos }`, uno por llamada
   real, nunca se sobreescribe.

## UI (`ceria/CeriaScreen.tsx`, `lib/ceria.ts`)

- Chat con 5 accesos rápidos (Fin de semana, Ayer, Alertas calidad,
  Incidencias, Resumen semanal).
- **Historial de conversaciones** (sesión 04-05/09): panel para
  continuar o borrar conversaciones pasadas del jefe
  (`listarConversaciones`, `eliminarConversacion`).
- **Log "Ver qué hizo Ceria"**: desplegable bajo cada respuesta con
  herramienta usada, filas y duración en ms (`duracion_ms` ahora se
  propaga hasta `filas_info`; antes se calculaba en Fase 2 y se
  descartaba).
- **Selector de modelo de Fase 3** — desplegable con los 7 modelos
  (`MODELOS_FASE3_OPCIONES` en `lib/ceria.ts`), oculta los que el
  admin haya desactivado.
- `conversacion_id` persistido en `localStorage` para sobrevivir a
  que el navegador descargue la pestaña en segundo plano.

## Acceso — integrado con `chat_acceso` (sesión 07/09/2026)

Ceria ya no es un acceso fijo en código solo para `jefe`/`administrador`:
se rige por la tabla `chat_acceso` (`tipo_chat='ceria'`, ver `15`),
comprobada tanto en el frontend (para mostrar o no la pestaña) como
dentro de la propia Edge Function (`ceria/index.ts`), además de la
RLS ya existente sobre las tablas `ceria_*` y las tablas de datos. El
administrador puede dar/quitar acceso a Ceria por rol desde
`admin/ChatAccesoScreen.tsx` sin tocar código.

## Logs y uso

`ceria_tool_logs` — insert en fire-and-forget dentro del `.map()` de
Fase 2 (no bloquea la respuesta si el log falla). Vista
`v_ceria_uso_herramientas`: ranking de uso (veces usada, duración
media, filas media, errores, último uso) — para responder "¿qué
herramienta se usa más?" sin depender de logs de la Edge Function que
rotan y no son consultables con SQL.

## Prueba

`fecha_referencia` (parámetro opcional del body, `YYYY-MM-DD`) simula
"qué día es hoy" — solo uso manual por curl/Postman, no expuesto en
la UI. Útil mientras la fábrica está parada y solo hay datos de
fechas de prueba.

## Pendiente

- Exportación CSV/PDF (`exportar_datos`, diseño empezado 03/09,
  sin implementar).
- `NULLS LAST` / filtro en modo ranking de `get_calidad_lote`.
- Desajuste de 1 pieza en un producto entre `piezas_entradas` y la
  suma de categorías (dato de entrada, no de la vista) — sin revisar.
- Terminología de `minutos_saturacion`: pendiente de confirmar si el
  texto vivo en `ceria_prompts` coincide con la corrección del jefe
  (es la propia sección — empaquetadora "Griffon" y posiblemente
  "parque" — no otra sección) o si el fallo real está en el modelo
  parafraseando mal.
- "Calidad de modelos de pulido vs. el resto" — pregunta planteada,
  sin construir; necesita confirmar valores reales de
  `lote.acabado_tipo` antes de diseñar la vista/función.
- Sin default de Fase 3 distinto de `gpt-5-mini` decidido — seguir
  probando los 7 modelos antes de fijar uno.

## Archivos

`supabase/functions/ceria/index.ts` (prompt + orquestación 3 fases),
`tools.ts` (schema + `executeTool`), `modelos.ts` (catálogo y
despacho de Fase 3) · `frontend/src/components/ceria/CeriaScreen.tsx`,
`lib/ceria.ts` · `lib/chat-acceso.ts`,
`components/admin/ChatAccesoScreen.tsx` (acceso por rol + apagado de
modelos, ver `15`).
