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

8. Primer cierre real de ciclo: lunes 28/09/2026, 8:00 Madrid (ciclo
   7). El cron `cerrar-ciclos-pendientes` ya corre los lunes sin error
   (devuelve 0 filas porque los ciclos 1..6 ya tienen fila).

10. Tras el lanzamiento del 31/08, con partes reales: Ranking del
    ciclo actual (operario y responsable), Equipo, Historial del
    responsable, Vista Detallada del jefe, Logros (operario y
    responsable).

11. Confirmar en el linter de Supabase (Database → Advisors) que tras
    aplicar `..._fix_search_path_20_funciones.sql`,
    `function_search_path_mutable` baja a 0 filas — la primera vez que
    se intentó aplicar falló por colisión de nombre de migración
    (`schema_migrations_pkey` duplicado, mismo prefijo `20260826` que
    otra migración del mismo día) y se corrigió renombrando el
    archivo, sin confirmar todavía que quedó aplicada. De paso probar
    en real que los 4 flujos afectados por las restricciones de RPC
    del 26/08/2026 siguen funcionando: generar personaje/avatar,
    botón "otorgar generaciones" del admin, y el cierre de ciclo (vía
    cron, la próxima vez que corra).

## Decisiones por tomar

- `extension_in_public`: `pg_trgm` vive en el esquema `public` en vez
  de uno propio (`extensions`). Cosmético, sin prisa (lint de
  seguridad 26/08/2026, ver `06`).
- `auth_leaked_password_protection`: comprobación de contraseñas
  filtradas (HaveIBeenPwned) desactivada en Supabase Auth. Toggle en
  el panel, sin código — pendiente decidir si se activa (lint de
  seguridad 26/08/2026, ver `06`).

## Seguridad — pendiente de un refactor concreto

- `fn_disparar_resumen_turno(uuid)` sigue expuesta a `anon`/
  `authenticated` vía RPC (lint de seguridad 26/08/2026, ver `06`). A
  diferencia de las otras 10 funciones `security definer` señaladas
  por el linter, esta la llama un trigger NO `security definer`
  (`fn_trigger_resumen_turno_cierre`), que corre con los permisos de
  quien cierra el turno de verdad — restringirla sin más rompería el
  cierre manual de turno en producción. Requiere hacer también ese
  trigger `security definer` antes de poder restringir la función sin
  riesgo. Dejada fuera a propósito de la migración de seguridad del
  26/08/2026, junto con las otras 10.

## Por construir (orden sugerido)

1. Admin: botón "Recalcular ciclo anterior" (hoy por SQL Editor;
   la vista de usuarios con puntos/nivel/botón "otorgar nivel" ya
   está construida, ver `04`/`09`). Nota 26/08/2026: cuando se
   construya, `fn_cerrar_ciclos_pendientes` ya no tiene `GRANT` para
   `authenticated` (restringida a `service_role` por seguridad) — el
   botón necesitará o bien llamarla vía Edge Function con
   `service_role`, o bien devolverle el `GRANT` y añadirle un check de
   `fn_rol_actual() = 'administrador'` (mismo patrón ya usado en
   `fn_otorgar_bonus_nivel`, ver `06`).
2. Admin: fusión de modelos/marcas/productos/lotes duplicados (Edge
   Function con `service_role`).
4. Pantalla de fábrica: diapositivas 4 (Ranking) y 5 (Reyes del
   formato) — la mecánica y las vistas ya existen (`10`); ahora
   incluiría también el ranking de responsables (`04`).
5. Refactor de `TurnoScreen.tsx` (hook `useTurnoActual`, componentes
   `EstadoTurnoBloqueado`, `TarjetaLinea`, máquina de estados pura).
6. Tests unitarios (rotación, validaciones, normalización, tramos) y
   paquete de dominio compartido frontend/Deno para dejar de duplicar
   `normalizacion`/`formato`/informe.
7. Migrar el interior de las pantallas al sistema de temas (lista en
   `12`).
8. PWA; retención de 18 meses en Cloudinary (automatizar el borrado
   de huérfanas requeriría Edge Function con `service_role`).
9. Squash de migraciones — ya desbloqueado: las 3 tablas temporales
   del import v2 (`staging_responsable_v2`, `stg_migracion_v2`,
   `tmp_puntos_turno`) se borraron el 26/08/2026, confirmado que nada
   dependía de ellas. Listo para ejecutar en cuanto se confirme el
   punto 11 de arriba (mejor squashear con el esquema de seguridad ya
   verificado en real, no a medias).
11. Base de conocimiento de averías — no empezado.


## Ideas futuras sin decidir

- **Juego de cartas coleccionables** (concepto planteado 02/09/2026,
  pensado a ~6 meses vista): las cartas nunca se pierden, un rival
  puede conseguir la copia de una carta ajena, posible combate en
  tiempo real 4-5 cartas contra 4-5. Sin mecánica, normas ni
  matemáticas decididas todavía — solo el concepto general. Decisión
  tomada: NO tocar fuerza/resistencia/velocidad actuales para
  anticipar esto (siguen representando honestamente "cuánto has
  movido en tu vida"). Cuando se diseñe la mecánica real, lo natural
  sería un stat de combate aparte, derivado y normalizado, guardado
  también en `personaje_stats_nivel` (o tabla equivalente) — para que
  una carta copiada por un rival lleve un número fijo, no algo que
  siguiera cambiando con la vida en vivo del dueño original.