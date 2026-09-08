# 15 — Notificaciones in-app y Chat unificado

Sistema construido en la sesión del 07/09/2026, **en paralelo** a los
avisos de Telegram existentes (`05-automatismos.md`) — no los
sustituye ni les toca nada, es un feed independiente dentro de la
propia app. No existía ningún archivo de memoria para esto todavía;
se crea este porque el tema ya tiene entidad propia (esquema, 3
pantallas, una tabla de control de acceso) y no encaja limpiamente en
ninguno de los 14 archivos existentes.

## Qué es, en una frase

Cada aviso que ya se manda a Telegram (incidencia de calidad,
incidencia de producción, nuevo lote, resumen de turno, resumen de
calidad) se guarda **también** dentro de la app, con el mismo texto
completo, en un feed por tipo con no-leídas — y desde el 07/09 esos 5
canales conviven con el chat humano general y con Ceria en una única
pestaña **Chat**, todo controlado por una tabla de permisos que edita
el administrador sin tocar código.

## Tablas

- **`notificaciones`** — feed de eventos: `tipo` (check constraint:
  `incidencia_calidad` / `incidencia_produccion` / `nuevo_lote` /
  `resumen_turno` / `resumen_calidad`), `titulo`, `cuerpo`,
  `referencia_id` (id de la fila origen, para enlazar al detalle),
  `data` jsonb (fotos, URL de PDF), `created_at`. Sin política de
  INSERT para `authenticated`/`anon` — solo se inserta desde las
  Edge Functions con `service_role` (ver "Cómo se alimenta" abajo).
  RLS de SELECT vía `fn_chat_acceso(tipo, 'ver')`.
- **`notificacion_estado_usuario`** — "hasta dónde he leído",
  **una fila por usuario Y por tipo** (rediseño 07/09: antes era un
  único timestamp por usuario; ahora cada canal necesita su propio
  contador de no-leídas). Ausencia de fila para un tipo = nunca
  abierto ese canal = todo no-leído en él.
- **`notificacion_preferencias`** — interruptor por tipo y usuario.
  Ausencia de fila = activado. **Solo gobierna push (Fase 7,
  futura)** — no oculta nada del feed ni afecta al contador de
  no-leídas; hoy no tiene efecto real porque no existe push todavía.
- **`notificacion_silencio`** — horario general de silencio (mismo
  rango todos los días, no distingue días de la semana), una fila
  por usuario, pensado para cruzar medianoche. Mismo caso: **sin
  efecto real hasta que exista push**.
- **`chat_mensajes`** — canal único de chat humano, sin salas. Texto
  y/o fotos (Cloudinary, preset `motiv_v3_chat`). Borrado **suave**
  (`eliminado=true`, nunca DELETE real — mismo criterio que
  `parte.vigente` en el resto del proyecto): cada uno borra lo suyo,
  el administrador borra cualquiera. Alcance de roles: responsable,
  suplente, operario, jefe, administrador — **calidad y
  jefe_rectificado quedan fuera a propósito**, misma decisión que en
  notificaciones.
- **`chat_acceso`** — control de acceso por rol para los **7
  "chats"** (los 5 automáticos + `general` + `ceria`): `tipo_chat`,
  `rol`, `puede_ver`, `puede_escribir`. **Deny-by-default**:
  ausencia de fila = sin acceso; quitar el "ver" de un rol borra la
  fila en vez de dejarla con `puede_ver=false`. Solo `general`
  distingue ver de escribir — en el resto un único interruptor
  (ver = participar, no hay "solo lectura" explícito salvo por no
  tener fila de escritura).

## Cómo se alimenta (sin duplicar lógica de texto en dos sitios)

Las 3 Edge Functions que ya mandaban avisos a Telegram
(`notificar-telegram`, `generar-resumen-turno`,
`notificar-telegram-resumen-calidad`) son las que insertan en
`notificaciones`, con **el mismo texto completo** que arman para
Telegram (no un resumen aparte). Hubo un vaivén de diseño esta
sesión, documentado en las migraciones:

1. **Fase 2** intentó que fueran las funciones SQL
   (`fn_notificar_telegram`, `fn_disparar_resumen_turno`,
   `fn_disparar_resumen_calidad`) las que insertaran directamente en
   `notificaciones` desde PL/pgSQL, reconstruyendo el texto en SQL.
2. Esto **se revirtió** el mismo día: reconstruir el mismo contenido
   en dos sitios (Edge Function para Telegram, SQL para el feed
   in-app) ya se había visto que se desincroniza (ejemplo real: una
   línea que faltaba en una de las dos versiones). Las 3 funciones
   SQL volvieron a ser **solo el disparo HTTP**; el INSERT en
   `notificaciones` se hace desde las Edge Functions, con el texto
   que ya construyen para Telegram.
3. `fn_disparar_resumen_calidad` es la única **condicional**: si no
   hay lotes finalizados pendientes, no inserta nada (mismo criterio
   exacto que ya usaba `notificar-telegram-resumen-calidad` para no
   mandar un mensaje vacío a Telegram) — replicado en SQL para que el
   cron (3 veces al día) no meta un canal "resumen_calidad" con
   entradas vacías.

## `fn_chat_acceso(p_tipo_chat, p_permiso default 'ver')`

`security definer`, consulta `chat_acceso` para el rol actual
(`fn_rol_actual()`). Devuelve `false` si no hay fila (deny-by-default).
Usada por las políticas RLS de `notificaciones` y `chat_mensajes`, y
por la propia Edge Function de Ceria (ver `11`) para decidir si el
rol que llama tiene acceso a `tipo_chat='ceria'`.

## Campana de notificaciones (`NotificacionesBell.tsx`)

Rediseñada al comportamiento de un cliente de Telegram: se abre una
**lista de 5 canales** (uno por tipo automático), cada uno con su
último mensaje y su contador de no-leídas; al tocar uno se entra a su
historial completo scrolleable, con botón atrás para volver a la
lista. Realtime: si el panel está cerrado o mirando otro canal, solo
sube el contador correspondiente; si se está viendo justo ese canal,
el mensaje se añade al hilo y se marca leído al instante.
"Preferencias" es una segunda pestaña dentro del mismo panel
(silencio por horario + interruptor por tipo) — construida pero,
como se explica arriba, sin efecto real todavía.

## Pestaña unificada "Chat" (`chat/ChatHomeScreen.tsx`)

Lista maestra que muestra **solo los chats a los que el rol del
usuario tiene acceso** (consulta `chat_acceso` filtrada por el propio
rol). Cada fila, al tocarla, abre a pantalla completa:
- Los 5 automáticos → historial de solo lectura, reutilizando la
  misma consulta que ya usaba la campana.
- `general` → la pantalla de chat humano ya existente
  (`ChatScreen.tsx`), tal cual.
- `ceria` → `CeriaScreen.tsx` tal cual, **sin contador de
  no-leídas** (no le pega — solo el propio usuario le habla).

Convive con la campana (que sigue mostrando solo los 5 automáticos)
— no la sustituye todavía; son dos puntos de entrada al mismo dato.

## Panel de administración de accesos (`admin/ChatAccesoScreen.tsx`)

Rejilla: cada fila es uno de los 7 chats, expandible, con un
interruptor por rol dentro (y uno adicional de "puede escribir" solo
para `general`). Cambios guardados al momento, sin botón "Guardar",
con reversión optimista si falla el guardado. **Comparte pantalla**
con el apagado de modelos de Fase 3 de Ceria
(`ceria_modelo_activo` — ver `11`) — decisión práctica de la sesión:
es la misma pantalla de "cosas que el admin enciende/apaga sin
desplegar nada", aunque conceptualmente sean dos sistemas distintos.

## Fases de esta sesión (07/09/2026), para referencia

1. Esquema de notificaciones (tabla + RLS global sin reparto por rol).
2. Fan-out por tipo con INSERT desde SQL → revertido a INSERT desde
   Edge Function (ver arriba).
3. Campana rediseñada a canales.
4. Esquema + RLS de `chat_mensajes`.
5. Pantalla de chat humano (`ChatScreen.tsx`).
6. `chat_acceso` + rediseño a canal-por-tipo (`notificacion_estado_usuario`
   pasa a clave compuesta usuario+tipo) + pestaña Chat unificada.
7. **Push real — no empezado.** `notificacion_preferencias` y
   `notificacion_silencio` están construidas y persistidas pero sin
   ningún efecto hasta que exista esta fase.

## Pendiente

- Push real (Fase 7) — sin empezar, es lo que dará efecto a
  preferencias y silencio.
- Decidir si la campana (5 canales automáticos) se retira en favor de
  la pestaña Chat unificada, o conviven permanentemente.
- `chat_acceso` seed inicial (migración `20260907180000`) da acceso a
  los 5 automáticos + `general` a responsable/suplente/operario/
  jefe/administrador, y `ceria` solo a jefe/administrador — cualquier
  ajuste posterior (ej. dar `ceria` a producción) se hace desde
  `ChatAccesoScreen.tsx`, no requiere migración.

## Archivos

`supabase/migrations/20260907120000_notificaciones_in_app_fase1.sql`,
`20260907130000_notificaciones_fanout_fase2.sql`,
`20260907150000_chat_esquema_rls_fase4.sql`,
`20260907170000_notificaciones_canal_por_tipo_esquema.sql`,
`20260907180000_chat_acceso_por_rol.sql` ·
`frontend/src/lib/notificaciones.ts`, `lib/chat.ts`, `lib/chat-acceso.ts` ·
`components/notificaciones/NotificacionesBell.tsx`,
`components/chat/ChatHomeScreen.tsx`, `components/chat/ChatScreen.tsx`,
`components/admin/ChatAccesoScreen.tsx`.
