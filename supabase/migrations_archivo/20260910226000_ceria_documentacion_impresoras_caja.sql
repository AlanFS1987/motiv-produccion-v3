-- Borrador -- Cabezales de impresion (BS08). Para revision antes de aplicar.
-- Fuente: bs08-subsistema-impresion.md.

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- -- PROCESO --------------------------------------------------------
('bs08.cabezales_impresion.proceso.01_distribucion_formato', 'BS08', 'Cabezales de impresión', 'proceso',
 '1. Distribucion de cabezales segun formato',
 'Hardware marca TopJet: 4 cabezales de impresion conectados a 2 '
 'consolas, y estas 2 consolas a un PC con Windows, con el software '
 'propio del fabricante. Formatos de tablilla: normalmente solo 2 '
 'cabezales superiores -- uno imprime la marca, el otro los detalles '
 '(especificaciones, modelo, tono, calibre, codigos de barras, '
 'fecha). Si la marca ya viene impresa en el carton, se usa solo 1 '
 'cabezal superior. Resto de formatos: normalmente 3 cabezales '
 'superiores + 1 lateral. El lateral imprime modelo/tono/calibre/'
 'codigos de barras/fecha; los superiores imprimen especificaciones, '
 'marca, logos y demas.'),

('bs08.cabezales_impresion.proceso.02_flujo_datos', 'BS08', 'Cabezales de impresión', 'proceso',
 '2. Flujo de datos e impresion',
 'El PC de las impresoras recibe los datos de partida desde el '
 'ordenador de transmitir (en el centro de la seccion): modelo, '
 'tono, calibre y codigo de barras del modelo -- son variables que '
 'el software puede colocar donde haga falta dentro del diseno. Los '
 'elementos fijos (logos, especificaciones) existen como imagenes '
 'BMP. El diseno completo para una marca se guarda como "receta"; '
 'cada cabezal guarda su diseno en un archivo TIFF. Al repetir esa combinacion de marca+formato, se carga desde '
 'ahi; los parametros variables (modelo/tono/calibre/etc.) se siguen '
 'enviando caja a caja desde el ordenador central. El PC de las '
 'impresoras tambien recibe si la caja que va a pasar es de 1a o '
 'comercial -- dentro de un mismo modelo, el material de 1a y el de '
 'comercial suelen llevar marca/impresion distintas.'),

-- -- PARAMETRO -- codigos de impresion -----------------------------
('bs08.cabezales_impresion.parametro.codigos_1a_1a', 'BS08', 'Cabezales de impresión', 'parametro',
 'Codigos de impresion 1 a 4 (calibre de material de 1a)',
 'Hasta 6 codigos configurables en total, aunque en la practica se '
 'usan 3 principales por calibre. Los codigos 1 a 4 corresponden al '
 'calibre de material de 1a (1/2/3/4) -- el dato se lo envia el '
 'sistema de la empaquetadora (BS08). En la practica, casi siempre '
 'es calibre 3 (el material de rectificado siempre deberia salir en '
 'calibre 3) -- las excepciones son raras, menos de 2 veces al ano.'),

('bs08.cabezales_impresion.parametro.codigo_5_comercial', 'BS08', 'Cabezales de impresión', 'parametro',
 'Codigo de impresion 5 (material comercial)',
 'No lleva calibre.'),

('bs08.cabezales_impresion.parametro.codigo_6_vacio', 'BS08', 'Cabezales de impresión', 'parametro',
 'Codigo de impresion 6 (vacio)',
 'Para cuando se sacan pilas de material de desecho sin caja, '
 'directamente colocadas en un palet.'),

-- -- PIEZA ----------------------------------------------------------
('bs08.cabezales_impresion.pieza.botella_tinta', 'BS08', 'Cabezales de impresión', 'pieza',
 'Botella de tinta',
 'Deposito de 1 litro, uno por cabezal.'),

('bs08.cabezales_impresion.pieza.filtro', 'BS08', 'Cabezales de impresión', 'pieza',
 'Filtro (entrada y retorno)',
 'La tinta pasa por un filtro con sentido de paso al ir hacia el '
 'cabezal -- ademas de filtrar, actua como antirretorno. La tinta '
 'sobrante del deposito interno del cabezal vuelve por otro tubo a '
 'la botella deposito, pasando antes por otro filtro igual que el '
 'de entrada.'),

('bs08.cabezales_impresion.pieza.tubo_tinta', 'BS08', 'Cabezales de impresión', 'pieza',
 'Tubo de tinta',
 'Conecta la botella de tinta con el cabezal (y el retorno del '
 'sobrante). Fallo mecanico habitual: se puede pinzar durante el '
 'posicionamiento manual-mecanico de los cabezales.'),

('bs08.cabezales_impresion.pieza.cable_conector_consola', 'BS08', 'Cabezales de impresión', 'pieza',
 'Cable/conector cabezal-consola',
 'Conector grande, parecido a los antiguos puertos de impresora '
 '(tipo Centronics/paralelo). Fallo mecanico habitual: se puede '
 'desconectar parcialmente durante el posicionamiento manual-'
 'mecanico de los cabezales.'),

-- -- ACTUADOR -------------------------------------------------------
('bs08.cabezales_impresion.actuador.bomba_tinta', 'BS08', 'Cabezales de impresión', 'actuador',
 'Bomba de tinta',
 'Una por cabezal. Bombea la tinta desde la botella deposito hasta '
 'el cabezal.'),

('bs08.cabezales_impresion.actuador.cabezal_topjet', 'BS08', 'Cabezales de impresión', 'actuador',
 'Cabezal de impresion TopJet',
 'Hasta 4 por maquina (posicionados segun formato -- ver proceso). '
 'Su posicion sobre la caja se ajusta de forma manual-mecanica.'),

-- -- SENSOR ---------------------------------------------------------
('bs08.cabezales_impresion.sensor.fotocelula_cabezal', 'BS08', 'Cabezales de impresión', 'sensor',
 'Fotocelula (una por cabezal)',
 'Permite ajustar el retraso de impresion de forma independiente por '
 'cabezal, para centrar la impresion sobre la caja.'),

-- -- ALARMA (fallos habituales -- solo que es/que lo dispara) ------
('bs08.cabezales_impresion.alarma.circuito_con_aire', 'BS08', 'Cabezales de impresión', 'alarma',
 'Circuito de tinta con aire',
 'Si el circuito de tinta coge aire, la impresora deja de imprimir, '
 'o imprime borroso o parcial.'),

('bs08.cabezales_impresion.alarma.tubo_pinzado', 'BS08', 'Cabezales de impresión', 'alarma',
 'Tubo de tinta pinzado',
 'Fallo mecanico habitual por el posicionamiento manual-mecanico de '
 'los cabezales -- uno de los tubos de tinta puede quedar pinzado.'),

('bs08.cabezales_impresion.alarma.cable_desconectado', 'BS08', 'Cabezales de impresión', 'alarma',
 'Cable cabezal-consola desconectado',
 'Fallo mecanico habitual por el posicionamiento manual-mecanico de '
 'los cabezales -- el cable/conector (tipo Centronics/paralelo) '
 'puede desconectarse parcialmente.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();