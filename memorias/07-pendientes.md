# 07 — Pendientes

Solo lo abierto. Cuando algo se cierra, se borra de aquí y se actualiza
el archivo de área correspondiente (no se dejan entradas "[CERRADO]").
Orden: primero lo que afecta al comportamiento real, luego
verificaciones, decisiones y construcción.

## Bugs y huecos conocidos

Ninguno abierto ahora mismo: los 6 que había (cuenta `suplente`,
migración RLS sin confirmar, código muerto en `gamificacion.ts`,
`fn_otorgar_bonus_nivel`, el slice de `ceria/index.ts` y el reintento
de DeepSeek) se cerraron en la sesión 25/08/2026 — decisiones y
reparaciones en `01` (suplente) y `04` (bonus de nivel). Durante esa
misma sesión aparecieron 3 bugs nuevos, ya reparados también: ver `04`,
secciones "Bugs encontrados y corregidos" (`v_puntos_responsable_total_vida`
apuntando a la tabla vieja, `fn_ciclo_id(now())` con tipo incorrecto,
ambigüedad `nivel_id` en `fn_otorgar_bonus_nivel`).

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
10. Tras el lanzamiento del 31/08, con partes reales: Ranking del
    ciclo actual (operario y responsable), Equipo, Historial del
    responsable, Vista Detallada del jefe, Logros (operario y
    responsable).
11. `[VERIFICAR]` nombres de secrets con `supabase secrets list` (el
    `telegram_webhook_secret` de `app_secrets` existe, 19 caracteres —
    comparar byte a byte) y ajustes de seguridad del preset
    `motiv_v3_personajes` en Cloudinary (`05`).
12. Cámara nativa recarga la app en Xiaomi/Redmi — investigación
    abierta, estado en `09`.
13. Confirmar que el botón "otorgar generaciones" también funciona
    para operarios tras el fix de `#variable_conflict` en
    `fn_otorgar_bonus_nivel` (probablemente sí — nunca se había
    disparado el bug con ellos porque ya venían con generaciones desde
    el seed inicial; no confirmado explícitamente, ver `04`).

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

1. Admin: vista de usuarios con puntos, siguiente nivel y botón
   "otorgar nivel" (`v_admin_usuarios_gamificacion` +
   `fn_otorgar_bonus_nivel`, ya en BD).
2. Admin: botón "Recalcular ciclo anterior" (hoy por SQL Editor).
3. Admin: fusión de modelos/marcas/productos/lotes duplicados (Edge
   Function con `service_role`).
4. `personaje_stats_nivel` para los 4 responsables migrados de v2
   (mismo efecto retroactivo que tienen los operarios).
5. Pantalla de fábrica: diapositivas 4 (Ranking) y 5 (Reyes del
   formato) — la mecánica y las vistas ya existen (`10`); ahora
   incluiría también el ranking de responsables (`04`).
6. Refactor de `TurnoScreen.tsx` (hook `useTurnoActual`, componentes
   `EstadoTurnoBloqueado`, `TarjetaLinea`, máquina de estados pura).
7. Tests unitarios (rotación, validaciones, normalización, tramos) y
   paquete de dominio compartido frontend/Deno para dejar de duplicar
   `normalizacion`/`formato`/informe.
8. Migrar el interior de las pantallas al sistema de temas (lista en
   `12`).
9. PWA; retención de 18 meses en Cloudinary (automatizar el borrado
   de huérfanas requeriría Edge Function con `service_role`).
10. Shell para `jefe_rectificado` (como jefe, solo lectura) — previsto,
    sin prisa.
11. Base de conocimiento de averías — no empezado.
12. Limpieza menor: columna `rol` de `historial_ciclos` (redundante,
    siempre `'operario'` desde que el responsable tiene tabla propia).
