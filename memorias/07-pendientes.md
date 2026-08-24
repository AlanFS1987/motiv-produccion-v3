# 07 — Pendientes

Solo lo abierto. Cuando algo se cierra, se borra de aquí y se actualiza
el archivo de área correspondiente (no se dejan entradas "[CERRADO]").
Orden: primero lo que afecta al comportamiento real, luego
verificaciones, decisiones y construcción.

## Bugs y huecos conocidos

1. ⚠️ **La cuenta `suplente` no existe en `usuario`** (comprobado
   24/08/2026: hay 24 usuarios — 4 responsables A/B/C/D, 17 operarios,
   jefe, admin, pantalla). Todo el mecanismo de cobertura de turnos
   (`01`) depende de ella: sin esa fila, si un titular falta, nadie
   puede abrir su turno, porque la RLS solo deja al responsable de la
   letra que toca. Crearla antes del 31/08 (Authentication → Add user
   + INSERT en `usuario` con `rol = 'suplente'`, sin letra; el índice
   único parcial garantiza que solo haya una).
2. Migración `20260824120000_rls_configuracion_usuario_ranking.sql` —
   confirmar que está aplicada (`db push`) y **repetir las pruebas de
   Ranking y Vista Detallada con una cuenta de operario y una de jefe
   reales**: hasta la auditoría del 24/08 solo se habían probado con
   admin, que ve todo por RLS.
3. Código muerto con contrato roto: `generarPersonaje()` en
   `lib/gamificacion.ts` no manda `nivel_id` (obligatorio en la Edge
   Function) — borrar; el flujo real es `generarPersonajeParaNivel`
   (`lib/stats-avatar.ts`), y el comentario de cabecera de ese archivo
   que dice lo contrario es falso. Relacionado: `AuthContext.tsx`,
   `obtenerDatosGamificacion` y `obtenerGeneracionesDisponibles`
   siguen leyendo `usuario.generaciones_disponibles` (sin significado
   desde 23/08) — limpiar cuando se toque esa zona.
4. `fn_otorgar_bonus_nivel` (confirmado leyendo la función, 24/08):
   (a) llama a `fn_otorgar_generaciones_por_nivel`, que escribe en el
   contador plano `usuario.generaciones_disponibles` que ya no lee
   nadie — llamada muerta, quitar; (b) congela las stats **en vivo al
   pulsar el botón**, así que un retraso del admin infla el snapshot
   (mitigación: otorgar a diario, o pasar a congelar contra el ciclo
   en que se cruzó el umbral); (c) inserta `velocidad` sin `coalesce`,
   puede congelar null si `tiempo_plena = 0`. Ver `04`.
5. `ceria/index.ts`, fase 1: revisar `historialLimpio.slice(0, -1)`. Si
   la pregunta del usuario aún no está guardada en BD en ese punto, el
   slice recorta el último mensaje del assistant, no un duplicado —
   degradaría el contexto sin error. Confirmar el orden real y quitar
   el slice si sobra.
6. Historia del personaje: si DeepSeek falla queda `null` y el admin
   la rellena a mano — sin reintento automático.

## Verificaciones pendientes con casos reales

7. Cierre automático de turno por cron + envío a Telegram: el cron
   `resumenes-turno-pendientes` corre cada hora y termina bien
   (comprobado 24/08), pero el camino completo con un turno real sin
   cerrar nunca se ha visto. Forzable con
   `select fn_encolar_resumenes_turno_pendientes();`.
8. Primer cierre real de ciclo: lunes 28/09/2026, 8:00 Madrid (ciclo
   7). El cron `cerrar-ciclos-pendientes` ya corre los lunes sin error
   (devuelve 0 filas porque los ciclos 1..6 ya tienen fila).
9. Camino "Continuar mismo lote+tono" con cambio de turno real: sin
   probar de punta a punta.
10. Tras el lanzamiento del 31/08, con partes reales: Ranking del ciclo
    actual, Vista Detallada del jefe, Logros.
11. `[VERIFICAR]` nombres de secrets con `supabase secrets list` (el
    `telegram_webhook_secret` de `app_secrets` existe, 19 caracteres —
    comparar byte a byte) y ajustes de seguridad del preset
    `motiv_v3_personajes` en Cloudinary (`05`).
12. Cámara nativa recarga la app en Xiaomi/Redmi — investigación
    abierta, estado en `09`.

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
