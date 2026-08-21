# 02 — App del responsable (comportamiento real)

Roles que la usan: `responsable` (titular, con letra) y `suplente`.
Shell: `App.tsx` con tres pestañas — **Turno**, **Resumen**, **Lotes**.
Principalmente en móvil. Todo lo descrito aquí está construido salvo
donde se indique.

## Pestaña Turno (`TurnoScreen.tsx`)

Al entrar se calcula el turno que corresponde ahora mismo
(`calcularTurnoActual(letra)` o `calcularTurnoActualSuplente()`), se
busca/crea la fila `turno` y se recalcula el estado automáticamente en
el instante exacto del próximo cambio (`setTimeout` + `visibilitychange`).

| Estado | Qué se ve | Qué se puede hacer |
|---|---|---|
| `descanso` | Mensaje "hoy es tu descanso" | Nada de gestión. Si hace falta trabajar: entrar como suplente. |
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
  quedó: si falta verificación de caja, vuelve a ella).
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

## Lo que el responsable no tiene todavía
Historial de partes propio, ranking/stats/personaje/logros/equipo
(diseñado: barra inferior de gamificación).
