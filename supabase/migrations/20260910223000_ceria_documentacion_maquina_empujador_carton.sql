-- Borrador -- Empujador de bandejas (BS08). Para revision antes de aplicar.
-- Fuente: bs08-subsistema-carton.md, secciones "4. Empujador de
-- bandejas" y "4bis. Bloqueo de bandejas", + un par de datos
-- constructivos de bs08-pantalla-maquina-datos-constructivos.md.

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- -- PROCESO --------------------------------------------------------
('bs08.empujador_bandejas.proceso.01_posiciones', 'BS08', 'Empujador de bandejas', 'proceso',
 '1. Recogida y posiciones configurables',
 'Gestionado, en la mayoria de las lineas, por un unico motor paso a '
 'paso. Tres posiciones configurables: Posicion 0 (atras del todo, '
 'es donde el empujador calibra), Posicion de espera (algo mas '
 'adelantada que la posicion 0, para que el carton caiga cerca del '
 'empujador sin llegar a caerle encima), y Posicion de final de '
 'empuje (hasta donde empuja el carton dentro del mandril).'),

('bs08.empujador_bandejas.proceso.02_mecanismo_cola', 'BS08', 'Empujador de bandejas', 'proceso',
 '2. Mecanismo de cola',
 'Al empezar a empujar, el empujador pasa por debajo de una '
 'fotocelula conectada a las electrovalvulas del calderin de cola '
 '(el deposito de cola). La posicion de los "tiros de cola" se '
 'programa en funcion de lo que detecta el propio motor del '
 'empujador -- asi la caja se pega correctamente mas adelante -- y '
 'el carton sigue avanzando hasta el final del mandril. Al final del '
 'recorrido hay otra fotocelula que confirma si el carton alcanzo el '
 'mandril.'),

('bs08.empujador_bandejas.proceso.03_cierre_ciclo', 'BS08', 'Empujador de bandejas', 'proceso',
 '3. Secuencia de cierre del ciclo',
 'Una vez el carton llega al final (la fotocelula del mandril lo '
 'confirma), el empujador de bandejas retrocede. Solo cuando supera '
 'una posicion programada llamada "cota obstaculo bandeja", el '
 'mandril tiene permiso para empezar a bajar -- es la forma de '
 'asegurar que el empujador ya no estorba antes de que el mandril se '
 'mueva.'),

('bs08.empujador_bandejas.proceso.04_bloqueo_bandejas', 'BS08', 'Empujador de bandejas', 'proceso',
 '4. Bloqueo de bandejas (interlock de seguridad del mandril)',
 'Antes de que el mandril empiece a bajar, unos pequenos pistones '
 'con silentblocks aseguran el carton en su sitio -- esto ocurre en '
 'cuanto el carton llega a la cota final del mandril y la fotocelula '
 'detecta que esta en posicion para bajar (se asegura ANTES de '
 'empezar a bajar). Si ese piston no esta en la posicion correcta '
 '(contraido), no se permite al empujador de bandejas empujar el '
 'siguiente carton hacia el mandril.'),

-- -- PARAMETRO ------------------------------------------------------
('bs08.empujador_bandejas.parametro.posicion_0', 'BS08', 'Empujador de bandejas', 'parametro',
 'Posicion 0',
 'Atras del todo -- es donde el empujador calibra.'),

('bs08.empujador_bandejas.parametro.posicion_espera', 'BS08', 'Empujador de bandejas', 'parametro',
 'Posicion de espera',
 'Algo mas adelantada que la posicion 0, para que el carton caiga '
 'cerca del empujador sin llegar a caerle encima.'),

('bs08.empujador_bandejas.parametro.posicion_final_empuje', 'BS08', 'Empujador de bandejas', 'parametro',
 'Posicion de final de empuje',
 'Hasta donde empuja el carton dentro del mandril.'),

('bs08.empujador_bandejas.parametro.velocidad_avance', 'BS08', 'Empujador de bandejas', 'parametro',
 'Velocidad de avance',
 'Motor paso a paso, en steps/s. Valores de fabrica: 6.000 = lenta, '
 '9.000 = rapida -- aqui se tiene siempre configurado en rapida: '
 '9.000.'),

('bs08.empujador_bandejas.parametro.velocidad_retroceso', 'BS08', 'Empujador de bandejas', 'parametro',
 'Velocidad de retroceso',
 'Mismo valor que el avance en esta linea: 9.000 steps/s (rapida).'),

('bs08.empujador_bandejas.parametro.aceleracion', 'BS08', 'Empujador de bandejas', 'parametro',
 'Aceleracion',
 'No esta claro que determina exactamente el parametro, pero en la '
 'practica el tiempo de aceleracion resulta de dividir 5 entre el '
 'numero configurado -- ej. valor 5 -> 1 segundo de aceleracion; '
 'valor 2 -> 2,5 segundos; valor 1 -> 5 segundos. Maximo '
 'configurable: 30. Valor habitual aqui: 9.'),

('bs08.empujador_bandejas.parametro.cota_obstaculo_bandeja', 'BS08', 'Empujador de bandejas', 'parametro',
 'Cota obstaculo bandeja',
 'Posicion que el empujador debe superar al retroceder para que el '
 'mandril tenga permiso de empezar a bajar -- asegura que el '
 'empujador ya no estorba antes de que el mandril se mueva.'),

('bs08.empujador_bandejas.parametro.comunicacion_inverter_dir24', 'BS08', 'Empujador de bandejas', 'parametro',
 'Comunicacion inverter -- direccion 24',
 'Dato constructivo: confirma que el empujador de bandejas lleva '
 'variador de frecuencia direccionado por bus (no solo arranque '
 'directo). Capturado en Si.'),

('bs08.empujador_bandejas.parametro.disabilita_spintore_vassoio', 'BS08', 'Empujador de bandejas', 'parametro',
 'Disabilita spintore vassoio',
 'Dato constructivo, termino en italiano sin traducir en el software '
 '("spintore vassoio" = empujador de bandeja) -- confirma que el '
 'software viene de un OEM italiano. Capturado en No, es decir, el '
 'empujador de bandejas SI esta habilitado/instalado en esta '
 'maquina.'),

-- -- ACTUADOR -------------------------------------------------------
('bs08.empujador_bandejas.actuador.motor_paso_a_paso', 'BS08', 'Empujador de bandejas', 'actuador',
 'Motor paso a paso (empujador de bandejas)',
 'Gestiona las tres posiciones (0, espera, final de empuje). '
 'Velocidad y aceleracion configurables por separado para avance y '
 'retroceso.'),

('bs08.empujador_bandejas.actuador.electrovalvulas_calderin_cola', 'BS08', 'Empujador de bandejas', 'actuador',
 'Electrovalvulas del calderin de cola',
 'Activadas segun lo que detecta la fotocelula del mecanismo de '
 'cola, sincronizadas con el propio motor del empujador, para '
 'programar los "tiros de cola" que pegan la caja correctamente.'),

('bs08.empujador_bandejas.actuador.pistones_silentblocks', 'BS08', 'Empujador de bandejas', 'actuador',
 'Pistones con silentblocks (bloqueo de bandejas)',
 'Aseguran el carton en su sitio antes de que el mandril empiece a '
 'bajar. Si no estan contraidos (posicion correcta), bloquean que el '
 'empujador de bandejas empuje el siguiente carton.'),

-- -- PIEZA ----------------------------------------------------------
('bs08.empujador_bandejas.pieza.calderin_cola', 'BS08', 'Empujador de bandejas', 'pieza',
 'Calderin de cola (deposito de cola)',
 'Deposito de cola conectado a las electrovalvulas que activa la '
 'fotocelula del mecanismo de cola al pasar el empujador.'),

-- -- SENSOR ---------------------------------------------------------
('bs08.empujador_bandejas.sensor.fotocelula_mecanismo_cola', 'BS08', 'Empujador de bandejas', 'sensor',
 'Fotocelula del mecanismo de cola',
 'Detecta el paso del empujador para activar las electrovalvulas del '
 'calderin de cola y programar los "tiros de cola".'),

('bs08.empujador_bandejas.sensor.fotocelula_confirmacion_mandril', 'BS08', 'Empujador de bandejas', 'sensor',
 'Fotocelula de confirmacion en el mandril',
 'Al final del recorrido del empujador, confirma si el carton '
 'alcanzo el mandril. Si no lee el carton, dispara la alarma '
 '"Mandril: faltan bandejas".'),

('bs08.empujador_bandejas.sensor.fotocelula_posicion_bajar', 'BS08', 'Empujador de bandejas', 'sensor',
 'Fotocelula de posicion para bajar (bloqueo de bandejas)',
 'Detecta que el carton ha llegado a la cota final del mandril y '
 'esta en posicion para que el mandril pueda bajar -- dispara que '
 'los pistones con silentblocks aseguren el carton ANTES de que '
 'empiece a bajar.'),

-- -- ALARMA (solo que es / que la dispara, sin resolucion) --------
('bs08.empujador_bandejas.alarma.mandril_faltan_bandejas', 'BS08', 'Empujador de bandejas', 'alarma',
 'Mandril: faltan bandejas',
 'Salta si, tras empujar, la fotocelula de confirmacion en el '
 'mandril no llega a leer el carton.'),

('bs08.empujador_bandejas.alarma.bloqueo_bandejas', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador carton: bloqueo bandejas',
 'Salta si el piston del bloqueo de bandejas no esta en la posicion '
 'correcta (contraido) -- no se permite empujar el siguiente carton '
 'hacia el mandril hasta resolverlo.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();