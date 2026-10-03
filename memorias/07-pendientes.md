# 07 — Pendientes

Solo lo abierto. Cuando algo se cierra, se borra de aquí y se actualiza
el archivo de área correspondiente (no se dejan entradas "[CERRADO]").
Orden: primero lo que afecta al comportamiento real, luego
verificaciones, decisiones y construcción.

## Bugs y huecos conocidos

1. Posible notificación duplicada del resumen de turno: la versión de
   `fn_disparar_resumen_turno` de `20260907130000` inserta una fila en
   `notificaciones` y `generar-resumen-turno` inserta otra. Si esa
   función no se actualizó después, cada resumen aparece dos veces en la
   campana. Comprobar con
   `select prosrc from pg_proc where proname = 'fn_disparar_resumen_turno';`
2. `ProgramacionConsultar.tsx` (hoja de impresión): el `<caption>`
   muestra la fecha de HOY aunque los datos impresos sean del último
   `confirmar_programacion` (puede ser de un día anterior si el CSV de
   hoy no se ha confirmado todavía). Arreglarlo con una consulta a
   `programacion_orden_historico` (`creado_en desc limit 1`) queda
   bloqueado: su única política de SELECT es
   `fn_rol_actual() in ('jefe','administrador')`, pero esta pantalla
   también la usan `responsable` y `producción` — para esos roles la
   consulta devolvería 0 filas por RLS (no por falta de snapshot) y
   caería al mismo fallback erróneo de "hoy". Necesita antes una
   migración RLS (fuera del alcance de un cambio "solo archivos, sin
   tocar BD").

(Histórico: los 6 bugs que había antes — cuenta `suplente`, migración
RLS sin confirmar, código muerto en `gamificacion.ts`,
`fn_otorgar_bonus_nivel`, el slice de `ceria/index.ts` y el reintento
de DeepSeek — se cerraron en la sesión 25/08/2026 — decisiones y
reparaciones en `01` (suplente) y `04` (bonus de nivel). Durante esa
misma sesión aparecieron 3 bugs nuevos, ya reparados también: ver `04`,
secciones "Bugs encontrados y corregidos" (`v_puntos_responsable_total_vida`
apuntando a la tabla vieja, `fn_ciclo_id(now())` con tipo incorrecto,
ambigüedad `nivel_id` en `fn_otorgar_bonus_nivel`).)

## Verificaciones pendientes con casos reales

1. Tras el lanzamiento del 31/08, con partes reales: Ranking del
   ciclo actual (operario y responsable), Equipo, Historial del
   responsable, Vista Detallada del jefe, Logros (operario y
   responsable). El primer cierre de ciclo ya ocurrió (28/09/2026: el
   cron corrió sin error y `historial_ciclos` e `historial_ciclo_responsable`
   tienen los ciclos 1 a 7), así que el ciclo 7 ya se puede revisar en el
   historial.

2. Probar en real los flujos afectados por las restricciones de RPC del
   26/08/2026: generar personaje/avatar y el botón "otorgar generaciones"
   del admin (el cierre de ciclo ya se vio en real el 28/09). El linter de
   Supabase marca hoy 7 funciones sin `search_path` fijo (lista en
   «Seguridad — pendiente», punto 4).

3. Cambio de la hora de revisión (20/09/2026): comprobar en una
   revisión real que el responsable ve el aviso con la hora de cierre y
   puede abrir "Nueva orden", "Continuar" y "Nuevo tono/calibre".

## Decisiones por tomar

- `extension_in_public`: `pg_trgm` vive en el esquema `public` en vez
  de uno propio (`extensions`). Cosmético, sin prisa (lint de
  seguridad 26/08/2026, ver `06`). Sus 31 funciones, al estar en `public`, son ejecutables por
  `anon`/PUBLIC (son funciones puras de similitud de texto).
- `auth_leaked_password_protection`: comprobación de contraseñas
  filtradas (HaveIBeenPwned) desactivada en Supabase Auth. Toggle en
  el panel, sin código — pendiente decidir si se activa (lint de
  seguridad 26/08/2026, ver `06`).
- Cierre de turno con partes pendientes activos: el cron de la hora en
  punto completa "sin producción" los partes pendientes, también el que
  el responsable esté rellenando en ese momento. Ahora que en revisión
  se pueden abrir partes nuevos es más probable. Opciones: dejarlo (el
  aviso con la hora exacta lo mitiga) o que el cron no toque partes con
  actividad reciente. Ver `02`.

## Seguridad — pendiente

Contexto: estado de seguridad y lo cerrado en `00-seguridad.md`. Quedan
abiertos:

1. **Políticas que dejan leer a una cuenta sin fila en `usuario`.** Cerrado el
   registro (ver `00`), una cuenta de Auth sin perfil solo puede existir si
   alguien la crea a mano en el panel o por un fallo de `admin-crear-usuario`.
   Aun así, `turno_select_autenticados` y `lote_select_autenticados` usan
   `auth.role() = 'authenticated'`, que no mira `fn_rol_actual()`; y
   `usuario_select_propio` / `usuario_select_roles_conocidos` conviven con
   otras permisivas. Tarea: que las políticas de SELECT de `usuario`, `turno`
   y `lote` exijan `fn_rol_actual() is not null`, para que una cuenta sin
   perfil no lea nada. Sin hacer. Probar por rol antes (todos los roles del
   enum leen `turno` y `lote`).
2. **`anon` conserva todos los privilegios en 53 de las 61 tablas de `public`**
   (SELECT, INSERT, UPDATE, DELETE, TRUNCATE…; no solo SELECT, como se anotó antes).
   Solo los frena la RLS por la API: con `anon`, `fn_rol_actual()` y `auth.role()` no
   dan acceso y no hay políticas de escritura para él. `TRUNCATE` no pasa por RLS,
   aunque PostgREST no lo expone. Las 8 tablas sin ningún privilegio para `anon` son
   `app_secrets`, las cuatro de Programación (`programacion_orden`,
   `programacion_orden_historico`, `programacion_nota`, `programacion_nota_frase`), las
   dos copias `_bak_20261002` y `stg_migracion_operario_v2`. Tarea: revocar todo a
   `anon` en las 53 (la app no usa `anon` para nada) y cambiar los privilegios por
   defecto para que las tablas y vistas nuevas no nazcan abiertas.
   **Las tablas nuevas nacen abiertas** (comprobado el 03/10/2026 creando una tabla de
   prueba en `public` y revirtiéndola): propietario `postgres`, **RLS desactivada** y
   `anon` y `authenticated` con los 7 privilegios (`select, insert, update, delete,
   truncate, references, trigger`) por los privilegios por defecto de Supabase
   (`pg_default_acl`: `postgres` y `supabase_admin` en `public` dan `arwdDxtm` a `anon`,
   `authenticated` y `service_role`). Las funciones sí están ya corregidas para
   `postgres` (M3), no para `supabase_admin`. Hasta cambiar esos privilegios por defecto
   (`alter default privileges for role postgres [in schema public] revoke ... on tables
   from anon, authenticated`), **cada tabla nueva debe llevar en su misma migración
   `enable row level security` + `revoke all ... from public, anon, authenticated` +
   `grant select` solo si procede** (las de Programación lo hacen).
3. `fn_disparar_resumen_turno(uuid)` sigue ejecutable por `authenticated`:
   la llama un trigger NO `security definer`
   (`fn_trigger_resumen_turno_cierre`), que corre con los permisos de quien
   cierra el turno. Hay que hacer también ese trigger `security definer`
   antes de restringirla sin romper el cierre manual. Hasta entonces
   cualquier usuario autenticado puede pedir un resumen de Telegram de
   cualquier turno.
4. Funciones sin `search_path` fijo (7, todas `security invoker`:
   `calidad_lote_por_fecha`, `calidad_linea_por_fecha`, `calidad_modelo_por_fecha`,
   `produccion_linea_por_fecha`, `fn_parte_validar_correccion`,
   `fn_incidencia_produccion_restringir_columnas_update`,
   `fn_almacen_pedido_linea_recibida`) y protección contra contraseñas
   filtradas desactivada (lint).
5. Borrar las copias `programacion_orden_bak_20261002` y
   `programacion_orden_historico_bak_20261002` a partir del 2026-10-16
   (ver `20`). Desde el 03/10/2026 **ya no representan la programación vigente** (la tabla se cargó con
   el Excel real del día anterior: 53 órdenes), así que no sirven para restaurar ni para verificar por hash.
6. **Tablas con RLS y sin políticas** (lint `rls_enabled_no_policy`, nivel INFO): las dos copias
   `_bak_20261002` (se borran el 16/10) y `stg_migracion_operario_v2` (ver «Por construir», squash).

## Programación — pendiente

> Seguridad (03/10/2026): `parse_programacion` es **llamable por `authenticated`** (EXECUTE por
> la API, `anon` no), con su guarda interna (solo `jefe`/`administrador`; el resto recibe «No
> autorizado»). El frontend no la usa; solo la llama `diff_programacion` (`security definer`),
> así que se le podría revocar EXECUTE a `authenticated` como a `fn_metros_entero`. Sin hacer.

Mejoras 1–4 implementadas el 03/10/2026 (`20`, `22`). Queda:

1. **Pasada de UI** (fase D): guion preparado en
   `privado/backups/guion_pasada_ui_programacion.md`; se hace una vez, con el
   usuario, y se limpia después (notas sintéticas, CSV sintético). **El guion está desactualizado:** su
   estado base y la verificación por hash contra `programacion_orden_bak_20261002` ya no valen, porque la
   tabla se cargó con el Excel real el 03/10/2026 (53 órdenes). Antes de hacerla hay que fijar un estado
   base nuevo (foto de la tabla, historial y `admin_notas`).
2. **`parse_programacion` no entiende el formato de un CSV guardado con fecha 2026-10-03**
   (observado el 03/10/2026 en `admin_notas`, creado por el administrador; ese archivo fue
   **sustituido ese mismo día** por el Excel real con la cabecera «Nº ORDEN», que sí se lee bien): la cabecera era
   `ORDEN;MODELO;METROS;Nº BOX;…` (sin «Nº» y sin la primera columna vacía), el número de orden
   va en la columna 1 y METROS llega como `4500` (sin punto de miles). El parser busca la
   cabecera con «Nº ORDEN» y lee el número en la columna 2, así que reconoce 0 órdenes: el
   diff marca como «eliminadas» las 48 de `programacion_orden` y `validar_programacion` da 50
   avisos de «línea ignorada». Desde el 03/10/2026 Revisar lo explica con un error claro, no
   enseña el diff y bloquea confirmar (y el servidor rechaza una lista vacía). No se ha
   tocado el parser; hay que decidir si se admite ese formato (y entonces replicarlo en
   `validar_programacion`, ver `20`).
3. Reglas de validación de tono/calibre (formato cerrado), sin las normas reales (`20`).

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
3. Pantalla de fábrica: escribir el suscriptor de Realtime. La base de datos ya
   publica `parte`, `turno` e `historial_ciclos` y `parte_select_todos` incluye a
   `pantalla`, pero el componente `RefrescoPantalla.tsx` que cita la migración no existe
   (ver `10`).
4. Refactor de `TurnoScreen.tsx` (785 líneas hoy: hook `useTurnoActual`, componentes
   `EstadoTurnoBloqueado`, `TarjetaLinea`, máquina de estados pura).
5. Tests unitarios (rotación, validaciones, normalización, tramos) y
   paquete de dominio compartido frontend/Deno para dejar de duplicar
   `normalizacion`/`formato`/informe.
6. Migrar el interior de las pantallas al sistema de temas (lista en
   `12`).
7. Retención de 18 meses en Cloudinary (automatizar el borrado
   de huérfanas requeriría Edge Function con `service_role`). La PWA ya está
   construida (`manifest.json`, `sw.js`, `instalar.html`; ver `CLAUDE.md`).
8. Squash de migraciones (169 hoy) — ya desbloqueado: las 3 tablas temporales
   del import v2 (`staging_responsable_v2`, `stg_migracion_v2`,
   `tmp_puntos_turno`) se borraron el 26/08/2026, confirmado que nada
   dependía de ellas. Queda `stg_migracion_operario_v2` (2.694 filas, sin
   ninguna dependencia en la BD ni en el código, RLS sin políticas): decidir si se
   borra antes del squash. Mejor squashear con el esquema de seguridad ya
   verificado en real (`00`), no a medias.
9. Base de conocimiento de averías — en curso: NORA (copiloto por voz)
   y `ceria_documentacion_maquina` (solo BS08). Pendientes propios en
   `16` y `11`.


## Pendientes que viven en su propio archivo

Cada área lleva su lista abierta en su archivo; aquí solo se remite
(un tema, un archivo).

- **Rol mecánico**: Almacén pieza 4 (Pedidos), Unidades
  intercambiables, vistas de producción para detectar anomalías de
  máquina, RLS de `engrase_parte_punto`, estado `'pendiente'` de
  `v_almacen_pedido_estado`, revisar `v_almacen_stock` bajo RLS →
  `18`.
- **NORA**: logging de conversaciones (`nora_conversaciones` /
  `nora_mensajes`) → `16`.
- **Ceria**: informe en PDF, pruebas de los 7 modelos de Fase 3,
  "calidad de modelos de pulido vs. el resto", terminología de
  `minutos_saturacion` → `11`.
- **Informes diario/semanal** (otros roles con acceso, botón
  "Regenerar", aviso en la campana, respuesta del mecánico en las
  incidencias, PDF huérfanos tras `regenerar`, comparar m² con el
  dashboard) → `19`.
- **Programación de hornos**: integrar la hoja de diseño (PDF con
  CLASE/TONO/CALIBRE/CONTROL) en la app, confirmar que la hoja de
  impresión sigue cabiendo en una cara con volumen de pedidos alto,
  reglas de validación de tono/calibre → `20`.
- **Alimentación**: confirmar el rango de minutos válidos (360–540,
  provisional), confirmar los valores de `REFERENCIAS_PIEZAS_MIN`
  (tomados de la gráfica de trabajo), zoom en las nubes (solo
  escritorio, fase 2) y saber si alguna línea ha cambiado de consigna
  en el histórico → `21`.


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
