-- Borrador — Divisor (BS08): 10 alarmas + hallazgos derivados.
-- Para revisión antes de aplicar.
-- Origen: sesión de alarmas del mecánico (11/09/2026).
--
-- Decisión de formato para esta sesión de alarmas: cada alarma en
-- UNA fila, significado + solución juntos en "contenido" (a
-- diferencia del criterio previo de dejar la resolución aparte).
--
-- Contenido:
--   1) Dato general de máquina (submaquina NULL): sensores MC
--      (inductivos), tipos pistón/calibrado, todos PNP normalmente
--      abiertos.
--   2) Nuevo sensor: MC del pistón de la mordaza (uno por lado).
--   3) Actualiza "Pistón de la mordaza" con la referencia a "cilindro"
--      y al sensor MC.
--   4) Dos parámetros nuevos: "Altura pila" y "Tolerancia altura
--      pila" (campos reales de la pantalla Divisor, antes solo
--      referidos de forma indirecta).
--   5) Actualiza el procedimiento de verificación del intereje con
--      los nombres de campo ya confirmados.
--   6) 10 alarmas del Divisor. La alarma "TO lectura pila" sustituye
--      y corrige el nombre de la alarma inferida anteriormente
--      ("TO lectura altura pila"), misma clave.
--
-- Pendiente sin resolver: alarmas 1 y 2 tienen texto idéntico en lo
-- entregado; no se ha confirmado si hay un matiz real que las
-- distinga.

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.contexto.sensores_mc_inductivos', 'BS08', null, 'sensor',
 'Sensores MC (inductivos): tipos y tecnología',
 '"MC" es como se llama en esta planta a los sensores inductivos. '
 'Se usan sobre todo dos tipos, según qué detectan: sensor de '
 'pistón (detecta el imán que lleva el propio pistón por dentro; se '
 'activa —cierra su contacto— cuando el imán está cerca) y sensor '
 'de calibrado (detecta la proximidad de un metal, no un imán; se '
 'activa —cierra su contacto— cuando ese metal se acerca). Todos '
 'los sensores usados en la máquina son PNP, normalmente abiertos: '
 'el contacto está abierto en reposo y se cierra al activarse el '
 'sensor.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.divisor.sensor.mc_piston_mordaza', 'BS08', 'Divisor', 'sensor',
 'Sensor MC del pistón de la mordaza (uno por lado)',
 'Sensor inductivo tipo MC, uno en el pistón derecho y otro en el '
 'izquierdo — ver "Pistón de la mordaza". Detecta el imán interno '
 'del propio pistón; se activa (cierra contacto) cuando el pistón '
 'está en reposo. Si no está excitado con el cilindro en reposo, '
 'salta "Divisor anomalía MC cilindro derecho/izquierdo" — puede ser '
 'fallo del cilindro o del sensor; se soluciona ajustando la '
 'posición del sensor si es necesario.'),

('bs08.divisor.actuador.pision_mordaza', 'BS08', 'Divisor', 'actuador',
 'Pistón de la mordaza',
 'Pistón grande, guiado y fuerte, al que va sujeta la mordaza '
 'vulcanizada de cada lado. En las alarmas de la máquina se le '
 'llama "cilindro derecho/izquierdo". Lleva un sensor MC interno '
 'que detecta un imán del propio pistón — ver '
 '"bs08.divisor.sensor.mc_piston_mordaza".'),

('bs08.divisor.parametro.altura_pila', 'BS08', 'Divisor', 'parametro',
 'Altura pila',
 'Campo de la pantalla "Divisor" (formato). Es el valor configurado/'
 'objetivo de la altura esperada de la pila — coincide con lo '
 'descrito antes como "altura prevista". Se compara contra la '
 'altura realmente medida por la fotocélula; si la diferencia '
 'supera la "Tolerancia altura pila", salta la alarma "Error lectura '
 'pila". Se reajusta por formato.'),

('bs08.divisor.parametro.tolerancia_altura_pila', 'BS08', 'Divisor', 'parametro',
 'Tolerancia altura pila',
 'Campo de la pantalla "Divisor" (formato). Margen permitido entre '
 'la altura de pila configurada ("Altura pila") y la altura '
 'realmente medida, antes de que salte la alarma "Error lectura '
 'pila". El mecánico la describe habitualmente como equivalente a '
 '"una pieza" (9-11 mm, el grosor típico de un azulejo — ver '
 '"Contexto: naturaleza de la pila").'),

('bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza', 'BS08', 'Divisor', 'mantenimiento',
 'Verificación del Intereje FT/mordaza (medición manual)',
 'Procedimiento para comprobar si el Intereje FT/mordaza programado '
 'coincide con la posición física real de la fotocélula. Con la '
 'máquina en manual, se deja entrar una pila y se deja que el '
 'divisor la mida sin dividir. En la pantalla "Divisor" se lee la '
 '"Altura medida" — lo que el divisor ha calculado que mide la pila '
 'con el intereje programado actual (valor de lectura en vivo, no '
 'configurable; los campos "Altura pila" y "Tolerancia altura pila" '
 'de esa misma pantalla ya están documentados aparte). A la vez, se '
 'mide la misma pila físicamente con un metro. Si la medida con '
 'metro da un valor MAYOR que la "Altura medida" de la máquina, el '
 'intereje real es mayor que el programado (la fotocélula física '
 'está más arriba de lo que dice el parámetro) — hay que aumentar el '
 'valor programado en la diferencia medida (p. ej., si el metro da '
 '20 mm más, subir el intereje 20 mm). Si diera un valor MENOR, '
 'sería el caso contrario.'),

('bs08.divisor.alarma.no_calibrado', 'BS08', 'Divisor', 'alarma',
 'Divisor no calibrado',
 'Uno de los motores del divisor se ha bloqueado en su movimiento. '
 'Solución: comprobar los sensores del divisor y quitar los '
 'eventuales obstáculos que hayan bloqueado el motor; realizar la '
 'calibración del divisor. Nota: el texto entregado es idéntico al '
 'de "Divisor fuera de posición" — pendiente de confirmar si hay '
 'algún matiz real que las distinga.'),

('bs08.divisor.alarma.fuera_de_posicion', 'BS08', 'Divisor', 'alarma',
 'Divisor fuera de posición',
 'Uno de los motores del divisor se ha bloqueado en su movimiento. '
 'Solución: comprobar los sensores del divisor y quitar los '
 'eventuales obstáculos que hayan bloqueado el motor; realizar la '
 'calibración del divisor. Nota: el texto entregado es idéntico al '
 'de "Divisor no calibrado" — pendiente de confirmar si hay algún '
 'matiz real que las distinga.'),

('bs08.divisor.alarma.anomalia_mc_cilindro_derecho', 'BS08', 'Divisor', 'alarma',
 'Divisor anomalía MC cilindro derecho',
 'El sensor MC del cilindro (pistón) derecho no está excitado con '
 'el cilindro en reposo, cuando debería marcar. Solución: comprobar '
 'el funcionamiento del cilindro y del sensor; ajustar la posición '
 'del sensor si es necesario.'),

('bs08.divisor.alarma.anomalia_mc_cilindro_izquierdo', 'BS08', 'Divisor', 'alarma',
 'Divisor anomalía MC cilindro izquierdo',
 'El sensor MC del cilindro (pistón) izquierdo no está excitado con '
 'el cilindro en reposo, cuando debería marcar. Solución: comprobar '
 'el funcionamiento del cilindro y del sensor; ajustar la posición '
 'del sensor si es necesario.'),

('bs08.divisor.alarma.to_lectura_altura_pila', 'BS08', 'Divisor', 'alarma',
 'TO lectura pila',
 'Durante la bajada para medir la altura de la pila, el divisor ha '
 'llegado al punto más bajo de su recorrido sin que la fotocélula '
 'de medición de altura haya llegado a realizar la lectura. Esto '
 'coincide con el análisis derivado antes por inferencia: pasa tanto '
 'si la pila es demasiado baja (el haz nunca llega a cortarse) como '
 'si es demasiado alta (el haz ya estaba cortado antes de empezar a '
 'bajar) — la alarma no distingue por sí sola entre los dos casos. '
 'Solución: comprobar el funcionamiento de la fotocélula, el '
 'movimiento de los motores del divisor, y la cuota configurada en '
 '"Posición espera" (pantalla Divisor).'),

('bs08.divisor.alarma.error_lectura_pila', 'BS08', 'Divisor', 'alarma',
 'Divisor error lectura pila',
 'Se ha detectado una altura de pila distinta a la configurada en '
 '"Altura pila" (pantalla Divisor), fuera del margen de "Tolerancia '
 'altura pila". Solución: comprobar el número real de piezas '
 'presentes en la pila, y verificar las cuotas configuradas en '
 '"Altura pila" y "Tolerancia altura pila".'),

('bs08.divisor.alarma.no_calibrado_off_derecha', 'BS08', 'Divisor', 'alarma',
 'Divisor no calibrado OFF derecha',
 'El motor derecho del divisor se ha bloqueado en su movimiento: '
 'debería haber liberado (dejado de excitar) el sensor de calibrado '
 'derecho, y ese sensor sigue activo. Solución: comprobar el sensor '
 'bajo derecho del divisor y el eventual atasco del motor; realizar '
 'la calibración del divisor.'),

('bs08.divisor.alarma.no_calibrado_off_izquierda', 'BS08', 'Divisor', 'alarma',
 'Divisor no calibrado OFF izquierda',
 'El motor izquierdo del divisor se ha bloqueado en su movimiento: '
 'debería haber liberado (dejado de excitar) el sensor de calibrado '
 'izquierdo, y ese sensor sigue activo. Solución: comprobar el '
 'sensor bajo izquierdo del divisor y el eventual atasco del motor; '
 'realizar la calibración del divisor.'),

('bs08.divisor.alarma.no_calibrado_on_derecha', 'BS08', 'Divisor', 'alarma',
 'Divisor no calibrado ON derecha',
 'El motor derecho del divisor se ha bloqueado en su movimiento: la '
 'posición actual debería excitar el sensor de calibrado derecho '
 '(abajo), y ese sensor todavía no está activo. Solución: comprobar '
 'el sensor de calibrado derecho del divisor y el eventual atasco '
 'del motor; realizar la calibración del divisor.'),

('bs08.divisor.alarma.no_calibrado_on_izquierda', 'BS08', 'Divisor', 'alarma',
 'Divisor no calibrado ON izquierda',
 'El motor izquierdo del divisor se ha bloqueado en su movimiento: '
 'la posición actual debería excitar el sensor de calibrado '
 'izquierdo (abajo), y ese sensor todavía no está activo. Solución: '
 'comprobar el sensor de calibrado izquierdo del divisor y el '
 'eventual atasco del motor; realizar la calibración del divisor.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
