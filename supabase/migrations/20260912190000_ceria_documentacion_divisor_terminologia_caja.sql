-- Corrige terminología "pila" vs "caja" en 4 filas del Divisor
-- (BS08) en ceria_documentacion_maquina -- sesión 12/09/2026,
-- detectado al revisar por qué NORA se liaba con estos términos.
--
-- Convención adoptada (ya usada en el resto de submáquinas de la
-- sección -- Escuadrador, Elevador, Mandril, Jaula -- pero que el
-- Divisor no seguía de forma consistente):
--   - "pila" / "pila completa" = el conjunto SIN DIVIDIR que llega
--     al divisor.
--   - "caja"                  = la porción YA SEPARADA por el
--     divisor que formará una caja.
--   - Fuera el híbrido "pila-caja": no aporta nada que no aporte ya
--     "caja" sola, y añadía una tercera variante más que confundir.
--
-- Filas afectadas:
--   1) bs08.divisor.proceso.00_contexto_pila_y_referencia
--      -- se añade la convención explícita al final, ya que esta es
--      -- la primera fila que lee NORA tras el reordenado de bloques
--      -- (proceso primero) -- así queda fijada desde el principio.
--   2) bs08.divisor.proceso.06_avance_y_ciclo_continuo
--      -- "pila-caja" (x2) -> "caja"
--   3) bs08.divisor.parametro.offset_posicion_recogida
--      -- "esa pila" -> "esa caja"; "última pila del ciclo" ->
--      -- "última caja del ciclo"
--   4) bs08.divisor.parametro.intereje_ft_mordaza
--      -- "pila-caja" -> "caja"; "ÚLTIMA pila del ciclo" ->
--      -- "ÚLTIMA caja del ciclo"
--
-- El resto de menciones a "pila" en estas mismas filas (altura de la
-- pila, pila cuya altura real, pila medible, toda la pila, etc.) se
-- dejan tal cual -- se refieren correctamente al conjunto sin
-- dividir, no a la caja.

update ceria_documentacion_maquina set
  contenido = 'La pila que llega al divisor es una pila de azulejos apilados. Cada azulejo tiene un espesor habitual entre 9 y 11 mm. El número de piezas por pila varía mucho según el formato: desde 4 piezas (formato 120x120 cm) hasta 25 piezas (formato 20x120 cm) — de ahí que la altura total a medir por la fotocélula cambie tanto entre formatos. Sistema de referencia de alturas: el punto 0 se toma siempre en las cadenas de tracción del divisor, que es el mismo punto que la posición de calibrado (ver "Offset calibr."). "Arriba" significa mayor altura numérica (más lejos de las cadenas); "abajo" significa menor altura numérica (más cerca de las cadenas). Convención de términos: "pila" o "pila completa" se refiere siempre al conjunto sin dividir que llega al divisor. "caja" se refiere a la porción ya separada por el divisor que formará una caja — mismo uso que en el resto de la documentación de la sección (Escuadrador, Elevador, Mandril, Jaula).',
  updated_at = now()
where clave = 'bs08.divisor.proceso.00_contexto_pila_y_referencia';

update ceria_documentacion_maquina set
  contenido = 'Las cadenas de tracción de la empaquetadora avanzan la caja hasta el escuadrador, mientras el resto de la pila queda sujeto arriba por las mordazas del divisor. Cuando esa caja llega al escuadrador (que cierra para escuadrarla sobre las cadenas), el divisor baja y realiza la siguiente división, repitiendo el proceso: deja una nueva caja sobre las cadenas y sigue sujetando el resto arriba. Es un proceso continuo, sin paradas entre una caja y la siguiente, hasta agotar las divisiones programadas para el formato.',
  updated_at = now()
where clave = 'bs08.divisor.proceso.06_avance_y_ciclo_continuo';

update ceria_documentacion_maquina set
  contenido = 'Corrige la posición calculada para la división, permitiendo realizarla solo más abajo de la calculada — a más valor, más abajo. No admite valores negativos (no se puede corregir hacia arriba). Rango habitual: 0 a 3 mm. Valor capturado: 1 mm. Se reajusta por formato. Diagnóstico: si la caja llega con MÁS piezas de las que le tocan (o "se escapa una pieza" hacia esa caja), es síntoma de que el divisor está dividiendo demasiado arriba — este es el ajuste habitual y más sencillo para corregirlo, aumentando el offset dentro de su rango. Si el offset ya está al límite y el síntoma persiste, o si el síntoma es el contrario (faltan piezas, se nota sobre todo en la última caja del ciclo), ver "Intereje FT/mordaza".',
  updated_at = now()
where clave = 'bs08.divisor.parametro.offset_posicion_recogida';

update ceria_documentacion_maquina set
  contenido = 'Altura de la fotocélula de medición (sobre las mordazas) respecto a la parte baja de la mordaza — es la fotocélula que mide la altura de la pila para calcular las divisiones. Valor capturado: 68 mm. Dato constructivo/físico: NO se reajusta como parte de un cambio de formato rutinario. Solo cambia si se manipula físicamente la posición de la fotocélula — por accidente (golpe, deformación) o, más raramente, de forma deliberada, cuando un formato nuevo trae una pila cuya altura real queda fuera del rango medible con el montaje actual. Relación derivada: como la mordaza nunca baja por debajo de su posición de calibrado (Offset calibr., que la deja a ras de la tracción de pilas o 1-2 mm por encima) y la fotocélula va siempre a esta distancia por encima de la mordaza, este valor es la altura MÍNIMA de pila medible por fotocélula. Ver "Posición espera" para el límite superior del rango, y la alarma "TO lectura altura pila" para el síntoma cuando la pila cae fuera de rango. Diagnóstico adicional: si el intereje programado está por debajo del real (la fotocélula física está, en realidad, más arriba de lo programado), la máquina subestima la altura de la pila y calcula cada corte más abajo de lo que toca. El síntoma más visible no es que cada caja lleve pocas piezas de menos (pasa desapercibido, y a veces la división sale bien "por los pelos"), sino que la ÚLTIMA caja del ciclo aparece con más piezas de las que le tocan — al agotarse las divisiones programadas antes de haber repartido toda la pila, el sobrante acumulado se concentra ahí. Ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza" para el procedimiento de verificación y corrección.',
  updated_at = now()
where clave = 'bs08.divisor.parametro.intereje_ft_mordaza';
