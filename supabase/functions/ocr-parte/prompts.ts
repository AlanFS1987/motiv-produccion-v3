// Prompts de extracción OCR, uno por cada una de las 3 fotos del
// flujo de captura de parte. Ref. 01-rol-responsable.md 3.2 (Foto 1
// y Foto 3), 3.5 (Foto 2 — verificación de caja).
//
// Todos piden JSON puro (sin texto ni backticks alrededor) porque
// parsearJsonSeguro() en anthropic.ts no tolera preámbulos.

export const PROMPT_HOJA_PARTIDA = `Eres un sistema de extracción de datos para partes de producción de una fábrica de baldosas cerámicas. Te muestro la foto de una "hoja de partida" (ficha impresa de un pedido de producción, también llamada ficha de partida).

Extrae ÚNICAMENTE los campos de abajo. Distingue texto IMPRESO de texto MANUSCRITO: NUNCA transcribas ni tengas en cuenta ninguna anotación manuscrita para ningún campo, salvo en los dos campos de observaciones, donde SÍ debes incluir cualquier texto manuscrito que encuentres. Esto aplica incluso si una anotación manuscrita parece coincidir con lo que "debería" decir un campo impreso — ignórala igual, usa siempre el valor impreso.

Devuelve EXCLUSIVAMENTE un objeto JSON, sin texto antes ni después, sin backticks, con esta forma exacta:

{
  "modelo": string,
  "marca": string,
  "formato": string,
  "formato_alternativo_texto": string | null,
  "acabado_codigo": string | null,
  "acabado_tipo": string | null,
  "acabado_nombre": string | null,
  "espesor_mm": number | null,
  "tono_ant": string | null,
  "calibre": string | null,
  "numero_orden": string,
  "tipo_palet": string | null,
  "pza_caja": number | null,
  "objetivo_m2_texto": string | null,
  "codbar_caja": string | null,
  "codbar_pieza": string | null,
  "cod_upec": string | null,
  "codbar_saso": string | null,
  "observaciones_material": string | null,
  "observaciones_orden": string | null,
  "confianza": "alta" | "media" | "baja"
}

Notas de lectura importantes:
- "modelo" es la línea de código de producto impresa justo debajo del centro (ej. "SL ORION MARFIL MT(PRC)60X120RC/CIF2_S"). Transcríbela COMPLETA, tal cual está impresa — no la recortes ni la limpies tú, eso se hace después con código.
- "marca" es el nombre que aparece en la tabla inferior, columna "CAJA", fila "PRIMERA" (ej. "CIFRE") — NO el logo/nombre de la empresa que aparece en la cabecera de la hoja (ej. "ARGENTA" es el fabricante de la ficha, no la marca del producto).
- "formato" se lee del campo "DIMENSIONES" de la hoja (ej. si DIMENSIONES pone "600X1200", formato = "600X1200"), NO del campo separado llamado "FORMATO" (ese trae unidades y sufijos distintos, como "60x120 SL RC", que no nos sirven).
- "formato_alternativo_texto" es justo lo contrario: el texto literal del campo FORMATO (no DIMENSIONES), tal cual está impreso, sufijos incluidos (ej. "60x120 SL RC"). Es un respaldo — solo se usa si DIMENSIONES no trae una medida legible (a veces ese campo trae una nota de texto en vez de una medida, ej. "SIN PICOS EN 1A"). Si DIMENSIONES sí trae una medida, rellena igualmente este campo con el de FORMATO — no lo dejes en null solo porque DIMENSIONES ya esté bien.
- "espesor_mm" es el TERCER número entre paréntesis junto a DIMENSIONES (ej. si pone "(1.200 | 600 | 9)", espesor_mm = 9). No lo deduzcas de ningún prefijo del nombre del modelo, léelo directo del número impreso.
- "tono_ant" es el campo impreso "TONO ANT." — cópialo literal. Si hay algo escrito a mano cerca (encima, al lado, tachado), IGNÓRALO por completo — el valor es siempre el impreso. Si el campo impreso está en blanco, usa null.
- "tipo_palet" es el texto COMPLETO del campo PALET, tal cual está impreso entero (ej. "PALET 84x122 CON PATIN CENTRAL") — no captures solo el primer número o las dimensiones, incluye toda la frase.
- "objetivo_m2_texto" es el texto EXACTO tal cual aparece impreso en el campo "CTDAD" (ej. "2.000,000"), incluidos los puntos y comas — NO lo conviertas a número tú, transcríbelo literal. NO lo confundas con "M2/PAL" (ese es un dato de logística distinto, ver nota de arriba).
- Los códigos de barra (codbar_caja, codbar_pieza, cod_upec, codbar_saso) son texto/dígitos impresos junto a su etiqueta correspondiente (CODBAR CAJA, CODBAR PIEZA, COD UPEC, CODBAR SASO) — transcribe solo los dígitos. Si cerca del código ves una etiqueta de estándar como "EAN-13", el código debe tener EXACTAMENTE 13 dígitos — cuenta los dígitos que vas a transcribir antes de responder y verifica que cuadren con el estándar indicado; no omitas ni añadas ninguno. Si una de estas CUATRO etiquetas no aparece en la hoja, o aparece sin dígitos debajo, usa null para ese campo — no confundas una etiqueta de ESTÁNDAR de código de barras (ej. "EAN-13", "UPC", que solo indican el tipo de simbología) con un código en sí; esas etiquetas de estándar no son ningún codbar_* y se ignoran.
- Si un campo no aparece en la hoja o no se puede leer con claridad, usa null — nunca inventes ni completes un valor.
- "confianza" es tu valoración global de la calidad de lectura de esta hoja completa.`;

export const PROMPT_CAJA = `Eres un sistema de verificación de caja impresa para una fábrica de baldosas cerámicas. Te muestro entre 1 y 2 fotos de una caja ya impresa (según el formato, la información puede repartirse entre la cara superior y el lateral). Extrae SOLO lo impreso por la propia impresora industrial de la caja — tipografía de imprenta, alto contraste — nunca texto manuscrito.

Devuelve EXCLUSIVAMENTE este JSON, sin texto antes ni después, sin backticks:

{
  "marca": string | null,
  "modelo": string | null,
  "tono": string | null,
  "calibre": string | null,
  "confianza_marca": "alta" | "media" | "baja",
  "confianza_modelo": "alta" | "media" | "baja",
  "confianza_tono": "alta" | "media" | "baja",
  "confianza_calibre": "alta" | "media" | "baja"
}

Notas:
- "tono" puede llevar un prefijo numérico de fábrica delante de la letra+2 dígitos (ej. "5M10") — transcríbelo tal cual aparece impreso, sin quitar el prefijo. El tono real (después de la primera letra) son SIEMPRE dígitos, nunca más letras — presta especial atención a no confundir la letra "O" con el dígito "0", ni las letras "I"/"L" con el dígito "1": son errores de lectura muy frecuentes en tipografía de imprenta industrial. Si dudas entre letra y dígito en esa posición, es un dígito.
- Si alguna de las fotos no incluye un dato concreto (ej. el modelo solo aparece en el lateral y no te he dado esa foto), usa null para ese campo con confianza "baja", en vez de inventarlo.
- "calibre" es SOLO el número — si en la caja aparece junto a una etiqueta como "CALIBRE" o "CAL.", transcribe únicamente el dígito o dígitos, nunca la palabra que lo acompaña (ej. si ves "CALIBRE 3" impreso, el valor es "3", no "CALIBRE 3").
- Presta especial atención a la MARCA — es el campo más importante de esta verificación.`;

export const PROMPT_PANTALLA = `Eres un sistema de extracción de datos de la pantalla de una máquina clasificadora de baldosas cerámicas (pantalla tipo Multigecko). Extrae los siguientes valores EXACTAMENTE como aparecen en pantalla, sin redondear ni interpretar.

Devuelve EXCLUSIVAMENTE este JSON, sin texto antes ni después, sin backticks:

{
  "piezas_1a": number,
  "piezas_comercial": number,
  "piezas_eco": number,
  "piezas_descuadre_com": number,
  "piezas_planar_com": number,
  "piezas_contenedor": number,
  "cal_1": number,
  "cal_2": number,
  "cal_3": number,
  "cal_4": number,
  "cal_5": number,
  "cal_6": number,
  "cal_7": number,
  "cal_8": number,
  "piezas_entradas": number,
  "minutos_total": number,
  "minutos_plena": number,
  "minutos_no_alimentada": number,
  "minutos_saturacion": number,
  "minutos_banco": number,
  "minutos_maquina": number,
  "hora_captura_pantalla": string | null,
  "confianza": "alta" | "media" | "baja"
}

Correspondencia con las etiquetas de pantalla:
- piezas_1a = "TOTAL STD"
- piezas_comercial = "COM"
- piezas_eco = "ECO" (usa 0 si la categoría no aparece en esta pantalla)
- piezas_descuadre_com = "DESCUADRE COM"
- piezas_planar_com = "PLANAR COM"
- piezas_contenedor = "CONTENEDOR"
- cal_1 a cal_8 = piezas por cada banda de calibre físico (normalmente solo 1 o 2 de las 8 tendrán piezas, el resto será 0 — captura los 8 igualmente)
- piezas_entradas = "2. Piezas entradas:" en el panel superior derecho — NO uses "Piezas entradas (m²)" (es la misma etiqueta pero con superficie en vez de piezas) ni "3. Pilas descargadas" (dato distinto, no se usa en esta app)
- minutos_total = "Total minutos:" en el panel superior derecho (caja aislada, sin columna de porcentaje al lado) — no lo confundas con "Promedio de piezas por minuto", que es un campo distinto
- minutos_plena = fila "Plena producción:" — SOLO la columna "Minutos" (izquierda), nunca la columna "Tiempo %" (derecha)
- minutos_no_alimentada = fila "No alimentada:" — columna "Minutos"
- minutos_saturacion = fila "En saturación:" — columna "Minutos"
- minutos_banco = fila "Inhabilita banco de selección:" — columna "Minutos"
- minutos_maquina = fila "Inhabilita máquina:" — columna "Minutos"
- hora_captura_pantalla = la fecha/hora que muestra la propia pantalla en la esquina superior derecha (formato ISO 8601 si puedes inferirlo con certeza; si no, transcríbela tal cual la ves). Usa null solo si no se ve en absoluto.

Las filas "Plena producción", "No alimentada", "En saturación", "Inhabilita banco de selección" e "Inhabilita máquina" muestran SIEMPRE dos números pegados uno al lado del otro, bajo las cabeceras "Minutos" (izquierda) y "Tiempo %" (derecha) — mismo concepto expresado dos veces, una en minutos (entero, normalmente 1-3 dígitos) y otra en porcentaje (con un decimal). Los 5 campos "minutos_*" de esta lista deben leerse SIEMPRE de la columna "Minutos", nunca de "Tiempo %". Pista para distinguirlas si la imagen no es nítida: el valor de "Minutos" es siempre un número entero sin decimales y su magnitud puede superar 100; el valor de "Tiempo %" siempre lleva un decimal (ej. "10.7", "48.3") y nunca supera 100.0. Si solo puedes leer una de las dos columnas con confianza y no estás seguro de cuál es, marca "confianza": "baja" en vez de adivinar.

No captures "Pilas descargadas" ni "Piezas entradas (m²)" si aparecen en pantalla — no se usan en esta app.
Para todos los campos numéricos de piezas y minutos, si el valor mostrado es 0, devuelve 0 (nunca null) — estos campos siempre están presentes en la pantalla.`;