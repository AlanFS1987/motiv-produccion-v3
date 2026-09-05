# 11 — Ceria (asistente de producción)

Edge Function `supabase/functions/ceria/` (`index.ts` + `tools.ts`),
accesible desde la pestaña Ceria en `jefe/` y `admin/` (mismo
componente `ceria/CeriaScreen.tsx`, reutilizado). Adaptación de un
diseño de v2 (mismo patrón de 3 fases) al esquema real de v3.

## Decisiones de sesión

- **Proveedor: GPT-5-mini**, no DeepSeek (v2 usaba DeepSeek; la
  empresa confía en GPT). Modelo de razonamiento — gasta tokens
  internos antes de responder, invisibles pero contados contra
  `max_completion_tokens`. Bug real visto, en DOS sitios distintos:
    1. Fase 1 (elegir herramienta): con 500 tokens, el modelo podía
       agotar el presupuesto razonando y devolver `tool_calls` vacío
       pese a `tool_choice: "required"`. Corregido: 1200 tokens +
       `reasoning_effort: "low"`.
    2. Caso especial `get_identidad` (respuesta directa con su propio
       prompt): mismo bug, detectado el 03/09/2026 al ampliar el
       prompt de `get_identidad` con el proceso completo de la
       sección (ver abajo) — con solo 500 tokens y sin
       `reasoning_effort`, la respuesta volvía **vacía** (`ok: true`,
       `respuesta: ""`, sin ningún error en logs). Corregido igual:
       2000 tokens + `reasoning_effort: "low"`.
  Fase 3 (redactar respuesta final) ya tenía 3000 + `"low"` desde el
  principio. **Lección**: cualquier llamada nueva a `llamarOpenAI`
  con GPT-5-mini necesita `reasoning_effort: "low"` desde el primer
  día, no solo cuando el prompt empieza a crecer.
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
- **Validación con datos reales (03/09/2026)**: primeros 3 días de
  producción real usados para validar `v_produccion_turno`,
  `v_calidad_modelo`, `v_calidad_lote` — las tres consistentes entre
  sí (mismo total de piezas exacto en las tres), sin partes huérfanos.
  Dos hallazgos menores, ninguno de la vista: un desajuste de 1 pieza
  entre `piezas_entradas` y la suma de categorías en un producto
  (dato de entrada, no revisado aún) y un lote con `piezas_entradas =
  0` que puede afectar al orden del modo ranking de
  `get_calidad_lote` si no se fuerza `NULLS LAST` — pendiente.
- **Prompts documentados a fondo (03/09/2026)**: se detectó que
  Ceria inventaba explicaciones plausibles pero falsas cuando le
  preguntaban por columnas sin definición en su prompt (visto en real
  con `rendimiento_numerador`/`rendimiento_denominador`). Todos los
  prompts de `ceria_prompts` se revisaron y se completó lo que
  faltaba — ver detalle en "Herramientas" y "Tablas propias" abajo.
  Regla aprendida: cualquier columna nueva expuesta a Ceria necesita
  su definición en el prompt correspondiente ANTES de que alguien
  pregunte por ella, no después.

## Herramientas (12)

Mecanismo: `get_identidad`, `ask_user`, `get_datos_historial`.

- **`get_identidad`**: además de "¿quién eres?" / "¿qué puedes
  hacer?", ahora también responde preguntas sobre el **funcionamiento
  de la sección** (qué hace cada máquina, flujo completo de una pieza
  desde rectificado hasta el palet, turnos y personal, qué pasa en un
  cambio de lote). Conocimiento añadido 03/09/2026, dado por el
  mecánico de sección (11 años de experiencia). Se usa solo para
  EXPLICAR el proceso, nunca para inventar cifras concretas de un
  turno/lote real — esos datos siempre vienen de las herramientas de
  datos.

Producción: `get_produccion_turno` (agregado por turno,
`v_produccion_turno`), `get_partes` (detalle, con límite+aviso),
`get_incidencias_produccion`.

Calidad: `get_calidad_modelo` (histórico por producto,
`v_calidad_modelo`), `get_calidad_lote` (por lote concreto O modo
ranking sin `numero_orden`, ordenado por `pct_1a_oficial` —
**pendiente**: forzar `NULLS LAST` o filtrar `piezas_entradas > 0` en
modo ranking, ver validación arriba), `get_incidencias_calidad`.

## Fórmula de rendimiento — documentada en el prompt (antes no lo estaba)

`get_produccion_turno` expone `rendimiento_numerador` /
`rendimiento_denominador` crudos (para poder sumar varios turnos sin
promediar % ya redondeados). Su fórmula, ahora explícita en el prompt
de Ceria (antes no estaba, y el modelo inventaba explicaciones al
preguntarle):

```
Por cada línea activa del turno (una línea puede tener VARIOS partes,
parte ≠ línea):
  numerador_línea   = SUMA(minutos_plena + minutos_no_alimentada)
                       de todos los partes de esa línea en ese turno
  denominador_línea = MÁXIMO(480, SUMA(minutos_total)
                       de todos los partes de esa línea en ese turno)
Se suman numerador_línea y denominador_línea entre todas las líneas
activas → rendimiento_numerador / rendimiento_denominador del turno.
```

Si `rendimiento_denominador` supera claramente `lineas_activas × 480`,
la causa habitual **no es un error de cálculo**: es que un
responsable no reseteó la estadística de los apiladores al cerrar un
parte (paso del cambio de lote, ver abajo), y el siguiente parte
arrastra minutos del periodo anterior (visto en real: un parte con
más de 800 min en un turno de 480). El prompt de Ceria ya sabe
detectar y explicar esto en vez de especular.

## Categorías de minutos (`minutos_plena`, `minutos_no_alimentada`, `minutos_saturacion`, `minutos_banco`, `minutos_maquina`)

Antes solo eran nombres de columna sin definición en ningún sitio del
proyecto — documentadas 03/09/2026 en los prompts de
`get_produccion_turno` y `get_partes`:

- **`minutos_plena`**: a pleno rendimiento, produciendo con normalidad.
- **`minutos_no_alimentada`**: máquina operativa pero sin material de
  la sección anterior — **problema ajeno a esta sección** (aguas
  arriba).
- **`minutos_saturacion`**: parada por problema **aguas abajo** del
  punto de captura de estadísticas (apiladores) — normalmente
  empaquetadora (más habitual) o paletizador (menos habitual).
  **Problema interno a esta sección**, a diferencia de
  `no_alimentada`.
- **`minutos_banco`**: banco parado, por alarma en ese tramo o parado
  manual.
- **`minutos_maquina`**: la máquina de la que se toman las
  estadísticas (apiladores/Multigecko) está en alarma o parada en
  manual.

Ceria nunca debe tratar `no_alimentada` y `saturacion` como
intercambiables — son causas opuestas (externa vs interna) aunque las
dos paren la producción.

## El proceso físico de la sección (resumen — detalle completo en el prompt de `get_identidad`)

Rectificado (sección anterior) → centrador Qualitron → **Qualitron**
(inspección visual por fotos: tono/defectos/bordes, asigna
1ª/comercial/descarte) → marcado manual opcional con cera UV → centrador
calibre-planar → **calibre-planar** (mide calibre y rectangularidad;
el planar de planitud suele estar desactivado porque el material
recién fabricado viene deformado) → máquina de cera (opcional) →
**apiladores / Multigecko** (aquí se capturan las fotos de estadística
que usa Ceria; descarte va al rompedor) → lanzadera → **empaquetadora**
(divisor, escuadrador, elevador, cartón, impresión) → acoplador →
flejadora (en los EDA) → **paletizador** (brazo de 4 ejes).

Terminología: **caldero = contenedor = descarte** son el mismo
concepto (material no apto para venta), tres nombres usados
indistintamente en la sección.

Cambio de lote (lo hace el responsable): parar Qualitron → esperar
última pieza en paletizador → foto de estadística en apiladores →
rellenar/finalizar parte → **resetear estadística** (paso crítico, ver
aviso de `rendimiento_denominador` arriba) → foto de la hoja del nuevo
lote → transmitir (línea, número de orden, calibre, tono) → ajustar
impresoras a mano → entrenar Qualitron → arrancar empaquetadora →
comprobar impresión de la primera caja.

## Tablas propias

`ceria_prompts` (prompt de interpretación por herramienta, editable
sin redesplegar), `ceria_conversaciones`/`ceria_mensajes` (historial
por usuario — jefe o admin —, RLS: cada uno ve solo las suyas).

**`ceria_tool_logs`** (añadida 03/09/2026): una fila por cada
herramienta ejecutada en cada pregunta — `herramienta`, `args`,
`filas`, `filas_totales`, `limitado`, `duracion_ms`, `error`. Insert
en fire-and-forget dentro del `.map()` de Fase 2 (no bloquea la
respuesta al jefe si el log falla). Vista `v_ceria_uso_herramientas`
da el ranking de uso: veces usada, duración media, filas media,
errores, último uso — pensada para responder "¿qué herramienta se usa
más?" o "¿cuánto tarda Ceria de media?" sin depender de los logs de
la Edge Function en el dashboard de Supabase (que rotan y no son
consultables con SQL).

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

## Pendiente (mover a `07-pendientes.md` si se quiere trackear ahí)

- Exportación CSV/PDF generada por Ceria (nueva herramienta
  `exportar_datos`, diseño empezado 03/09/2026, sin implementar).
- `NULLS LAST` / filtro en modo ranking de `get_calidad_lote`.
- Revisar el desajuste de 1 pieza en HAUTEVILLE CREAM (dato de
  entrada, no de la vista).
## Sesión 04-05/09/2026 — historial, logs, selector de modelo, 3 bugs de datos, 3 herramientas nuevas

### UI nueva (frontend, `CeriaScreen.tsx`)
- **Historial de conversaciones**: botón junto a "Nueva" que abre un
  panel con las conversaciones pasadas del jefe — continuar o borrar.
  Nuevas funciones en `lib/ceria.ts`: `listarConversaciones`,
  `eliminarConversacion`.
- **Log "Ver qué hizo Ceria"**: desplegable bajo cada respuesta con
  herramienta usada, filas y duración (ms). `duracion_ms` no llegaba
  antes al frontend (se calculaba en Fase 2 y se descartaba) — ahora
  se propaga hasta `filas_info`.

### Selector de modelo para Fase 3 (`modelos.ts`, nuevo archivo)
Fase 1 (elegir herramienta) y Fase 2 (ejecutar) siguen fijas en
GPT-5-mini — ahí el `tool_choice: "required"` de OpenAI ha sido
fiable. Fase 3 (redactar la respuesta) ahora es intercambiable entre
7 modelos vía un desplegable en la UI (solo afecta a redacción, nunca
a qué herramienta se elige):
- GPT-5-mini (por defecto), GPT-5.6 Luna, GPT-5.4 Mini (OpenAI)
- Claude Haiku 4.5, Claude Sonnet 4.6 (Anthropic — mismo
  `ANTHROPIC_API_KEY` que `ocr-parte`)
- DeepSeek V4 Flash, DeepSeek V4 Pro (nuevo secret
  `DEEPSEEK_API_KEY`)

Los mensajes que le llegan a Fase 3 son **siempre genéricos**
(`role: "user"|"assistant"`, `content: string`), sin el andamiaje de
`tool_calls`/mensajes `tool` de OpenAI — los datos de las
herramientas viajan como bloque de texto `[DATOS_OBTENIDOS]` dentro
del último mensaje de usuario. Esto es lo que permite intercambiar
de proveedor sin duplicar lógica de conversión por cada uno.

**Primeras pruebas con datos reales**: DeepSeek V4 Pro parecía el más
obediente al prompt (menos preguntas de más, nunca JSON), pero **no
es fiable a ciegas** — falló en un caso real diciendo "sin datos en
ningún periodo" cuando uno de los dos sí tenía datos (ver bug de
`datosCrudos` más abajo; en ese caso concreto el fallo era nuestro,
no del modelo, pero sirve de aviso de que hace falta seguir probando
antes de fijar un default).

### 3 bugs de datos encontrados y corregidos (todos con verificación SQL directa antes de dar por bueno el arreglo)

1. **`v_produccion_turno` contaba de más una línea con varios partes
   en el mismo turno** (JOIN duplicado: `rendimiento_por_linea` se
   unía directo contra `parte` antes de agregar por turno, así que
   una línea con 2 partes sumaba su denominador ×2). Corregido
   agregando primero por TURNO en una CTE aparte
   (`rendimiento_por_turno`) antes del join final.

2. **`get_partes` y `get_incidencias_produccion` ignoraban por
   completo el filtro de fecha** — clásico problema de PostgREST:
   filtrar `.gte("turno.fecha", ...)` sobre una relación anidada
   sin `!inner` no restringe las filas del recurso principal, solo
   decide si el objeto anidado se rellena. Con 300 de límite y sin
   filtro real, devolvía el histórico entero. Corregido añadiendo
   `!inner` a la relación `turno:turno_id`.

3. **El propio modelo tenía que sumar filas cuando se pedía "por
   lote"/"por modelo"/"por línea" de un rango de fechas**, porque no
   existía ninguna vista agregada con ese filtro — solo
   `get_partes` (crudo). Probado con 7 modelos distintos sobre el
   mismo día: solo el que NO intentó sumar (dio el detalle sin
   agregarlo) acertó las 10 piezas de los 10 lotes; el resto falló
   por hasta 13.000 piezas en un lote. Cerrado con 3 herramientas
   nuevas (ver abajo) que agregan siempre en SQL.

4. **Bug de sobreescritura en `datosCrudos`** (introducido el mismo
   05/09 al normalizar Fase 3 multi-proveedor): se guardaba como
   objeto `{ [nombre_herramienta]: datos }` — si la misma
   herramienta se llamaba dos veces en un turno (comparar dos
   rangos de fechas), la segunda llamada sobreescribía a la
   primera, y Fase 3 solo veía la última. Detectado con "línea 3
   esta semana vs semana pasada": los 3 modelos probados (GPT,
   Haiku, DeepSeek) dijeron "sin datos en ningún periodo" cuando
   "esta semana" sí tenía datos — el dato ya se había perdido antes
   de llegar a ningún modelo. Corregido: `datosCrudos` es ahora un
   ARRAY de `{ herramienta, argumentos, datos }`, uno por llamada
   real, sin sobreescribir nunca. `cargarHistorial` no necesitó
   cambios (no depende de esa forma interna).

### 3 herramientas nuevas — todas siguen el patrón "función SQL parametrizada, nunca vista fija con fecha aproximada"

- **`get_calidad_lote` + `fecha_desde`/`fecha_hasta`** (función
  `calidad_lote_por_fecha`): antes solo existía histórico completo
  (`v_calidad_lote`, con `primera_produccion`/`ultima_produccion`
  aproximadas — limitación ya documentada en `14-calidad.md`). La
  función filtra con precisión por `turno.fecha` de cada parte.
- **`get_calidad_modelo` + fecha** (función
  `calidad_modelo_por_fecha`): mismo patrón, por producto en vez de
  por lote.
- **`get_calidad_turno`**: expone `v_calidad_turno`, que ya existía
  en BD desde el 21/08 (para el dashboard del jefe) pero nunca se
  había conectado a Ceria. El resumen diario más pedido, el más
  barato de construir.
- **`get_produccion_linea` / `get_calidad_linea`** (funciones
  `produccion_linea_por_fecha` / `calidad_linea_por_fecha`): una
  fila por línea con TODO un rango de fechas ya sumado (no una fila
  por turno) — para "línea 3 esta semana vs línea 3 semana pasada"
  se llama dos veces, una por rango, y el modelo compara. Producción
  respeta el mismo suelo de 480 min/turno que `v_produccion_turno`
  (CTE `por_turno_linea` antes de sumar entre turnos, para no repetir
  el bug #1).

Las 5 verificadas con datos reales del 2-3/09/2026 contra consultas
SQL independientes (no contra sí mismas) antes de darlas por buenas.

### Prompt (`buildSystemPrompt`, todo en `index.ts`) — varias correcciones esta sesión

- **"Dos ejes que nunca se mezclan" estaba mal redactado**: decía
  "SIEMPRE en secciones separadas", cuando lo único que debía
  prohibirse era la CAUSALIDAD (nunca "esto causó aquello"). Cantidad
  y calidad SÍ deben poder mostrarse juntas en una tabla — corregido.
- **Nunca JSON crudo como respuesta** + red de seguridad en código
  (`sanearRespuestaJSON`) que extrae el texto legible si el modelo
  igual lo suelta — la instrucción de prompt sola no bastó dos veces.
- **No abuses de preguntas de aclaración**: por defecto, agrupar y
  responder con una interpretación razonable en vez de preguntar
  antes de actuar; ejemplos concretos añadidos según fallos reales
  (agrupar por lote, deduplicar listados).
- **Nunca ofrecer generar CSV/Excel** — esa función no existe en
  Ceria, y el modelo lo prometía sin que fuera cierto.
- **`get_partes` nunca para totales/comparar**: su descripción
  llegó a poner como ejemplo "¿cómo fue la línea 3 esta semana?" —
  justo lo que ahora cubre `get_produccion_linea`. Causó que Fase 1
  eligiera mal herramienta en una comparación real. Corregido:
  descripción reescrita para excluir explícitamente agregados y
  comparaciones, apuntando a las herramientas correctas.
- **Nunca digas "sin datos" si alguna llamada sí trajo filas** —
  añadido tras el bug #4 de arriba, para que ningún modelo futuro
  agrupe un resultado con filas junto a uno sin filas bajo un único
  "no hay nada".
- Timeout de `llamarOpenAI` subido de 30s a 60s (colchón mayor según
  el prompt ha ido creciendo con cada corrección).

### Pendiente / a medias
- **Terminología de `minutos_saturacion`**: el jefe corrigió que no
  es "otra sección" sino la propia sección (empaquetadora, de nombre
  propio "Griffon" — antes solo constaba "empaquetadora" a secas —, y
  posiblemente "parque" como tercera zona). El texto en
  `ceria_prompts`/memoria parece correcto ("problema interno a esta
  sección"), así que antes de tocar nada hay que revisar si el fallo
  real está en la fila viva de la BD (pudo divergir del texto
  documentado) o es el modelo parafraseando mal — sin confirmar aún.
- **"Calidad de modelos de pulido vs el resto"** (la pregunta más
  compleja planteada): sigue sin construir. Necesita confirmar qué
  valores tiene `lote.acabado_tipo` en real antes de diseñar la
  vista/función.
- **`strict: true`** en el esquema de `TOOLS` (fuerza a OpenAI a no
  inventar nombres de parámetros): quedó como red de seguridad
  estructural pendiente, no aplicada — se prefirió primero afinar
  descripciones de herramientas, que resolvió el caso visto.
- Sigue sin hacerse la **auditoría del resto de vistas** (`v_calidad_lote`
  ranking sin `piezas_entradas > 0`/`NULLS LAST` ya apuntado en sesión
  anterior, `v_rectificado_*`, etc.) buscando el mismo patrón de bug
  #1/#2 de arriba.