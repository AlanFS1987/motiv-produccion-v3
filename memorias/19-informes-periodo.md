# 19 — Informes por periodo: diario y semanal

Encargo del encargado de clasificación (sesión 20/09/2026): además del
parte de cada turno (`05`, `generar-resumen-turno`), un **parte del día**
y un **parte de la semana**. Misma información a otra granularidad:
fusionar turnos da el día, fusionar días da la semana. Cada uno es un
PDF que se envía al grupo de Telegram del resumen de turno y se puede
abrir desde la pestaña **Informes** del jefe y del administrador.

Verificado en real el 21/09/2026: el diario del 20/09 y el semanal
del 14–20/09 llegaron al grupo tras el cierre automático del turno de
noche, junto con el informe del propio turno.

## Qué periodo cubre cada informe

Convención de siempre (`01`): la `fecha` de un turno es el día en que
**empieza**; el turno N de la fecha D termina a las 06:00 de D+1.

| Informe | Turnos que incluye | Se genera cuando |
|---|---|---|
| **Diario** de D | M, T y N con `fecha = D` (de 06:00 de D a 06:00 de D+1) | se cierra el turno N de D |
| **Semanal** que empieza el lunes L | todos los turnos con fecha entre L y L+6 (lunes M … domingo N, 21 turnos) | se cierra el turno N del domingo |

Filtrar por fecha evita calcular "los 3 últimos turnos" por hora. Si un
turno no llegó a abrirse no se omite en silencio: la cabecera dice
"Turnos incluidos: 19 de 21" y lista cuáles faltan.

## Estructura del PDF (igual en los dos)

1. **Cabecera**: periodo, turnos incluidos (y faltantes / sin cerrar en
   ámbar), solo en el diario los responsables de M/T/N, m² totales con
   el reparto 1ª / comercial / contenedor en %.
2. **Producción y tiempos por turno (diario) o por día (semanal)**
   (añadido el 21/09/2026): el mismo par de tablas que por línea pero
   con el eje temporal — diario: 3 filas (Mañana, Tarde, Noche);
   semanal: 7 filas (lun 07/09 … dom 13/09) — + fila TOTAL. Siempre
   salen todas las filas: un turno sin registrar aparece como
   "Tarde (sin turno)" con ceros, y un día con turnos incompletos como
   "mar 08/09 (2/3)" (nota al pie: turnos registrados de los 3
   esperados). Dos tablas y no una porque, igual que por línea, una
   sola con m² por calidad + 5 tiempos no cabe en el ancho de página.
   Bajo la tabla de tiempos va el bloque **tiempo registrado / sin
   registrar** (ver más abajo), aparte de las tablas.
3. **Producción por línea**: una fila por línea (m² y piezas de 1ª,
   comercial y contenedor, m² total) + fila TOTAL.
4. **Tiempos por línea**: plena / no alimentada / saturación / banco /
   máquina, con % sobre el total de cada línea + fila TOTAL.
5. **Producción por lote**: una fila por lote con producción en el
   periodo — nº de orden, modelo, formato, m² y piezas de cada
   calidad, m² total, % de 1ª y **"Ton / Cal"** (nº de tonos y de
   calibres distintos combinados en el lote, p. ej. `2 / 1`). Ordenada
   por m² de mayor a menor. Solo cuenta lo producido en el periodo, no
   el acumulado del lote: un lote que sigue la semana siguiente sale en
   ambos informes con lo suyo en cada uno.
6. **Incidencias** (calidad + producción + generales), por fecha, turno
   (M<T<N) y línea. **Diario con fotos; semanal solo texto**, con el
   aviso "(n fotos en el informe del turno)".

## Tiempo registrado y sin registrar

Bloque de tres líneas bajo "Tiempos por turno/día" (21/09/2026):

```text
Tiempo registrado: 6.980 min (80,8 %)
Tiempo sin registrar: 1.660 min (19,2 %) — de ellos 2.880 min por turnos sin registrar
Sobre el tiempo máximo del periodo: 8.640 min (3 turnos × 6 líneas × 480 min). ...
```

- **Tiempo máximo** = turnos esperados × nº de líneas × 480 min: 8.640 al
  día, 60.480 a la semana (con 6 líneas). Los turnos que no llegaron a
  registrarse cuentan dentro del máximo.
- **Registrado** = suma de las cinco categorías de tiempo de todos los
  partes (el mismo total que las tablas de tiempos). **Sin registrar**
  = máximo − registrado, con mínimo 0. "De ellos … por turnos sin
  registrar" solo aparece si falta algún turno: es la única causa que se
  puede distinguir con certeza.
- **Solo a nivel de día y semana, no por línea**: decisión para absorber
  los pequeños descuadres de tiempos entre partes. Consecuencia
  asumida: un parte con exceso (p. ej. 800 min por no resetear los
  apiladores) compensa el hueco de otra línea.
- **Porcentajes**: sobre el tiempo máximo, y **solo en este bloque**. Las
  tablas de tiempos siguen con su % sobre el tiempo registrado (no
  cambiaron). No es comparable al "% rendimiento" del dashboard (suma
  plena + no alimentada y solo cuenta líneas con parte).
- **Qué significa**: tiempo del máximo posible que no aparece en ningún
  parte. Incluye líneas paradas sin producción (p. ej. sin material u
  orden que producir), turnos sin registrar y tiempo no reportado. No
  distingue entre ellas; sirve para hacer visible algo que antes no se
  veía, no como prueba de un olvido.
- No confundir con el "sin reportar" de Vista Rápida (`10`), que es la
  diferencia entre `minutos_total` y la suma de las cinco categorías
  dentro de cada parte.
- Si una línea estuviera parada mucho tiempo por decisión, subiría el
  "sin registrar" todos esos días; habría que poder excluirla del
  máximo (pendiente).

Los totales de las tres vistas (turno/día, línea, cabecera) salen de
los mismos partes y coinciden. Pie con "Página x de y". No hay detalle
parte a parte: eso vive en el
informe de turno. Decisiones de sesión: tono y calibre solo como
recuento (no una fila por tono), dos tablas por línea (producción y
tiempos) porque una sola no cabe en el ancho de página.

Referencia de tamaño con datos reales (semana 07–13/09): 7 páginas —
3 y un tercio de producción y lotes (72 lotes), 2 de incidencias
(120). El diario del 19/09: 12 lotes, 28 incidencias.

## Datos: de dónde salen y con qué criterio

- **Criterio de partes idéntico al informe de turno**: solo `vigente`,
  `completado` y `piezas_entradas > 0`. Así los tres informes cuadran
  entre sí. Las incidencias de calidad son las de esos partes.
- **Se calcula desde los partes**, no desde las vistas del dashboard
  (`v_produccion_turno`…): m² = piezas × área del formato con
  `_shared/formato.ts`, igual que `generar-resumen-turno`. Los tiempos
  son la suma de `minutos_*`. `[VERIFICAR]` comparar los m² de un día
  con Vista Rápida / Vista Detallada.
- **Calibre** normalizado como en el resto de la app (`03` = `3`);
  tonos en mayúsculas. Los partes sin calibre no cuentan como calibre.
- Consultas paginadas de 1.000 filas (PostgREST corta ahí, con tope de
  seguridad de 100 páginas) y los `in (...)` de incidencias en trozos
  de 80 ids para no pasarse de longitud de URL.
- El PDF es una **foto fija**: si después el admin corrige un parte, no
  cambia. Para rehacerlo: `regenerar` (ver más abajo).

## Base de datos

`informe_periodo` (`20260920130000_informe_periodo.sql`): una fila por
informe. Único por `(tipo, desde)`; `desde`/`hasta` son fechas de
turno (diario: `desde = hasta = D`; semanal: lunes y domingo).
Columnas: `tipo` (`diario`/`semanal`), `pdf_url` (Cloudinary), `resumen`
jsonb (totales, turnos registrados/esperados/faltantes/sin cerrar,
nº de lotes e incidencias — con esto se compone el aviso sin recalcular
y se pinta la tarjeta de la app), `generado_at`, `enviado_at`.

RLS: escritura solo `service_role` (la Edge Function); lectura
`informe_periodo_select_jefe_admin` → `jefe` y `administrador`
(`20260920150000_informe_periodo_select_jefe.sql`). Para que otro rol
los vea basta ampliar la lista de esa política. Los PDF de turno no
necesitan nada: `turno.informe_pdf_url` ya era legible.

## Edge Function `generar-informe-periodo`

POST con `{ tipo: "diario"|"semanal", desde: "AAAA-MM-DD", enviar?: bool,
regenerar?: bool }`. Para el semanal, `desde` debe ser lunes (si no,
400). Pasos: comprobar autorización → buscar la fila → si no hay PDF
(o `regenerar`) cargar datos, generar PDF, subirlo a Cloudinary y
hacer upsert en `informe_periodo` → si `enviar`, avisar por Telegram.
Si la ventana no tiene ningún turno (cierre de fábrica) devuelve
`{ omitido: true }` y no crea nada.

- **Idempotente y sin dobles envíos**: el derecho a enviar se
  *reclama* con `UPDATE informe_periodo SET enviado_at = now() WHERE
  … AND enviado_at IS NULL`. Aunque trigger y cron coincidan, el
  mensaje sale una vez. Si Telegram falla se suelta la marca para que el
  cron reintente. `regenerar` libera la marca antes, para reenviar a
  propósito.
- **Autenticación**: se despliega con `--no-verify-jwt` y comprueba
  dentro `x-webhook-secret` (= `app_secrets.telegram_webhook_secret`,
  el mismo que `fn_disparar_resumen_turno`) o la service_role key como
  Bearer. Nunca la llama el navegador.
- **Telegram**: mensaje corto (m² totales, reparto de calidad, lotes,
  incidencias, avisos de turnos faltantes/sin cerrar) + enlace al PDF.
  Va a `TELEGRAM_CHAT_INFORMES` si existe; si no, a
  `TELEGRAM_CHAT_RESUMEN_TURNO` (el caso actual: mismo grupo).
- **Cloudinary**: reutiliza el preset y la carpeta de los informes de
  turno (`CLOUDINARY_PRESET_INFORMES_TURNO`, `informes-turno`); nombre
  `informe_diario_20260919_ab12cd34`. Sin configuración nueva.
  Un `regenerar` deja el PDF anterior huérfano en Cloudinary (entra en
  la limpieza de huérfanas pendiente en `07`).

## Automatización (`20260920140000_informe_periodo_automatico.sql`)

- **Trigger `trg_turno_informe_periodo_cierre`** sobre
  `turno.cerrado_at`: al cerrarse un turno **N** (a mano, o el cron a las
  07:00 de Madrid) llama a `fn_disparar_informe_periodo('diario', fecha)`
  y, si esa fecha es **domingo**, también `('semanal', fecha - 6)`. Todo
  dentro de un bloque `EXCEPTION`: un fallo aquí **nunca** impide cerrar
  el turno (solo deja un `WARNING`). Es `security definer` porque el
  UPDATE lo hace el responsable (`authenticated`) y las funciones de
  disparo ya no son ejecutables por ese rol.
- **`fn_disparar_informe_periodo(tipo, desde)`**: `pg_net` a la Edge
  Function con `enviar: true`, secreto compartido y timeout de 120 s.
- **Cron de respaldo `informes-periodo-pendientes`**, minuto 30 de cada
  hora (`fn_encolar_informes_periodo_pendientes`): reintenta lo que no
  se llegó a enviar. Diario: fechas con turnos cuyo periodo terminó hace
  **más de 75 min** (para que el trigger llegue antes) y **menos de
  30 h**. Semanal: domingos de los últimos 7 días con turnos en su
  semana, terminados hace más de 75 min y menos de **4 días**. Cubre
  también el día sin turno de noche (si hay turnos ese día, hay
  informe). Las ventanas evitan reenviar historia antigua.
- **Seguridad**: las tres funciones con `REVOKE EXECUTE` a
  `public/anon/authenticated` (dispararían mensajes a Telegram).
- Probado antes de aplicar en un Postgres real (PGlite) con reloj
  simulado: domingo/lunes, ventanas, cambio de hora de octubre, que un
  fallo de `pg_net` no impida cerrar el turno y que un `authenticated`
  cierre el turno igualmente.
- Al activarlo, el 20/09 a las 19:30 el cron envió el diario del 19/09
  (generado en las pruebas y sin enviar); a partir de ahí, solo los
  reales.

## Pestaña "Informes" (jefe y administrador)

`jefe/InformesScreen.tsx` + `lib/informes.ts`; añadida tras Calidad en
`JefeApp.tsx` y `AdminApp.tsx` (el admin reutiliza el mismo componente).
Tres vistas: **Diarios**, **Semanales** (30 últimos de `informe_periodo`,
tarjeta con m², % de 1ª, turnos, lotes, incidencias y aviso en ámbar si
falta algún turno) y **Por turno** (45 últimos `turno.informe_pdf_url`,
Noche → Tarde → Mañana dentro de cada día). "Abrir PDF" lo abre en
pestaña nueva (solo URL `https`). Estilo con las variables del sistema
de temas (`12`). Solo lectura.

## Cambios colaterales en el informe de turno

Se extrajo la maquetación común a `_shared/pdf-comun.ts`
(`pdf-informe-turno.ts` lo importa; el informe de turno salió
píxel a píxel igual en la comparación antes/después). Además:

- **Bug corregido**: una incidencia con emoji (o `→`, `≥`…) hacía fallar
  todo el PDF con "WinAnsi cannot encode" y el turno se quedaba sin
  `informe_pdf_url`. Ahora el carácter no soportado se sustituye por `?`.
- Las palabras más anchas que su celda se parten en vez de solaparse con
  la columna siguiente.
- Una incidencia con foto ya no se queda con el texto al final de una
  página y la foto en la siguiente.

## Cómo pedir un informe a mano

Desde el SQL Editor (la respuesta se consulta con el `id` devuelto):

```sql
select net.http_post(
  url     := 'https://boyphawxerstehngbhfe.supabase.co/functions/v1/generar-informe-periodo',
  headers := jsonb_build_object('Content-Type', 'application/json',
             'x-webhook-secret', (select value from app_secrets where key = 'telegram_webhook_secret')),
  body    := jsonb_build_object('tipo', 'diario', 'desde', '2026-09-19'),   -- + 'enviar', true / 'regenerar', true
  timeout_milliseconds := 120000);

select status_code, content::text, error_msg from net._http_response order by id desc limit 1;
```

Por defecto no envía a Telegram (`enviar` no se manda). Con la service_role
key también vale un `curl` con `Authorization: Bearer …` (nunca pegarla
en chats ni en el repo).

## Archivos

- `supabase/functions/generar-informe-periodo/index.ts`
- `supabase/functions/_shared/`: `informe-periodo-datos.ts` (consultas +
  agregación pura), `pdf-informe-periodo.ts` (PDF), `pdf-comun.ts`
  (dibujo compartido), `pdf-informe-turno.ts`, `cloudinary.ts`
  (`construirPublicIdInformePeriodo`)
- `supabase/migrations/`: `20260920130000_informe_periodo.sql`,
  `20260920140000_informe_periodo_automatico.sql`,
  `20260920150000_informe_periodo_select_jefe.sql`
- `frontend/src/lib/informes.ts`, `components/jefe/InformesScreen.tsx`

## Pendiente

- `[VERIFICAR]` que los m² de un día cuadran con el dashboard del jefe.
- Otros roles con acceso a los informes (calidad, produccion… según en
  qué rol esté el encargado): ampliar la política de lectura.
- Botón "Regenerar" en la pestaña Informes para el admin (hoy solo por
  SQL, con `regenerar: true`).
- Aviso en la campana de la app: `notificaciones.tipo` tiene un `CHECK`
  con tipos cerrados y calidad/jefe_rectificado no ven notificaciones;
  habría que ampliar el `CHECK` y decidir quién las recibe.
- Que los informes muestren la respuesta del mecánico a cada incidencia
  de producción (`18`) — hoy no aparece.
- Excluir del tiempo máximo una línea parada por decisión (hoy siempre
  cuentan todas las líneas).
- Si el semanal creciera demasiado: resumir las incidencias por línea y
  tipo en vez de listarlas una a una.
