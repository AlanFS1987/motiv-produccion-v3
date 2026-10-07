# 23 — Historial de migraciones (squash) y entorno local

## Estado

Desde el 06/10/2026 el historial de migraciones es una sola baseline,
`supabase/migrations/20261006204519_baseline.sql`, que sustituye a 173 migraciones.
Esas 173 (más su README) están archivadas en `supabase/migrations_archivo/`, carpeta que la CLI no
lee: sirve solo para consultar cómo se llegó a cada objeto. El esquema vigente es la baseline.

- La baseline es el volcado de producción (`supabase db dump --linked`) más dos bloques al final:
  los 4 `cron.schedule` (el volcado no trae los jobs de `pg_cron`) y los `REVOKE` explícitos de
  privilegios (ver «Trampas»).
- `supabase/seed.sql` contiene el catálogo (17 tablas: `almacen_categoria`,
  `ceria_documentacion_maquina`, `ceria_modelo_activo`, `ceria_prompts`, `chat_acceso`,
  `checklist_items`, `configuracion`, `engrase_punto`, `formato`, `linea`, `logros_definicion`,
  `niveles`, `programacion_nota_frase`, `puntos_metros`, `puntos_piezas`, `puntos_rendimiento`,
  `puntos_rendimiento_responsable`). Solo se aplica en local (`db reset`); nunca en producción.
- Las tablas de backup (`bak_*`, `programacion_orden_bak_20261002`,
  `programacion_orden_historico_bak_20261002`) y `stg_migracion_operario_v2` se borraron antes del
  volcado (migración `20261006203944`, ya archivada). Su respaldo, esquema y datos, está en
  `privado/backups/squash/bak_tablas_20261006.sql`.
- El historial remoto (`supabase_migrations.schema_migrations`) tiene una sola fila: la baseline.
  La lista previa de las 173 versiones está en `privado/backups/squash/schema_migrations_antes_del_repair.csv`.

## Entorno local

1. `supabase/config.toml` con `studio`, `storage`, `edge_runtime` y `analytics` desactivados
   (`enabled = false`); no hacen falta para probar la base y consumen memoria. No hay sección
   `[inbucket]` en esta versión de la CLI.
2. `supabase start` y `supabase db reset` (aplica baseline + seed).
3. **Justo después de cualquier `start` o `db reset`**, como `supabase_admin` (con `postgres` da
   «permission denied for table job»): `update cron.job set active = false;`. Las funciones de
   disparo llevan escrita la URL de producción y el cron local las lanzaría contra producción.
   Comprobar: `select count(*) from cron.job where active;` → 0.
4. Para ejecutar SQL en local sin cliente: `docker exec -i supabase_db_motiv-produccion-v3 psql -U supabase_admin -d postgres`.
5. Memoria: limitar WSL a 6 GB y no abrir `.sql` grandes en VS Code (la baseline tiene unas 8.000 líneas y el
   seed otras 2.300; se cerró por falta de memoria durante el ensayo).
6. `supabase stop` al terminar.

## Comprobar la deriva entre repo y producción

Tres comprobaciones, siempre juntas:

1. `supabase db diff --linked --schema public`: debe decir «No schema changes found». **No es fiable
   para privilegios**: la CLI usa un motor u otro según la ejecución y con `migra` salió limpio teniendo
   diferencias reales (anon con permisos sobre las 59 vistas y 5 tablas, authenticated sobre `app_secrets`).
2. Comparar las ACL de local y producción con `supabase/scripts/acl_resumen.sql` (nº de grupos y hash):
   deben coincidir. Valor tras el squash: 286 grupos, hash `28fe350557e3130c6fbedc5150185bb7`.
3. Comparar el inventario con `supabase/scripts/inventario.sql`. Valores de referencia (06/10/2026):
   funciones 61, políticas 114, triggers 19, tablas 58, vistas 59, cron_jobs 4, realtime
   `chat_mensajes,historial_ciclos,notificaciones,parte,turno`, docs 307, logros 37, niveles 9, config 2,
   formatos 7, líneas 6, puntos_piezas 35, chat_acceso 39, prompts 10 (el catálogo cambia con el uso:
   al comparar, contrastar local contra producción, no contra estos números).

Las lecturas contra producción con el rol temporal de la CLI no ven `supabase_migrations`; para eso y
para las ACL se usa la consulta SQL del proyecto (herramienta MCP de Supabase o el SQL Editor, solo lectura).

## Receta para repetir un squash

1. Borrar antes lo que no deba entrar al volcado (tablas de backup/staging) con una migración normal; guardar
   su respaldo en `privado/backups/squash/` (esquema y datos, `pg_dump -t` por tabla) y contar filas.
2. Rama nueva. Volcar: esquema con `supabase db dump --linked`; catálogo con los mismos flags que usa la CLI
   (`--data-only --quote-all-identifier --column-inserts --rows-per-insert 100000`, `-t` por tabla; comentar
   las líneas `\restrict`/`\unrestrict`, que son meta-comandos de psql). Exportar la lista de versiones remotas.
3. Mover todas las migraciones y el README a `supabase/migrations_archivo/`. Crear
   `supabase/migrations/<fecha-hora>_baseline.sql` (fecha-hora nueva, mayor que la última migración) con
   cabecera, esquema, bloque de cron y bloque de REVOKE. `seed.sql` = catálogo.
4. `supabase start`, `db reset`, desactivar cron, validar con las tres comprobaciones de arriba.
5. Commit; `db push --dry-run` debe decir que no hay nada (el repair aún no se ha hecho).
6. Repair en producción (único paso que escribe en `schema_migrations`): todas las versiones antiguas a
   `reverted` y la baseline a `applied`. Después: `migration list` solo con la baseline, `db push --dry-run`
   sin pendientes, `db diff` limpio.

**Trampas conocidas**

- El volcado no incluye los jobs de `pg_cron`: copiar de `cron.job` de producción (nombre, horario y comando) y
  añadir `select cron.schedule(...)` al final de la baseline.
- El Supabase local concede por defecto privilegios de más a `anon`/`authenticated` al crear cada objeto
  (`pg_default_acl`) que producción no tiene. Hay que añadir `REVOKE` explícitos al final de la baseline,
  generados **desde las ACL de producción** (`pg_class.relacl`), no desde el `db diff`. Estado actual del
  bloque: `anon` sin ningún privilegio en las 59 vistas y en `app_secrets` y las 4 tablas de Programación;
  `authenticated` sin nada en `app_secrets` y solo `SELECT` en esas 4 tablas y en `v_lote_gestion`.
- Versiones de formato no estándar: dos migraciones antiguas tenían versión de 8 dígitos (`20260826`,
  `20260913`). `migration list` las muestra duplicadas (una fila solo-local y otra solo-remota) aunque existen
  igual en ambos lados; se pasan tal cual al `repair`. De ahí la regla de versiones de 14 dígitos (`CLAUDE.md`).
- `db push --dry-run` antes de cualquier push; si lista algo inesperado, parar.
- El `repair` va troceado: una línea con 173 versiones no cabe en un comando. Se hicieron 3 de 60, 60 y 53.
- El rol temporal de la CLI no puede leer `supabase_migrations` (permission denied): para esa tabla usar la consulta SQL de proyecto.
- `\restrict` en los volcados: la CLI actual lo comenta con `sed`; el `sed -E` de Git Bash falla con
  `\\(un)?restrict`, usar `awk`.
- Archivos del CLI: `supabase/.gitignore` ignora `.branches` y `.temp`.

## Migraciones posteriores a la baseline

Ya existen dos: `20261006230657_parte_operario_desde_asignacion.sql` (trigger `trg_asignacion_rellena_operario`,
ver `01`) y `20261007000722_endurecer_resumen_turno_y_app_secrets.sql` (ver `00`). Local y remoto coinciden
(`supabase migration list`, `db push --dry-run` sin cambios, 07/10/2026). Tras un squash o una migración
nueva hay que verificar privilegios con `supabase/scripts/acl_resumen.sql` (ver «Comprobar la deriva»). Los
valores de referencia de arriba son los de la baseline: con esas dos migraciones pasan a 62 funciones y 20
triggers, y el hash de ACL cambia (RLS en `app_secrets`, `EXECUTE` revocado en `fn_disparar_resumen_turno`).

## Referencias

- `supabase/scripts/inventario.sql` — inventario de objetos y datos de catálogo.
- `supabase/scripts/acl_resumen.sql` — resumen de ACL (grupos + hash) y desglose por tipo y rol.
- `privado/backups/squash/` — volcados, CSV de versiones, plan de repair y logs (no versionado).
