-- Borrador -- Mandril (BS08). Para revision antes de aplicar.
-- Fuente: bs08-subsistema-carton.md, seccion "5. Mandril", + dato
-- constructivo de bs08-pantalla-maquina-datos-constructivos.md.

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- -- PROCESO --------------------------------------------------------
('bs08.mandril.proceso.01_descenso_envoltura', 'BS08', 'Mandril', 'proceso',
 '1. Descenso y envoltura',
 'Una vez el carton esta bien posicionado (empujado por el '
 'empujador de bandejas hasta el final del mandril), el mandril baja '
 'con el sobre la pila que esta en el elevador, envolviendola por la '
 'parte superior y los laterales -- falta cerrarla con las solapas '
 'de abajo (ver Jaula).'),

('bs08.mandril.proceso.02_estructura_contrapeso', 'BS08', 'Mandril', 'proceso',
 '2. Estructura y contrapeso',
 'El mandril son realmente dos motores paso a paso pequenos, uno a '
 'cada lado -- cada guia es independiente, aunque van sincronizadas. '
 'Es una prolongacion movil de las guias del almacen de carton (esas '
 'guias son fijas; esta parte, no). Tiene unos pistones que actuan '
 'de contrapeso, para que el mandril no caiga y esos motores '
 'pequenos puedan aguantar la posicion alta sin esfuerzo excesivo.'),

('bs08.mandril.proceso.03_posiciones_nivelado', 'BS08', 'Mandril', 'proceso',
 '3. Posiciones y nivelado',
 'El mandril conoce su posicion en milimetros. La posicion abajo '
 '(donde envuelve la caja) es siempre la posicion 0. La posicion '
 'arriba es configurable -- habitualmente entre 320 y 350 mm -- y si '
 'que hay que reajustarla de vez en cuando segun el estado del '
 'carton: si el carton viene un poco doblado hacia arriba, interesa '
 'subir algo la posicion alta para que encare bien y pase con '
 'fluidez sin engancharse. Cada uno de los dos motores tiene su '
 'propio sensor de calibrado en la parte inferior; la posicion de '
 'ese sensor determina tambien la cota de arriba, que debe ser la '
 'misma en los dos lados. Esto importa porque el mandril tiene que '
 'quedar razonablemente nivelado -- se permite cierta tolerancia de '
 'error, pero lo ideal es que los dos lados queden lo mas igualados '
 'posible, ajustando la posicion del sensor inferior de cada lado '
 'por separado.'),

('bs08.mandril.proceso.04_calibrado', 'BS08', 'Mandril', 'proceso',
 '4. Calibrado',
 'Se realiza en la posicion inferior -- posicion 0 mas el offset de '
 'calibracion -- mediante un sensor inductivo que lee una pieza '
 'metalica del propio mandril (mismo tipo de mecanismo que el offset '
 'de calibracion del sacabandejas).'),

-- -- PARAMETRO ------------------------------------------------------
('bs08.mandril.parametro.posicion_arriba', 'BS08', 'Mandril', 'parametro',
 'Posicion arriba',
 'Configurable, habitualmente entre 320 y 350 mm. Se reajusta de vez '
 'en cuando segun el estado del carton: si viene un poco doblado '
 'hacia arriba, interesa subir algo esta posicion para que encare '
 'bien y pase con fluidez sin engancharse. La posicion abajo (donde '
 'envuelve la caja) es siempre 0, no configurable.'),

('bs08.mandril.parametro.offset_calibracion', 'BS08', 'Mandril', 'parametro',
 'Offset de calibracion',
 'Se aplica sobre la posicion 0 (abajo) para el calibrado, via '
 'sensor inductivo -- mismo tipo de mecanismo que el offset de '
 'calibracion del sacabandejas. La posicion del sensor determina '
 'tambien la cota de arriba, que debe coincidir en ambos lados para '
 'que el mandril quede nivelado.'),

('bs08.mandril.parametro.velocidad_subida', 'BS08', 'Mandril', 'parametro',
 'Velocidad subida',
 'Valor: 9.000 (misma velocidad que el empujador de carton).'),

('bs08.mandril.parametro.velocidad_bajada', 'BS08', 'Mandril', 'parametro',
 'Velocidad bajada',
 'Valor: 9.000.'),

('bs08.mandril.parametro.aceleracion', 'BS08', 'Mandril', 'parametro',
 'Aceleracion',
 'Valor: 9. Igual que el empujador de carton -- misma formula que el '
 'resto de motores paso a paso de la maquina (tiempo de aceleracion '
 '= 5 dividido entre el valor programado).'),

('bs08.mandril.parametro.disabilita_mandrino', 'BS08', 'Mandril', 'parametro',
 'Disabilita mandrino',
 'Dato constructivo, termino en italiano sin traducir en el software '
 '("mandrino" = mandril). Capturado en No, es decir, el mandril SI '
 'esta habilitado/instalado en esta maquina.'),

-- -- ACTUADOR -------------------------------------------------------
('bs08.mandril.actuador.motor_paso_a_paso', 'BS08', 'Mandril', 'actuador',
 'Motor paso a paso (x2, uno a cada lado)',
 'Pequenos, uno por cada guia del mandril -- guias independientes '
 'pero sincronizadas entre si.'),

('bs08.mandril.actuador.pistones_contrapeso', 'BS08', 'Mandril', 'actuador',
 'Pistones de contrapeso',
 'Evitan que el mandril caiga por su propio peso, para que los '
 'motores pequenos puedan aguantar la posicion alta sin esfuerzo '
 'excesivo.'),

-- -- PIEZA ----------------------------------------------------------
('bs08.mandril.pieza.guias_moviles', 'BS08', 'Mandril', 'pieza',
 'Guias moviles del mandril',
 'Prolongacion movil de las guias del almacen de carton -- esas '
 'guias son fijas, esta parte no. Es lo que baja para envolver la '
 'pila.'),

('bs08.mandril.pieza.pieza_metalica_calibrado', 'BS08', 'Mandril', 'pieza',
 'Pieza metalica de calibrado',
 'Leida por el sensor inductivo de cada lado durante el calibrado en '
 'la posicion inferior.'),

-- -- SENSOR ---------------------------------------------------------
('bs08.mandril.sensor.inductivo_calibrado', 'BS08', 'Mandril', 'sensor',
 'Sensor inductivo de calibrado (x2, uno por lado)',
 'En la parte inferior de cada motor. Lee la pieza metalica del '
 'propio mandril durante el calibrado (posicion 0 + offset). Su '
 'posicion fisica determina tambien la cota de arriba de ese lado -- '
 'debe coincidir con la del otro lado para que el mandril quede '
 'nivelado.'),

-- -- ALARMA (solo que es / que la dispara, sin resolucion) --------
('bs08.mandril.alarma.calibrar_mandril', 'BS08', 'Mandril', 'alarma',
 'Calibrar mandril',
 'Salta si, al bajar, los sensores de calibrado (posicion 0) no se '
 'activan, o se activan antes de tiempo. Especifica lado, ej. "no '
 'calibrado derecho: sensor bajo (activo)" si leyo antes de tiempo, '
 'o "...(no activo)" si no llego a leer a tiempo -- obliga a '
 'recalibrar antes de poder volver a arrancar. Los dos motores '
 'independientes del mandril explican por que la alarma distingue '
 'lado izquierdo/derecho.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();