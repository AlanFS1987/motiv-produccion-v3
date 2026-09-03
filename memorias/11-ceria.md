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

## Herramientas (9)

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