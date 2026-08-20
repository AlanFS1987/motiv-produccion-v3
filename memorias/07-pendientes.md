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



9. Enum `rol_usuario` con `pantalla`/`jefe_rectificado` en BD y no en
   migraciones (confirmado): migración `alter type ... add value if not
   exists` y `supabase db diff` para cazar más deriva.

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
- Ceria sobre DeepSeek: aprobación explícita de sacar datos de
  producción a ese proveedor antes de construirlo.
- `[DECISIÓN PENDIENTE]` umbral de "minutos atípicos" (hoy 600).

- Decidir modelo principal de OCR (GPT `gpt-4o-mini` vs Claude Haiku) —
  hoy GPT es el extractor principal con fallback automático a Haiku si
  falla, en prueba de coste/calidad desde 20/08/2026
  (`_shared/openai.ts`, `_shared/anthropic.ts`). Sin fecha límite para
  decidir cuál queda en firme.

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

17. `extraido_con` (gpt/claude) que devuelve `ocr-parte` no se guarda
    en ningún sitio — se pierde al terminar la petición. Si se quiere
    poder comparar coste/calidad de forma sistemática (no solo
    mirando la factura de Anthropic), hace falta una columna en
    `parte` (una por foto: hoja/caja/pantalla) y que el frontend la
    guarde al llamar a resolver-catalogo/completar el parte.
18. Warning "Docker is not running" en cada `supabase functions
    deploy` — no se ha confirmado si afecta al empaquetado real de las
    funciones o es inofensivo. Instalar/abrir Docker Desktop de forma
    permanente antes de futuros deploys, para descartarlo de raíz.