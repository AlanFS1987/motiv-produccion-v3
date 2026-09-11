-- Borrador -- Elevador (BS08). Version final, para revision antes de aplicar.
-- Fuentes: explicacion directa del mecanico (sesion 10/09/2026) +
-- bs08-pantalla-trac-pilas.md (Start plantil., Punto espera
-- empujador libre) + cruce con bs08-subsistema-carton.md (paso 6,
-- cierre de la caja).

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- -- PROCESO --------------------------------------------------------
('bs08.elevador.proceso.01_elevacion_pila', 'BS08', 'Elevador', 'proceso',
 '1. Elevacion de la pila y descenso del mandril',
 'Dos motores independientes, sincronizados entre si -- mismo patron '
 'que el Divisor y el Mandril. Situados justo debajo del mandril. '
 'Cuando la pila se para encima de ellos, los motores suben y '
 'separan la pila de la traccion de pilas. El mandril baja entonces '
 'sobre el elevador (con la pila encima) para envolverla con el '
 'carton. Que la pila quede elevada es lo que deja hueco libre '
 'debajo para que, durante el cierre de la caja (ver Jaula), el '
 'fondo jaula pueda subir desde el frontal y el empujador de pila '
 'pueda empujar desde atras, los dos por debajo de la pila: el '
 'empujador cierra la solapa trasera empujando la caja, y el fondo '
 'jaula cierra la solapa frontal al subir -- las guias de la jaula '
 'cierran las solapas laterales mientras tanto.'),

('bs08.elevador.proceso.02_mecanismo_accionamiento', 'BS08', 'Elevador', 'proceso',
 '2. Mecanismo de accionamiento (motor -> reductor -> biela -> patin)',
 'Motor paso a paso (mismo tipo que usan el Divisor y el empujador '
 'de carton/bandejas), unido a un reductor I30. El motor no llega a '
 'dar ni una vuelta completa: gira unos 180 grados. Ese giro pasa '
 'por una biela, que convierte el movimiento rotacional del motor en '
 'un movimiento vertical recto -- es este movimiento el que sube y '
 'baja el patin del elevador.'),

-- -- ACTUADOR -------------------------------------------------------
('bs08.elevador.actuador.motor_elevador', 'BS08', 'Elevador', 'actuador',
 'Motor elevador (x2, uno a cada lado)',
 'Motor paso a paso, mismo tipo que usan el Divisor y el empujador '
 'de carton (bandejas) -- sin encoder. Independientes entre si pero '
 'sincronizados. Van unidos a un reductor I30; no llegan a dar ni '
 'una vuelta completa, giran unos 180 grados. Ese giro se transmite '
 'a traves de una biela, que lo convierte en el movimiento vertical '
 'recto que sube y baja el patin del elevador, separando la pila de '
 'la traccion de pilas.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- -- PIEZA ---------------------------------------------------------
insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.elevador.pieza.reductor_i30', 'BS08', 'Elevador', 'pieza',
 'Reductor I30',
 'Recibe el giro del motor paso a paso y lo transmite a la biela. A '
 'diferencia del reductor del Divisor, aqui no se menciona ninguna '
 'alternativa I50 -- es fijo.'),

('bs08.elevador.pieza.biela', 'BS08', 'Elevador', 'pieza',
 'Biela',
 'Convierte el movimiento de giro del motor (que no llega a una '
 'vuelta completa, unos 180 grados) en un movimiento vertical recto, '
 'que es el que sube y baja el patin.'),

('bs08.elevador.pieza.patin', 'BS08', 'Elevador', 'pieza',
 'Patin del elevador',
 'Una especie de lamina o espada, cubierta por una cadena loca -- no '
 'va cogida a ningun motor. Su unica funcion es dejar que la caja se '
 'deslice sobre ella mientras esta siendo empujada.'),

('bs08.elevador.pieza.cadena_loca', 'BS08', 'Elevador', 'pieza',
 'Cadena loca (cubre el patin)',
 'No es motriz -- no va cogida a ningun motor. Permite que la caja '
 'se deslice sobre el patin mientras es empujada.'),

('bs08.elevador.pieza.leva', 'BS08', 'Elevador', 'pieza',
 'Leva (en el eje del motor)',
 'Sujeta al eje del motor; la lee el sensor de calibrado para '
 'determinar la posicion.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- -- SENSOR --------------------------------------------------------
insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.elevador.sensor.calibrado', 'BS08', 'Elevador', 'sensor',
 'Sensor de calibrado',
 'Lee una leva sujeta al eje del motor. A diferencia de otros '
 'offsets de la maquina (medidos en mm), aqui la calibracion se mide '
 'en decimas de grado, porque el origen del movimiento es '
 'rotacional.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- -- PARAMETRO -- dinamica -------------------------------------------
insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.elevador.parametro.velocidad_subida', 'BS08', 'Elevador', 'parametro',
 'Velocidad subida',
 'Valor: 10.000 steps/s (motor paso a paso).'),

('bs08.elevador.parametro.velocidad_bajada', 'BS08', 'Elevador', 'parametro',
 'Velocidad bajada',
 'Valor: 10.000 steps/s.'),

('bs08.elevador.parametro.aceleracion', 'BS08', 'Elevador', 'parametro',
 'Aceleracion',
 'Valor: 10. Misma formula que el resto de motores paso a paso de la '
 'maquina (tiempo de aceleracion = 5 dividido entre el valor '
 'programado) -> 0,5 s.'),

-- -- PARAMETRO -- Start plantil. y Punto espera empujador libre,
-- version final con la explicacion completa dada por el mecanico --
('bs08.elevador.parametro.start_plantil', 'BS08', 'Elevador', 'parametro',
 'Start plantil.',
 '"Plantilla" es como llama la maquina al carton. Cota en '
 'milimetros: distancia recorrida por la pila entre el escuadrador y '
 'el elevador a partir de la cual arranca el empuje del carton hacia '
 'el mandril -- dispara el arranque del ciclo del subsistema de '
 'carton en funcion del avance de la pila, para que el carton y la '
 'pila lleguen sincronizados al mandril. Valor capturado: 1 mm. Se '
 'reajusta por formato.'),

('bs08.elevador.parametro.punto_espera_empujador_libre', 'BS08', 'Elevador', 'parametro',
 'Punto espera empujador libre',
 'Punto donde la pila espera, entre escuadrador y elevador, a que el '
 'empujador de pila (que acaba de empujar la caja anterior) vuelva a '
 'su posicion trasera de espera, antes de poder seguir avanzando -- '
 'condicion de enclavamiento entre el avance de la pila y el retorno '
 'del empujador de pila (ver Jaula). Se ajusta segun el formato con '
 'un efecto practico opuesto: formatos de tablilla (20x120, 30x120) '
 '-> se coloca a 1 mm, practicamente a la salida del escuadrador -- '
 'la pila espera ahi a que el empujador vuelva, y luego recorre de '
 'un tiron todo el tramo hasta el elevador. Formatos grandes '
 '(60x120, 90x90, 120x120) -> se coloca 1 mm por debajo del '
 '"Intereje wrap" (ver Escuadrador), es decir, casi pegado al '
 'elevador -- en la practica, la pila no se detiene en ningun punto '
 'intermedio: en cuanto el escuadrador la libera, avanza '
 'automaticamente hasta el elevador sin pausa. Valor capturado '
 '(formato no tablilla): 1440 mm.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();