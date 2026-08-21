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

- **[CERRADO 20/08/2026]** robada en real —
  reparto igualitario confirmado entre 2 operarios en la misma
  línea+turno. Se encontró y corrigió un bug aparte:
  `crearParteInicial` (lib/parte.ts) no copiaba el operario a
  `parte.operario_id`, quedaba siempre null.

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
  responsable→operario con la fábrica parada por vacaciones. Sigue sin
  pantalla que lo muestre (ver `04-gamificacion.md`).
## Decisiones por tomar

- Alcance del lanzamiento del 31/08 (propuesta: responsable + operario,
  jefe por Telegram; el resto en septiembre–octubre).
- Tabla de rendimiento del responsable: confirmar escala
  (`select * from puntos_rendimiento_responsable order by pct_min` —
  no venía en el volcado).
- Dónde guardar el saldo inicial de puntos de v2.
- `[DECISIÓN PENDIENTE]` umbral de "minutos atípicos" (hoy 600).

- Decidir modelo principal de OCR (GPT `gpt-4o-mini` vs Claude Haiku) —
  hoy GPT es el extractor principal con fallback automático a Haiku si
  falla, en prueba de coste/calidad desde 20/08/2026
  (`_shared/openai.ts`, `_shared/anthropic.ts`). Sin fecha límite para
  decidir cuál queda en firme.

## Por construir (orden sugerido)

1. `cerrar-ciclo` + escritura de `historial_ciclos` + total de puntos
   completo (piezas + rendimiento + limpieza) — **antes del 28/09**.
2. Alta/edición de usuarios y letra desde la app — DESCARTADO (ver
   `09-administrador.md`); la letra ya se ajusta desde el panel de
   admin, el alta de cuentas se queda en SQL a mano.
3. Incidencia de producción desde dentro del parte.
4. Responsable: Historial de partes, barra de gamificación (Ranking,
   Personaje, Logros, Equipo).
5. Operario: Inicio con puntos/nivel, Ranking, Stats, Logros, personaje
   RPG (elegir proveedor de imagen).
6. Administrador: fusión de modelos/marcas/productos/lotes, corrección
   de partes sin límite, cierre de fábrica, checklist. "Recalcular
   ciclo anterior" bloqueado hasta que exista `cerrar-ciclo` (punto 1).
7. Refactor de `TurnoScreen.tsx` (hook `useTurnoActual`, componentes
   `EstadoTurnoBloqueado`, `TarjetaLinea`, máquina de estados pura).
8. Tests unitarios (rotación, validaciones, normalización, tramos) y
   paquete de dominio compartido frontend/Deno para dejar de duplicar
   `normalizacion`/`formato`/informe.
9. Migrar el contenido interior de las pantallas ya construidas
   (Vista Rápida/Detallada/Incidencias, Ceria, Rotación, y todo lo
   anterior a hoy) al sistema de temas — ver `12-temas.md` para la
   lista exacta de qué falta.
10. PWA, retención de 18 meses en Cloudinary.
11. Reyes del formato (pantalla de fábrica) — sin diseño, sin
    capturas de referencia.