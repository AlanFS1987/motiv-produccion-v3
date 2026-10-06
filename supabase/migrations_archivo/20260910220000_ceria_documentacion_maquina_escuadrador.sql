-- Borrador -- Escuadrador (BS08). Para revision antes de aplicar.
-- Fuente: bs08-pantalla-trac-pilas.md (Datos de formato, Tiempos,
-- Detalle tecnico: traccion warp, divisor y escuadrador -- seccion 5).

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- -- PROCESO (2 pasos, mismo criterio que Divisor) ----------------
('bs08.escuadrador.proceso.01_llegada_tope', 'BS08', 'Escuadrador', 'proceso',
 '5.1 Llegada y tope mecanico',
 'Una vez dividida, la pila avanza hasta el escuadrador ya con '
 'unicamente las piezas que componen una sola caja. El tope es '
 'mecanico; el punto de parada depende de la posicion determinada '
 'por el formato y de la distancia configurada (ver "Distancia FT '
 'cinta/divisor" en Divisor, y "Intereje wrap" en los parametros de '
 'este mismo bloque).'),

('bs08.escuadrador.proceso.02_escuadrado_liberacion', 'BS08', 'Escuadrador', 'proceso',
 '5.2 Escuadrado y liberacion',
 'Mecanismo de 2 pistones frontales + 1 trasero, por cada lado: el '
 'piston frontal 1 mueve el taco de teflon; el piston frontal 2 '
 'mueve una pieza con dos rodillos verticales que centran la pila '
 'lateralmente; el piston trasero lleva dos rodillos dispuestos de '
 'forma que, al extender el piston, uno presiona la pieza por detras '
 'y otro por el lateral, dejando la pila perfectamente escuadrada '
 'sobre las cadenas. Una vez escuadrada (durante el "Tiempo '
 'escuadrado" configurado), todo se abre y libera la pila, que '
 'avanza al elevador. Al avanzar, deja libre el hueco y la siguiente '
 'pila ya dividida en el divisor avanza a la posicion de escuadrado '
 '-- divisor y escuadrador trabajan en cadena, una pila detras de '
 'otra.'),

-- -- PARAMETRO ----------------------------------------------------
('bs08.escuadrador.parametro.tiempo_escuadrado_lateral', 'BS08', 'Escuadrador', 'parametro',
 'Tiempo escuadrado (lateral)',
 'Valor capturado: 1 ms. Parte lateral del mecanismo de escuadrado.'),

('bs08.escuadrador.parametro.retardo_escuadrado_frontal', 'BS08', 'Escuadrador', 'parametro',
 'Retardo escuadrado (frontal)',
 'Valor capturado: 1 ms.'),

('bs08.escuadrador.parametro.tiempo_escuadrado_frontal', 'BS08', 'Escuadrador', 'parametro',
 'Tiempo escuadrado (frontal)',
 'Valor capturado: 1300 ms.'),

('bs08.escuadrador.parametro.habilitado_lateral', 'BS08', 'Escuadrador', 'parametro',
 'Habilitado (lateral)',
 'Capturado en Si. En esta planta la parte lateral esta siempre '
 'habilitada, nunca se deshabilita.'),

('bs08.escuadrador.parametro.habilitado_frontal', 'BS08', 'Escuadrador', 'parametro',
 'Habilitado (frontal)',
 'Capturado en Si. En esta planta la parte frontal esta siempre '
 'habilitada, nunca se deshabilita.'),

('bs08.escuadrador.parametro.intereje_wrap', 'BS08', 'Escuadrador', 'parametro',
 'Intereje wrap',
 'Distancia que avanza la pila desde el escuadrador hasta el '
 'elevador. No es lo mismo que "Distancia FT cinta/divisor" (que '
 'mide desde la foto de salida de apiladores hasta el punto de '
 'parada en el divisor) -- son dos tramos distintos y consecutivos '
 'de la misma traccion warp. Valor capturado: 1443 mm. Se reajusta '
 'por formato.'),

-- -- PIEZA ---------------------------------------------------------
('bs08.escuadrador.pieza.taco_teflon', 'BS08', 'Escuadrador', 'pieza',
 'Taco de teflon',
 'Movido por el piston frontal 1. Primer punto de contacto con la '
 'pila al entrar en el escuadrador.'),

('bs08.escuadrador.pieza.rodillos_verticales', 'BS08', 'Escuadrador', 'pieza',
 'Pieza con dos rodillos verticales',
 'Movida por el piston frontal 2. Centra la pila lateralmente.'),

('bs08.escuadrador.pieza.rodillos_traseros', 'BS08', 'Escuadrador', 'pieza',
 'Rodillos traseros (x2)',
 'En el piston trasero, por cada lado. Al extender el piston, uno '
 'presiona la pieza por detras y otro por el lateral, dejando la '
 'pila perfectamente escuadrada sobre las cadenas.'),

-- -- ACTUADOR -------------------------------------------------------
('bs08.escuadrador.actuador.piston_frontal_1', 'BS08', 'Escuadrador', 'actuador',
 'Piston frontal 1 (por cada lado)',
 'Mueve el taco de teflon.'),

('bs08.escuadrador.actuador.piston_frontal_2', 'BS08', 'Escuadrador', 'actuador',
 'Piston frontal 2 (por cada lado)',
 'Mueve la pieza con dos rodillos verticales que centra la pila '
 'lateralmente.'),

('bs08.escuadrador.actuador.piston_trasero', 'BS08', 'Escuadrador', 'actuador',
 'Piston trasero (por cada lado)',
 'Lleva dos rodillos; al extenderse, uno presiona la pieza por '
 'detras y otro por el lateral, escuadrando la pila sobre las '
 'cadenas.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();