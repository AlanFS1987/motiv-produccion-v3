# 07 — Pendientes

Solo lo abierto. Cuando algo se cierra, se borra de aquí y se actualiza
el archivo de área correspondiente (no se dejan entradas "[CERRADO]").
Orden: primero lo que afecta al comportamiento real, luego
verificaciones, decisiones y construcción.

## Bugs y huecos conocidos

1. Migración `20260824120000_rls_configuracion_usuario_ranking.sql`
   (RLS de `configuracion`, `usuario`, `historial_ciclos`) — confirmar
   que está aplicada (`db push`) y **repetir las pruebas de Ranking y
   Vista Detallada con una cuenta de operario y una de jefe reales**:
   hasta la auditoría del 24/08 solo se habían probado con admin, que
   ve todo por RLS.
2. Código muerto con contrato roto: `generarPersonaje()` en
   `lib/gamificacion.ts` no manda `nivel_id` (obligatorio en la Edge
   Function) — borrar; el flujo real es `generarPersonajeParaNivel`
   (`lib/stats-avatar.ts`), y el comentario de cabecera de ese archivo
   que dice lo contrario es falso. Relacionado: `AuthContext.tsx`,
   `obtenerDatosGamificacion` y `obtenerGeneracionesDisponibles`
   siguen leyendo `usuario.generaciones_disponibles` (sin significado
   desde 23/08) — limpiar cuando se toque esa zona.
3. `ceria/index.ts`, fase 1: revisar `historialLimpio.slice(0, -1)`. Si
   la pregunta del usuario aún no está guardada en BD en ese punto, el
   slice recorta el último mensaje del assistant, no un duplicado —
   degradaría el contexto sin error. Confirmar el orden real y quitar
   el slice si sobra.
4. `[VERIFICAR]` `fn_otorgar_bonus_nivel`: si sigue llamando a
   `fn_otorgar_generaciones_por_nivel` (contador plano antiguo) es
   redundante con `personaje_stats_nivel.generaciones_usadas` (`04`).
5. Historia del personaje: si DeepSeek falla queda `null` y el admin
   la rellena a mano — sin reintento automático.

## Verificaciones pendientes con casos reales

6. Cierre automático de turno por cron + envío a Telegram: nunca visto
   en real (se puede forzar con
   `select fn_encolar_resumenes_turno_pendientes();`).
7. Primer cierre real de ciclo: lunes 28/09/2026, 8:00 Madrid (cierre
   del ciclo 7). Confirmar que el cron dispara.
8. Camino "Continuar mismo lote+tono" con cambio de turno real: sin
   probar de punta a punta.
9. Tras el lanzamiento del 31/08, con partes reales: Ranking del ciclo
   actual, Vista Detallada del jefe, Logros — hoy no hay datos de v3
   para probarlos de extremo a extremo.
10. `[VERIFICAR]` `formato.area_m2` aplicada en BD (`01`); nombres de
    secrets con `supabase secrets list` y ajustes de seguridad del
    preset `motiv_v3_personajes` (`05`); si `configuracion` necesita
    SELECT para roles distintos de admin (`06`).
11. Cámara nativa recarga la app en Xiaomi/Redmi — investigación
    abierta, pantalla de prueba y estado en `09`.

## Decisiones por tomar

- Modelo principal de OCR: GPT-4o-mini (principal hoy) vs Claude Haiku
  (fallback). En prueba de coste/calidad desde 20/08, sin fecha.
- `[DECISIÓN PENDIENTE]` umbral de "minutos atípicos" (hoy 600).
- Identificador de modelo de OCR fijo en código: moverlo a
  configuración/secret para no redesplegar cuando se retire.
- Migraciones duplicadas de mismo propósito (`20260816230000`/
  `20260816230001` resumen automático; `20260820220000`/
  `20260821220000` seeds de Ceria): resultado en BD correcto, pero
  confusas. Squash general de migraciones antes del 31/08 (no hay
  datos reales de v3 todavía).

## Por construir (orden sugerido)

1. **Gamificación del responsable** en su app (Inicio con tarjeta,
   Ranking, Stats+Avatar) + historial de partes propio. Requiere
   diseño propio (`04`, "Pendiente").
2. **Logros del responsable** — crear desde cero (no existían en v2),
   sembrar con `rol = 'responsable'`.
3. Admin: vista de usuarios con puntos, siguiente nivel y botón
   "otorgar nivel" (`v_admin_usuarios_gamificacion` +
   `fn_otorgar_bonus_nivel`, ya en BD).
4. Admin: botón "Recalcular ciclo anterior" (hoy por SQL Editor).
5. Admin: fusión de modelos/marcas/productos/lotes duplicados (Edge
   Function con `service_role`).
6. `personaje_stats_nivel` para los 4 responsables migrados de v2
   (mismo efecto retroactivo que tienen los operarios).
7. Pantalla de fábrica: diapositivas 4 (Ranking) y 5 (Reyes del
   formato) — la mecánica y las vistas ya existen (`10`).
8. Refactor de `TurnoScreen.tsx` (hook `useTurnoActual`, componentes
   `EstadoTurnoBloqueado`, `TarjetaLinea`, máquina de estados pura).
9. Tests unitarios (rotación, validaciones, normalización, tramos) y
   paquete de dominio compartido frontend/Deno para dejar de duplicar
   `normalizacion`/`formato`/informe.
10. Migrar el interior de las pantallas al sistema de temas (lista en
    `12`).
11. PWA; retención de 18 meses en Cloudinary (automatizar el borrado
    de huérfanas requeriría Edge Function con `service_role`).
12. Shell para `jefe_rectificado` (como jefe, solo lectura) — previsto,
    sin prisa.
13. Base de conocimiento de averías — no empezado.
