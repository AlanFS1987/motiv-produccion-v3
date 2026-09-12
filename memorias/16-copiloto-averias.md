# NN — Copiloto de averías (independiente de Ceria)

[Borrador para archivar como `memorias/NN-copiloto-averias.md` — el
número de archivo está sin confirmar; usar el siguiente libre según
`memorias/README.md` en el momento de archivarlo, y añadir la entrada
correspondiente en la tabla de ese índice.]

## Decisión (11/09/2026)

El futuro asistente de diagnóstico/reparación de máquinas (hasta
ahora referido dentro de `11-ceria.md` como "nueva multi-tool
copiloto de diagnóstico") se construirá como **asistente
independiente de Ceria**, no como una herramienta más dentro de su
Fase 1.

### Por qué

- Ya estaba anticipado: el propio `index.ts` de Ceria dejó constancia
  explícita de que la electromecánica se descartó a propósito
  ("Sin electromecánica — get_averias/get_ajustes descartadas por
  ahora"). Esto no es un cambio de rumbo, es llenar ese hueco.
- **Público distinto**: Ceria habla con el jefe de planta (roles
  jefe/admin, vía `chat_acceso`). Esto habla con un mecánico delante
  de la máquina, con las manos ocupadas.
- **Patrón de interacción distinto**: Fase 1 de Ceria elige entre
  herramientas de datos agregados con `tool_choice: required` — bien
  para "dame una cifra". El copiloto de averías necesita una
  conversación tipo Socrático (pregunta corta → respuesta → siguiente
  pregunta), apoyada en texto libre e inferencia sobre
  `ceria_documentacion_maquina`, no en llamadas a datos estructurados.
- **Los datos no se duplican**: `ceria_documentacion_maquina` sigue
  siendo una tabla normal de Supabase — el asistente nuevo la
  consulta igual que podría hacerlo Ceria, sin copiar nada. Separar
  el asistente no obliga a separar los datos.

## Interés en voz (GPT Realtime)

Motivación: velocidad de respuesta, y encaja de forma natural con el
`tipo = 'diagnostico'` ya creado en la tabla (preguntas cortas, una
detrás de otra) — ese formato es prácticamente un guion pensado para
voz, aunque se diseñó pensando en texto.

**Antes de comprometerse con esto, verificar:**
- Que el modelo Realtime soporte function calling contra la tabla de
  documentación con la latencia buscada (no solo que hable rápido,
  también que busque y razone rápido).
- La infraestructura que exige (conexión persistente/websocket) es
  un salto real de complejidad frente al patrón HTTP simple que usa
  Ceria hoy — no es solo "añadir un modelo más al desplegable".

## Estado

Decisión tomada, nada construido todavía. A desarrollar en otro chat.
Reutilizará `ceria_documentacion_maquina` tal cual; el Divisor
(ver `11-ceria.md`) es, hoy, el caso más completo y sirve de
referencia de qué nivel de detalle hace falta por submáquina antes
de que el copiloto pueda diagnosticar bien.
