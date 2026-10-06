-- Corrige el árbol de diagnóstico de "sobra/falta pieza" del Divisor
-- (BS08) en ceria_documentacion_maquina -- sesión 12/09/2026,
-- a raíz de una pregunta mal formada de NORA en prueba real
-- ("¿la caja que sale mal es siempre la última, o puede pasar en
-- cualquier división?").
--
-- Qué estaba mal (aclarado en conversación con el mecánico):
--   - La pregunta "¿última división o cualquiera?" no distingue nada
--     entre Offset y Intereje: los dos fallos pueden aparecer en
--     CUALQUIER división del ciclo, no en una posición fija -- el
--     margen de corte está tan ajustado (~1 mm sobre los ~10 mm de
--     una pieza) que una pieza se escapa o se queda pillada de forma
--     probabilística en cualquier corte, no según un patrón de
--     posición.
--   - La idea previa de que un fallo de Intereje "se concentra en la
--     última caja" era una simplificación del mecánico para explicar
--     que algo había ido mal a lo largo del ciclo, pero no es
--     literal: las piezas no se pueden acumular parcialmente en cada
--     corte y aparecer enteras al final (no hay fracciones de
--     pieza) -- el problema puede darse en cualquier corte, iguial
--     que con el Offset.
--   - La distinción real entre Offset e Intereje NO es "dónde
--     ocurre", es "en qué DIRECCIÓN falla":
--       - Sobra pieza (corte demasiado arriba) -> Offset posición
--         recogida (corrige hacia abajo, 0-3 mm). Si ya está al
--         límite y sigue sobrando, el desajuste es mayor de lo que
--         el offset puede absorber -> revisar Intereje (sobreestimado).
--       - Falta pieza (corte demasiado abajo) -> el Offset NO puede
--         corregirlo NUNCA (no admite ir hacia arriba) -> hay que
--         corregir el Intereje directamente (subestimado).
--
-- Filas afectadas:
--   1) bs08.divisor.diagnostico.divide_mal -- pregunta clave
--      reescrita: sobra/falta en vez de última/cualquiera.
--   2) bs08.divisor.parametro.offset_posicion_recogida -- quita la
--      referencia a "última caja del ciclo", dejar solo sobra/falta.
--   3) bs08.divisor.parametro.intereje_ft_mordaza -- quita la idea de
--      "se concentra en la última caja"; explica las dos direcciones
--      (subestimado -> falta pieza / sobreestimado -> sobra pieza),
--      ambas posibles en cualquier división.

update ceria_documentacion_maquina set
  contenido = 'Paso 0 — descartar mecánica antes que parámetro: si el fallo es errático (a veces sobra, a veces falta, sin patrón claro, y/o va acompañado de piezas rotas o ruido), sospechar fallo mecánico, no paramétrico — ver "bs08.divisor.mantenimiento.criterio_mecanico_vs_parametro" y las pruebas de juego/balanceo. Solo seguir con lo siguiente si el fallo tiene una dirección CONSISTENTE (siempre sobra, o siempre falta pieza) — puede aparecer en cualquier división del ciclo, de forma no siempre predecible (el margen de corte es muy ajustado, y una pieza puede escaparse o quedarse pillada en cualquier corte); lo relevante no es EN QUÉ división pasa, sino en qué DIRECCIÓN falla siempre. Pregunta clave: cuando falla, ¿la caja sale con una pieza DE MÁS, o con una pieza DE MENOS? → Si SOBRA pieza (el divisor está dividiendo demasiado arriba): subir "Offset posición recogida" dentro de su rango (0-3 mm) — es el ajuste habitual y más sencillo. Si el offset ya está al límite y el síntoma persiste, el desajuste es mayor de lo que el offset puede absorber por sí solo: revisar y corregir "Intereje FT/mordaza" (ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza"). → Si FALTA pieza (el divisor está dividiendo demasiado abajo): "Offset posición recogida" NO puede corregir esto bajo ningún concepto, porque solo admite corregir hacia abajo, nunca hacia arriba — hay que revisar y corregir directamente "Intereje FT/mordaza".',
  updated_at = now()
where clave = 'bs08.divisor.diagnostico.divide_mal';

update ceria_documentacion_maquina set
  contenido = 'Corrige la posición calculada para la división, permitiendo realizarla solo más abajo de la calculada — a más valor, más abajo. No admite valores negativos (no se puede corregir hacia arriba). Rango habitual: 0 a 3 mm. Valor capturado: 1 mm. Se reajusta por formato. Diagnóstico: si la caja llega con MÁS piezas de las que le tocan (o "se escapa una pieza" hacia esa caja) — puede pasar en cualquier división del ciclo, no en una posición fija —, es síntoma de que el divisor está dividiendo demasiado arriba: este es el ajuste habitual y más sencillo para corregirlo, aumentando el offset dentro de su rango. Si el offset ya está al límite y el síntoma persiste, el desajuste es mayor de lo que este offset puede absorber por sí solo — ver "Intereje FT/mordaza". Si en cambio falta alguna pieza, este offset no puede corregirlo bajo ningún concepto (no admite ir hacia arriba): ver directamente "Intereje FT/mordaza".',
  updated_at = now()
where clave = 'bs08.divisor.parametro.offset_posicion_recogida';

update ceria_documentacion_maquina set
  contenido = 'Altura de la fotocélula de medición (sobre las mordazas) respecto a la parte baja de la mordaza — es la fotocélula que mide la altura de la pila para calcular las divisiones. Valor capturado: 68 mm. Dato constructivo/físico: NO se reajusta como parte de un cambio de formato rutinario. Solo cambia si se manipula físicamente la posición de la fotocélula — por accidente (golpe, deformación) o, más raramente, de forma deliberada, cuando un formato nuevo trae una pila cuya altura real queda fuera del rango medible con el montaje actual. Relación derivada: como la mordaza nunca baja por debajo de su posición de calibrado (Offset calibr., que la deja a ras de la tracción de pilas o 1-2 mm por encima) y la fotocélula va siempre a esta distancia por encima de la mordaza, este valor es la altura MÍNIMA de pila medible por fotocélula. Ver "Posición espera" para el límite superior del rango, y la alarma "TO lectura altura pila" para el síntoma cuando la pila cae fuera de rango. Diagnóstico adicional: si el intereje programado está por DEBAJO del real (la fotocélula física está, en realidad, más arriba de lo programado), la máquina SUBESTIMA la altura de la pila y calcula cada corte más abajo de lo que toca — el divisor divide demasiado abajo, con riesgo de que FALTE alguna pieza en cualquier caja del ciclo (nunca se corrige con "Offset posición recogida", que solo permite ir hacia abajo). Si el intereje programado está por ENCIMA del real (la fotocélula física está, en realidad, más abajo de lo programado), la máquina SOBREESTIMA la altura de la pila y calcula cada corte más arriba de lo que toca — el divisor divide demasiado arriba, con riesgo de que SOBRE alguna pieza en cualquier caja del ciclo; si el desajuste es pequeño puede quedar absorbido dentro del rango de "Offset posición recogida" (0-3 mm), pero si es mayor persistirá incluso con el offset al límite. En ambos casos el fallo puede aparecer en cualquier división del ciclo, no en una posición fija — lo que distingue la causa es la DIRECCIÓN del error (sobra/falta), no en qué caja concreta ocurre. Ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza" para el procedimiento de verificación y corrección.',
  updated_at = now()
where clave = 'bs08.divisor.parametro.intereje_ft_mordaza';
