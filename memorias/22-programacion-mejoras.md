# 22 — Programación: mejoras acordadas con el jefe (v2)

Estado (03/10/2026): **Mejoras 1–4 implementadas** (ver "Estado de
implementación"). El pegado de celdas de Excel (Mejora 1) sigue **PROVISIONAL** a
falta de guardar el archivo original de la muestra real; la pasada de UI (guion preparado) está pendiente.
Complementa a `20-programacion.md`, que describe lo que ya existe. Este
documento recoge lo que se decidió en la conversación de diseño entre el
usuario, Claude (chat) y, a partir de ahora, Claude Code. Las decisiones
están marcadas como **[acordado]** (lo dijo el usuario) o **[propuesta]**
(lo sugirió Claude, falta que se confirme o se valide con el código real).

## Por qué se cambia

El flujo actual obliga al jefe a: guardar el Excel como CSV, abrirlo como
txt, copiar todo, pegar, y en el mismo paso de revisión rellenar tono y
calibre. Eso mezcla dos cosas distintas (validar el archivo y completar
datos) y deja trabajo manual repetido (notas escritas a mano en papel,
una por orden).

## Mejora 1 — Pegar celdas directamente desde Excel

> **Implementada el 03/10/2026; verificada con una muestra real (reconstruida desde el chat), falta
> confirmar con el archivo original.** `lib/normalizar-pegado.ts`
> (`normalizarPegado`, función pura aplicada antes de `guardarProgramacionCsv`; el parser
> SQL no cambia y los CSV con `;` se siguen aceptando). Verificada con un script
> desechable (TSV simple, comillas con salto de línea, `;` dentro de celda, mezcla de
> líneas con y sin tabuladores, línea vacía final y las 4 secciones apiladas con sus
> cabeceras) y con los CSV reales. El 03/10/2026 llegó una **muestra real** de celdas pegadas
> (53 órdenes, ver `20`): `normalizarPegado` + `parse_programacion` dan el resultado esperado. Como el chat
> convierte los tabuladores en espacios, el fixture es una reconstrucción; se cierra del todo guardando el
> original en `privado/muestras/celdas_excel_real.txt` y pasando `verificar_muestra_real.mjs`.

**[acordado]** El jefe debe poder seleccionar celdas en Excel, copiar y
pegar en el textarea, sin pasar por CSV ni txt.

- Al copiar celdas, el portapapeles de Excel trae texto separado por
  **tabuladores**. `parse_programacion` espera **punto y coma**
  (`split_part(line, ';', N)`), así que hoy no lo entendería.
- **[propuesta]** Normalizar en el frontend antes de llamar a
  `guardar_programacion_csv`: si las líneas traen tabuladores y no `;`,
  sustituirlos por `;`. El parser SQL y el diff no se tocan. Se siguen
  aceptando CSV con `;` (no romper el flujo anterior).
- A validar con un ejemplo **real** (hay que pedirlo al usuario, ver
  "Datos de prueba"): cómo llegan los `METROS` (el CSV usa el punto como
  separador de miles, `5.500` = 5500), celdas con comillas o saltos de
  línea (Excel las envuelve entre comillas), celdas combinadas/filas
  ocultas, y que las 4 secciones apiladas con sus cabeceras sigan
  detectándose igual.

## Mejora 2 — Revisar solo valida (sin tono/calibre)

> **Implementada el 03/10/2026.** `validar_programacion` (base de datos) y el bloque
> «Avisos» de Revisar (`AvisosRevisar.tsx`): repetidas lado a lado sin preselección,
> incompletas (completar o descartar) y líneas ignoradas (informativo); confirmar
> bloqueado mientras haya repetidos sin resolver o incompletas incluidas. Tono y
> calibre salen de Revisar. Detalle en `20`.

**[acordado]** Tras "guardar y comparar" el jefe solo debe poder **validar**:
decir "está bien", o corregir avisos. Tono y calibre salen de este paso.

Avisos que debe mostrar y dejar corregir:

1. **Número de orden repetido.** **[acordado]** Siempre es un error, aunque
   sea en hornos distintos. Suele pasar que una fila está bien y la otra
   tiene campos vacíos o claramente erróneos. La decisión de cuál es la
   buena la toma **el jefe**, no la app: se muestran las dos filas
   juntas, con los campos que difieren resaltados, y elige "quedarme con
   esta" o edita. La app puede **sugerir** la más completa, nunca decidir.
2. **Fila incompleta.** **[acordado]** Número de orden presente pero faltan
   modelo u otros datos.
3. **Líneas descartadas por el parser.** **[propuesta]** Hoy
   `parse_programacion` filtra con `numero_orden ~ '^[0-9]{6,8}$'` y
   descarta el resto en silencio. Conviene avisar de lo descartado que
   *parezca* una orden (tiene contenido en otras columnas pero el número
   no cumple el formato), sin avisar del ruido conocido (huecos `" - "`,
   cabeceras repetidas, notas tipo "CAMBIO DE FORMATO...").

Si no hay avisos: un solo botón de confirmar. El resto de la pantalla
(diff agrupado por horno, "mantener eliminado", "¿Archivo equivocado?
Sustituir", "Deshacer última confirmación") se conserva.

**[acordado e implementado 02/10/2026]** Unicidad: la clave es solo
`numero_orden` (`unique (numero_orden)`, antes `unique (horno,
numero_orden)`); el horno es un dato de la orden. `confirmar_programacion`
rechaza un payload con números de orden repetidos como red de seguridad
del servidor, y `diff_programacion` marca `repetida` sin multiplicar
filas. Una orden que cambia de horno es el estado `cambia_horno` y
conserva tono, calibre y fecha de alta.

## Mejora 3 — Consultar como vista de trabajo

> **Implementada el 03/10/2026** (`ProgramacionConsultar.tsx`, `ConsultarFila.tsx`,
> RPC `actualizar_tono_calibre`). Fecha de alta, «Nueva hoy», filtros, tono/calibre
> editables en la fila, «Copiar nuevas de hoy». Detalle en `20`.

**[acordado]** Tras confirmar, el jefe vuelve a Consultar y ve cómo quedó.
Ahí rellena tono y calibre.

- **Fecha de alta** por fila, visible. **[acordado]**
- Las filas añadidas hoy se destacan (y filtro "solo las de hoy").
  **[acordado]** Motivo: en principio solo las órdenes nuevas tienen tono y
  calibre vacíos, y son las que el jefe tiene que buscar hoy en SAP.
- **Tono y calibre se editan directamente en la fila**, sin pasar por el
  flujo de confirmar. Hoy no hay escritura directa sobre
  `programacion_orden` (solo vía RPC), así que hace falta una RPC nueva
  para jefe/administrador. **[propuesta]**
- **[propuesta]** Botón "copiar números de orden de las nuevas de hoy"
  (una por línea): el jefe hoy copia el número orden a orden hacia SAP.
- Los campos vacíos de tono/calibre deben verse a simple vista (qué falta).
- Validación de formato de tono/calibre: **fuera de esta versión** (ver
  "Aparcado").

## Mejora 4 — Notas por orden

> **Implementada el 03/10/2026** (`programacion_nota`, `programacion_nota_frase` y
> RPC de notas y frases; selección múltiple y diálogo en Consultar; pantalla «Frases» del
> admin). Detalle en `20`.

**[acordado]** Hoy se escriben a mano sobre la hoja impresa de la orden.
Solo el rol **jefe** las escribe (se mantiene también administrador por
coherencia con las demás RPC de programación; confirmar con el usuario).
Se podrán leer en el resto de la app a futuro (la programación se va a
usar más allá de esta pestaña).

- Texto libre **y** frases frecuentes en desplegable. Ejemplos reales:
  "guardar 2 palets y una caja", "recordar sacar palet de revisión",
  "cuidado diseño UGL".
- **Escribir una vez y aplicar a varias órdenes.** **[acordado]** Caso real:
  15 órdenes con la misma nota. Selección múltiple en Consultar (casillas,
  "seleccionar todas las de este horno", filtro "añadidas hoy") y un botón
  "Añadir nota a las seleccionadas".
- **[propuesta]** Modelo de datos:
  - Tabla propia de notas (no una columna en `programacion_orden`): varias
    notas por orden, con texto, autor y fecha. Referenciar por
    `numero_orden` (no por el id de la fila de programación), para que
    sobrevivan a reemplazos y sirvan a otras partes de la app (`lote` ya
    usa `numero_orden`).
  - Tabla de frases frecuentes, editable por admin desde la app, con
    activa/inactiva (misma idea que la pantalla de puntos de engrase).
  - Frases con cantidades ("guardar 2 palets y 1 caja"): el desplegable
    inserta el texto en un campo editable y el jefe cambia el número antes
    de aplicar. No hay que crear una frase por cada cantidad.
  - Escritura solo por RPC (patrón del proyecto); lectura por RLS para
    `jefe, responsable, produccion, administrador`.
- **No** entra en la primera versión: avisos fijos por diseño o caja
  ("cuidado diseño UGL" aplicado automáticamente a toda orden con ese
  diseño). Se reevalúa si el jefe sigue escribiendo las mismas notas.

## Datos de prueba que faltan

- Una muestra **real** de celdas copiadas desde un correo del Excel diario
  y pegadas en un bloc de notas (para validar la Mejora 1, sobre todo
  `METROS`, comillas y la columna anterior a «Nº ORDEN»). **Sigue sin existir.**
  Pista, no prueba: en los CSV reales guardados METROS llega como `" 4.500   "`
  (punto de miles y espacios) y otras columnas usan coma decimal (`9,4`).
- Un caso real de número de orden duplicado (una fila buena y otra rota)
  para probar la Mejora 2. Hay uno real, `1114132` en las programaciones del 29 y
  30/09/2026, pero con las **dos filas idénticas**; el caso «buena y rota» sigue
  sin ejemplo real (se probó con datos sintéticos).

## Aparcado (se habló pero no entra ahora)

Se dejó por escrito para no perderlo; **no implementar** sin una
conversación nueva.

- **Hoja de partida digital (antes "Foto 1").** Idea: que SAP deje de
  imprimirse/fotografiarse, y que el responsable elija la hoja en la app.
  Fases propuestas: (1) quitar el copiar-pegar orden a orden en SAP,
  (2) guardar el PDF en la app asociado a `numero_orden`, (3) que el
  responsable la use para empezar el lote. `Foto 1` hoy alimenta
  `resolver-catalogo`; habría que conservarla como plan B hasta probar lo
  nuevo.
- **SAP.** En SAP la pantalla no admite pegar varias órdenes a la vez
  (el usuario lo probó). Flujo manual actual: copiar orden, pegar,
  elegir clasificación (solo la primera vez), ejecutar, generar documento,
  imprimir, volver, repetir; a veces 30 órdenes. Candidato: script con
  **SAP GUI Scripting** en el PC de transmitir modelos (tiene SAP GUI; el
  PC de oficina entra por navegador, donde no aplica). Pendiente de
  confirmar: que el scripting esté habilitado en el servidor y en el
  cliente (Alt+F12 muestra la grabación de scripts) y el visto bueno de IT.
- **Diseño de caja (PDF).** Es la imagen que va impresa en la caja, no el
  azulejo. Un solo PDF por marca+formato. Cada línea tiene un PC que
  carga una "receta" con el diseño de los 4 cabezales a partir de BMP.
  Idea: enlazar el diseño por el campo `CAJA` del Excel y mostrar al
  responsable qué receta/BMP cargar.
- **SASO (código de barras).** Hoy se consulta en una tabla impresa que
  hizo el usuario (marca+formato+acabado+SASO). Hallazgos del inventario
  de 233 txt (`inventario_saso.csv`):
  - Cada txt tiene una línea: `(EAN13): 8435592099972` o
    `(CODE128): 0200312000`; el formato varía (con/sin paréntesis, con/sin
    dos puntos). 177 EAN13 (13 dígitos), 42 CODE128 (10 dígitos).
  - 114 archivos SASO distintos; existe una carpeta central `saso` con
    los 114 y las carpetas de diseño tienen las mismas copias (más 5 en
    subcarpetas `_2024`); coinciden todos.
  - Solo 37 códigos distintos: el SASO depende sobre todo de marca y
    acabado/variante, casi no del formato (p. ej. Cifre mate usa el mismo
    código en 20x120, 30x120, 60x120, 60x60 y 120x120; Cifre brillo otro;
    Argenta mate y Argenta mate UGL son distintos).
  - Dos casos a revisar contra la etiqueta real:
    `20X120_TERRA_SURFACES_MATE_SL_5PZ_REC_F5_4_SASO.txt` trae
    `84355920555329` (14 dígitos; las otras 8 de Terra Surfaces tienen
    `8435592055329`) y `120x120_SL_COLORKER_MATE_REC_F5_SASO.txt` está como
    CODE128 con 13 dígitos (`8431738101000`, no cumple dígito de control
    EAN13).
  - Este inventario solo lista carpetas **con** txt: no muestra diseños
    sin SASO (en los BMP aparecen muchas carpetas OKER y no hay txt de
    OKER).
  - Falta saber cómo llegan `MODELO`/`ACABADO`/`CAJA` en el Excel diario
    para saber cómo se buscaría el SASO de una orden.
- **Estructura de la carpeta de diseños.** Una carpeta por diseño
  (`60x120 ARGENTA MATE SL REC_181223`, el sufijo parece fecha ddmmaa), con
  BMP numerados, un PDF y un txt de SASO. Los nombres los pone el
  departamento de diseño y no son consistentes (orden de palabras,
  mayúsculas, erratas como `FIILIPINAS`, `5PZ` vs `7PZAS`); el nombre de
  archivo solo no sirve de clave, la carpeta sí.
- Validación de formato de **tono y calibre** (calibre ∈ `{3, 4, 44, SC}`,
  tono = letra `M/X/R` + número) — sigue sin validar con las normas reales.

## Estado de implementación

| Pieza | Estado |
|---|---|
| `fecha_alta` en `programacion_orden` (null en las 39 existentes; la fija `confirmar` al insertar; la conserva `deshacer`) | **Hecho 02/10/2026** (`20261002164859`) |
| Clave `unique (numero_orden)`, `cambia_horno`, rechazo de repetidos en `confirmar` | **Hecho 02/10/2026** |
| Frontend de Revisar: `cambia_horno` informativo + bloqueo si hay repetidas | **Hecho 02/10/2026** |
| Mensaje de resultado visible tras confirmar/deshacer (bug previo) | Hecho 02/10/2026, pendiente de ver en UI |
| Cierre de acceso a `programacion_orden` (RLS) | **Hecho 02/10/2026** (`20261002131613`), ver 20 |
| `actualizar_tono_calibre` (identifica por `numero_orden`, no por `id`: los `id` cambian en deshacer) | **Hecho 03/10/2026** (`20261003020941`) |
| `validar_programacion(fecha)` (devuelve las filas crudas de cada repetido) y pantalla de resolución de duplicados | **Hecho 03/10/2026** (`20261003021650`; resolución en Revisar) |
| Notas por orden y frases frecuentes (tablas con RLS + RPC) | **Hecho 03/10/2026** (`20261003021449`) |
| Consultar: `fecha_alta`, «Nueva hoy», filtros, edición de tono/calibre, copiar nuevas, notas con selección múltiple | **Hecho 03/10/2026** |
| Pantalla «Frases» del administrador | **Hecho 03/10/2026** |
| Quitar tono/calibre de Revisar | **Hecho 03/10/2026** |
| Pegado de celdas de Excel (tabuladores) | **Hecho 03/10/2026**; verificado con una muestra real reconstruida (falta el archivo original) |
| Pasada de UI con el usuario (fase D) | Pendiente; guion en `privado/backups/guion_pasada_ui_programacion.md` |

Decisiones tomadas en la implementación: `fecha_alta` en `null` para las
existentes (la UI mostrará "—" y no las marca como de hoy);
`actualizar_tono_calibre` identifica por `numero_orden`; las tablas nuevas
(notas, frases) salen con RLS desde su creación.

## Orden de implementación sugerido

1. Migraciones de base de datos (fecha de alta, notas y frases, RPC de
   edición de tono/calibre y de notas, unicidad de `numero_orden`,
   validaciones en `confirmar_programacion`).
2. Pantalla **Consultar** (Mejoras 3 y 4).
3. Flujo **Revisar** (Mejora 2) y **pegado de celdas** (Mejora 1).
