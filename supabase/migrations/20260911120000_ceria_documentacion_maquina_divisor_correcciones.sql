-- Borrador — Divisor (BS08): correcciones y relaciones derivadas.
-- Para revisión antes de aplicar como migración.
-- Origen: sesión de test de diagnóstico (11/09/2026) sobre "divide mal"
-- y rango de altura de pila medible por fotocélula.
--
-- Cambios:
--   1) intereje_ft_mordaza: corrige "se reajusta por formato" (dato
--      constructivo/físico, no ajuste rutinario) + relación derivada
--      (altura mínima de pila medible).
--   2) posicion_espera: añade relación derivada (altura máxima de
--      pila medible, junto con intereje_ft_mordaza).
--   3) distancia_ft_cinta_divisor: añade nota de descarte explícita
--      (no afecta a la altura de corte, solo a la parada horizontal).
--   4) Nueva alarma: TO lectura altura pila (dispara igual en ambos
--      extremos del rango, pila demasiado baja o demasiado alta).

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

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
 'la pila cae fuera de rango.'),

('bs08.divisor.parametro.posicion_espera', 'BS08', 'Divisor', 'parametro',
 'Posición espera',
 'Altura a la que esperan las mordazas una nueva pila que llega de '
 'los apiladores — debe ser superior a la altura de la pila. Valor '
 'capturado: 50 mm. Se reajusta por formato. Relación derivada: '
 'junto con "Intereje FT/mordaza", define el límite superior de '
 'altura de pila medible por fotocélula = posición espera + '
 'intereje FT/mordaza (con los valores capturados, 50 + 68 = 118 mm '
 'de ejemplo, no fijo para todos los formatos). Por encima de ese '
 'límite, el haz de la fotocélula ya está cortado por la pila antes '
 'de que las mordazas empiecen a bajar, y no queda ninguna '
 'transición que detectar. Ver la alarma "TO lectura altura pila".'),

('bs08.divisor.parametro.distancia_ft_cinta_divisor', 'BS08', 'Divisor', 'parametro',
 'Distancia FT cinta/divisor',
 'Distancia entre la fotocélula de salida de los apiladores y el '
 'punto donde debe pararse la pila para poder dividirla. Valor '
 'capturado el 09/09/2026: 1212 mm. Se reajusta por formato. Nota de '
 'descarte: regula dónde para la pila en el sentido de avance '
 '(posición horizontal), no la altura a la que se realiza el corte. '
 'No influye en que la división salga alta o baja — para eso ver '
 '"Offset posición recogida", "Intereje FT/mordaza" o "Posición '
 'espera".'),

('bs08.divisor.alarma.to_lectura_altura_pila', 'BS08', 'Divisor', 'alarma',
 'TO lectura altura pila',
 'Salta si, durante el descenso de las mordazas hacia la pila, la '
 'fotocélula de medición de altura no detecta la transición esperada '
 '(de libre a cortada) dentro del rango medible del montaje. Se '
 'dispara por dos causas opuestas que dan la misma alarma: pila '
 'demasiado baja (altura de pila menor que "Intereje FT/mordaza" — '
 'el haz nunca llega a cortarse aunque la mordaza baje hasta el '
 'fondo) o pila demasiado alta (altura de pila mayor que "Posición '
 'espera" + "Intereje FT/mordaza" — el haz ya está cortado por la '
 'pila antes de que las mordazas empiecen a bajar). La alarma por sí '
 'sola no distingue entre ambos casos; hay que comparar la altura '
 'real de la pila con el rango medible del montaje actual.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
