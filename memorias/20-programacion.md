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
  tipo "CAMBIO DE FORMATO...", cabeceras repetidas). `metros`:
  `replace(..,'.','')::numeric` — el CSV usa el punto como separador
  de miles (`5.500` = 5500), no decimal. **Nota de PL/pgSQL**: al
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
  filas sin número/horno. Guarda primero un snapshot en
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
- Las tres comprobaciones de rol de `diff`, `confirmar` y `deshacer`
  usan `coalesce(fn_rol_actual()::text,'') not in (...)`: con rol nulo,
  `NULL NOT IN (...)` es `NULL` y el `if` no saltaba. Las demás RPC de
  programación (`parse`, `guardar_programacion_csv`,
  `existe_csv_programacion`) y el resto del proyecto siguen con el
  patrón antiguo hasta que se corrijan (pendiente).

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
`supabase/migrations/`). **La copia en BD es la fiable para restaurar**;
el JSON es solo una copia de conveniencia (en una fila el `modelo` pierde
unos espacios finales al transcribirlo). Se usó una vez, tras la prueba
de UI del 02/10/2026: se restauró `programacion_orden` (con sus `id` y
marcas de tiempo) y el historial, y se verificó por hash que quedaron
idénticos a la copia. **Borrar las dos tablas `_bak_20261002` a partir
del 2026-10-16** si todo va bien (están marcadas con un comentario).

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

`JefeApp.tsx` gana una 8ª pestaña, **"Programación"**
(`jefe/programacion/ProgramacionScreen.tsx`), con dos sub-vistas:

- **Revisar**: si no hay CSV hoy (`existeCsvHoy`), muestra el textarea
  de pegar ahí mismo (fusionado, sin pestaña aparte — decisión de
  sesión: "reduce complejidad"). En cuanto hay CSV, diff agrupado por
  horno: `+ nuevo` (con inputs de tono/calibre), `− eliminado` (con
  botón "mantener igualmente"), `~ reordenado`/`= sin cambios`
  informativos, y `⇄ cambia de horno` (informativo, agrupado bajo el
  horno nuevo con "viene del horno X"; **sí entra en el payload**, con
  la posición dentro del horno nuevo). Si alguna fila viene `repetida`
  hay un aviso rojo y **confirmar queda bloqueado**: hay que corregir el
  archivo y usar «¿Archivo equivocado? Sustituir». El resultado de
  confirmar/deshacer se muestra tras recargar el diff (`cargarDiff`
  recibe el mensaje; antes la propia recarga lo borraba y solo se veía
  el spinner). Botón "Confirmar y actualizar".
- **Consultar**: la lista congelada de hoy, agrupada por horno, con
  badge de estado en vivo (pendiente/iniciado/finalizado, colores
  distintos), botón "copiar → copiado" junto a cada `Nº ORDEN`
  (`navigator.clipboard`, sin dependencias), y "Exportar/Imprimir".

`lib/programacion.ts` — todas las llamadas RPC + tipos
(`FilaDiff`, `FilaConEstado`, `FilaAConfirmar`) + `agruparPorHorno`.

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

## Pendiente

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
