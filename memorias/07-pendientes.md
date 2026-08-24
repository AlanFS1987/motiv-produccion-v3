# 07 — Pendientes

Solo lo abierto. Cuando algo se cierra, se borra de aquí y se actualiza
el archivo de área correspondiente. Orden: primero lo que afecta al
comportamiento real, luego decisiones, luego construcción.

## Bugs y huecos conocidos (afectan al uso real)

- **[CERRADO 20/08/2026]** `crearParteInicial` (lib/parte.ts) nunca
  copiaba el operario asignado a `parte.operario_id` al crear el
  parte — quedaba siempre `null`. Añadida la consulta a
  `asignacion_operario_linea` antes del insert. Probado en real:
  reparto igualitario entre 2 operarios confirmado con datos reales
  (16 puntos cada uno).

- **[CERRADO 20/08/2026]** `puntos_rendimiento` (operario) tenía
  copiada por error la escala del responsable (10 tramos, máx 45).
  Reemplazada por la escala real de v2 (6 tramos, máx 15), sin huecos.
- **[CERRADO 20/08/2026]** `puntos_rendimiento_responsable` tenía
  huecos entre tramos; cerrados sin tocar los puntos (la escala en sí
  era correcta).
- **[CERRADO 20/08/2026]** `puntos_piezas` estaba completamente
  vacía — nunca se aplicó su siembra (mismo patrón que
  checklist_items). Sembrada con los 35 tramos reales de v2, y
  quitado el tope superior del último tramo de cada formato (ahora
  `max` puede ser null = sin límite, igual que puntos_metros).
- **[CERRADO 20/08/2026]** Admin ya puede corregir partes (trigger
  security definer + política nueva).
- **[CERRADO 20/08/2026]** `fn_turno_de_letra`/`fn_ciclo_id`/
  `fn_ciclo_rango` pasadas de immutable a stable.

- **[CERRADO 20/08/2026]** `parte_update_vigente_responsable_ventana`:
  el `with check` no impedía cambiar `completado_at`/`completado`/
  `vigente` dentro de la ventana de corrección de 1h (solo lo
  garantizaba la UI). Añadido trigger
  `fn_parte_restringir_columnas_update`
  (`20260820170000_parte_restringir_columnas_update.sql`) que bloquea
  esos cambios a nivel de BD, tanto para el responsable en ventana de
  corrección como para el operario (limitado a sus 5 columnas de
  verificación).
- **[CERRADO 20/08/2026]** `fn_rol_actual`/`fn_es_responsable_de_turno`
  security definer sin `set search_path`. Añadido `set search_path =
  public` a ambas (`20260820160000_fix_search_path_funciones.sql`).
  Confirmado contra `pg_proc` en BD real: `proconfig =
  ["search_path=public"]` en las dos.
  
  
  Confirmado 21/08/2026: `supabase db diff --linked` sin diferencias —
esquema real y migraciones alineados, incluido el enum `rol_usuario`
completo (`pantalla`/`jefe_rectificado` sí están cubiertos por
migración, la nota anterior sobre esto era incorrecta/desactualizada).
- **[CERRADO 21/08/2026]** `FotoPantallaMaquina.tsx` modo `"corregir"`
  — el tono/calibre nunca fueron editables al corregir un parte: el
  guardado enviaba siempre `props.valoresIniciales.tono/calibre` a
  pelo, sin ningún `<input>` que los expusiera. No era un fallo nuevo
  de la pantalla de admin (`CorreccionPartesScreen.tsx`) — ya existía
  para el responsable corrigiendo su propio parte, solo que rara vez
  necesita tocar el tono al corregir. Se añadieron campos editables
  con la misma validación de siempre (`esTonoCalibreValido`,
  `limpiarEntradaTonoCalibre`).


- **[CERRADO 21/08/2026]** Ceria (fase 1) podía devolver `tool_calls`
  vacío pese a `tool_choice: "required"` con preguntas más complejas
  de clasificar. Causa: gpt-5-mini es un modelo de razonamiento, gasta
  tokens internos antes de responder, contados contra
  `max_completion_tokens` — con 500 podía agotar el presupuesto
  pensando. Corregido: 1200 tokens + `reasoning_effort: "low"` en fase
  1 (elegir herramienta es tarea simple, no necesita razonar de más),
  3000 + `"low"` en fase 3.
  - **[CERRADO 21/08/2026]** `AuthContext.tsx` — el guard de
  `TOKEN_REFRESHED` comprobaba `usuario` directamente dentro del
  callback de `onAuthStateChange`, pero ese callback vive en un
  `useEffect` con deps `[]` (se crea una sola vez, al montar) — así
  que `usuario` quedaba congelado en `null` para siempre por el
  closure, y el guard nunca se cumplía. Resultado real: cada
  TOKEN_REFRESHED (se dispara al recuperar el foco, incluida la
  cámara nativa) seguía disparando `setCargando(true)` y desmontando
  la app — el bug de "se pierde la foto en curso al volver de la
  cámara" que un comentario anterior en el propio archivo daba por
  corregido, en realidad seguía activo. Corregido con un `useRef`
  sincronizado (`usuarioRef`) que sí refleja el valor actual dentro
  del callback.

- **[CERRADO 21/08/2026]** `fn_es_responsable_de_turno` — función sin
  ningún uso real (confirmado contra `pg_policies`), con un bug de
  diseño (el `or fn_rol_actual() in (...)` final anulaba la
  comprobación real de `exists(...)` contra `p_turno_id`). Eliminada
  con `20260821223000_drop_fn_es_responsable_de_turno.sql`.

- **[CERRADO 21/08/2026]** `lib/supabase-functions.ts` tenía
  `llamarEdgeFunction`/`generarResumenTurnoRemoto` sin ningún uso real
  y con un comentario que decía justo lo contrario que la Edge
  Function que llamaba (`generar-resumen-turno`, que "NUNCA la llama
  el frontend"). Además mandaba la anon key como Bearer contra una
  función desplegada `--no-verify-jwt` que solo acepta
  `x-webhook-secret` — habría fallado con 401 si alguien la
  reactivaba. Eliminada la función y sus tipos asociados.

- **[CERRADO 21/08/2026]** `App.tsx` — cualquier rol no reconocido
  explícitamente (`produccion`, `calidad`, o cualquier valor futuro)
  caía por defecto al shell de responsable y fallaba en silencio
  contra RLS. Añadido componente `RolSinInterfaz` y una comprobación
  explícita: solo `responsable`/`suplente` van al shell de
  responsable, cualquier otro rol ve un aviso claro.

- **[CERRADO 21/08/2026]** `notificar-telegram-resumen-calidad` — el
  marcado de `resumen_calidad_enviado_at` ocurría solo al final de
  todos los envíos; si un mensaje fallaba a mitad (de varios, por el
  límite de 3500 caracteres), ningún lote quedaba marcado, incluidos
  los ya enviados con éxito en mensajes anteriores — duplicados
  garantizados en el siguiente pase del cron. Corregido: se marca
  cada lote justo tras confirmarse el envío de SU mensaje concreto.

- **[CERRADO 21/08/2026]** `SelectorFotosMultiple.tsx` — al quitar una
  foto no se liberaba la URL de objeto local (`URL.revokeObjectURL`),
  quedando en memoria hasta recargar la página. Corregido. (El borrado
  del archivo remoto en Cloudinary queda fuera: los presets son
  unsigned y no permiten borrado sin exponer credenciales — se acepta
  la huérfana hasta la purga de retención de 18 meses, o hasta que el
  volumen justifique una Edge Function de borrado con service_role.)

- **[CERRADO 24/08/2026]** `obtenerPodioCicloActual` (lib/ranking.ts)
  usaba un embed de PostgREST (`usuario:operario_id(username)`) contra
  `v_puntos_operario_ciclo`, una VISTA sin foreign key propia —
  PostgREST no puede resolver relaciones sobre vistas sin FK, error
  400 "Could not find a relationship... in the schema cache". No era
  un problema de RLS (el podio del ciclo ANTERIOR, que sí usa un
  embed pero contra la tabla `historial_ciclos` con FK real, no tenía
  este fallo). Corregido añadiendo `username` como columna directa a
  `v_puntos_operario_ciclo` (mismo patrón que `v_rey_formato_
  historico.operario_username`) y quitando el embed del cliente.
  Bug pre-existente desde que se escribió el archivo (23/08/2026),
  nunca se había probado contra datos reales de un ciclo con más de
  un operario hasta la auditoría del 24/08.

- **[CERRADO 22/08/2026]** `operario_logro` eliminada — con los 19
  logros pasando a calcularse 100% por consulta, esta tabla de
  progreso guardado se q
  
- **[NUEVO 24/08/2026 — auditoría]** Tres huecos de RLS detectados y
  corregidos en `20260824120000_rls_configuracion_usuario_ranking.sql`
  (pendiente de `supabase db push` + retest): (1) `configuracion` SIN
  RLS — cualquier autenticado podía escribirla vía PostgREST; (2) los
  embeds de username (Ranking del operario, Vista Detallada del jefe)
  chocaban con la RLS de `usuario` — el podio salía sin nombres para
  un operario y el dashboard sin nombres para el jefe; (3) el podio
  del ciclo anterior lee `historial_ciclos` directo y la RLS solo
  devolvía la fila propia. **Todo lo de Ranking/Dashboard se había
  probado solo con cuenta admin** (que ve todo por RLS) — tras aplicar
  la migración, repetir la prueba con una cuenta de operario y una de
  jefe reales.
- **[NUEVO 24/08/2026 — auditoría]** Código muerto con contrato roto:
  `generarPersonaje()` en `lib/gamificacion.ts` no manda `nivel_id`,
  que la Edge Function reescrita exige — si algo la llamara, fallaría.
  El comentario de cabecera de `lib/stats-avatar.ts` ("la generación
  sigue siendo generarPersonaje() de lib/gamificacion.ts") es falso:
  el flujo real es `generarPersonajeParaNivel` del propio archivo.
  Borrar la función vieja y el comentario. Relacionado:
  `AuthContext.tsx`, `obtenerDatosGamificacion` y
  `obtenerGeneracionesDisponibles` siguen leyendo
  `usuario.generaciones_disponibles` (valor sin significado desde
  23/08) — limpiar cuando se toque esa zona.
- **[NUEVO 24/08/2026 — auditoría]** `frontend/.env.example` no
  incluía `VITE_CLOUDINARY_PRESET_PERSONAJES` (obligatoria para la
  generación de avatar desde 22/08). Corregido — ver parche.
- **[NUEVO 24/08/2026 — auditoría]** Revisar en `ceria/index.ts` el
  `historialLimpio.slice(0, -1)` de la fase 1: si la pregunta del
  usuario aún no está guardada en BD en ese punto (el guardado ocurre
  después), ese slice recorta el ÚLTIMO MENSAJE DEL ASSISTANT del
  historial, no un duplicado de la pregunta — degradaría el contexto
  sin dar error. Confirmar el orden real guardado/carga y quitar el
  slice si sobra.



12. Cierre automático de turno: confirmar con un caso real (o forzar
    `select fn_encolar_resumenes_turno_pendientes();`).
13. Camino "Continuar mismo lote+tono" con cambio de turno real: sin
    probar de punta a punta.
14. Identificador de modelo de OCR fijo en código; moverlo a
    configuración/secret para no redesplegar cuando se retire.
15. Migraciones duplicadas de mismo propósito
    (`20260816230000`/`20260816230001` para resumen automático de
    turno; `20260820220000`/`20260821220000` para seeds de prompts de
    Ceria) — el resultado final en BD es correcto (confirmado con
    `supabase db diff --linked`, sin diferencias), pero son confusas
    de leer. Aplazado a propósito: se resolverá con un squash general
    de migraciones antes de arrancar producción (31/08/2026) — la app
    no tiene datos reales más allá de usuarios de prueba creados a
    mano, así que es un buen momento para hacerlo sin riesgo.
16. **[NUEVO 22/08/2026]** `fn_cerrar_ciclos_pendientes` está
    construida y probada manualmente, pero el primer cierre real no
    ocurrirá hasta el 28/09/2026 (fin del ciclo 0) — pendiente de
    confirmar con un caso real que el cron dispara correctamente ese
    lunes (mismo tipo de validación pendiente que el cierre automático
    de turno, punto 12).

17. **[CERRADO 23/08/2026]** `generar-personaje` reescrita ese mismo
   día: lee el snapshot de `personaje_stats_nivel` del nivel elegido
   (imagen E historia con las mismas stats congeladas). Ver
   `04-gamificacion.md`.
18. **[NUEVO 23/08/2026]** Vista de usuarios del admin: ampliar con
   puntos totales, puntos para el siguiente nivel y botón "otorgar
   generaciones" (consume `v_admin_usuarios_gamificacion` +
   `fn_otorgar_bonus_nivel`, ya construidos en
   `20260823100000_personaje_stats_nivel_bonus.sql`). Sin pantalla
   todavía.

   
- **[CERRADO 20/08/2026]** Sin plan B si la API de Anthropic no
  respondía: se descartó el formulario manual/guardado local (mucha
  complejidad para un evento que no había ocurrido en 5 meses de uso
  real). En su lugar, `ocr-parte` ahora prueba GPT (`gpt-4o-mini`)
  como extractor principal y cae a Haiku si falla — con timeout de
  25s en ambas llamadas y de 10s en la validación de sesión
  (`Promise.race`), para que ningún fallo se quede colgado
  indefinidamente (visto en real: sin timeout, un cuelgue tardaba
  ~150s hasta que Supabase mataba la función con error 546). La
  respuesta de `ocr-parte` incluye ahora `extraido_con: "gpt" |
  "claude"` para poder auditar cuál resolvió cada caso.
- **[CERRADO 20/08/2026]** `fn_rol_actual()` / `fn_es_responsable_de_turno()`
  security definer sin `set search_path` — corregido, ambas fijadas a
  `search_path = public` (migración `20260820160000_fix_search_path_funciones.sql`).

- **[CERRADO 20/08/2026]** Restricción por fila (no por columna) en
  `UPDATE` de `parte` — operario podía tocar cualquier columna, no solo
  las `*_operario`; responsable en ventana de 1h podía cambiar
  `completado`/`completado_at`/`vigente`. Resuelto con un único trigger
  `trg_parte_restringir_columnas` (`fn_parte_restringir_columnas_update`,
  migración `20260820170000_parte_restringir_columnas_update.sql`) que
  compara OLD/NEW por columna y bloquea lo que no corresponde a cada
  camino. Probado en real con responsable y operario reales.

- **[VALIDADO 20/08/2026]** Cálculo de puntos de rendimiento del
  operario confirmado correcto contra datos reales
  (`v_puntos_operario_total_vida`) tras probar el flujo completo
  responsable→operario con la fábrica parada por vacaciones.
  **[CERRADO 22/08/2026]**: ya tiene pantalla (`InicioOperarioScreen.tsx`,
  ver `04-gamificacion.md`).

## Decisiones por tomar

- Alcance del lanzamiento del 31/08 (propuesta: responsable + operario,
  jefe por Telegram; el resto en septiembre–octubre).
- Dónde guardar el saldo inicial de puntos de v2.
- `[DECISIÓN PENDIENTE]` umbral de "minutos atípicos" (hoy 600).

- Decidir modelo principal de OCR (GPT `gpt-4o-mini` vs Claude Haiku) —
  hoy GPT es el extractor principal con fallback automático a Haiku si
  falla, en prueba de coste/calidad desde 20/08/2026
  (`_shared/openai.ts`, `_shared/anthropic.ts`). Sin fecha límite para
  decidir cuál queda en firme. (Nota: el proveedor de imagen del
  personaje RPG, GPT Image 2, es una decisión distinta y ya está
  cerrada — ver `04-gamificacion.md`.)

  - Cámara nativa (`<input capture>`) sigue recargando la app en Redmi
  Note 12 Pro+ (confirmado 21/08/2026, pantalla de prueba
  `admin/PruebaCamaraScreen.tsx`) — igual que en los Xiaomi de la
  sesión 18/08/2026 que motivó pasar a cámara en vivo. v2 usaba el
  mismo `<input capture>` sin este problema; hipótesis en estudio:
  peso en memoria de la app actual frente a v2, no falta de RAM
  (MIUI descarta procesos de fondo aunque sobre memoria). Pendiente
  de confirmar con `chrome://discards` si de verdad es un descarte de
  pestaña. Se mantiene la pantalla de prueba para seguir investigando
  y para repetir la comprobación si la app pasa a PWA.

## Por construir (orden sugerido)

1. **[CERRADO 22/08/2026]** `cerrar-ciclo` + escritura de
   `historial_ciclos` + total de puntos completo (piezas + rendimiento
   + limpieza) — construido, probado manualmente. Ver
   `04-gamificacion.md`. Queda pendiente confirmar el primer cierre
   real el 28/09/2026 (punto 16 de arriba).
2. Alta/edición de usuarios y letra desde la app — DESCARTADO (ver
   `09-administrador.md`); la letra ya se ajusta desde el panel de
   admin, el alta de cuentas se queda en SQL a mano.
3. Responsable: Historial de partes, barra de gamificación (Ranking,
   Personaje, Logros, Equipo). Personaje ya tiene la Edge Function y
   la fórmula lista (`generar-personaje`, ver `04-gamificacion.md`) —
   solo falta la pantalla del responsable, que puede reutilizar
   `frontend/src/lib/gamificacion.ts` tal cual.
4. **[CERRADO 23/08/2026]** Operario: Ranking, Stats+Avatar (fusionadas
   en una pestaña), Logros — las 3 sub-vistas de gamificación que
   faltaban dentro de Inicio. Construido y probado en real, incluida
   la migración de datos reales de v2. Ver `04-gamificacion.md`.
   Sigue pendiente: sembrar los 19 logros en `logros_definicion` (el
   motor ya funciona, la tabla está vacía), y toda la gamificación
   del responsable (nueva entrada, ver `04-gamificacion.md` sección
   "Pendiente").
5. Administrador: **[CERRADO 22/08/2026]** cambio de rol, cierre de
   fábrica y checklist ya construidos (ver `09-administrador.md`).
   "Recalcular ciclo anterior" **[CERRADO 22/08/2026]**: ya no está
   bloqueado — `fn_cerrar_ciclos_pendientes` es idempotente y sirve
   para esto directamente, llamándola a mano. Solo queda fusión de
   modelos/marcas/productos/lotes (necesita Edge Function con
   `service_role`). Corrección de partes sin límite —
   **[CERRADO 21/08/2026]**.
6. Refactor de `TurnoScreen.tsx` (hook `useTurnoActual`, componentes
   `EstadoTurnoBloqueado`, `TarjetaLinea`, máquina de estados pura).
7. Tests unitarios (rotación, validaciones, normalización, tramos) y
   paquete de dominio compartido frontend/Deno para dejar de duplicar
   `normalizacion`/`formato`/informe.
8. Migrar el contenido interior de las pantallas ya construidas
   (Vista Rápida/Detallada/Incidencias, Ceria, Rotación, y todo lo
   anterior a hoy) al sistema de temas — ver `12-temas.md` para la
   lista exacta de qué falta. `InicioOperarioScreen.tsx` (reescrita
   22/08/2026) tampoco usa las variables de tema todavía — se dejó
   igual que el resto de pantallas de `operario/` a propósito, para no
   mezclar dos cambios en el mismo archivo.
9. PWA, retención de 18 meses en Cloudinary.
10. Reyes del formato (pantalla de fábrica) — sin diseño, sin
    capturas de referencia.

## Auditoría de congruencia 24/08/2026 — resumen

- RLS: `configuracion` sin RLS (escribible por cualquiera), embeds de
  `usuario` bloqueados por RLS para operario/jefe, `historial_ciclos`
  solo visible para uno mismo (podio de una persona). Corregido en
  20260824120000_rls_configuracion_usuario_ranking.sql.
- Bug real (no RLS): `obtenerPodioCicloActual` usaba un embed de
  PostgREST contra una vista con UNION ALL — PostgREST no puede
  rastrear FK a través de UNIONs (confirmado contra la doc oficial).
  Corregido horneando `username` en la vista
  (20260824130000_fix_v_puntos_operario_ciclo_username.sql) +
  lib/ranking.ts actualizado.
- .md sincronizados con el estado real (CLAUDE.md, 04-gamificacion,
  06-esquema-bd, README de migraciones) + 5 correcciones menores de
  código (env.example, mensaje UI, fallback de fecha, comentarios
  fósiles, tipo RolUsuario).
- Pendiente de verificar con datos reales tras el lanzamiento del
  31/08: Ranking ciclo actual, Vista Detallada del jefe, Logros — sin
  partes reales todavía, no se pueden probar de extremo a extremo.