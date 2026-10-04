# 02 — App del responsable (comportamiento real)

Rol que la usa: `responsable` (titular, con letra). El rol `suplente`
existe en el enum pero no hay ninguna cuenta con él ni se creará
(decisión cerrada, ver `01`, "Suplente y refuerzo") — la cobertura de
turnos se hace siempre con las credenciales del titular, nunca con una
cuenta aparte.

Shell: `App.tsx` con seis pestañas arriba — **Turno**, **Resumen**,
**Lotes**, **Historial**, **Relevo**, **Chat** — más un botón flotante **Progreso** fijo
abajo del todo, que abre un panel con toda la gamificación (Ranking,
Ranking resp., Stats, Equipo, Logros — detalle en `04`). Principalmente
en móvil. Todo lo descrito aquí está construido salvo donde se indique.

## Pestaña Turno (`TurnoScreen.tsx`)

Al entrar se calcula el turno que corresponde ahora mismo
(`calcularTurnoActual(letra)` o `calcularTurnoActualSuplente()`), se
busca/crea la fila `turno` y se recalcula el estado automáticamente en
el instante exacto del próximo cambio (`setTimeout` + `visibilitychange`).

**Recarga no destructiva** (sesión 02/09/2026): cada vez que la
pestaña recupera el foco (cámara, foto abierta en pestaña nueva,
notificación, bloquear/desbloquear el móvil...) se comprueba primero,
solo por reloj y sin llamar a Supabase, si sigue siendo el mismo turno
(fecha + tipo + estado) que el que ya hay en pantalla. Si es el mismo,
no se toca nada — ni pantalla de carga ni red. Solo se dispara la
recarga completa (que sí desmonta y reconstruye la pantalla) si de
verdad cambió: cambio de franja o salto al turno del día siguiente. Se
mantiene además la guarda de "flujo activo" (`lineaEnCaptura`,
`verEditar`, `nuevoTonoOrigen`, `continuarOrigen`, `lineaConIncidencia`,
`mostrandoIncidenciaGeneral`) para no interrumpir un formulario a
medias tampoco en ese caso. Bug real que motivó esto: fotos de
incidencia abiertas con `target="_blank"` no estaban en esa lista, así
que perdían el turno cargado en pantalla cada vez que se cerraban.

| Estado | Qué se ve | Qué se puede hacer |
|---|---|---|
| `descanso` | Mensaje "hoy es tu descanso" | Nada de gestión. Si hace falta cubrir el turno de otro: con las credenciales del titular que le toca (`01`). |
| `antes` | Cuándo empieza el turno | Nada |
| `abierto` | Tarjeta de refuerzo + 6 tarjetas de línea + incidencias generales + Cerrar turno | Todo |
| `en_revision` | Igual, con aviso de la hora de cierre automático | Todo lo del estado `abierto`: nuevo lote, nuevo tono/calibre, continuar del turno anterior, asignar operarios, corregir, cerrar turno. Desde el 20/09/2026 (antes solo se podía continuar y corregir). El aviso dice "puedes seguir registrando partes hasta las HH:MM, cuando el turno se cierra solo". |
Motivo del cambio (20/09/2026): tres veces el responsable no llegó a
registrarlo todo a tiempo y la hora de revisión solo dejaba continuar
y corregir. El bloqueo era solo de interfaz (`TurnoScreen.tsx`): la
política `parte_insert_responsable` nunca comprobó hora ni estado del
turno, así que no hizo falta migración.

Riesgo conocido: a la hora en punto el cron cierra el turno y completa
"sin producción" los partes que sigan pendientes (`20260820123000`).
Un parte que se empiece justo antes de ese momento puede cerrarse a
cero mientras se rellena. Ver `07`.
| `cerrado` | Vista de solo lectura | Nada |

**Operarios de refuerzo** (tarjeta arriba de las líneas): alta/baja de
operarios de otra letra para este turno. Sin alta previa no aparecen en
el desplegable de ninguna línea.

**Tarjeta de línea** (una por línea, colapsable):
- Desplegable de operario: los de la letra del responsable + los de
  refuerzo. Guarda en `asignacion_operario_linea`.
- Si hay un parte pendiente (`completado = false`) de este turno en
  esta línea → botón **Continuar parte** (retoma el wizard donde se
  quedó: si falta verificación de caja, vuelve a ella), con una línea
  de texto explicando que hay que terminarlo antes de poder abrir
  otro (sesión 02/09/2026 — sin esto, la opción "Nueva orden"
  simplemente desaparecía sin que quedara claro por qué; el
  responsable no ve nunca un error, solo un botón que ya no está).
- Si no → botón **Nuevo lote** y, si el turno anterior dejó partes en
  esta línea, sugerencias **Continuar** (mismo lote y tono, sin fotos
  de hoja) y **Nuevo tono/calibre** (mismo lote, sin foto de hoja).
- "Ver partes de hoy (N)": lista de partes completados de la línea en
  este turno; cada uno abre el detalle y, dentro de la hora, la
  corrección.
- Botón de incidencia de producción de la línea.

**Incidencias generales del turno**: incidencias de producción sin
línea (`linea_id = null`).

**Cerrar turno**: confirmación en dos pasos → escribe
`turno.cerrado_at = now()`, `como_cerro = 'manual'`. Eso dispara el
envío del informe a Telegram (ver `05-automatismos.md`). Si nadie
cierra, el cron lo hace 1 h después del fin de la franja.

**Aviso de partes pendientes al cerrar** (sesión 02/09/2026): si al
confirmar el cierre queda algún parte `completado = false` en
cualquier línea, el segundo paso de la confirmación muestra qué
líneas son antes del botón "Sí, cerrar turno" — no bloquea el cierre
(puede ser una decisión legítima, ej. turno interrumpido por avería),
solo evita que sea un accidente. A diferencia del cierre automático
por cron (`20260820123000_cerrar_partes_pendientes_auto.sql`, que sí
completa esos partes "sin producción" solo), el cierre manual no
toca los partes pendientes — quedan huérfanos hasta que un admin los
complete desde "Añadir parte" (`09`).

## Captura de un parte (`captura-parte/CapturaParteScreen.tsx`)

Wizard con pasos `hoja → tono → caja → codbar → pantalla → (incidencia)
→ aviso`. Tres puntos de entrada:

1. **Nuevo lote**: empieza en `hoja`.
2. **Nuevo tono/calibre, mismo lote**: empieza en `tono` con el lote
   precargado; tono y calibre editables.
3. **Continuar mismo lote+tono** (del turno anterior): confirmación y
   salta a `caja`.

El parte se **inserta al resolver el lote** (fin de `hoja` en el camino
1, confirmación en 2 y 3), con piezas/minutos a 0. Por eso se puede
dejar un lote preparado y retomarlo.

**Solo un pendiente por línea+turno** (sesión 02/09/2026): como el
parte ya existe en BD antes de terminar el wizard, darle a "atrás"
justo después de la Foto 1 dejaba un parte huérfano
(`completado=false`) sin que nadie lo cerrara; si luego se entraba por
"Continuar" o "Nuevo tono/calibre", se creaba un segundo pendiente en
la misma línea+turno, y el más antiguo (el huérfano) reaparecía más
tarde tapando al que sí se había completado. Dos capas de arreglo:
índice único parcial en BD (`uq_parte_pendiente_por_linea_turno`, ver
`06`) que lo impide siempre, pase lo que pase; y en `TurnoScreen.tsx`
las sugerencias "Continuar"/"Nuevo tono/calibre" del turno anterior
dejan de mostrarse en cuanto ya hay un pendiente en esa línea (solo
queda "Continuar parte"). Ese mismo día, más tarde, un caso real (responsable cerró el turno
sin completar el pendiente en vez de entender por qué no podía abrir
uno nuevo) motivó dos ajustes más: el texto explicativo junto a
"Continuar parte" (arriba) y el aviso de pendientes al cerrar turno
(ver "Cerrar turno"), además de una vía de admin para completar/crear
el parte que faltó (`09`, "Añadir parte a un turno ya cerrado").

### Paso hoja (Foto 1 — hoja de partida)
La hoja de partida es un **A4 vertical**: se fotografía en vertical, con la
cabecera arriba y el texto recto. Cámara nativa (`<input capture>`) o galería,
sin recorte (`procesarFotoLibre`: solo reduce a ≤1600 px de ancho, WebP) →
Cloudinary (`hoja_{...}`) → `ocr-parte` con
`foto_tipo=hoja_partida` → JSON con modelo, marca, formato, acabado,
espesor, tono anterior, calibre, número de orden, palet, piezas/caja,
objetivo, 4 códigos de barras, observaciones, confianza. El responsable
revisa y edita. Al confirmar → `resolver-catalogo` (crea/enlaza modelo,
marca, producto, lote; reabre el lote si estaba finalizado) → se
inserta el parte con tono sugerido `tono_ant + 1`.

En pantalla (`FotoHojaPartida.tsx`): aviso propio, siempre visible, con un
dibujo de folio vertical y flecha ARRIBA ("Pon la hoja en vertical, con la
cabecera arriba. El texto tiene que leerse recto."), recuadro-guía vertical con
proporción A4 (210/297, altura máxima) y previsualización entera
(`object-contain`, sin recorte, también si la foto sale apaisada). No usa
`AvisoGirarMovil`: ese aviso ("Gira el móvil en horizontal") solo lo usan las
fotos de documentos apaisados (caja y pantalla). No hay detección ni giro
automático de la foto: posible mejora si esto no basta.

**Incidente (02/10/2026):** hasta este cambio la Foto 1 mostraba
`AvisoGirarMovil` y un recuadro apaisado 4:3, así que se fotografiaba la hoja
de lado. Resultado: número de orden mal leído por el OCR y un lote duplicado
(lotes `1117222` y `11172222`, mismo modelo SL IRATI TAUPE; el primero quedó
iniciado con 1 parte y el segundo finalizado con 2).

**Validación en la revisión (04/10/2026).** Datos reales: los 264 lotes tienen 7
dígitos y empiezan por 11; el objetivo va de 100 a 50.000 m², siempre entero.
Lógica pura en `lib/validar-orden.ts` (copia idéntica en
`functions/_shared/validacion-orden.ts`; tests: `node --test frontend/tests/validar-orden.test.ts`).
- **Nº de orden:** se quitan los no-dígitos y se exige `/^11\d{5}$/`. Si tras
  limpiar cumple, se corrige y se enseña en ámbar ("Corregido de «11.147.69»");
  si no, rojo "7 dígitos y empieza por 11" y Confirmar deshabilitado
  (`11172222`, `1.16640`, `M-14 CAL`, `843559203684` bloquean).
- **Objetivo m²:** primero el formato español impreso ("2.000,000" → 2000, sin
  aviso); si no da un entero en rango, se limpia a dígitos: ≥ 1.000.000 → ÷1000
  y redondeo; 1–99 → ×1000; solo si cae en 100–50.000, y se enseña en ámbar
  ("Corregido: 11.000.000 -> 11.000"). Fuera de rango o vacío: rojo y bloquea.
  Ejemplos: `3000000`→3.000, `4`→4.000, `4000002`→4.000, `111604`→rojo.
- **Cruce** (RPC `cruzar_orden_captura`, security definer, roles
  responsable/suplente/jefe/produccion/administrador; `programacion_orden` no la
  puede leer el suplente por RLS). Lógica pura en `lib/cruce-orden-logica.ts`; si la RPC falla, no bloquea.
  - **Comparar modelos:** IGUALDAD EXACTA tras normalizar (mayúsculas, sin acentos, sin espacios ni
    signos; en programación se corta antes del primer «(»). Nunca «uno contenido en el otro»: hay
    modelos distintos que solo se diferencian por un sufijo (CALA DESERT / CALA DESERT ANT, SL LIVIA
    CREAM / … LM, CLASS AVORIO / … PL, SL MIDTOWN CREAM / … NPL, SL NEUTRA CREAM / … AN).
    `normalizarTexto` no sirve (conserva acentos y `- / . &`): se usa `normalizarModeloComparable`.
  - **Lote existente con otro modelo:** ámbar «Esta orden ya existe como X y has leído Y», con «Usar
    la orden existente» / «Corregir el número». Hoy SOLO AVISA: `BLOQUEAR_CRUCE_MODELO = false` (único
    sitio, `cruce-orden-logica.ts`); a `true` bloquea Confirmar hasta que coincidan (ver `07`). Como
    `resolver-catalogo` usa el producto del lote existente, el aviso sirve para detectar un NÚMERO mal.
  - **Lote existente → objetivo:** de solo lectura con el valor del lote; no se valida lo leído y el
    cliente no lo exige (envía `null`).
  - **Programación:** si el número está, se enseña su modelo; si no coincide (igualdad exacta), ámbar,
    sin bloquear.
  - **Sugerencia «¿1114136?»:** solo si el número leído NO tiene lote y hay una orden a un dígito que
    sea el MISMO PRODUCTO: modelo + marca + formato en lotes; en programación (sin marca propia; el
    formato va en el texto del modelo, p. ej. «60X120RC») modelo + formato. Mismo modelo con otro
    formato o marca no se sugiere. No hay comprobación de marca en el cruce de modelos. Nunca bloquea.
- **Servidor:** `resolver-catalogo` valida `numero_orden` SIEMPRE (422); valida y normaliza
  `objetivo_m2` (100–50.000, entero) SOLO cuando va a CREAR el lote (antes de crear modelo/marca/
  producto, para no dejar huérfanos); si el lote existe lo ignora. Mismo código en
  `_shared/validacion-orden.ts`. **Orden de despliegue:** primero el cliente (Vercel Ready), después
  la función (con servidor nuevo y cliente viejo, objetivos como 11000000 darían 422).
- Migración `cruzar_orden_captura` aplicada (04/10/2026, versión 20261004053508; el mismo día `20261004054534` le quita el límite de parecidos: el filtro «mismo producto» es del cliente y un límite podía dejar fuera al gemelo). `resolver-catalogo` v30 desplegada el 04/10/2026 con la validación del servidor (v29 anterior guardada en `privado/backups/resolver-catalogo_v29_20261004/`, fuera de git).

### Paso tono
Formulario tono (obligatorio, patrón `[A-ZÑ0-9]`) y calibre.

### Paso caja (Foto 2 — verificación de caja impresa)
Obligatorio en los 3 caminos; "dejar para más tarde" solo aplaza (al
retomar el parte vuelve aquí). Dos formas de cumplirlo:
- **OCR**: 1 foto (formatos pequeños `200x1200`, `300x1200`) o 2
  (superior 1600×1200 + lateral 1600×300, resto de formatos). Se
  comparan marca, modelo, tono y calibre con el lote. Resultado por
  campo `correcto / incorrecto / no_verificable` (no verificable =
  sin lectura o confianza baja). Global: incorrecto si alguno lo está;
  si no, no verificable si alguno lo está; si no, correcto. Se guarda
  `verificacion_caja_estado`, `verificacion_caja_detalle` (los 4
  campos con leído/esperado) y `fotos_caja`.
- **Confirmación manual** (checkbox "lo he comprobado a simple
  vista"): guarda `verificado_manual`, sin foto.
El resultado es informativo, nunca bloquea. Cualquier cambio de
`verificacion_caja_estado` dispara el aviso de Telegram "Nuevos lotes".

### Paso codbar (verificación de códigos de barras)
Escáner en vivo (ZXing, EAN-13 y Code128) contra los códigos del lote
que estén rellenos. Cada lectura que coincida con uno lo marca; las
que no coinciden con ninguno se ignoran. Estado: `completo` (todos),
`parcial`, `manual` (checkbox), `no_realizada` (lote sin códigos, se
salta solo). Guarda `verificacion_codbar_estado` y `_detalle`.

### Paso pantalla (Foto 3 — pantalla de la máquina Multigecko)
Foto 1600×1200 → `ocr-parte` `foto_tipo=pantalla` → piezas por calidad
(1ª=TOTAL STD, comercial=COM, eco, descuadre com, planar com,
contenedor), cal_1…cal_8, piezas entradas, 6 minutos (total, plena, no
alimentada, saturación, banco, máquina), y la fecha/hora que muestra la
pantalla (se guarda parseada y en crudo). El responsable revisa/edita;
se aplican las validaciones de `01-dominio.md`; al confirmar →
`completado = true`. Alternativa: **Cerrar sin producción**.

### Incidencia de calidad
Botón dentro del parte mientras está pendiente (no después): texto +
fotos opcionales → `incidencia_calidad(parte_id)` → Telegram al
instante. La incidencia de producción no tiene botón aquí a propósito:
cuelga de turno + línea (o solo turno si es general), no de un parte
concreto — un paro de máquina o falta de material no está ligado a un
lote/tono específico. Su punto de entrada real está en `TurnoScreen`
(ver más abajo), no dentro de la captura de parte.

### Aviso final
Recuerda la ventana de corrección de 1 h. Se puede ocultar.

## Corrección de un parte completado (`DetalleParteScreen`)
Dentro de la hora desde `completado_at`, el responsable que lo capturó
puede corregir: se abre el formulario con los datos actuales, al
guardar se inserta un parte nuevo con `corrige_a_parte_id` y el
original queda `vigente = false` (trigger). `corregirParte` comprueba
después que el original de verdad quedó no vigente; si no, lanza error
explícito ("hay dos partes vigentes").

## Pestaña Resumen (`ResumenScreen.tsx`)
Informe del turno de hoy, recalculado al entrar: cabecera (fecha,
turno, responsable), por línea → operario → partes con producción
(modelo, tono, m² por categoría, incidencias de calidad colgando), y al
final las incidencias generales. Se omiten los partes sin producción.
Si el turno no está cerrado se marca como provisional. Botón
**Copiar** (texto plano, pensado para WhatsApp). Es la misma estructura
que envía `generar-resumen-turno`, calculada aparte en el cliente.

## Pestaña Lotes (`GestionLotes.tsx`)
Todos los lotes **iniciados** (sin límite), de `v_lote_gestion`, con la
actividad más reciente primero. Cada tarjeta: modelo/marca, orden,
pendiente (m² y piezas), % del objetivo, "hace N días" y la etiqueta
"En producción" si hay un parte abierto. Sin sección de cerrados.

Cierre automático: el trigger `trg_parte_z_cerrar_lote_completo` finaliza
el lote al completarse un parte si está `iniciado`, su `objetivo_m2` está
entre 100 y 50.000, `m2_pendiente = 0` (v_lote_pendiente) y no queda ningún
parte vigente sin completar. Un parte nuevo lo reabre solo
(`trg_parte_reabre_lote`, que también limpia `resumen_calidad_enviado_at`)
y se reevalúa al completarse; se puede cerrar y reabrir las veces que haga
falta. El nombre del trigger debe ordenarse DESPUÉS de
`trg_parte_reabre_lote` (orden alfabético). Botón **Finalizar** manual con
confirmación; no hay Reabrir manual.

## Pestaña Historial y botón Progreso

**Historial** (`HistorialResponsableScreen.tsx`): reutiliza el mismo
acordeón turno → línea → parte del jefe (`VistaDetalladaScreen`), con
el filtro de responsable fijado al propio usuario y oculto. Es dato de
trabajo, por eso vive como pestaña de arriba y no dentro de Progreso.

**Progreso** (botón flotante, `ProgresoFlotante.tsx`): abre un panel
con 5 sub-vistas — Ranking (de operarios), Ranking resp. (de
responsables), Stats (avatar + 4 barras), Equipo (los operarios de su
letra, con avatar y stats congeladas), Logros (18 propios). Toda la
mecánica de puntos, niveles, ciclos y logros del responsable está
descrita en `04`.
