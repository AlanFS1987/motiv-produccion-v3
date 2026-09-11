-- Borrador -- Sacabandejas (BS08). Para revision antes de aplicar.
-- Fuente: bs08-subsistema-carton.md, seccion "2. Sacabandejas".

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- -- PROCESO --------------------------------------------------------
('bs08.sacabandejas.proceso.01_recogida', 'BS08', 'Sacabandejas', 'proceso',
 '1. Recogida del carton en el almacen',
 'Brazo movil con ventosas que se mueve transversalmente sobre la '
 'maquina. Hay dos almacenes de carton, uno a cada lado (izquierdo y '
 'derecho), cada uno con su propio angulo. El carton esta colocado '
 'casi en vertical en ambos almacenes; las ventosas lo cogen en '
 'vertical y lo sueltan en horizontal -- por eso el giro de las '
 'ventosas no es completo, ronda los 90 grados (la configuracion de '
 'rotacion se ajusta en decimas de grado, nunca llega a los 360 '
 'grados). En la propia barra hay una fotocelula: "bandeja a '
 'bordo".'),

('bs08.sacabandejas.proceso.02_desplazamiento_deposito', 'BS08', 'Sacabandejas', 'proceso',
 '2. Desplazamiento y deposito sobre las guias',
 'El sacabandejas va, segun la pila que entra en la empaquetadora, '
 'al almacen correspondiente al codigo de esa pila (tipo de carton). '
 'Va al almacen, coge el carton, y se desplaza horizontalmente hasta '
 'la cota de deposito, ajustando el angulo durante el trayecto (el '
 'carton se deposita en horizontal sobre las guias). Al llegar a la '
 'cota de deposito, se detiene la alimentacion de los venturis y se '
 'suelta el carton sobre las guias.'),

('bs08.sacabandejas.proceso.03_por_que_dos_almacenes', 'BS08', 'Sacabandejas', 'proceso',
 'Por que hay dos almacenes',
 'No es para acumular mas carton y aguantar mas tiempo sin reponer '
 '-- es para tener dos tipos de carton disponibles a la vez '
 '(tipicamente 1a y comercial). Logica de uso: el sacabandejas va, '
 'segun la pila que entra, al almacen correspondiente al codigo de '
 'esa pila. Un operario siempre esta entre dos lineas -- para la '
 'linea que tiene a su derecha usa el almacen izquierdo de la '
 'maquina, y para la que tiene a su izquierda, el derecho. Cual se '
 'usa mas depende de la posicion del operario respecto a sus dos '
 'lineas.'),

-- -- PARAMETRO ------------------------------------------------------
('bs08.sacabandejas.parametro.distancia_almacen_izquierdo', 'BS08', 'Sacabandejas', 'parametro',
 'Distancia almacen (izquierdo, relativo al derecho)',
 'El almacen derecho tiene el sensor de cero (posicion 0). El '
 'izquierdo es relativo a ese cero -- nominalmente ~1.600 mm, aunque '
 'en la practica es habitual encontrarlo entre 1.680 y 1.730 mm, '
 'segun donde este fisicamente el sensor.'),

('bs08.sacabandejas.parametro.offset_calibracion_traslacion', 'BS08', 'Sacabandejas', 'parametro',
 'Offset de calibracion (traslacion)',
 'En el almacen derecho (el del sensor de cero): define cuanto puede '
 'pasar del sensor para que la pieza metalica lo cubra por completo '
 '-- en teoria bastan ~10 mm, pero el ajuste permite hasta 30 mm.'),

('bs08.sacabandejas.parametro.offset_calibracion_rotacion', 'BS08', 'Sacabandejas', 'parametro',
 'Offset de calibracion (rotacion)',
 'Permite hasta 10 grados de ajuste; habitualmente configurado en '
 '100 (=10 grados en decimas), para cubrir del todo el sensor '
 'inductivo de calibracion de rotacion.'),

('bs08.sacabandejas.parametro.angulo_almacen_derecho', 'BS08', 'Sacabandejas', 'parametro',
 'Angulo almacen derecho',
 'Uno de los tres angulos configurables (derecho, izquierdo, y el '
 'del deposito). Rango total de configuracion: 0 a 2.300 decimas de '
 'grado (~230 grados). Habitual: entre 0 y 150 (0-15 grados).'),

('bs08.sacabandejas.parametro.angulo_almacen_izquierdo', 'BS08', 'Sacabandejas', 'parametro',
 'Angulo almacen izquierdo',
 'Habitual: entre 2.100 y 2.300 decimas de grado (210-230 grados). '
 'Mismo rango total de configuracion que el almacen derecho: 0 a '
 '2.300.'),

('bs08.sacabandejas.parametro.tolerancia_posicion', 'BS08', 'Sacabandejas', 'parametro',
 'Tolerancia de posicion',
 'Configurable, normalmente al maximo (15 mm) para evitar problemas. '
 'Al ser un motor convencional con encoder real (no paso a paso, por '
 'tanto no perfectamente preciso), si se pasa 5-10 mm no ocurre '
 'nada, e incluso a 15 mm tampoco. Solo si se supera esa tolerancia '
 'de 15 mm, la maquina se para -- no esta confirmado que de una '
 'alarma explicita; segun el mecanico, simplemente se detiene y se '
 'retira el carton para repetir el proceso. Principio general '
 '(valido para casi toda la seccion): cuanta mas velocidad, menos '
 'precision -- si un movimiento necesita ser mas preciso, tiene que '
 'ir mas despacio. Es la explicacion por defecto de por que se '
 'supera una tolerancia de posicion como esta, antes de sospechar de '
 'un fallo mecanico real.'),

('bs08.sacabandejas.parametro.velocidad_lenta', 'BS08', 'Sacabandejas', 'parametro',
 'Velocidad lenta',
 'Entre 10 y 20 Hz. Se usa en los dos tramos criticos: al acercarse '
 'al almacen, y al depositar sobre las guias.'),

('bs08.sacabandejas.parametro.velocidad_rapida', 'BS08', 'Sacabandejas', 'parametro',
 'Velocidad rapida',
 'Entre 40 y 60 Hz. Se usa en el tramo intermedio, entre los dos '
 'tramos lentos.'),

-- -- SENSOR --------------------------------------------------------
('bs08.sacabandejas.sensor.fotocelula_almacen', 'BS08', 'Sacabandejas', 'sensor',
 'Fotocelula del almacen de bandejas',
 'Detecta la presencia de carton en el almacen. Si deja de leer '
 'carton, dispara la alarma "Almacen bandejas: faltan bandejas".'),

('bs08.sacabandejas.sensor.fotocelula_bandeja_bordo', 'BS08', 'Sacabandejas', 'sensor',
 'Fotocelula "bandeja a bordo"',
 'Situada en la propia barra del sacabandejas -- confirma que el '
 'carton va cogido durante el desplazamiento.'),

('bs08.sacabandejas.sensor.cero_almacen_derecho', 'BS08', 'Sacabandejas', 'sensor',
 'Sensor de cero (almacen derecho)',
 'Define la posicion 0 de traslacion; el almacen izquierdo se mide '
 'relativo a este.'),

('bs08.sacabandejas.sensor.inductivo_rotacion', 'BS08', 'Sacabandejas', 'sensor',
 'Sensor inductivo de calibracion de rotacion',
 'Lee el offset de calibracion de rotacion (ver parametro '
 'correspondiente).'),

-- -- ACTUADOR -------------------------------------------------------
('bs08.sacabandejas.actuador.motor_trifasico', 'BS08', 'Sacabandejas', 'actuador',
 'Motor trifasico convencional (con encoder)',
 'Rotor en jaula de ardilla, sin escobillas, con encoder -- conoce su '
 'posicion en todo momento. Precision: milimetros. A diferencia de '
 'los motores paso a paso (Divisor, Elevador, empujador de carton), '
 'este SI lleva encoder.'),

('bs08.sacabandejas.actuador.ventosas', 'BS08', 'Sacabandejas', 'actuador',
 'Ventosas',
 'Cogen el carton en vertical en el almacen y lo sueltan en '
 'horizontal sobre las guias -- por eso su giro no es completo, '
 'ronda los 90 grados. Alimentadas por venturis, que se desconectan '
 'al llegar a la cota de deposito para soltar el carton.'),

-- -- ALARMA (solo que es / que la dispara, sin resolucion) --------
('bs08.sacabandejas.alarma.bandeja_perdida', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: bandeja perdida',
 'Salta si el carton se cae durante el desplazamiento del '
 'sacabandejas hacia el deposito.'),

('bs08.sacabandejas.alarma.faltan_bandejas', 'BS08', 'Sacabandejas', 'alarma',
 'Almacen bandejas: faltan bandejas',
 'Salta cuando la fotocelula del almacen deja de leer carton.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();