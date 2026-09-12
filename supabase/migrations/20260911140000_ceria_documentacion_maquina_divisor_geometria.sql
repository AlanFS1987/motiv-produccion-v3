-- Borrador — Divisor (BS08): geometría de la división y diagnóstico
-- direccional (arriba/abajo). Para revisión antes de aplicar.
-- Origen: sesión de test de diagnóstico (11/09/2026), explicación
-- directa del mecánico sobre naturaleza de la pila, sistema de
-- referencia de alturas, mecánica completa del ciclo de división, y
-- las dos reglas de diagnóstico (divide arriba / divide abajo).
--
-- Cambios:
--   1) Nueva fila de contexto: naturaleza de la pila (azulejos) +
--      sistema de referencia de alturas (0 = cadenas).
--   2) Dos filas de proceso nuevas (05, 06): mecánica de la división
--      y sujeción, y el ciclo continuo hacia el escuadrador.
--   3) Enriquecidas "Offset posición recogida" e "Intereje FT/mordaza"
--      con el diagnóstico direccional: qué síntoma indica cada causa.
--   4) Nueva fila de mantenimiento: procedimiento de verificación
--      manual del Intereje FT/mordaza (metro vs. altura medida).
--
-- Pendiente (a propósito, no incluido todavía): la pantalla "Datos de
-- formato Divisor" (altura medida/prevista/tolerancia) está solo
-- mencionada, no documentada en detalle — el mecánico dijo que la
-- explicaría más adelante para no mezclar demasiados conceptos.

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.divisor.proceso.00_contexto_pila_y_referencia', 'BS08', 'Divisor', 'proceso',
 '0. Contexto: naturaleza de la pila y sistema de referencia',
 'La pila que llega al divisor es una pila de azulejos apilados. '
 'Cada azulejo tiene un espesor habitual entre 9 y 11 mm. El número '
 'de piezas por pila varía mucho según el formato: desde 4 piezas '
 '(formato 120x120 cm) hasta 25 piezas (formato 20x120 cm) — de ahí '
 'que la altura total a medir por la fotocélula cambie tanto entre '
 'formatos. Sistema de referencia de alturas: el punto 0 se toma '
 'siempre en las cadenas de tracción del divisor, que es el mismo '
 'punto que la posición de calibrado (ver "Offset calibr."). '
 '"Arriba" significa mayor altura numérica (más lejos de las '
 'cadenas); "abajo" significa menor altura numérica (más cerca de '
 'las cadenas).'),

('bs08.divisor.proceso.05_division_y_sujecion', 'BS08', 'Divisor', 'proceso',
 '5. División y sujeción de la pila',
 'Una vez determinada la altura de la pila (y, si aplica, tras el '
 'escuadrado de pila completa del paso 4), si "Escuadra pila" NO '
 'está activado las mordazas bajan directamente a la altura a la '
 'que corresponde dividir. Al cerrar ahí, las mordazas sujetan toda '
 'la pila EXCEPTO las piezas que componen una caja, que quedan '
 'libres, apoyadas sobre las cadenas de tracción de la '
 'empaquetadora.'),

('bs08.divisor.proceso.06_avance_y_ciclo_continuo', 'BS08', 'Divisor', 'proceso',
 '6. Avance al escuadrador y ciclo continuo',
 'Las cadenas de tracción de la empaquetadora avanzan la pila que '
 'compone una caja hasta el escuadrador, mientras el resto de la '
 'pila queda sujeto arriba por las mordazas del divisor. Cuando esa '
 'pila llega al escuadrador (que cierra para escuadrarla sobre las '
 'cadenas), el divisor baja y realiza la siguiente división, '
 'repitiendo el proceso: deja una nueva pila-caja sobre las cadenas '
 'y sigue sujetando el resto arriba. Es un proceso continuo, sin '
 'paradas entre una pila-caja y la siguiente, hasta agotar las '
 'divisiones programadas para el formato.'),

('bs08.divisor.parametro.offset_posicion_recogida', 'BS08', 'Divisor', 'parametro',
 'Offset posición recogida',
 'Corrige la posición calculada para la división, permitiendo '
 'realizarla solo más abajo de la calculada — a más valor, más '
 'abajo. No admite valores negativos (no se puede corregir hacia '
 'arriba). Rango habitual: 0 a 3 mm. Valor capturado: 1 mm. Se '
 'reajusta por formato. Diagnóstico: si la pila que compone una '
 'caja llega con MÁS piezas de las que le tocan (o "se escapa una '
 'pieza" hacia esa pila), es síntoma de que el divisor está '
 'dividiendo demasiado arriba — este es el ajuste habitual y más '
 'sencillo para corregirlo, aumentando el offset dentro de su rango. '
 'Si el offset ya está al límite y el síntoma persiste, o si el '
 'síntoma es el contrario (faltan piezas, se nota sobre todo en la '
 'última pila del ciclo), ver "Intereje FT/mordaza".'),

('bs08.divisor.parametro.intereje_ft_mordaza', 'BS08', 'Divisor', 'parametro',
 'Intereje FT/mordaza',
 'Altura de la fotocélula de medición (sobre las mordazas) respecto '
 'a la parte baja de la mordaza — es la fotocélula que mide la '
 'altura de la pila para calcular las divisiones. Valor capturado: '
 '68 mm. Dato constructivo/físico: NO se reajusta como parte de un '
 'cambio de formato rutinario. Solo cambia si se manipula '
 'físicamente la posición de la fotocélula — por accidente (golpe, '
 'deformación) o, más raramente, de forma deliberada, cuando un '
 'formato nuevo trae una pila cuya altura real queda fuera del rango '
 'medible con el montaje actual. Relación derivada: como la mordaza '
 'nunca baja por debajo de su posición de calibrado (Offset calibr., '
 'que la deja a ras de la tracción de pilas o 1-2 mm por encima) y '
 'la fotocélula va siempre a esta distancia por encima de la '
 'mordaza, este valor es la altura MÍNIMA de pila medible por '
 'fotocélula. Ver "Posición espera" para el límite superior del '
 'rango, y la alarma "TO lectura altura pila" para el síntoma cuando '
 'la pila cae fuera de rango. Diagnóstico adicional: si el intereje '
 'programado está por debajo del real (la fotocélula física está, '
 'en realidad, más arriba de lo programado), la máquina subestima la '
 'altura de la pila y calcula cada corte más abajo de lo que toca. '
 'El síntoma más visible no es que cada pila-caja lleve pocas piezas '
 'de menos (pasa desapercibido, y a veces la división sale bien "por '
 'los pelos"), sino que la ÚLTIMA pila del ciclo aparece con más '
 'piezas de las que le tocan — al agotarse las divisiones '
 'programadas antes de haber repartido toda la pila, el sobrante '
 'acumulado se concentra ahí. Ver '
 '"bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza" para '
 'el procedimiento de verificación y corrección.'),

('bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza', 'BS08', 'Divisor', 'mantenimiento',
 'Verificación del Intereje FT/mordaza (medición manual)',
 'Procedimiento para comprobar si el Intereje FT/mordaza programado '
 'coincide con la posición física real de la fotocélula. Con la '
 'máquina en manual, se deja entrar una pila y se deja que el '
 'divisor la mida sin dividir. En la pantalla "Datos de formato '
 'Divisor" (pendiente de documentar en detalle) se lee la "Altura '
 'medida" — lo que el divisor ha calculado que mide la pila con el '
 'intereje programado actual. A la vez, se mide la misma pila '
 'físicamente con un metro. Si la medida con metro da un valor MAYOR '
 'que la "Altura medida" de la máquina, el intereje real es mayor '
 'que el programado (la fotocélula física está más arriba de lo que '
 'dice el parámetro) — hay que aumentar el valor programado en la '
 'diferencia medida (p. ej., si el metro da 20 mm más, subir el '
 'intereje 20 mm). Si diera un valor MENOR, sería el caso contrario.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
