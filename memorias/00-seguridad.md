# 00 — Seguridad

Estado de la superficie expuesta con la clave pública (`anon`), de los
avisos del linter de Supabase y de los análisis automáticos. Lo que sigue
abierto vive en `07-pendientes.md` ("Seguridad — pendiente"); aquí, lo cerrado,
cómo se comprobó y el estado actual de cada vía.

## Superficie con la clave pública (estado al 03/10/2026)

| Vía | Estado | Cerrado |
|---|---|---|
| Registro de usuarios en Auth (`/auth/v1/signup`) | **Cerrado**: 422 `signup_disabled` | 03/10/2026 |
| Inicio de sesión anónimo | Cerrado: 422 `anonymous_provider_disabled` | antes del 03/10/2026 |
| Vinculación manual de identidades | Desactivada | antes del 03/10/2026 |
| Confirmación de email | Activa | — |
| Funciones de `public` ejecutables por `anon`/PUBLIC | Cerradas, y los privilegios por defecto ya no las abren | 02/10/2026 (`20261002191839`) |
| `SELECT` de `anon` en las vistas de `public` | **Revocado**: 0 de 58 legibles por `anon` | 03/10/2026 (`20261003015059`, `20261003015203`) |
| Privilegios de `anon` en tablas de `public` | **Abierto**: 53 de 61 tablas con **todos** los privilegios (SELECT, INSERT, UPDATE, DELETE, TRUNCATE…); solo los frena la RLS — pendiente en `07` | — |
| Privilegios de las tablas de Programación (`programacion_orden`, `_historico`, `programacion_nota`, `programacion_nota_frase`) | **Cerrados**: solo `SELECT` para `authenticated` (el historial conservaba los siete para `anon` y `authenticated`) | 02/10/2026 (`programacion_orden`, `20261002131613`) y 03/10/2026 (resto, `20261003033056`) |
| `confirmar_programacion` con lista vacía | Rechazada (antes borraba toda la programación) | 03/10/2026 (`20261003032652`) |
| `fn_metros_entero` | Sin `EXECUTE` para `public`, `anon` y `authenticated` (la llaman funciones `security definer`) | 03/10/2026 (`20261003142002`) |

### Registro de usuarios

El registro **estuvo abierto** (`disable_signup: false`) hasta el
03/10/2026: cualquiera con un email podía crear una cuenta `authenticated`
sin fila en `usuario` (`fn_rol_actual()` nulo). El 02/10/2026 se comprobó
que una cuenta así leía `usuario` (33 filas), `turno` (98), `lote` (263) y
las vistas `v_*`. El 03/10/2026 se desactivó "Allow new users to sign up"
en el panel (Authentication → Sign In / Providers). Las altas van solo por
la Edge Function `admin-crear-usuario` (service_role), que crea la cuenta
vía `/auth/v1/admin/users`; el signup público no se usa. No se puede
cambiar desde SQL.

Comprobación del 03/10/2026 (solo lectura, con `curl`):

- `POST /auth/v1/signup` con la clave publishable y con la anon legacy:
  422 `signup_disabled` (visible en los `auth_logs`). Con signup anónimo:
  422 `anonymous_provider_disabled`.
- `auth.users` (34) frente a `usuario` (34): sin cuentas de Auth sin fila
  en `usuario`, sin filas de `usuario` sin cuenta, 34 `identities`.
- La última alta (`prueba`, 03/10/2026 01:44 UTC) sale de
  `admin-crear-usuario`: en los logs, `/admin/users` lo llama service_role
  y la fila de `usuario` se crea 0,3 s después. Los logs solo cubren 24 h:
  de las altas anteriores solo consta que las dos tablas cuadran y que todas
  tienen `email_confirmed_at` de su mismo día de creación.
- Ninguna cuenta del 03/10/2026 corresponde a las pruebas de registro (se
  rechazaron todas).

Si algún día hay que reabrir el registro (p. ej. alta por invitación), hay
que antes hacer que las políticas exijan `fn_rol_actual()` no nulo
(`07`, punto 1).

### Vistas

Las vistas `v_*` y `operario_ledger` corren con permisos del propietario
(NO `security_invoker`, y no hay que cambiarlo: es lo que permite que
Ranking, Reyes del formato y la pantalla de fábrica lean agregados de
tablas que la RLS no abre a esos roles; ver `CLAUDE.md`). Por eso la RLS de
las tablas no las protege y el único control es el `GRANT`. Con la clave
pública, `anon` leía datos reales (`v_produccion_turno`, `v_calidad_lote`,
`v_almacen_stock`...). Hay 58 vistas en `public`: 56 con prefijo `v_`, más
`operario_ledger` y `programacion_con_estado`. El 03/10/2026 se revocó
`SELECT` a `anon` en las 56 `v_*` y en `operario_ledger`;
`programacion_con_estado` nunca lo tuvo. Con la clave pública devuelven 401
`permission denied`. `authenticated` y `service_role` conservan `SELECT` en
las 58.

Prueba de lectura por rol (03/10/2026, bloque `DO` con rol `authenticated`
y claims del usuario, abortado con excepción para que no quede nada): un
usuario real de cada uno de `jefe`, `administrador`, `responsable`,
`produccion`, `operario`, `calidad`, `mecanico` y `pantalla` leyó las 58
vistas sin ningún error. Las filas que ve cada rol coinciden con las del
propietario salvo en `programacion_con_estado`, que filtra por
`fn_rol_actual()` a propósito (jefe, administrador, responsable y
producción veían 39 filas en esa fecha —hoy son 53—; el resto, 0). No cambia nada para `authenticated`.

Antes de revocar se comprobó que ninguna pantalla consulta sin sesión:
`App.tsx` solo monta `Login` mientras no hay sesión, `Login` y `auth.ts`
solo llaman a `signInWithPassword`, el rol `pantalla` entra con una cuenta
real (`pantalla@…`, con sesión) y fuera del cliente de Supabase solo hay
un `fetch` a Cloudinary. `admin-crear-usuario` usa la clave anon solo para
validar el JWT de quien llama. **Vistas nuevas**: los privilegios por
defecto de tablas y vistas aún pueden darlas a `anon` — revocar a mano o
cerrarlo en `07`, punto 2.

### Privilegios de tablas y funciones (comprobado el 03/10/2026)

- **Funciones propias de `public`** (59): `anon` no puede ejecutar ninguna; 47 las ejecuta
  `authenticated` (con guarda de rol interna donde procede) y 12 son solo `service_role`.
  Los privilegios por defecto de `postgres` ya no abren las funciones nuevas a `anon`/PUBLIC (M3).
  Excepción: las 31 funciones de la extensión `pg_trgm`, instalada en `public`, sí son ejecutables
  por `anon`/PUBLIC (son funciones puras de similitud de texto; ver `extension_in_public`).
- **Tablas**: 53 de las 61 tablas tienen todos los privilegios para `anon` y `authenticated`
  (los privilegios por defecto de Supabase) y se apoyan solo en la RLS. Las 8 sin ningún privilegio
  para `anon` son `app_secrets` (única sin RLS, sin acceso para `anon` ni `authenticated`), las cuatro
  de Programación, las dos copias `_bak_20261002` y `stg_migracion_operario_v2`.
- **Tablas y vistas nuevas nacen abiertas**: propietario `postgres`, sin RLS y con los siete privilegios
  para `anon` y `authenticated`. Cada migración que cree una tabla debe cerrarlo en la misma migración
  (`enable row level security`, `revoke all ... from public, anon, authenticated`, `grant select` si
  procede); a una vista nueva hay que revocarle `select` a `anon`. Pendiente: cambiar los privilegios por
  defecto (`07`, punto 2).

### Programación: superficie nueva (03/10/2026)

Detalle del esquema en `06` y de los flujos en `20`.

- **Tablas** (RLS desde la creación, política de `SELECT` para jefe, responsable, produccion y
  administrador, `revoke all` a `anon`/`authenticated` y `grant select` a `authenticated`, sin políticas de
  escritura): `programacion_nota` (referencia por `numero_orden` sin FK; FK de `creado_por` a `usuario`) y
  `programacion_nota_frase`.
- **RPC** (todas `security definer`, `search_path = public`, guarda `coalesce(fn_rol_actual()::text,'')`,
  `revoke execute ... from public, anon`, `grant ... to authenticated`): `actualizar_tono_calibre`,
  `anadir_nota_ordenes`, `editar_nota`, `borrar_nota` (jefe/administrador), `guardar_frase` (solo
  administrador), `validar_programacion` (solo lectura, jefe/administrador).
- **`parse_programacion` es llamable por `authenticated`**, con su guarda interna (jefe/administrador); el
  frontend no la usa, solo `diff_programacion`. Se le podría revocar `EXECUTE` a `authenticated`
  (como a `fn_metros_entero`); sin hacer.
- Ensayadas en transacción revertida con un usuario real de cada rol (`jefe`, `administrador`,
  `responsable`, `produccion`, `operario`, `calidad`, `mecanico`, `pantalla`, `jefe_rectificado`), una
  cuenta sin fila en `usuario` (rol nulo) y `anon`: solo los roles previstos pueden; el resto recibe «No
  autorizado»; `anon`, «permission denied»; ninguna escritura directa en las tablas nuevas.

### Avisos del linter de Supabase (03/10/2026)

| Aviso | Nivel | Nº | Estado |
|---|---|---|---|
| `security_definer_view` | ERROR | 58 | Por diseño: las vistas corren como propietario (`06`). El control es el `GRANT` (ver «Vistas») |
| `authenticated_security_definer_function_executable` | WARN | 21 | 13 RPC de Programación/notas con guarda interna, 3 funciones de trigger y 5 anteriores (`06`) |
| `function_search_path_mutable` | WARN | 7 | Las 7 son `security invoker`; lista en `07`, punto 4 |
| `extension_in_public` | WARN | 1 | `pg_trgm`; pendiente de decidir (`07`) |
| `auth_leaked_password_protection` | WARN | 1 | Desactivada en el panel de Auth; pendiente de decidir (`07`) |
| `rls_enabled_no_policy` | INFO | 3 | Las dos copias `_bak_20261002` y `stg_migracion_operario_v2` (`07`) |

## Análisis automáticos

**Semgrep OSS** (210 reglas, 124 ficheros): 2 hallazgos aceptados, ambos
`unsafe-formatstring`:

1. `supabase/functions/ceria/conversaciones.ts:36` (antes `index.ts:152`, movido en el refactor
   del 10/09/2026) — `role` solo admite valores literales controlados por código.
2. `supabase/functions/ceria/tools/index.ts:57` (antes `tools.ts:220`) — `toolName` procede del
   conjunto cerrado de herramientas definido por la aplicación.

(Los números de línea son de la revisión del 03/10/2026; el escaneo se hizo sobre una versión anterior
del código y no se ha repetido: conviene volver a pasarlo.)

**`npm audit`**: 0 vulnerabilidades en la raíz y en `frontend/`.
