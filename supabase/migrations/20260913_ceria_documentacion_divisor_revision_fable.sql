-- Sincroniza ceria_documentacion_maquina con la revisión del Divisor
-- (BS08) preparada por Fable tras hablar con el mecánico -- sesión
-- 12-13/09/2026.
--
-- Contenido de esta migración:
--   1) Corrige clave con typo: bs08.divisor.actuador.pision_mordaza
--      -> piston_mordaza (mismo id, solo se arregla clave/nombre/contenido).
--   2) Inserta 2 parámetros nuevos que faltaban y que explicitan el
--      mecanismo ya acordado (la cota de corte sale de dividir la
--      altura medida entre el número de divisiones, y es la MISMA
--      en todas las divisiones del ciclo):
--        - bs08.divisor.parametro.numero_divisiones_por_pila
--        - bs08.divisor.parametro.lectura_altura_pila
--   3) Actualiza 27 filas existentes (alarmas, diagnóstico,
--      mantenimiento, parámetros, proceso, sensores) con el
--      contenido revisado. Mantiene todo lo ya corregido en las
--      migraciones anteriores (terminología caja/pila, dirección
--      sobra/falta en vez de última/cualquiera) y añade detalle
--      mecánico adicional (p. ej. desgaste de la mordaza vulcanizada
--      como causa de "sobra pieza"; magnitud del efecto del Offset
--      vs. el Intereje en la cota de corte).
--   4) Limpieza adicional respecto al archivo de Fable: en la alarma
--      "TO lectura altura pila" se ha quitado el resto de texto
--      "esto coincide con el análisis derivado antes por inferencia"
--      (mismo tipo de comentario meta que ya se había limpiado antes
--      en otra fila) -- el resto de esa fila queda igual.
--
-- No toca ninguna otra submáquina ni ningún dato fuera de Divisor.

update ceria_documentacion_maquina set
  clave = 'bs08.divisor.actuador.piston_mordaza',
  nombre = 'Pistón de la mordaza',
  contenido = 'Pistón grande, guiado y fuerte, al que va sujeta la mordaza vulcanizada de cada lado. En las alarmas de la máquina se le llama "cilindro derecho/izquierdo". Lleva un sensor magnético MC que detecta el imán del propio émbolo — ver "bs08.divisor.sensor.mc_piston_mordaza".',
  updated_at = now()
where clave = 'bs08.divisor.actuador.pision_mordaza';

insert into ceria_documentacion_maquina
  (id, clave, maquina, submaquina, tipo, nombre, contenido, activo)
values
  ('49f8af08-ca1d-45ff-bf3f-f63323ce8b1b', 'bs08.divisor.parametro.numero_divisiones_por_pila', 'BS08', 'Divisor', 'parametro', 'Número de divisiones por pila', 'Campo de la pantalla Formato → Divisor. Número de cortes que el divisor hace a cada pila completa (= número de cajas que salen de una pila). Es el dato con el que se calcula la cota de corte en modo normal: cota de corte = Lectura altura pila ÷ Número de divisiones por pila (p. ej. 225 mm ÷ 5 = 45 mm). Como cada caja tiene la misma altura y la pila restante vuelve a apoyarse en las cadenas tras cada avance, la cota de corte es la MISMA en todas las divisiones del ciclo. La máquina no conoce el espesor de pieza ni cuenta piezas: reparte altura. Por eso, si la pila trae una pieza de más o de menos y pasa la tolerancia, el reparto sale mal en todas las cajas. Se reajusta por formato.', true)
on conflict (id) do update set
  clave = excluded.clave,
  nombre = excluded.nombre,
  contenido = excluded.contenido,
  updated_at = now();

insert into ceria_documentacion_maquina
  (id, clave, maquina, submaquina, tipo, nombre, contenido, activo)
values
  ('056b66ed-f42f-4f78-a8c9-7474e608f613', 'bs08.divisor.parametro.lectura_altura_pila', 'BS08', 'Divisor', 'parametro', 'Lectura altura pila', 'Campo informativo (no configurable) de la pantalla Formato → Divisor. Muestra la altura que la fotocélula ha medido en la última pila durante la bajada de las mordazas. Se compara con "Altura pila" usando "Tolerancia altura pila". Es también el dato que se usa en la verificación manual del intereje: si el metro da un valor distinto a esta lectura, el "Intereje FT/mordaza" programado no coincide con el real — ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza".', true)
on conflict (id) do update set
  clave = excluded.clave,
  nombre = excluded.nombre,
  contenido = excluded.contenido,
  updated_at = now();
update ceria_documentacion_maquina set
  contenido = 'La altura medida por la fotocélula (mostrada en "Lectura altura pila", pantalla Formato → Divisor) difiere de la configurada en "Altura pila" en más de la "Tolerancia altura pila". Es la única comprobación de la máquina de que la pila trae el número de piezas esperado, porque el divisor no cuenta piezas: reparte la altura medida entre el "Número de divisiones por pila". Solución: comprobar el número real de piezas presentes en la pila y verificar las cuotas configuradas en "Altura pila" y "Tolerancia altura pila". Si la pila es correcta y la lectura se desvía siempre en la misma dirección, revisar el "Intereje FT/mordaza".',
  updated_at = now()
where clave = 'bs08.divisor.alarma.error_lectura_pila';

update ceria_documentacion_maquina set
  contenido = 'Uno de los motores del divisor se ha bloqueado en su movimiento. Solución: comprobar los sensores del divisor y quitar los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del divisor. Nota: el texto es literal del manual/documentación técnica oficial del fabricante, que usa exactamente la misma descripción para "Divisor no calibrado". No es un error de transcripción; el fabricante no documenta ningún matiz que las distinga.',
  updated_at = now()
where clave = 'bs08.divisor.alarma.fuera_de_posicion';

update ceria_documentacion_maquina set
  contenido = 'Uno de los motores del divisor se ha bloqueado en su movimiento. Solución: comprobar los sensores del divisor y quitar los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del divisor. Nota: el texto es literal del manual/documentación técnica oficial del fabricante, que usa exactamente la misma descripción para "Divisor fuera de posición". No es un error de transcripción; el fabricante no documenta ningún matiz que las distinga.',
  updated_at = now()
where clave = 'bs08.divisor.alarma.no_calibrado';

update ceria_documentacion_maquina set
  contenido = 'El motor derecho del divisor se ha bloqueado en su movimiento: debería haber liberado (dejado de excitar) el sensor de calibrado (sensor bajo) derecho, y ese sensor sigue activo. Solución: comprobar el sensor de calibrado (sensor bajo) derecho del divisor y el eventual atasco del motor; realizar la calibración del divisor.',
  updated_at = now()
where clave = 'bs08.divisor.alarma.no_calibrado_off_derecha';

update ceria_documentacion_maquina set
  contenido = 'El motor izquierdo del divisor se ha bloqueado en su movimiento: debería haber liberado (dejado de excitar) el sensor de calibrado (sensor bajo) izquierdo, y ese sensor sigue activo. Solución: comprobar el sensor de calibrado (sensor bajo) izquierdo del divisor y el eventual atasco del motor; realizar la calibración del divisor.',
  updated_at = now()
where clave = 'bs08.divisor.alarma.no_calibrado_off_izquierda';

update ceria_documentacion_maquina set
  contenido = 'El motor derecho del divisor se ha bloqueado en su movimiento: la posición actual debería excitar el sensor de calibrado (sensor bajo) derecho, y ese sensor todavía no está activo. Solución: comprobar el sensor de calibrado (sensor bajo) derecho del divisor y el eventual atasco del motor; realizar la calibración del divisor.',
  updated_at = now()
where clave = 'bs08.divisor.alarma.no_calibrado_on_derecha';

update ceria_documentacion_maquina set
  contenido = 'El motor izquierdo del divisor se ha bloqueado en su movimiento: la posición actual debería excitar el sensor de calibrado (sensor bajo) izquierdo, y ese sensor todavía no está activo. Solución: comprobar el sensor de calibrado (sensor bajo) izquierdo del divisor y el eventual atasco del motor; realizar la calibración del divisor.',
  updated_at = now()
where clave = 'bs08.divisor.alarma.no_calibrado_on_izquierda';

update ceria_documentacion_maquina set
  contenido = 'Durante la bajada para medir la altura de la pila, el divisor ha llegado al punto más bajo de su recorrido sin que la fotocélula de medición de altura haya llegado a realizar la lectura. Pasa tanto si la pila es demasiado baja (el haz nunca llega a cortarse) como si es demasiado alta (el haz ya estaba cortado antes de empezar a bajar) — la alarma no distingue por sí sola entre los dos casos. Solución: comprobar el funcionamiento de la fotocélula, el movimiento de los motores del divisor, y la cuota configurada en "Posición espera" (pantalla Divisor). Si la pila queda estructuralmente fuera del rango medible (por debajo del "Intereje FT/mordaza", p. ej. formato 120x120 de 4 piezas), la solución no es ajustar nada sino trabajar con "División de la pila sin fotocélula" y una "Cuota de división de la pila" fija.',
  updated_at = now()
where clave = 'bs08.divisor.alarma.to_lectura_altura_pila';

update ceria_documentacion_maquina set
  contenido = 'Paso 0 — descartar mecánica antes que parámetro: si el fallo es errático (a veces sobra, a veces falta, sin patrón claro, y/o va acompañado de piezas rotas o ruido), sospechar fallo mecánico, no paramétrico — ver "bs08.divisor.mantenimiento.criterio_mecanico_vs_parametro" y las pruebas de juego/balanceo. Solo seguir con lo siguiente si el fallo tiene una dirección CONSISTENTE (siempre sobra, o siempre falta pieza) — puede aparecer en cualquier división del ciclo, de forma no siempre predecible (el margen de corte es muy ajustado, y una pieza puede escaparse o quedarse pillada en cualquier corte); lo relevante no es EN QUÉ división pasa, sino en qué DIRECCIÓN falla siempre. Pregunta clave: cuando falla, ¿la caja sale con una pieza DE MÁS, o con una pieza DE MENOS? → Si SOBRA pieza (el divisor está dividiendo demasiado arriba): subir "Offset posición recogida" dentro de su rango (0-3 mm) — es el ajuste habitual y más sencillo. Comprobar también el desgaste de la parte baja de la mordaza vulcanizada (ver "bs08.divisor.pieza.mordaza_vulcanizada"): una mordaza desgastada divide más arriba y da exactamente este síntoma; si el desgaste es grande, sustituirla en vez de seguir compensando con offset. Si el offset ya está al límite y el síntoma persiste, el desajuste es mayor de lo que el offset puede absorber por sí solo: revisar y corregir "Intereje FT/mordaza" (ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza"). → Si FALTA pieza (el divisor está dividiendo demasiado abajo): "Offset posición recogida" NO puede corregir esto bajo ningún concepto, porque solo admite corregir hacia abajo, nunca hacia arriba — hay que revisar y corregir directamente "Intereje FT/mordaza". Antes, comprobar que el operario no ha dejado "Offset posición recogida" alto de un formato anterior. Recordar que la cota de corte = altura medida ÷ número de divisiones: el error de intereje llega al corte dividido por ese número.',
  updated_at = now()
where clave = 'bs08.divisor.diagnostico.divide_mal';

update ceria_documentacion_maquina set
  contenido = 'Con la mecánica verificada, se colocan los sensores de calibrado (sensores bajos) a ojo, más o menos a la misma altura en ambos lados. Se ejecuta un calibrado: los dos lados bajan a buscar su sensor, siguen bajando los mm del "Offset calibr." y toman esa cota como 0. En manual, se cierran las mordazas y se observa visualmente la altura a la que quedan sobre las cadenas de tracción de la empaquetadora — debe estar entre 1 y 2 mm por encima de las cadenas. Esta es la altura a la que el divisor suelta la pila entre división y división; si suelta demasiado alto hace ruido, golpea, y puede llegar a romper piezas. Si los dos lados no coinciden dentro de ese margen, se reajusta la posición física de los sensores y se repite el calibrado, hasta que ambos lados queden exactamente igual.',
  updated_at = now()
where clave = 'bs08.divisor.mantenimiento.ajuste_cero_02_sensores_calibrado';

update ceria_documentacion_maquina set
  contenido = 'Una vez la máquina mide correctamente la pila (paso 4), se observa a qué altura está haciendo las divisiones y, si hace falta, se corrige HACIA ABAJO con el Offset posición recogida (nunca hacia arriba, el parámetro no lo permite). En un ajuste completamente nuevo casi siempre hace falta esta corrección: durante el calibrado (paso 2) se dejó 1-2 mm de margen entre la mordaza cerrada y las cadenas, para evitar el golpe al soltar la pila. Como todas las cotas se miden desde ese cero, la cota de corte queda esos 1-2 mm por encima de lo que tocaría aunque el intereje ya esté midiendo bien — por eso, en un ajuste desde cero, suele hacer falta bajar la división 1-2 mm con este offset, incluso sin que nadie lo haya tocado antes.',
  updated_at = now()
where clave = 'bs08.divisor.mantenimiento.ajuste_cero_05_offset_final';

update ceria_documentacion_maquina set
  contenido = 'Procedimiento para comprobar si el Intereje FT/mordaza programado coincide con la posición física real de la fotocélula. Con la máquina en manual, se deja entrar una pila y se deja que el divisor la mida sin dividir. En la pantalla Formato → Divisor se lee "Lectura altura pila" — lo que el divisor ha calculado que mide la pila con el intereje programado actual (valor informativo, no configurable). A la vez, se mide la misma pila físicamente con un metro. Si la medida con metro da un valor MAYOR que la "Lectura altura pila" de la máquina, el intereje real es mayor que el programado (la fotocélula física está más arriba de lo que dice el parámetro) — hay que aumentar el valor programado en la diferencia medida (p. ej., si el metro da 20 mm más, subir el intereje 20 mm). Si diera un valor MENOR, sería el caso contrario. Nota sobre el efecto en el corte: corregir el intereje mueve la cota de corte solo en la diferencia dividida por el "Número de divisiones por pila" (20 mm de intereje con 5 divisiones = 4 mm de corte), porque la cota de corte es altura medida ÷ número de divisiones.',
  updated_at = now()
where clave = 'bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza';

update ceria_documentacion_maquina set
  contenido = 'Campo de la pantalla Formato → Divisor. Es la altura que el operario le dice a la máquina que debería medir la pila completa (p. ej. 225 mm). Trabaja junto con otros dos datos de la misma pantalla: "Lectura altura pila" (informativo, lo que la fotocélula ha medido realmente) y "Tolerancia altura pila" (margen admitido). Si |Lectura − Altura pila| supera la tolerancia, salta la alarma "Error lectura pila" y no se divide; si está dentro, la pila se da por buena y se efectúan las divisiones. Se reajusta por formato.',
  updated_at = now()
where clave = 'bs08.divisor.parametro.altura_pila';

update ceria_documentacion_maquina set
  contenido = 'Cota de corte fija, en mm desde el cero del divisor, usada cuando "División de la pila sin fotocélula" está en "Sí". Valor capturado: 14 mm (campo inactivo en esta línea por estar la opción en "No"). Con 14 mm, el divisor cierra las mordazas a 14 mm en cada división (≈ una pieza de 9-11 mm más margen), tantas veces como indique "Número de divisiones por pila", sin medir la pila. Se reajusta por formato.',
  updated_at = now()
where clave = 'bs08.divisor.parametro.cuota_division_pila';

update ceria_documentacion_maquina set
  contenido = 'Booleano de la pantalla Formato → Divisor. Capturado en "No" en esta línea. En "No" (modo normal), el divisor mide la pila con la fotocélula y calcula la cota de corte; el campo "Cuota de división de la pila" queda en gris/inactivo. En "Sí", el divisor NO mide la pila: corta siempre a la cota fija indicada en "Cuota de división de la pila", tantas veces como diga "Número de divisiones por pila". Es la opción para formatos cuya pila no es medible con el montaje actual de la fotocélula — típicamente pilas más bajas que el "Intereje FT/mordaza" (p. ej. formato 120x120, 4 piezas, unos 40 mm de pila frente a un intereje de 68 mm). El 120x120 se divide siempre así, con la cota asignada a mano. En este modo no aplica la comprobación "Altura pila / Tolerancia".',
  updated_at = now()
where clave = 'bs08.divisor.parametro.division_sin_fotocelula';

update ceria_documentacion_maquina set
  contenido = 'Altura de la fotocélula de medición (sobre las mordazas) respecto a la parte baja de la mordaza — es la fotocélula que mide la altura de la pila para calcular las divisiones. Valor capturado: 68 mm. Dato constructivo/físico: NO se reajusta como parte de un cambio de formato rutinario. Solo cambia si se manipula físicamente la posición de la fotocélula — por accidente (golpe, deformación) o, más raramente, de forma deliberada, cuando un formato nuevo trae una pila cuya altura real queda fuera del rango medible con el montaje actual. Relación derivada: como la mordaza nunca baja por debajo de su posición de calibrado (el cero, que queda 1-2 mm por encima de las cadenas — ver "Offset calibr.") y la fotocélula va siempre a esta distancia por encima de la mordaza, este valor es la altura MÍNIMA de pila medible por fotocélula. Ver "Posición espera" para el límite superior del rango, y la alarma "TO lectura altura pila" para el síntoma cuando la pila cae fuera de rango. Para formatos con pila más baja que este valor (p. ej. 120x120 de 4 piezas) se trabaja con "División de la pila sin fotocélula" y cota fija, no se mueve la fotocélula. Diagnóstico adicional: si el intereje programado está por DEBAJO del real (la fotocélula física está, en realidad, más arriba de lo programado), la máquina SUBESTIMA la altura de la pila y calcula cada corte más abajo de lo que toca — el divisor divide demasiado abajo, con riesgo de que FALTE alguna pieza en cualquier caja del ciclo (nunca se corrige con "Offset posición recogida", que solo permite ir hacia abajo). Si el intereje programado está por ENCIMA del real (la fotocélula física está, en realidad, más abajo de lo programado), la máquina SOBREESTIMA la altura de la pila y calcula cada corte más arriba de lo que toca — el divisor divide demasiado arriba, con riesgo de que SOBRE alguna pieza en cualquier caja del ciclo; si el desajuste es pequeño puede quedar absorbido dentro del rango de "Offset posición recogida" (0-3 mm), pero si es mayor persistirá incluso con el offset al límite. Magnitud del efecto: el error de intereje entra entero en la altura medida, pero la cota de corte es altura ÷ "Número de divisiones por pila", así que al corte solo llega dividido por el número de divisiones (20 mm de error de intereje con 5 divisiones = 4 mm de error en el corte). A diferencia del "Offset posición recogida", que mueve el corte 1 mm por cada mm. En ambos casos el fallo puede aparecer en cualquier división del ciclo, no en una posición fija — lo que distingue la causa es la DIRECCIÓN del error (sobra/falta), no en qué caja concreta ocurre. Ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza" para el procedimiento de verificación y corrección.',
  updated_at = now()
where clave = 'bs08.divisor.parametro.intereje_ft_mordaza';

update ceria_documentacion_maquina set
  contenido = 'Parámetro de software que define el cero del divisor junto con la posición física del sensor de calibrado (sensor bajo). Al calibrar, cada lado baja hasta que su sensor de calibrado empieza a leer y sigue bajando exactamente esta distancia; el punto donde se detiene es el cero de la máquina (cota 0). Es decir: cero = punto donde el sensor empieza a leer + Offset calibr. Valor capturado: 8 mm. Habitualmente entre 4 y 8 mm; nunca puede ser 0 (a diferencia de otros offsets de la máquina). Con offset 8, el sensor empieza a leer 8 mm por encima del cero, o sea a 9-10 mm sobre las cadenas. El ajuste fino se hace moviendo físicamente el sensor arriba o abajo en el chasis del divisor hasta que, tras calibrar, la mordaza cerrada quede 1-2 mm por encima de las cadenas de tracción, igual en ambos lados. Ese margen de 1-2 mm es deliberado: al soltar la pila entre división y división evita que las mordazas la fuercen contra las cadenas; si el cero quedara más alto, soltaría la pila desde demasiado alto, con golpe y riesgo de romper piezas. Relación con "Offset posición recogida": como el cero queda 1-2 mm por encima de las cadenas reales, toda cota de corte calculada desde ese cero queda ese mismo margen por encima de lo que tocaría — por eso, en un ajuste desde cero, casi siempre hay que aplicar 1-2 mm de Offset posición recogida para compensarlo.',
  updated_at = now()
where clave = 'bs08.divisor.parametro.offset_calibracion';

update ceria_documentacion_maquina set
  contenido = 'Corrige la posición calculada para la división, permitiendo realizarla solo más abajo de la calculada — a más valor, más abajo. No admite valores negativos (no se puede corregir hacia arriba). Rango habitual: 0 a 3 mm. Valor capturado: 1 mm. Se reajusta por formato. Actúa directamente sobre la cota de corte (1 mm de offset = 1 mm de corte), a diferencia del error de intereje, que llega al corte dividido por el número de divisiones. Uso típico: compensar el margen de 1-2 mm que el cero queda por encima de las cadenas (ver "Offset calibr.") o un ligero desgaste de la mordaza vulcanizada. Diagnóstico: si la caja llega con MÁS piezas de las que le tocan (o "se escapa una pieza" hacia esa caja) — puede pasar en cualquier división del ciclo, no en una posición fija —, es síntoma de que el divisor está dividiendo demasiado arriba: este es el ajuste habitual y más sencillo para corregirlo, aumentando el offset dentro de su rango. Si el offset ya está al límite y el síntoma persiste, el desajuste es mayor de lo que este offset puede absorber por sí solo — ver "Intereje FT/mordaza". Si en cambio falta alguna pieza, este offset no puede corregirlo bajo ningún concepto (no admite ir hacia arriba): ver directamente "Intereje FT/mordaza".',
  updated_at = now()
where clave = 'bs08.divisor.parametro.offset_posicion_recogida';

update ceria_documentacion_maquina set
  contenido = 'Altura (cota de la mordaza) a la que esperan las mordazas una nueva pila que llega de los apiladores. No hace falta que la mordaza quede por encima de la pila: lo que tiene que quedar por encima de la pila es la fotocélula, que va "Intereje FT/mordaza" por encima de la mordaza. Condición: Posición espera + Intereje FT/mordaza > altura de la pila. Valor capturado: 50 mm. Se reajusta por formato. Relación derivada: junto con "Intereje FT/mordaza", define el límite superior de altura de pila medible por fotocélula = posición espera + intereje FT/mordaza (con los valores capturados, 50 + 68 = 118 mm de ejemplo, no fijo para todos los formatos). Por encima de ese límite, el haz de la fotocélula ya está cortado por la pila antes de que las mordazas empiecen a bajar, y no queda ninguna transición que detectar. Ver la alarma "TO lectura altura pila".',
  updated_at = now()
where clave = 'bs08.divisor.parametro.posicion_espera';

update ceria_documentacion_maquina set
  contenido = 'Campo configurable de la pantalla Formato → Divisor. Margen permitido entre "Altura pila" (configurada) y "Lectura altura pila" (medida) antes de que salte la alarma "Error lectura pila". Se suele tener entre 9 y 12 mm, es decir, aproximadamente el grosor de una pieza (9-11 mm, ver "Contexto: naturaleza de la pila"). Ejemplo: con Altura pila 225 mm y tolerancia 12 mm, la máquina da por buena cualquier lectura entre 213 y 237 mm; fuera de ese rango (una pieza de más o de menos, o más) no divide y alarma.',
  updated_at = now()
where clave = 'bs08.divisor.parametro.tolerancia_altura_pila';

update ceria_documentacion_maquina set
  contenido = 'La pila que llega al divisor es una pila de azulejos apilados. Cada azulejo tiene un espesor habitual entre 9 y 11 mm. El número de piezas por pila varía mucho según el formato: desde 4 piezas (formato 120x120 cm) hasta 25 piezas (formato 20x120 cm) — de ahí que la altura total a medir por la fotocélula cambie tanto entre formatos. Sistema de referencia de alturas: el punto 0 es la posición de calibrado del divisor (donde se para la mordaza al calibrar: sensor de calibrado + "Offset calibr."), que queda deliberadamente 1-2 mm por encima de las cadenas de tracción. Todas las cotas del divisor (posición espera, cota de corte, cuota de división) se miden desde ese cero, no desde las cadenas. "Arriba" significa mayor altura numérica (más lejos de las cadenas); "abajo" significa menor altura numérica (más cerca de las cadenas). Convención de términos: "pila" o "pila completa" se refiere siempre al conjunto sin dividir que llega al divisor. "caja" se refiere a la porción ya separada por el divisor que formará una caja — mismo uso que en el resto de la documentación de la sección (Escuadrador, Elevador, Mandril, Jaula).',
  updated_at = now()
where clave = 'bs08.divisor.proceso.00_contexto_pila_y_referencia';

update ceria_documentacion_maquina set
  contenido = 'Cuando la pila para, el divisor (que espera arriba) baja y mide la pila antes de dividirla. Estructura: un motor a cada lado de la pila, cada uno con una mordaza vulcanizada sujeta a un pistón grande, guiado y fuerte. El motor sube y baja este conjunto mediante motor + eje + polea dentada, que actúa sobre una cremallera. Sobre las mordazas hay una fotocélula (emisor en un lado, receptor en el otro) que mide la altura de la pila — el "Intereje FT/mordaza" es la altura de esa fotocélula respecto a la parte baja de la mordaza. Los dos motores son independientes pero trabajan sincronizados. Calibrado: hay un sensor de calibrado (sensor bajo) a cada lado; al calibrar, cada lado baja hasta que el sensor empieza a leer, sigue bajando los mm del "Offset calibr." (habitual 4-8 mm, nunca 0) y ese punto es el cero. El sensor se coloca físicamente de modo que ese cero quede 1-2 mm por encima de las cadenas de tracción.',
  updated_at = now()
where clave = 'bs08.divisor.proceso.02_medicion_corte';

update ceria_documentacion_maquina set
  contenido = '"Posición espera" es la altura a la que esperan las mordazas una nueva pila que llega de los apiladores — basta con que la fotocélula (mordaza + intereje) quede por encima de la pila. Secuencia: llega la pila → las mordazas bajan → en el momento en que la fotocélula emisor/receptor (sobre las propias mordazas) se corta por la pila, ahí se determina su altura → a partir de esa altura medida se calcula a qué cota hay que dividir: cota de corte = altura medida ÷ "Número de divisiones por pila" (p. ej. 225 mm ÷ 5 = 45 mm), más el "Offset posición recogida" hacia abajo si lo hay. Antes de dividir se comprueba que la altura medida está dentro de "Altura pila" ± "Tolerancia altura pila"; si no, alarma "Error lectura pila". Si "División de la pila sin fotocélula" está en "Sí", no se mide y se corta directamente a la "Cuota de división de la pila".',
  updated_at = now()
where clave = 'bs08.divisor.proceso.03_posicion_espera';

update ceria_documentacion_maquina set
  contenido = 'Una vez determinada la altura de la pila (y, si aplica, tras el escuadrado de pila completa del paso 4), si "Escuadra pila" NO está activado las mordazas bajan directamente a la altura a la que corresponde dividir. Al cerrar ahí, las mordazas sujetan toda la pila EXCEPTO las piezas que componen una caja, que quedan libres, apoyadas sobre las cadenas de tracción de la empaquetadora. Como la pila restante vuelve a apoyarse en las cadenas tras cada avance, la cota de corte es la misma en todas las divisiones de la pila.',
  updated_at = now()
where clave = 'bs08.divisor.proceso.05_division_y_sujecion';

update ceria_documentacion_maquina set
  contenido = 'Las cadenas de tracción de la empaquetadora avanzan la caja hasta el escuadrador, mientras el resto de la pila queda sujeto arriba por las mordazas del divisor. Cuando esa caja llega al escuadrador (que cierra para escuadrarla sobre las cadenas), el divisor baja y realiza la siguiente división, repitiendo el proceso: deja una nueva caja sobre las cadenas y sigue sujetando el resto arriba. Es un proceso continuo, sin paradas entre una caja y la siguiente, hasta agotar las divisiones programadas para el formato.',
  updated_at = now()
where clave = 'bs08.divisor.proceso.06_avance_y_ciclo_continuo';

update ceria_documentacion_maquina set
  contenido = 'Sensor inductivo, uno a cada lado, en la parte baja del divisor. En la documentación y en las alarmas aparece indistintamente como "sensor de calibrado" y "sensor bajo": es el mismo sensor. Define el cero de la máquina junto con el "Offset calibr.": al calibrar, la mordaza baja hasta que el sensor empieza a leer, sigue bajando los mm del offset y ese punto es el cero. Ajustable mecánicamente moviendo la posición física del sensor en el chasis, hasta que el cero quede 1-2 mm por encima de las cadenas, igual en ambos lados. Alarmas asociadas: "Divisor no calibrado ON/OFF derecha/izquierda".',
  updated_at = now()
where clave = 'bs08.divisor.sensor.inductivo_calibrado';

update ceria_documentacion_maquina set
  contenido = 'Sensor magnético tipo MC (no inductivo), uno en el pistón derecho y otro en el izquierdo — ver "Pistón de la mordaza". Detecta el imán del propio émbolo del cilindro; se activa (cierra contacto) cuando el pistón está en reposo. Si no está excitado con el cilindro en reposo, salta "Divisor anomalía MC cilindro derecho/izquierdo" — puede ser fallo del cilindro o del sensor; se soluciona ajustando la posición del sensor si es necesario.',
  updated_at = now()
where clave = 'bs08.divisor.sensor.mc_piston_mordaza';
