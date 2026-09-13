# 16 — NORA: copiloto de averías por voz (independiente de Ceria)

## Decisión y por qué (11/09/2026)

El futuro asistente de diagnóstico/reparación de máquinas (hasta
`11-ceria.md` referido como "nueva multi-tool copiloto de
diagnóstico") se construyó como **asistente independiente de Ceria**,
no como herramienta dentro de su Fase 1. Se llama **N.O.R.A.**
(Navegación, Orientación y Resolución de Averías).

- Ya estaba anticipado: el propio `index.ts` de Ceria dejó constancia
  de que la electromecánica se descartó a propósito
  ("get_averias/get_ajustes descartadas por ahora").
- **Público distinto**: Ceria habla con jefe/admin desde un puesto
  fijo. NORA habla con un mecánico delante de la máquina, con las
  manos ocupadas — de ahí voz en vez de texto.
- **Patrón de interacción distinto**: no es "elige una herramienta de
  datos agregados" (Fase 1 de Ceria), es un diálogo socrático
  (pregunta corta → respuesta → siguiente pregunta) apoyado en texto
  libre e inferencia sobre `ceria_documentacion_maquina`.
- **Los datos no se duplican**: reutiliza `ceria_documentacion_maquina`
  tal cual, sin copiar nada.

## Arquitectura

- **Voz**: OpenAI Realtime API, WebRTC **directo navegador↔OpenAI**.
  El backend solo emite un token efímero de corta duración (una
  llamada HTTP normal) — no hay conexión persistente en nuestro
  servidor, ni websocket que mantener.
- **Un único edge function**, `supabase/functions/nora/index.ts`, con
  dos acciones por el campo `accion` del body:
  - `"token"` — mint del client_secret efímero (llama a
    `POST https://api.openai.com/v1/realtime/client_secrets`), más
    toda la configuración de comportamiento.
  - `"documentacion"` — la tool que el modelo llama durante la
    conversación: `{maquina, submaquina}` → filas de
    `ceria_documentacion_maquina` (con `service_role`, comprobando
    acceso ella misma — no depende de la RLS pensada para jefe/admin).
- **Todo el comportamiento vive en ese único edge function**, no en
  el frontend: el prompt (`construirInstrucciones()`), el índice de
  máquinas (`INDICE_MAQUINAS`) y una única constante `AUDIO_CONFIG`
  (voz, sensibilidad al detectar turnos, reducción de ruido,
  transcripción) son la fuente de verdad. Se usan dos veces: para fijar
  la sesión al crear el token, y se devuelven tal cual al frontend, que
  los reenvía sin conocerlos ni repetirlos. **Cambiar cualquier cosa de
  comportamiento = editar este archivo + `supabase functions deploy
  nora`, sin tocar ni desplegar el frontend.** (`aSnakeCase()` adapta
  `AUDIO_CONFIG`, escrito en camelCase para el SDK del frontend, al
  snake_case que exige la API REST de OpenAI al crear el token.)
- La **tool en sí** (su `execute` real contra Supabase) vive en
  `NoraScreen.tsx`, porque tiene que correr en el navegador. El modelo
  puede llamarla varias veces por conversación (cambia de submáquina,
  o cruza varias); los resultados se **acumulan**, nunca se descartan.
- **Modelo**: `gpt-realtime-2.1-mini` — elegido por coste/velocidad.
  Alternativa si el razonamiento del árbol socrático se queda corto:
  `gpt-realtime-2.1` (el mismo modelo sin "mini"), cambiando solo esa
  constante.
- **Voz**: `marin` (clara/profesional). Alternativa `cedar` (más
  cercana/conversacional) — cambio de una palabra en `AUDIO_CONFIG`.
- **Turn detection**: `semantic_vad`, `eagerness: "low"`,
  `interrupt_response: true`, `create_response: true`, más
  `noise_reduction: { type: "near_field" }` — necesario porque en la
  primera prueba real, el ruido de la nave interrumpía a NORA con
  cualquier sonido de fondo; sin este ajuste no es usable en planta.
  Si con esto no basta, el siguiente paso (anotado en el propio
  código) es `server_vad` con `threshold` 0.7-0.8 en vez de
  `semantic_vad`.
- **Transcripción de entrada** activada (`gpt-4o-mini-transcribe`) —
  no se usa todavía, pero es la que hará falta para el logging
  pendiente (ver abajo).

## Prompt actual

```text
Eres NORA (Navegación, Orientación y Resolución de Averías), copiloto de voz para un mecánico que está delante de la máquina, con las manos ocupadas. Hablas español, con frases cortas y naturales: esto es una conversación de voz, no un informe escrito.

Máquinas y submáquinas disponibles hoy:
${indiceTexto}

Cuando el mecánico describa un problema, identifica tú mismo la máquina/submáquina más probable. Pregunta UNA cosa corta solo si realmente no puedes deducirla. La identificación inicial es provisional y puede cambiar durante el diagnóstico.

Llama a la herramienta obtener_documentacion con la máquina/submáquina identificada ANTES de intentar diagnosticar. No inventes procedimientos, alarmas, piezas, valores ni causas que no estén respaldados por la documentación disponible o por información confirmada durante la conversación.

Puedes llamar a la herramienta varias veces si el problema resulta estar en otra submáquina distinta a la inicialmente identificada, o si necesitas cruzar información de varias submáquinas. Si cambias de hipótesis, no descartes automáticamente lo consultado anteriormente: conserva y utiliza la información relevante ya obtenida.

Una vez tengas la documentación necesaria, guía al mecánico mediante preguntas cortas y progresivas, una detrás de otra, siguiendo un razonamiento socrático. Prioriza las preguntas que permitan diferenciar entre varias causas posibles.

No intentes adivinar la solución demasiado pronto. Primero recopila la evidencia necesaria. Distingue internamente entre hechos confirmados, hipótesis y comprobaciones pendientes -- esta distinción es para tu propio razonamiento, no la verbalices ante el mecánico (nunca digas cosas como "esto es una hipótesis" o "esto es un hecho confirmado"): simplemente pregunta o actúa en consecuencia.

No repitas preguntas que el mecánico ya haya respondido ni comprobaciones que ya haya confirmado, salvo que exista una razón técnica para repetirlas.

Sé MUY breve en cada turno: una o dos frases como mucho. Nunca produzcas un párrafo largo ni una lista de pasos leída de corrido.

Da un solo paso o una sola pregunta cada vez y espera la respuesta del mecánico antes de continuar.

Si una comprobación física es necesaria, indica exactamente qué debe comprobarse, pero de forma breve. No des varias comprobaciones a la vez.

Si la solución tiene varios pasos, indícalos de uno en uno, confirmando que el mecánico ha realizado cada paso antes de pasar al siguiente. Nunca enumeres todos los pasos de una reparación de golpe.

Si la información disponible no permite establecer una causa con suficiente evidencia, dilo claramente y solicita la comprobación o el dato que falta. Nunca inventes una respuesta para cerrar el diagnóstico.

Cuando exista evidencia suficiente, proporciona una causa probable y una acción concreta para resolver la avería.

En cuanto el mecánico diga que el problema ya está resuelto (o algo equivalente: "ya funciona", "ya está", "solucionado"...), no sigas la conversación ni ofrezcas nada más. Despídete en una frase corta y pídele explícitamente que cuelgue él mismo. Tú no puedes colgar la llamada; solo el mecánico tiene el botón. Por ejemplo: "Perfecto, me alegro. Puedes colgar cuando quieras." Nunca preguntes "¿algo más en lo que pueda ayudarte?" en ese momento. La despedida cierra la conversación, no la reabre.
```

`${indiceTexto}` se genera desde `INDICE_MAQUINAS` (hoy solo BS08 con
sus 8 submáquinas — ver `11-ceria.md`).

## Acceso

Mismo patrón que Ceria, vía `chat_acceso`: `tipo_chat='nora'`.
Migración `20260912120000_chat_acceso_nora.sql` siembra acceso
inicial a `jefe`+`administrador`. El admin gestiona qué roles ven
NORA desde `ChatAccesoScreen.tsx` — sin código ni despliegue, igual
que con Ceria. Aparece en la pestaña Chat (`ChatHomeScreen.tsx`) como
fila propia, debajo de Ceria, con icono de micrófono en vez de robot.

## Archivos (11-12/09/2026)

- `supabase/migrations/20260912120000_chat_acceso_nora.sql`
- `supabase/functions/nora/index.ts`
- `frontend/src/lib/nora.ts`
- `frontend/src/components/nora/NoraScreen.tsx`
- `frontend/src/components/chat/ChatHomeScreen.tsx` (modificado: fila
  de NORA, mismo criterio que Ceria)
- `frontend/src/lib/chat-acceso.ts` (modificado: `'nora'` añadido a
  `TipoChat` / `TIPOS_CHAT` / `ETIQUETA_CHAT`)
- `frontend/vercel.json` (modificado: `Permissions-Policy` con
  `microphone=(self)`, y `https://api.openai.com` añadido a
  `connect-src` de la CSP — sin esto, el micrófono y la conexión
  WebRTC a OpenAI quedan bloqueados por las propias cabeceras de
  seguridad del proyecto)
- Dependencias nuevas en `frontend/`: `@openai/agents`, `zod`

## Infra / cosas no obvias descubiertas en esta sesión

- **PWA instalado en Android**: el permiso de micrófono no aparece en
  "Configuración del sitio" del navegador si nunca llegó a pedirse (se
  bloqueaba antes por la cabecera `Permissions-Policy`, ver arriba).
  Concederlo puede requerir entrar a "Información de la app" en
  Android, o probar primero desde Chrome normal (no desde el icono
  instalado) para que el permiso se comparta.
- **`sw.js` no necesitó cambios** para que las cabeceras nuevas
  llegaran: su estrategia para `navigate` es red-primero, así que se
  aplican solas en la siguiente carga. Solo hay que subir el número de
  versión de `sw.js` cuando se edita el propio `sw.js`, no por cambios
  en `vercel.json`.

## Estado (12/09/2026)

Experimento funcionando de punta a punta: conecta, identifica la
submáquina sin que se le indique explícitamente, llama a la tool,
mantiene un diálogo socrático breve, y se despide pidiendo colgar al
terminar. Probado solo con el Divisor (caso más completo de
documentación, ver `11-ceria.md`).

## Pendiente

- **Logging de conversaciones** (`nora_conversaciones`/
  `nora_mensajes`, mismo patrón que Ceria) — no empezado. No es solo
  auditoría: el prompt ya le pide a NORA decir explícitamente cuando
  no tiene evidencia suficiente en vez de inventar, así que el
  historial es la vía natural para detectar huecos reales en
  `ceria_documentacion_maquina`.
- **Confirmar en planta real** que `noise_reduction` + `eagerness:
  "low"` resuelven las interrupciones por ruido de fábrica — ajuste
  reciente, sin validar todavía con ruido de máquina de verdad.
- **Validar la calidad de razonamiento de `gpt-realtime-2.1-mini`**
  contra el prompt actual (diferenciación de causas, no inventar,
  distinguir hecho/hipótesis/pendiente sin verbalizarlo) — si se queda
  corto, probar `gpt-realtime-2.1` (el modelo completo) antes de tocar
  más el prompt.
- **Ampliar más allá del Divisor** — el resto de submáquinas de la
  BS08 tienen menos documentación capturada; el copiloto solo puede
  ser tan bueno como esos datos.
- **Resto de máquinas de la sección** (Griffón, Qualitron...) — sin
  empezar, ni en la documentación base ni en NORA.
- **`INDICE_MAQUINAS` fijo en código** — hoy es una constante a mano
  en el edge function; si el catálogo crece, valorar sustituirlo por
  una consulta real a `ceria_documentacion_maquina`.