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


7. `fn_rol_actual` security definer sin `set search_path`. Añadirlo.

9. Enum `rol_usuario` con `pantalla`/`jefe_rectificado` en BD y no en
   migraciones (confirmado): migración `alter type ... add value if not
   exists` y `supabase db diff` para cazar más deriva.
- Borrar el comentario con el secreto viejo de Telegram
  (`**********************`, ya rotado y sin uso) en
  `20260816214000_notificaciones_telegram.sql` — limpieza.
11. `parte_update_vigente_responsable_ventana`: el `with check` no
    impide cambiar `completado_at`/`completado`/`vigente`; la ventana de
    1 h solo la garantiza la UI. Trigger `before update` si se quiere
    garantía real.
12. Cierre automático de turno: confirmar con un caso real (o forzar
    `select fn_encolar_resumenes_turno_pendientes();`).
13. Camino "Continuar mismo lote+tono" con cambio de turno real: sin
    probar de punta a punta.
14. Identificador de modelo de OCR fijo en código; moverlo a
    configuración/secret para no redesplegar cuando se retire.
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
16. Rol de la cuenta `test` en `usuario`: si tiene `rol = 'responsable'`,
    puede aparecer mezclada en listados futuros que filtren por ese rol
    (p. ej. un dashboard del jefe). Se decide más adelante; se borra a
    mano desde Supabase cuando ya no haga falta.

## Decisiones por tomar

- Alcance del lanzamiento del 31/08 (propuesta: responsable + operario,
  jefe por Telegram; el resto en septiembre–octubre).
- Tabla de rendimiento del responsable: confirmar escala
  (`select * from puntos_rendimiento_responsable order by pct_min` —
  no venía en el volcado).
- Dónde guardar el saldo inicial de puntos de v2.
- Ceria sobre DeepSeek: aprobación explícita de sacar datos de
  producción a ese proveedor antes de construirlo.
- `[DECISIÓN PENDIENTE]` umbral de "minutos atípicos" (hoy 600).

## Por construir (orden sugerido)

1. `cerrar-ciclo` + escritura de `historial_ciclos` + total de puntos
   completo (piezas + rendimiento + limpieza) — **antes del 28/09**.
2. Alta/edición de usuarios y letra desde la app (hoy SQL a mano).
3. Incidencia de producción desde dentro del parte.
4. Responsable: Historial de partes, barra de gamificación (Ranking,
   Personaje, Logros, Equipo).
5. Operario: Inicio con puntos/nivel, Ranking, Stats, Logros, personaje
   RPG (elegir proveedor de imagen).
6. Dashboard del jefe (Vista Rápida, Detallada, Calidad, Rendimiento,
   incidencias) y recortes para producción/calidad.
7. Administrador: fusión de modelos/marcas/productos/lotes, corrección
   de partes sin límite, cierre de fábrica, checklist, "Recalcular ciclo
   anterior".
8. Pantalla (carrusel, con login) y políticas RLS para pantalla y
   jefe_rectificado; diseñar jefe_rectificado.
9. Ceria y base de conocimiento de averías.
10. Refactor de `TurnoScreen.tsx` (hook `useTurnoActual`, componentes
    `EstadoTurnoBloqueado`, `TarjetaLinea`, máquina de estados pura).
11. Tests unitarios (rotación, validaciones, normalización, tramos) y
    paquete de dominio compartido frontend/Deno para dejar de duplicar
    `normalizacion`/`formato`/informe.
12. Temas de color (claro/oscuro/gaming/IA), PWA, retención de 18 meses
    en Cloudinary.