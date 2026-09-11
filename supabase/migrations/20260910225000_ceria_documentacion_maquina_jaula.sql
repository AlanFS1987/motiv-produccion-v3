-- Borrador -- Jaula (BS08). Para revision antes de aplicar.
-- Fuente: bs08-subsistema-carton.md, seccion "6. Cierre de la caja
-- (jaula)" + detalle del empujador de pila, + un dato constructivo
-- de bs08-pantalla-maquina-datos-constructivos.md.

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- -- PROCESO --------------------------------------------------------
('bs08.jaula.proceso.01_secuencia_cierre', 'BS08', 'Jaula', 'proceso',
 '1. Secuencia de cierre de la caja',
 'Con el mandril abajo y la caja envuelta por arriba y los '
 'laterales: el plato de empuje baja por la parte trasera de la '
 'pila envuelta y la empuja, cerrando la solapa trasera. Por el '
 'frontal, sube el fondo jaula, cerrando la solapa delantera. '
 'Mientras se empuja, unas guias de la jaula cierran las solapas '
 'laterales. Si todo esta bien ajustado, entra a la jaula ya una '
 'caja terminada -- solo falta la impresion, que llega en el tramo '
 'siguiente (ver Cabezales de impresion).'),

('bs08.jaula.proceso.02_empujador_pila_conjunto', 'BS08', 'Jaula', 'proceso',
 '2. Empujador de pila -- conjunto y componentes',
 'El empujador de pila es el conjunto completo (motor + correa Breco '
 '+ guia Nadella + rodamientos + plato de empuje). El plato de '
 'empuje es solo la parte de ese conjunto que entra en contacto '
 'fisico con la pila. Motor convencional con encoder (igual tipo que '
 'el del sacabandejas), de 0,37 kW, con reductor de calidad -- '
 'grande y pesado -- mas sensor de calibracion delantero. Se '
 'desplaza por una guia Nadella, con rodamientos lineales '
 '("patines"/"patinetes"), mediante una correa Breco ancha y '
 'resistente. La correa Breco lleva alambre de acero por dentro; es '
 'una correa abierta (se corta a medida y se monta, no viene en un '
 'lazo cerrado de fabrica). Sensor de cero/calibrado hacia la jaula '
 '(delante); sensor de seguridad detras.'),

('bs08.jaula.proceso.03_tres_velocidades', 'BS08', 'Jaula', 'proceso',
 '3. Tres velocidades del empujador de pila',
 'Rapida (~80 Hz): a la que vuelve a la posicion de espera, despues '
 'de haber empujado la pila. Velocidad de empuje (50-60 Hz): al '
 'empezar a empujar la pila. Lenta (20-40 Hz): al terminar el '
 'empuje, metiendo la pila dentro de la jaula.'),

('bs08.jaula.proceso.04_enlace_punto_espera', 'BS08', 'Jaula', 'proceso',
 '4. Enlace con "Punto espera empujador libre"',
 'Parametro de la traccion warp (ver Elevador): es la condicion de '
 'enclavamiento que obliga a la pila a esperar en la traccion warp '
 'hasta que este empujador de pila haya vuelto a su posicion de '
 'espera, antes de poder seguir avanzando desde el escuadrador.'),

-- -- PARAMETRO ------------------------------------------------------
('bs08.jaula.parametro.rango_ajuste', 'BS08', 'Jaula', 'parametro',
 'Rango de ajuste (empujador de pila)',
 'De 0 a ~1.600 mm.'),

('bs08.jaula.parametro.posicion_espera', 'BS08', 'Jaula', 'parametro',
 'Posicion de espera (empujador de pila, detras)',
 'Suele estar sobre 1.400-1.500 mm para formatos habituales de 1.200 '
 'mm de largo.'),

('bs08.jaula.parametro.velocidad_rapida', 'BS08', 'Jaula', 'parametro',
 'Velocidad rapida (retorno)',
 '~80 Hz. Velocidad a la que el empujador de pila vuelve a la '
 'posicion de espera despues de empujar.'),

('bs08.jaula.parametro.velocidad_empuje', 'BS08', 'Jaula', 'parametro',
 'Velocidad de empuje',
 '50-60 Hz. Al empezar a empujar la pila.'),

('bs08.jaula.parametro.velocidad_lenta', 'BS08', 'Jaula', 'parametro',
 'Velocidad lenta (fin de empuje)',
 '20-40 Hz. Al terminar el empuje, metiendo la pila dentro de la '
 'jaula.'),

('bs08.jaula.parametro.aceleracion', 'BS08', 'Jaula', 'parametro',
 'Aceleracion (empujador de pila)',
 'Misma formula que el resto de motores de la maquina (tiempo de '
 'aceleracion = 5 dividido entre el valor programado). Aqui se '
 'suele tener entre 2 y 6, segun como se comporte la pila al ser '
 'empujada.'),

('bs08.jaula.parametro.posterior_jaula_configuracion', 'BS08', 'Jaula', 'parametro',
 'Posterior jaula -- Configuracion usada',
 'Dato constructivo fijo: "Configuracion 1". No se toca nunca, igual '
 'que el resto de la pantalla "Maquina -> Datos constructivos".'),

-- -- PIEZA ----------------------------------------------------------
('bs08.jaula.pieza.plato_empuje', 'BS08', 'Jaula', 'pieza',
 'Plato de empuje',
 'Parte del conjunto "empujador de pila" que entra en contacto '
 'fisico con la pila. Baja por la parte trasera y la empuja, '
 'cerrando la solapa trasera.'),

('bs08.jaula.pieza.fondo_jaula', 'BS08', 'Jaula', 'pieza',
 'Fondo jaula',
 'Sube por el frontal durante el cierre, cerrando la solapa '
 'delantera.'),

('bs08.jaula.pieza.guias_jaula', 'BS08', 'Jaula', 'pieza',
 'Guias de la jaula',
 'Cierran las solapas laterales mientras el plato de empuje empuja '
 'la caja.'),

('bs08.jaula.pieza.correa_breco', 'BS08', 'Jaula', 'pieza',
 'Correa Breco',
 'Ancha y resistente, con alambre de acero por dentro. Es una correa '
 'abierta -- se corta a medida y se monta, no viene en un lazo '
 'cerrado de fabrica. Transmite el movimiento del motor al plato de '
 'empuje.'),

('bs08.jaula.pieza.guia_nadella', 'BS08', 'Jaula', 'pieza',
 'Guia Nadella',
 'Guia por la que se desplaza el conjunto del empujador de pila, con '
 'rodamientos lineales ("patines"/"patinetes").'),

-- -- ACTUADOR -------------------------------------------------------
('bs08.jaula.actuador.motor_empujador_pila', 'BS08', 'Jaula', 'actuador',
 'Motor del empujador de pila',
 'Motor convencional con encoder -- igual tipo que el del '
 'sacabandejas. 0,37 kW, con reductor de calidad -- grande y pesado. '
 'Mueve el conjunto completo (correa Breco + guia Nadella + '
 'rodamientos + plato de empuje) a traves de la correa Breco.'),

-- -- SENSOR ---------------------------------------------------------
('bs08.jaula.sensor.cero_calibrado_delantero', 'BS08', 'Jaula', 'sensor',
 'Sensor de cero/calibrado (delantero, hacia la jaula)',
 'Sensor de calibracion delantero del motor del empujador de pila, '
 'orientado hacia la jaula.'),

('bs08.jaula.sensor.seguridad_trasero', 'BS08', 'Jaula', 'sensor',
 'Sensor de seguridad (trasero)',
 'Si se activa, pide calibracion y da alarma -- ver alarma asociada.'),

-- -- ALARMA (solo que es / que la dispara, sin resolucion) --------
('bs08.jaula.alarma.sensor_seguridad_activado', 'BS08', 'Jaula', 'alarma',
 'Empujador de pila: sensor de seguridad activado',
 'Salta si se activa el sensor de seguridad trasero del empujador de '
 'pila -- pide recalibrar antes de continuar.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();