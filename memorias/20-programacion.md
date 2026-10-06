# 20 — Programación diaria (hornos)

Encargo del encargado de clasificación ("jefe en la app"): cada día
llega por correo un Excel de la fábrica de cerámica con la
programación de los 4 hornos. Hasta ahora se comparaba a mano contra
el Excel de ayer (qué pedido ya no está → se completó, qué sigue →
se conserva, qué es nuevo → se añade), y de las filas nuevas se
sacaba a mano la hoja de partida en SAP. Este documento describe la
automatización de ese proceso: parseo del CSV, diff editable, y la
vista de consulta del jefe.

## El CSV de origen

El correo trae un Excel con 4 secciones apiladas verticalmente, una
por horno (antes llamadas `ESM-1`..`ESM-4` en el propio archivo, pero
el dato real es **el horno**: 1, 2, 3 y 4, siempre los 4). El admin lo
guarda como CSV y su contenido crudo se guarda tal cual en
`admin_notas` (`tipo='programacion'`, `fecha`, `contenido`,
`num_filas` — tabla y flujo de guardado ya existentes, ver más abajo
quién puede escribir ahí).

Columnas originales del CSV (15): `Nº ORDEN, MODELO, METROS, Nº BOX,
PLATOS, TIERRA, ESP. PRENSA, ACABADO, HORNO, CEP, CAJA, ENGOBE,
ESMALTE, CUBIERTA, GRANILLA`. Separador **punto y coma** (`;`), no
coma — es exportación de Excel en configuración regional española. La
columna `HORNO` del propio CSV es 100% redundante con la sección (toda
fila de la sección del horno 2 trae `HORNO=2`, sin excepción,
comprobado en los 4 días reales usados para validar) — no se guarda
como columna aparte, se deriva de la sección.

Dos cabeceras repetidas por día (de las 4 totales) tienen un typo real:
falta la etiqueta `GRANILLA` al final. No afecta a los datos (esa
columna casi siempre está vacía, y las demás columnas SÍ caen en su
sitio correcto) — es solo un fallo de tecleo en el Excel original.

Columnas finales que se conservan en la app (9): `Nº ORDEN, MODELO,
HORNO, METROS, ACABADO, CEP, CAJA` (del CSV) + `TONO, CALIBRE`
(nuevas, no vienen del CSV). Se descartan: `Nº BOX, PLATOS, TIERRA,
ESP. PRENSA, ENGOBE, ESMALTE, CUBIERTA, GRANILLA`. `CEP` es booleano
(`X` = cepillado). `TONO`/`CALIBRE` los rellena el jefe a mano cuando
el pedido es nuevo — vienen de la propia etiqueta de la caja
(`CLASE/TONO/CALIBRE/CONTROL`, ver hoja de diseño de Argenta), no de
ningún sitio automatizable todavía. Reglas futuras (sin validar aún):
calibre ∈ `{3, 4, 44, SC}`; tono = letra `M`/`X`/`R` + número `01..N`.

## Modelo de datos

**`programacion_orden`** — una fila por pedido activo hoy.
`horno smallint` (1-4), `posicion integer` (orden dentro del horno,
según el último CSV), `numero_orden text`, `modelo`, `metros numeric`,
`acabado`, `cep boolean`, `caja`, `tono`, `calibre`, `fecha_alta date`.
**La clave de negocio es solo `numero_orden`** (`unique (numero_orden)`,
desde el 02/10/2026): el horno es un dato de la orden, no parte de la
clave, y una orden puede cambiar de horno conservando tono, calibre y
fecha de alta. Antes era `unique (horno, numero_orden)`. `fecha_alta` =
día en que la orden se insertó por primera vez (la fija solo
`confirmar_programacion` al insertar; `null` en las filas anteriores al
02/10/2026, la UI las muestra como "—"). El estado
(pendiente/iniciado/finalizado) **no se guarda aquí**: se calcula al
vuelo.

**`programacion_con_estado`** (vista) — `programacion_orden` +
`LEFT JOIN lote on lote.numero_orden = programacion_orden.numero_orden`.
La vista corre como owner (convención del proyecto, sin
`security_invoker`), así que **filtra por rol dentro de la propia vista**
(`where fn_rol_actual() in ('jefe','responsable','produccion','administrador')`);
sin sesión o con otro rol devuelve 0 filas. Expone `fecha_alta`.
`lote.estado` (enum `estado_lote`) solo tiene `iniciado`/`finalizado` —
no existe `pendiente` como valor guardado en ningún sitio: pendiente es
la ausencia de fila en `lote` para ese `numero_orden`
(`coalesce(lote.estado::text, 'pendiente')`). `numero_orden` no tiene
duplicados en `lote` (comprobado), así que el JOIN nunca multiplica
filas.

**`programacion_orden_historico`** — snapshot completo (`jsonb`) de
`programacion_orden` justo antes de cada `confirmar_programacion`, para
poder deshacer una confirmación equivocada (ver más abajo).

**`programacion_nota`** (03/10/2026) — notas por orden: `id`, `numero_orden`,
`texto` (1–500 caracteres), `creado_por` (FK a `usuario`, `on delete set
null`; el autor se muestra con `usuario.username`, como en el resto de la
app), `created_at`, `updated_at`. Varias notas por orden. Se referencian por
`numero_orden` **sin FK** a `programacion_orden`, a propósito: las notas
sobreviven si la orden sale de programación (y por tanto **no se borran solas**:
al limpiar datos de prueba hay que borrarlas aparte). RLS desde la creación;
SELECT para `jefe, responsable, produccion, administrador`; sin permisos a
`anon` y sin escritura directa (solo las RPC de abajo).

**`programacion_nota_frase`** (03/10/2026) — frases frecuentes del desplegable:
`id`, `texto` (único, 1–200), `activa`, `orden`. Siembra: «guardar 2 palets y
una caja», «recordar sacar palet de revisión», «cuidado diseño UGL». Mismas RLS
y permisos que la tabla de notas. Baja lógica con `activa = false`.

## Funciones (RPC, patrón de seguridad igual al resto del proyecto)

Todas `security definer`, con `raise exception 'No autorizado'` si
`fn_rol_actual() not in ('jefe','administrador')`, `revoke ... from
public, anon` + `grant execute ... to authenticated`. `admin_notas`
sigue con su RLS de siempre (solo `administrador` puede leer/escribir
directamente la tabla) — estas funciones existen precisamente para que
`jefe` pueda operar sobre `admin_notas`/`programacion_orden` sin tener
que tocar esa RLS.

- **`existe_csv_programacion(fecha)`** — hay ya CSV pegado hoy.
- **`guardar_programacion_csv(fecha, contenido)`** — upsert en
  `admin_notas` (select-then-write: sobrescribe si ya existía fila esa
  fecha). Permite a `jefe` pegar el CSV él mismo, sin depender del
  admin — es la única vía de escritura de `tipo='programacion'` hoy
  (la pantalla simple del admin que escribía esas filas directamente
  desde `lib/admin-notas.ts` se retiró el 27/09/2026, ver "Frontend"
  más abajo).
- **`parse_programacion(fecha)`** — el parser SQL puro. Detecta
  cabeceras por `ilike '%Nº ORDEN%' and ilike '%MODELO%'`, cuenta
  cabeceras vistas (`sum() over (order by ordinality)`) para asignar
  horno, extrae por `split_part(line, ';', N)`, filtra filas basura
  con `numero_orden ~ '^[0-9]{6,8}$'` (descarta huecos `" - "`, notas
  tipo "CAMBIO DE FORMATO...", cabeceras repetidas). `metros`: **la regla
  vive en `fn_metros_entero(texto)`** (03/10/2026, `20261003142002`), que usan
  `parse_programacion` y `validar_programacion`: quita todo lo que no sea un dígito
  (`5500`, `5.500` y `5,500` = 5500; `15.000` y `15,000` = 15000; **`5,5` = 55**: un
  decimal se lee como entero, los metros son siempre enteros), sin dígitos (vacío,
  `" - "`, texto) = `null`, y más de 18 dígitos = `null`. Nunca lanza excepción, es pura
  e inmutable y **no es ejecutable por `public`/`anon`/`authenticated`** (solo la llaman
  funciones `security definer`). Antes era `replace(..,'.','')::numeric`, que lanzaba
  `invalid input syntax` con `5,5` o `" - "` y hacía fallar todo el diff.
  **`validar_programacion` reimplementa la lectura de líneas de `parse_programacion`**
  (cabeceras, horno por orden de cabecera, posición, filtro del número): **cualquier
  cambio de formato hay que replicarlo en las dos** (y mantener las mismas 8 columnas de
  salida de `parse_programacion`, de las que depende `diff_programacion`). **Nota de PL/pgSQL**: al
  convertirla a `security definer`/`plpgsql`, los nombres de columna
  del `RETURNS TABLE` (`numero_orden`, `modelo`, `acabado`, `caja`)
  colisionan con variables internas de la función — lleva
  `#variable_conflict use_column` al principio del body (mismo fix ya
  usado en `fn_otorgar_bonus_nivel`, `04`).
- **`diff_programacion(fecha)`** — `full outer join` entre
  `parse_programacion(fecha)` y el `programacion_orden` actual, **por
  `numero_orden`**. Devuelve `cambio`
  (`nuevo`/`eliminado`/`reordenado`/`sin_cambios`/`cambia_horno`),
  `horno_actual`, `horno_nuevo` y `repetida`. `cambia_horno`: la orden
  existía en otro horno; se comprueba **antes** que `reordenado`
  (la posición no es comparable entre hornos). Un `numero_orden`
  repetido en el CSV (mismo horno o distinto) sale **una sola vez**
  (`distinct on`, la primera aparición) con `repetida = true`: no
  multiplica filas, y el frontend bloquea confirmar. Solo lectura.
- **`confirmar_programacion(fecha, filas jsonb)`** — la escritura real.
  Recibe el estado final **ya revisado/editado por el jefe** (no
  vuelve a llamar al parser a ciegas — el jefe pudo excluir una
  eliminación, descartar un "nuevo" falso positivo, corregir algo).
  Rechaza (`raise exception`) un payload con `numero_orden` repetidos o
  filas sin número/horno, y **una lista vacía** (`p_filas` = `[]`: borraría toda la
  programación; mensaje «No se puede confirmar una programación vacía…», antes de tocar nada,
  ni siquiera guarda el snapshot; migración `20261003032652`, 03/10/2026). Guarda primero un snapshot en
  `programacion_orden_historico` (incluye `fecha_alta`), luego hace
  reemplazo completo (`delete` de lo que sobra + `upsert` por
  `numero_orden`, que actualiza también `horno` y `posicion`).
  `tono`/`calibre` solo se sobrescriben si el payload trae valor no
  vacío (`coalesce(excluded.tono, programacion_orden.tono)`) — para no
  borrar por accidente lo ya rellenado en una fila que solo se
  reordenó o cambió de horno. `fecha_alta` no se toca en el conflicto.
- **`deshacer_ultima_programacion()`** — restaura la foto más reciente
  de `programacion_orden_historico` (incluidos `horno` y `fecha_alta`;
  los snapshots anteriores al 02/10/2026 no la traen y quedan en
  `null`) y la consume. **Es una pila: cada uso retrocede UN paso más**;
  pulsarlo dos veces seguidas deshace también la confirmación anterior
  (pasó en la prueba del 02/10/2026). Los `id` de las filas cambian al
  restaurar. Ojo: `delete from programacion_orden` sin condición choca
  con la protección `safe-update` del proyecto ("DELETE requires a
  WHERE clause") — lleva `where true` explícito.
- **`validar_programacion(fecha)`** (03/10/2026, solo lectura, jefe/administrador)
  — los avisos que Revisar debe resolver, con los **campos crudos de cada
  aparición** (`diff_programacion` solo devuelve una fila por número repetido).
  `tipo`: `repetida` (mismo `numero_orden` más de una vez, mismo horno o
  distinto; una fila por aparición), `incompleta` (número válido pero falta
  MODELO o METROS: nulo/vacío/ilegible/≤ 0; `falta` dice cuál; **ACABADO y
  CAJA vacíos NO se marcan**, hay órdenes legítimas sin acabado) y
  `descartada` (línea que el parser ignora pero que parece una orden: número
  con dígitos que no cumple `^[0-9]{6,8}$`, o sin número válido pero con modelo y
  metros numéricos; el ruido conocido —títulos, huecos « - », cabeceras
  repetidas, «CAMBIO DE FORMATO…», líneas vacías— no avisa). Devuelve `linea`
  (nº de línea del texto guardado), `horno`, `posicion` (igual que el diff),
  `modelo`, `metros`/`cep`/`acabado`/`caja` como texto crudo, `falta` y
  `linea_cruda`. No toca `parse_programacion` ni `diff_programacion`. Con las 8
  programaciones reales guardadas solo avisa del duplicado real descrito abajo.
- **`actualizar_tono_calibre(numero_orden, tono, calibre)`** (03/10/2026,
  jefe/administrador) — edita tono y calibre sin pasar por confirmar. Identifica
  por `numero_orden` (los `id` cambian al deshacer). Texto vacío = `null`; recorta
  espacios, máximo 20 caracteres, error claro si la orden no existe; sin
  validación de formato. Devuelve la fila actualizada.
- **`anadir_nota_ordenes(ordenes text[], texto)`** (jefe/administrador) — la misma
  nota en varias órdenes, **todo o nada**: array no vacío (máx. 200), sin vacíos ni
  duplicados, todas deben existir en `programacion_orden` (el error lista las
  desconocidas), texto de 1–500 caracteres. Devuelve cuántas notas creó.
  **`editar_nota(id, texto)`** y **`borrar_nota(id)`** (jefe/administrador).
  **`guardar_frase(id, texto, activa, orden)`** (solo administrador): `id` nulo =
  alta (activa y al final); en una edición, `activa`/`orden` nulos conservan el valor.
- Todas las RPC de programación (`parse`, `diff`, `confirmar`, `deshacer`,
  `guardar_programacion_csv`, `existe_csv_programacion`, y las nuevas de arriba) comprueban el rol con
  `coalesce(fn_rol_actual()::text,) not in (...)`: con rol nulo,
  `NULL NOT IN (...)` es `NULL` y el `if` no saltaba (corregido el
  02/10/2026, migraciones `20261002164859` y `20261002183413`). Con la
  migración `20261002191839` ninguna función propia de `public` es
  ejecutable por `anon`/PUBLIC y las funciones nuevas ya no nacen abiertas
  (privilegios por defecto revocados).

RLS de `programacion_orden`: SELECT para `jefe, responsable,
produccion, administrador`. Sin políticas de INSERT/UPDATE/DELETE
directas — toda escritura pasa por `confirmar_programacion`/
`deshacer_ultima_programacion`. `programacion_orden_historico`: mismo
SELECT, sin escritura directa tampoco.

> **Corrección (02/10/2026).** Este documento afirmaba lo anterior desde
> el principio, pero **en producción `programacion_orden` tenía RLS
> desactivado y `GRANT ALL` a `anon` y `authenticated`** (se copió la
> afirmación sin comprobarla en la BD): con la clave anónima del
> frontend se podía leer, modificar o vaciar. Cerrado el 02/10/2026 con
> la migración `20261002131613_cerrar_acceso_programacion_orden.sql`
> (RLS + política de SELECT, `revoke all` a `anon`/`authenticated` y
> `grant select` solo a `authenticated`, filtro por rol dentro de la
> vista). En la misma migración se eliminó `aplicar_programacion`,
> versión antigua sin comprobación de rol ni `security definer`,
> ejecutable por `anon`/`PUBLIC`, que nadie usaba. Se comprobó con un
> usuario de cada rol: jefe, administrador, responsable y producción
> leen 39 filas; operario, calidad y mecánico 0; `anon` denegado; ningún
> rol puede escribir directo. `get_advisors` ya no marca
> `rls_disabled_in_public`. La migración
> `20261002164859_programacion_clave_numero_orden.sql` (clave por
> `numero_orden`, `fecha_alta`, `cambia_horno`) se aplicó el mismo día.

## Copias de seguridad y restauración

Antes de la migración de la clave se hizo copia de las dos tablas:
`programacion_orden_bak_20261002` y
`programacion_orden_historico_bak_20261002` (RLS activo, sin acceso para
`anon`/`authenticated`), más el archivo
`privado/backups/programacion_pre_M2_20261002.json` (fuera de git y de
`supabase/migrations/`). **La copia en BD era la fiable para restaurar**;
el JSON es solo una copia de conveniencia (en una fila el `modelo` pierde
unos espacios finales al transcribirlo). Se usó una vez, tras la prueba
de UI del 02/10/2026: se restauró `programacion_orden` (con sus `id` y
marcas de tiempo) y el historial, y se verificó por hash que quedaron
idénticos a la copia. **Las dos tablas `_bak_20261002` se borraron el
06/10/2026** (migración `20261006203944`, archivada; respaldo en
`privado/backups/squash/bak_tablas_20261006.sql`).

> **03/10/2026 — las copias ya no representan la programación vigente.** `programacion_orden` se cargó con el
> Excel real del día anterior (53 órdenes, `fecha_alta` 2026-10-03): 30 de las órdenes actuales no estaban en la
> copia y 16 de las 39 de la copia (la programación del 30/09) ya no están. Las copias **ya no sirven para
> restaurar el estado vigente ni para verificar por hash**; se borraron el 06/10/2026 (no había nada que
> conservar de ellas). El historial (`programacion_orden_historico`) tiene desde ese momento un snapshot de la
> programación anterior.

## Por qué el diff es editable (y no un upsert automático)

Decisión explícita de diseño: el proceso manual de hoy ya incluye al
jefe revisando y decidiendo, no solo comparando — el parser puede
equivocarse (fila rara, formato inesperado) y el jefe necesita poder
verlo y corregirlo antes de que se guarde nada, igual que revisar un
`git diff` antes de un commit. De ahí que `confirmar_programacion`
reciba el array de filas ya decidido por el cliente, no una fecha a
secas.

Dos redes de seguridad ante un error humano (CSV equivocado):
- **Antes de confirmar**: botón "¿Archivo equivocado? Sustituir" —
  vuelve al textarea de pegar, sin perder nada (el diff se recalcula
  contra el `programacion_orden` real, que no se ha tocado todavía).
- **Después de confirmar**: botón "Deshacer última confirmación" —
  restaura exactamente el estado de antes vía el historial. Sin esto,
  volver a pegar el CSV correcto compararía contra el estado
  *equivocado ya confirmado* (no contra "el último válido", porque no
  hay más historial que ese) — el resultado final converge igual,
  pero el diff de por medio sería un diff sin sentido de negocio.

## Frontend

`JefeApp.tsx` tiene una pestaña **"Programación"** (la 7.ª de sus 9;
`jefe/programacion/ProgramacionScreen.tsx`), con dos sub-vistas:

- **Revisar** (solo VALIDA; tono y calibre **ya no se rellenan aquí**, se hace en
  Consultar): si no hay CSV hoy (`existeCsvHoy`), muestra el textarea de pegar ahí
  mismo. Acepta el CSV (`;`) **o las celdas copiadas directamente de Excel**
  (tabuladores): `lib/normalizar-pegado.ts` (`normalizarPegado`, función pura) las
  convierte antes de `guardarProgramacionCsv` —quita BOM y normaliza `\r\n`, las
  líneas con tabuladores pasan a `;`, descomilla las celdas (`""` → `"`, saltos
  internos → espacio), un `;` dentro de una celda pasa a `,`, y las líneas que ya usan
  `;` sin tabuladores quedan intactas— y se guarda en `admin_notas` el texto
  **normalizado**; el parser SQL no cambia. Avisa («Celdas copiadas de Excel
  detectadas») y, si la cabecera empieza en «Nº ORDEN» (se copió sin la columna
  anterior), no deja guardar: el parser lee el número en la 2.ª columna y no
  reconocería ninguna orden. **Verificado con un Excel real el 03/10/2026**: el
  usuario pegó directamente en Revisar el Excel del día anterior y funcionó perfecto (ver
  «Validado con datos reales»).
  En cuanto hay CSV, carga el diff y `validar_programacion` en paralelo. Bloque
  **Avisos** antes de los hornos (`AvisosRevisar.tsx`): para cada número **repetido**,
  las apariciones en tarjetas lado a lado con los campos que difieren resaltados
  («Más completa» solo como pista, **nunca preselecciona**); el jefe elige «Quedarme con
  esta» o «Editar y quedarme con esta», y la elegida sustituye en el payload a la fila
  que devuelve el diff (se mueve de horno si hace falta; las demás se descartan).
  «Resuelto» vive en el estado del cliente (el validador seguirá avisando del CSV crudo)
  y se reaplica al recargar tras confirmar. Filas **incompletas**: se completan en la
  fila (modelo/metros) o se descartan (si la orden ya estaba en programación, descartar
  la elimina: el botón lo dice). Líneas **ignoradas por el parser**: lista informativa
  con la línea cruda, no bloquea. Después, el diff agrupado por horno: `+ nuevo`,
  `− eliminado` (botón "mantener igualmente"), `~ reordenado`/`= sin cambios`
  informativos, y `⇄ cambia de horno` (informativo, agrupado bajo el horno nuevo con
  "viene del horno X"; **sí entra en el payload**). **Confirmar queda bloqueado**
  mientras haya repetidos sin resolver, filas incompletas incluidas, la validación
  fallida o el diff sin poder leerse (el servidor sigue rechazando repetidos como red
  de seguridad). **Si el archivo existe pero el lector no reconoce ninguna orden** (el diff no trae ninguna fila que no sea
  «eliminado»: otro formato, o se copió sin la columna anterior a «Nº ORDEN»), Revisar muestra un error claro
  («No se ha reconocido ninguna orden en el archivo de hoy…»), sin diff, con confirmar bloqueado y con las
  líneas «ignoradas» como pista; la programación actual no se toca. Sin avisos: un solo botón. Conserva «Mantener igualmente»,
  «Descartar», «¿Archivo equivocado? Sustituir» y «Deshacer última confirmación». El
  resultado de confirmar/deshacer se muestra tras recargar el diff
  (`cargarDiff(mensaje)`). **Si el diff falla** (desde `fn_metros_entero` un METROS
  ilegible ya no lo provoca; antes sí, con `invalid input syntax`; el aviso para ese
  error concreto se conserva) se
  explica con las líneas afectadas y se bloquea confirmar; antes, un diff fallido dejaba
  el botón activo y habría enviado una lista vacía (reemplazo completo = vaciar la
  programación; recuperable con Deshacer). Ahora el botón se bloquea **y** el servidor
  rechaza la lista vacía.
- **Consultar** (vista de trabajo, tras confirmar): la lista congelada de hoy,
  agrupada por horno, con badge de estado en vivo (pendiente/iniciado/finalizado),
  botón "copiar → copiado" junto a cada `Nº ORDEN` y "Exportar/Imprimir". Además
  (03/10/2026): **fecha de alta** por fila (`—` si es null) e insignia **«Nueva hoy»**
  (`fecha_alta` = hoy, con `hoyLocalISO`); filtros combinables **«Solo nuevas de hoy»**
  y **«Sin tono/calibre»**; **tono y calibre editables en la fila** para
  jefe/administrador (guardan al salir del campo con `actualizar_tono_calibre`, con
  indicación de guardado/error; los vacíos se ven a simple vista con borde y chip
  «falta tono/calibre»; el resto de roles los ve en solo lectura); **«Copiar nuevas de
  hoy»** (números de orden por horno y posición, uno por línea; avisa si no hay);
  **notas**: contador por orden con las notas (autor y fecha), **selección múltiple**
  (casilla por fila, «seleccionar las N del horno», «seleccionar las visibles» que respeta
  los filtros) y barra «N seleccionadas · Añadir nota» con un diálogo con desplegable de
  frases activas **y** campo editable (elegir una frase la pone en el campo y el jefe
  cambia la cantidad antes de aplicar), más editar y borrar una nota concreta. La hoja
  impresa A4 **no cambia** (las notas y la fecha de alta no van en ella; usa siempre
  todas las filas, no las filtradas en pantalla).
- **Frases (admin)**: pestaña «Frases» de `AdminApp` (`admin/FrasesNotaScreen.tsx`,
  mismo patrón que Engrase): alta, edición, activar/desactivar y orden de las frases
  del desplegable. Guardan con `guardar_frase`.

`lib/programacion.ts` — todas las llamadas RPC + tipos
(`FilaDiff`, `FilaConEstado`, `FilaAConfirmar`, `AvisoProgramacion`) +
`agruparPorHorno`, `validarProgramacion`, `actualizarTonoCalibre` y `metrosDeTexto`.
`lib/programacion-notas.ts` — notas y frases. `lib/normalizar-pegado.ts` — pegado
de celdas de Excel.

**Admin (27/09/2026)**: la pestaña "Programación" de `AdminApp.tsx`
reutiliza literalmente este mismo `jefe/programacion/ProgramacionScreen.tsx`
(mismo patrón ya usado para Vista Rápida/Detallada/Incidencias/Informes),
en vez de la pantalla simple que tenía antes (solo pegar CSV +
histórico, `admin/AdminProgramacionCsvScreen.tsx`, ya borrada). El
admin tiene ahora diff editable, confirmar y deshacer igual que el
jefe — no hizo falta ningún cambio de RLS/RPC: `diff_programacion`,
`guardar_programacion_csv`, `confirmar_programacion` y
`deshacer_ultima_programacion` ya comprobaban
`fn_rol_actual() in ('jefe','administrador')` desde que se crearon.
Las funciones de Programación que vivían en `lib/admin-notas.ts`
(`guardarProgramacion`, `listarProgramacionHistorico`,
`fechaDeHoyISO`, `ProgramacionHistorico`) se borraron por quedar sin
ningún uso; las de Notas (`tipo='nota'`) en ese mismo archivo no se
tocaron.

### Exportación — una hoja A4 vertical, una cara

El botón "Exportar/Imprimir" usa `window.print()` (sin librería de
PDF: el propio diálogo "Guardar como PDF" del navegador). Réplica del
formato de papel tradicional (columna de horno combinada a la
izquierda, como el `ESM-1/H1` de la hoja real que se enseñó) con el
set de columnas nuevo, comprimida a una sola cara:

- `@page { size: A4 portrait; margin: 8mm; }` — vertical, no apaisado:
  con el mismo número de filas, más alto disponible por fila → letra
  más grande (9pt) que en horizontal (que hubiera necesitado 7pt).
- **Aislamiento de impresión** (bug real, corregido): `window.print()`
  imprime todo lo visible en pantalla, incluida la cabecera de la app
  (pestañas, "Conectado como...", campana). Fix estándar:
  `body * { visibility: hidden }` + `.print-area, .print-area * {
  visibility: visible }` + `.print-area { position: absolute; top:0;
  left:0 }` — sólo la tabla queda visible, posicionada desde la
  esquina de la página, sin depender de dónde esté en el DOM.
  El toggle en pantalla usa Tailwind (`hidden print:block` /
  `print:hidden`), separado de este CSS global de aislamiento.
- `table-layout: fixed` + `<colgroup>` con anchos en mm (`MODELO` es
  la única que hace salto de línea — las demás son valores cortos).
  Cabecera `ACABADO` abreviada a `ACB` para dar más ancho a `CAJA`
  (petición de sesión, columnas: Horno 8mm, Nº ORDEN 16mm, MODELO
  70mm, METROS 14mm, ACB 8mm, CEP 8mm, CAJA 28mm, TONO 14mm, CALIBRE
  14mm).
- Probado con los 53 pedidos reales del 25/09/2026: cabe en una
  página. Con volúmenes muy por encima de lo habitual (~55-60) podría
  desbordar a una segunda hoja — bajar el `font-size` del `<style>`
  o recortar más `MODELO` si llega a pasar.

## Validado con datos reales

Los 4 CSV reales de `admin_notas` (22, 23, 24 y 25 de septiembre de
2026) se encadenaron con `confirmar_programacion` en orden, día a día,
igual que lo haría el jefe: 22→23 (13 nuevos/9 eliminados/34
reordenados/1 sin cambios), 23→24 (5/5/33/10), 24→25 (10/5/36/7).
Estado final: 53 filas, coincide exactamente con la foto real de la
hoja del 25/09 aportada en la sesión (recuento por horno: 13/15/13/12).
El ciclo confirmar→deshacer también se probó en vivo (53→48 filas,
restaurando el estado exacto de antes).

**03/10/2026.** `validar_programacion` sobre las 8 programaciones reales guardadas
(22–30/09): sin avisos en las 6 primeras; el 29 y el 30/09 traen **un número repetido
real, `1114132`, en el horno 2 (dos filas idénticas, modelo SL GLACIAR MATE
60X120RC/CIF02_S, 4.500 m²)**. Es un duplicado exacto, no el caso de «una fila buena y otra
rota». Datos reales de formato (de las filas guardadas): la cabecera empieza con una
primera columna vacía; la primera celda de las filas de datos es la etiqueta de
formato o está vacía; METROS llega como `" 4.500   "` (punto de miles, con
espacios) y otras columnas usan coma decimal (`9,4`).

**03/10/2026 — pegado directo verificado con un Excel real.** El usuario pegó en Revisar el Excel de la
programación del 02/10/2026 (4 hornos) tal como sale de Excel, y funcionó perfecto: `admin_notas` guardó el
texto normalizado (67 líneas, fecha 2026-10-03) y `programacion_orden` quedó cargada con **53 órdenes**
(14, 14, 13 y 12 por horno) con `fecha_alta` = 2026-10-03 y un snapshot nuevo en el historial. **A partir de
ese momento `programacion_orden` ya no es la programación del 30/09: las copias `_bak_20261002` (hoy borradas) no la
representan** (ver «Copias de seguridad y restauración»).

Antes de esa prueba se había comprobado el mismo Excel por SQL con una muestra recibida por el chat (reconstruida: el
chat convierte los tabuladores en grupos de 4 espacios y pierde los finales): `normalizarPegado` sin recortar líneas
(con la primera columna vacía y los tabuladores finales conservados, cabecera `;Nº ORDEN;MODELO;METROS;…`) y
`parse_programacion` en transacción revertida dan 53 órdenes (h1=14, h2=14, h3=13, h4=12), idénticas por hash a
un cálculo independiente en Python; METROS enteros (mín. 300, máx. 13000; `1118578` = 300); 3 órdenes con el CEP
formado por un espacio (no cepilladas); 2 sin ACABADO y 2 con ACABADO `1a/2b`; sin avisos de validación. Formato
observado: cada sección tiene la cabecera «Nº ORDEN» con la primera columna vacía; METROS y Nº BOX llegan con relleno
(` 3.300   `, ` 12   `); `ESP. PRENSA` usa coma decimal (`9,4`); la columna HORNO coincide con la sección; filas
separadoras ` - `.

## Pendiente

- **Pasada de UI** (fase D): guion preparado en `privado/backups/guion_pasada_ui_programacion.md`;
  se hace una vez, con el usuario, y se limpia después (notas, CSV sintético).
- ~~`parse_programacion` fallaba con un METROS no numérico~~: resuelto el 03/10/2026 con
  `fn_metros_entero`. El frontend usa la misma regla: `metrosDeTexto` vive en `lib/metros.ts`
  (reexportada desde `lib/programacion.ts`) y quita todo lo que no sea un dígito; solo difiere
  en que un valor ≤ 0 devuelve `null` (la base de datos trata `coalesce(metros,0) <= 0` como «falta»).

- **Hoja de diseño** (el PDF tipo "CAJA 20x120 SL ARGENTA MATE REC
  5PZ APAISADO F5" que se grapa junto a la hoja de partida, con
  `CLASE/TONO/CALIBRE/CONTROL`): integrarla en la app es una idea a
  futuro, aparcada — no forma parte de esta funcionalidad todavía.
- Confirmar en real, con volumen de pedidos alto, que la hoja de
  impresión sigue cabiendo en una sola cara (ver nota de `colgroup`
  arriba).
- Reglas de validación de `tono`/`calibre` (formato cerrado en vez de
  texto libre) — con las normas reales de calibre/tono, cuando se
  quieran aplicar.

## Resumen para `00-seguridad.md` (03/10/2026)

Superficie nueva de Programación, para recoger en `00-seguridad.md` cuando se reescriba
(esta sesión **no lo ha tocado**):

- **Tablas** (RLS activa desde la creación, solo política de SELECT para `jefe`,
  `responsable`, `produccion`, `administrador`; `revoke all` a `anon`/`authenticated` +
  `grant select` a `authenticated`; **sin políticas de escritura**): `programacion_nota`
  (referencia por `numero_orden` sin FK; FK de `creado_por` a `usuario`),
  `programacion_nota_frase`.
- **RPC** (todas `security definer`, `search_path = public`, guarda
  `coalesce(fn_rol_actual()::text,'') not in (...)`, `revoke execute ... from public, anon`,
  `grant ... to authenticated`): `actualizar_tono_calibre`, `anadir_nota_ordenes`,
  `editar_nota`, `borrar_nota` (jefe/administrador); `guardar_frase` (solo administrador);
  `validar_programacion` (solo lectura, jefe/administrador).
- **Función de trigger**: `set_updated_at_programacion_nota` (`search_path` fijo).
- **`fn_metros_entero(text)`** (`20261003142002`): pura, inmutable, `search_path = pg_catalog`,
  `execute` revocado a `public`, `anon` y `authenticated` (solo `service_role` y el propietario;
  la llaman `parse_programacion` y `validar_programacion`, ambas `security definer`).
- **`parse_programacion` es llamable por `authenticated`** (EXECUTE por la API), con su guarda
  interna (`jefe`/`administrador`; el resto «No autorizado»; `anon` no tiene EXECUTE). El frontend
  no la usa directamente: solo la llama `diff_programacion`.
- Ensayadas en transacción revertida con un usuario real de cada rol (`jefe`,
  `administrador`, `responsable`, `produccion`, `operario`, `calidad`, `mecanico`,
  `pantalla`, `jefe_rectificado`), una cuenta sin fila en `usuario` (rol nulo) y `anon`:
  solo los roles previstos pueden; el resto recibe «No autorizado»; `anon`, «permission
  denied»; ninguna escritura directa en las tablas nuevas.
- **Privilegios de tablas (cerrado 03/10/2026, `20261003033056`)**: `programacion_orden_historico`,
  `programacion_nota` y `programacion_nota_frase` quedan con `revoke all` a `anon` y
  `authenticated` y solo `SELECT` a `authenticated` (como `programacion_orden` desde M1).
  `programacion_orden_historico` conservaba `INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER`
  para ambos (privilegios por defecto; la RLS sin políticas de escritura bloqueaba la API, pero
  `TRUNCATE` no pasa por RLS). Solo la escriben `confirmar_programacion` y
  `deshacer_ultima_programacion` (security definer). Ver en `07` que las tablas nuevas siguen
  naciendo con privilegios amplios por defecto; los permisos reales se comprueban con
  `supabase/scripts/acl_resumen.sql` (ver `23`).
- **`confirmar_programacion`** rechaza `p_filas` vacío (`20261003032652`).
