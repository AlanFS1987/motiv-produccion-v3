# 02 — App del responsable (comportamiento real)

Rol que la usa: `responsable` (titular, con letra). El rol `suplente`
existe en el enum pero no hay ninguna cuenta con él ni se creará
(decisión cerrada, ver `01`, "Suplente y refuerzo") — la cobertura de
turnos se hace siempre con las credenciales del titular, nunca con una
cuenta aparte.

Shell: `App.tsx` con cuatro pestañas arriba — **Turno**, **Resumen**,
**Lotes**, **Historial** — más un botón flotante **Progreso** fijo
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
| `en_revision` | Igual, con aviso | Continuar partes ya abiertos, corregir partes cerrados, cerrar turno. **No** crear partes nuevos (nuevo lote / nuevo tono / continuar del turno anterior deshabilitados). |
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
Cámara en vivo con recuadro-guía 4:3, o galería. Recorte en cliente a
1600×1200 WebP → Cloudinary (`hoja_{...}`) → `ocr-parte` con
`foto_tipo=hoja_partida` → JSON con modelo, marca, formato, acabado,
espesor, tono anterior, calibre, número de orden, palet, piezas/caja,
objetivo, 4 códigos de barras, observaciones, confianza. El responsable
revisa y edita. Al confirmar → `resolver-catalogo` (crea/enlaza modelo,
marca, producto, lote; reabre el lote si estaba finalizado) → se
inserta el parte con tono sugerido `tono_ant + 1`.

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
Últimos 15 lotes por actividad, con modelo/marca/formato/número de
orden y estado. Botón **Finalizar** / **Reabrir**. Reabrir a mano no
limpia `resumen_calidad_enviado_at` (solo la reapertura automática por
parte nuevo lo hace).

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
