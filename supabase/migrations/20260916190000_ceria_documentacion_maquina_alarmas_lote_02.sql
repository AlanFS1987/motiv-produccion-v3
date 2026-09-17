-- Borrador — Lote de alarmas BS08 (fotos del manual, sesión 16/09/2026).
-- Para revisión antes de aplicar (mismo criterio que
-- 20260911170000_ceria_documentacion_maquina_divisor_alarmas_01.sql).
--
-- Cubre las submáquinas: Jaula, Hotmelt, Sacabandejas, Quad 01/02/03,
-- Regulaciones, Avisos, Dispositivos de seguridad, Fondo de jaula
-- (cierre fleje), Empujador, Empujador de bandejas, Escuadrador,
-- Starter, Tracción pilas wrap. (Printosh descartado — ver aviso 2.)
--
-- Formato: significado + solución juntos en "contenido" (criterio
-- 11/09/2026), tipo = 'alarma'.
--
-- OJO — puntos a confirmar antes de aplicar (varias de estas
-- submáquinas ya tienen filas en la tabla, capturadas de los .md
-- originales; puede haber solape o contradicción, no se ha
-- comprobado contra el contenido ya existente):
--   1) Sacabandejas, Escuadrador y Empujador de bandejas ya tenían
--      19/14/22 filas respectivamente. Las de aquí son nuevas según
--      las fotos, pero no se ha cruzado alarma por alarma contra lo
--      que ya había — usa "on conflict do update" por clave, así que
--      si alguna clave ya existiera con otro nombre no se duplicaría,
--      pero tampoco se detectaría el posible solape de contenido.
--   2) Las alarmas "Printosh" (anomalía cilindro / nivel de tinta) se
--      han descartado a propósito: esa submáquina no se usa.
--   3) "Empujador: Elevador fuera de posición / no calibrado"
--      (dentro de la sección Empujador) vs. la submáquina "Elevador"
--      ya existente (14 filas) — sin confirmar si es el mismo
--      elevador o uno distinto propio del Empujador.
--   4) "Empujador: Anomalía hotmelt" duplica literalmente el texto
--      de "Hotmelt: Anomalía cola caliente" — se ha dejado como fila
--      aparte (clave distinta) porque aparece en dos secciones del
--      manual, pero es la misma alarma física.
--   5) Los avisos genéricos tipo "ALARMA XXX DESCONOCIDA/DESCONOCIDO"
--      que cierran cada tabla del manual no se han incluido como
--      filas — son el mensaje genérico de fallback, no una alarma
--      real.
--   6) "Starter" solo traía "*** Previsto ***" en la foto — no hay
--      contenido real que capturar todavía, no se incluye fila.
--   7) [RESUELTO con la segunda tanda de fotos] "Tracción pilas
--      wrap: T.O. tránsito pila" ya tiene el contenido completo.
--
--   10) "Tracción pilas wrap: Pila código 0" y "Target lejano" venían
--       marcadas como "No presente" en el manual — no se han incluido
--       como filas porque no aplican a esta máquina.
--   11) Las alarmas de "ALARMAS BANDEJA" (11.3.22) hablan todas del
--       "mandril" (motor, sensores, flejes) — se han mapeado a la
--       submáquina ya existente "Mandril" en vez de crear una
--       submáquina "Bandeja" nueva. Confirmar que es correcto.
--   12) [RESUELTO] Giracajas (tramo posterior wrap) tampoco está
--       instalado en esta máquina — sus 6 alarmas no se incluyen.
--   13) "Bandeja: No calibrado derecho sensor atrás activo" y "...
--       izquierdo sensor alto activo" aparecen agrupadas con el mismo
--       contenido en el manual (posible errata de imprenta cruzando
--       "atrás" con "alto") — transcritas tal cual, sin corregir.
--   8) "Regulaciones: Máquina no vacía" menciona "Tción pilas wrap"
--      en la foto — se ha interpretado como "Tracción pilas wrap".
--   9) Submáquinas nuevas no confirmadas contra la lista maestra de
--      submáquinas de BS08 (Hotmelt, Printosh→Cabezales impresión,
--      Quad 01/02/03, Regulaciones, Avisos, Dispositivos de
--      seguridad, Empujador) — revisar nomenclatura antes de aplicar.

-- =====================================================================
-- JAULA
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.jaula.alarma.mc_jaula_cerrada', 'BS08', 'Jaula', 'alarma',
 'Jaula: Mc jaula cerrada',
 'El sensor del cilindro jaula cerrada no se ha excitado con el '
 'cilindro jaula inactivo. Solución: comprobar el funcionamiento de '
 'los cilindros de la jaula y del correspondiente sensor.'),

('bs08.jaula.alarma.to_salida_pila', 'BS08', 'Jaula', 'alarma',
 'Jaula: T.O. salida pila',
 'La pila presente dentro de la jaula no salió en el tiempo máximo '
 'previsto. Solución: comprobar el posible atasco de la pila, el '
 'funcionamiento del motor, el funcionamiento de la fotocélula a la '
 'salida de la jaula y el tiempo máximo previsto programado en la '
 'diapositiva de la jaula.'),

('bs08.jaula.alarma.mc_fondo_jaula_atras', 'BS08', 'Jaula', 'alarma',
 'Fondo jaula: Mc fondo jaula atrás',
 'El sensor de fondo jaula atrás no está activo con el mando del '
 'cilindro fondo jaula atrás activo y el mando del cilindro fondo '
 'jaula corto atrás activo. Solución: comprobar el funcionamiento del '
 'sensor y del cilindro fondo jaula.'),

('bs08.jaula.alarma.mc_fondo_jaula_adelante', 'BS08', 'Jaula', 'alarma',
 'Fondo jaula: Mc fondo jaula adelante',
 'El sensor de fondo jaula adelante no está activo con el mando del '
 'cilindro fondo jaula adelante activo y el mando del cilindro fondo '
 'jaula corto atrás activo. Solución: comprobar el funcionamiento del '
 'sensor y de los cilindros fondo jaula.'),

('bs08.jaula.alarma.mc_fondo_jaula_alto', 'BS08', 'Jaula', 'alarma',
 'Fondo jaula: Mc fondo jaula alto',
 'El sensor de cilindro jaula alto no está activo con el mando del '
 'cilindro fondo jaula subida activo. Solución: comprobar el '
 'funcionamiento del sensor y del cilindro fondo jaula.'),

('bs08.jaula.alarma.mc_fondo_jaula_bajo', 'BS08', 'Jaula', 'alarma',
 'Fondo jaula: Mc fondo jaula bajo',
 'El sensor de cilindro jaula bajo no está activo con el mando del '
 'cilindro fondo jaula bajada activo. Solución: comprobar el '
 'funcionamiento del sensor y del cilindro fondo jaula.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- HOTMELT
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.hotmelt.alarma.anomalia_cola_caliente', 'BS08', 'Hotmelt', 'alarma',
 'Hotmelt: Anomalía cola caliente',
 'La máquina que suministra la cola en caliente presenta una '
 'anomalía. Solución: comprobar el estado de la máquina de la cola '
 'en caliente.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- SACABANDEJAS (ya existían 19 filas — ver aviso 1 arriba)
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.sacabandejas.alarma.recogida_fallida', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: Recogida fallida',
 'La fotocélula de bandeja a bordo no se ha excitado después de la '
 'recogida de una bandeja. Solución: comprobar la efectiva falta de '
 'recogida de la bandeja, la presencia de bandejas en el almacén de '
 'recogida, el funcionamiento de las ventosas de recogida y de la '
 'fotocélula de bandeja a bordo.'),

('bs08.sacabandejas.alarma.no_calibrado', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: No calibrado',
 'Hay que calibrar el motor de la traslación del sacabandejas. '
 'Solución: realizar la calibración del sacabandeja.'),

('bs08.sacabandejas.alarma.ventosas_no_calibradas', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: Ventosas no calibradas',
 'El motor de la rotación ventosas del sacabandejas se ha bloqueado '
 'en su movimiento. Solución: controlar el sensor de restablecimiento '
 'de las ventosas del sacabandejas y extraer los eventuales '
 'obstáculos que hayan bloqueado el motor; realizar la calibración '
 'del sacabandeja.'),

('bs08.sacabandejas.alarma.to_hacia_recogida', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: T.O. hacia recogida',
 'Durante una operación de recogida, el sacabandejas no ha alcanzado '
 'el almacén en el tiempo máximo previsto. Solución: comprobar el '
 'posible atasco del sacabandejas, el funcionamiento del motor, del '
 'codificador y las cuotas programadas para los almacenes de '
 'bandejas.'),

('bs08.sacabandejas.alarma.to_hacia_deposito', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: T.O. hacia depósito',
 'Durante una operación de depósito, el sacabandejas no ha alcanzado '
 'la cuota de depósito en el tiempo máximo previsto. Solución: '
 'comprobar el posible atasco del sacabandejas, el funcionamiento del '
 'motor, del codificador y las cuotas programadas para el depósito '
 'del recipiente.'),

('bs08.sacabandejas.alarma.anomalia_inverter', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: Anomalía inverter',
 'El inverter presenta una anomalía. Solución: comprobar que el '
 'inversor y el motor conectado a él funcionen correctamente.'),

('bs08.sacabandejas.alarma.anomalia_comunicacion_inverter', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: Anomalía comunicación inverter',
 'Error de comunicaciones con inversor. Solución: comprobar el '
 'funcionamiento correcto de los inverters, la conexión correcta del '
 'cable de comunicación hacia los inverters y la configuración de los '
 'parámetros de comunicación de los inverters como se muestra en el '
 'esquema eléctrico del panel.'),

('bs08.sacabandejas.alarma.tiempo_limite_comunicacion_inverter', 'BS08', 'Sacabandejas', 'alarma',
 'Sacabandejas: Tiempo límite comunicación inverter',
 'Timeout de comunicaciones con inverter. Solución: comprobar el '
 'funcionamiento correcto de los inverters, la conexión correcta del '
 'cable de comunicación hacia los inverters y la configuración de los '
 'parámetros de comunicación de los inverters como se muestra en el '
 'esquema eléctrico del panel.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- QUAD 01 / 02 / 03 (accionamientos genéricos)
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.quad01.alarma.quad_fault', 'BS08', 'Quad 01', 'alarma',
 'Quad 01: Quad fault',
 'Uno de los accionamientos presenta una anomalía. Solución: '
 'controlar el tipo de anomalía en la diapositiva MONITOR QUAD; '
 'controlar el funcionamiento correcto del accionamiento en anomalía '
 'y de los motores conectados a este.'),

('bs08.quad02.alarma.quad_fault', 'BS08', 'Quad 02', 'alarma',
 'Quad 02: Quad fault',
 'Uno de los accionamientos presenta una anomalía. Solución: '
 'controlar el tipo de anomalía en la diapositiva MONITOR QUAD; '
 'controlar el funcionamiento correcto del accionamiento en anomalía '
 'y de los motores conectados a este.'),

('bs08.quad03.alarma.quad_fault', 'BS08', 'Quad 03', 'alarma',
 'Quad 03: Quad fault',
 'Uno de los accionamientos presenta una anomalía. Solución: '
 'controlar el tipo de anomalía en la diapositiva MONITOR QUAD; '
 'controlar el funcionamiento correcto del accionamiento en anomalía '
 'y de los motores conectados a este.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- REGULACIONES
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.regulaciones.alarma.mc_maximo_abierto', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Mc máximo abierto',
 'Durante la ejecución del cambio de formato se ha alcanzado el '
 'final de carrera en la cuota máxima de apertura. Solución, '
 'controlar: que la cuota del formato no sea mayor que el formato '
 'máximo soportado por la máquina; que el sensor de final de carrera '
 'esté situado de la manera correcta.'),

('bs08.regulaciones.alarma.mc_maximo_cerrado', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Mc máximo cerrado',
 'Durante la ejecución del cambio de formato se ha alcanzado el '
 'final de carrera en la cuota máxima de cierre. Solución, '
 'controlar: que la cuota de formato no sea menor que el formato '
 'mínimo soportado por la máquina; que el sensor de final de carrera '
 'esté situado de la manera correcta.'),

('bs08.regulaciones.alarma.maquina_no_vacia', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Máquina no vacía',
 'La máquina no está completamente vacía. Solución: comprobar que no '
 'haya pilas presentes en tracción pilas wrap, divisor, empujador y '
 'jaula.'),

('bs08.regulaciones.alarma.falta_cotas_preset', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Falta cotas preset',
 'En la diapositiva de las regulaciones se deben configurar las '
 'cuotas detectadas durante la fase de instalación/regulación de la '
 'máquina. Solución: introducir la cuota en el caso de que se '
 'conozca, o llevar la máquina a la condición necesaria para '
 'detectar la cuota, realizar la detección e introducir la cuota '
 'detectada.'),

('bs08.regulaciones.alarma.faltan_calibraciones', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Faltan calibraciones',
 'No todos los elementos interesados durante la fase de regulación '
 'automática se han calibrado. Solución: comprobar cada uno de los '
 'elementos y, si el led de calibración parpadea, realizar la '
 'calibración; esta operación solo es necesaria si el elemento '
 'seleccionado está realmente instalado en la máquina.'),

('bs08.regulaciones.alarma.plato_empujador_no_alto', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Plato empujador no alto',
 'Antes de empezar el cambio de formato automático, la máquina lleva '
 'algunos elementos que podrían crear interferencias mecánicas fuera '
 'del radio de acción y activar esta alarma. Indica que el plato '
 'empujador no se detecta en la posición alta deseada. Solución, '
 'comprobar: si el elemento se encuentra en la posición deseada; que '
 'el sensor de posición esté activo; que las cuotas correspondan a '
 'la efectiva posición del elemento.'),

('bs08.regulaciones.alarma.empujador_no_atras', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Empujador no atrás',
 'Antes de empezar el cambio de formato automático, la máquina lleva '
 'algunos elementos que podrían crear interferencias mecánicas fuera '
 'del radio de acción y activar esta alarma. Indica que el empujador '
 'no se detecta en la posición atrás deseada. Solución, comprobar: '
 'si el elemento se encuentra en la posición deseada; que el sensor '
 'de posición esté activo; que las cuotas correspondan a la efectiva '
 'posición del elemento.'),

('bs08.regulaciones.alarma.jaula_no_alta', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Jaula no alta',
 'Antes de empezar el cambio de formato automático, la máquina lleva '
 'algunos elementos que podrían crear interferencias mecánicas fuera '
 'del radio de acción y activar esta alarma. Indica que la jaula no '
 'se detecta en la posición alta deseada. Solución, comprobar: si el '
 'elemento se encuentra en la posición deseada; que el sensor de '
 'posición esté activo; que las cuotas correspondan a la efectiva '
 'posición del elemento.'),

('bs08.regulaciones.alarma.fondo_jaula_no_alto', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Fondo jaula no alto',
 'Antes de empezar el cambio de formato automático, la máquina lleva '
 'algunos elementos que podrían crear interferencias mecánicas fuera '
 'del radio de acción y activar esta alarma. Indica que el fondo de '
 'la jaula no se detecta en la posición alta deseada. Solución, '
 'comprobar: si el elemento se encuentra en la posición deseada; que '
 'el sensor de posición esté activo; que las cuotas correspondan a '
 'la efectiva posición del elemento.'),

('bs08.regulaciones.alarma.fondo_jaula_no_adelante', 'BS08', 'Regulaciones', 'alarma',
 'Regulaciones: Fondo jaula no adelante',
 'Antes de empezar el cambio de formato automático, la máquina lleva '
 'algunos elementos que podrían crear interferencias mecánicas fuera '
 'del radio de acción y activar esta alarma. Indica que el fondo de '
 'la jaula no se detecta en la posición adelante deseada. Solución, '
 'comprobar: si el elemento se encuentra en la posición deseada; que '
 'el sensor de posición esté activo; que las cuotas correspondan a '
 'la efectiva posición del elemento.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- AVISOS
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.avisos.alarma.regulaciones_no_en_formato', 'BS08', 'Avisos', 'alarma',
 'Avisos: Regulaciones no en el formato',
 'Uno o más motores de regulación no están en la posición correcta '
 'para el formato en curso. Solución: realizar el cambio de formato '
 'con los mandos generales.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- DISPOSITIVOS DE SEGURIDAD
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.dispositivos_seguridad.alarma.restablezca_fungiformes_emergencia', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: restablezca los botones fungiformes de emergencia',
 'Se presionó el botón fungiforme rojo de la zona wrap. Solución: '
 'para volver a poner en marcha el wrap y el wrap del tramo '
 'posterior, restablezca el botón fungiforme presionado y reajuste '
 'la alarma con la diapositiva ALARMAS ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.restablezca_barrera_derecha', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Restablezca barrera derecha',
 'Una barrera de la zona wrap está intervenida bloqueando el wrap. '
 'Solución: controle el estado de las barreras fotoeléctricas, '
 'restablezca la marcha del wrap y reajuste la alarma con la '
 'diapositiva ALARMAS ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.restablezca_barrera_izquierda', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Restablezca barrera izquierda',
 'Una barrera de la zona wrap está intervenida bloqueando el wrap. '
 'Solución: controle el estado de las barreras fotoeléctricas, '
 'restablezca la marcha del wrap y reajuste la alarma con la '
 'diapositiva ALARMAS ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.restablezca_barreras', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Restablezca barreras',
 'Una barrera de la zona wrap está intervenida bloqueando el wrap. '
 'Solución: controle el estado de las barreras fotoeléctricas, '
 'restablezca la marcha del wrap y reajuste la alarma con la '
 'diapositiva ALARMAS ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.restablezca_pulsador_parada_wrap', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Restablezca el pulsador de parada del wrap',
 'Se presionó el botón fungiforme de la zona wrap. Solución: para '
 'volver a poner en marcha el wrap, restablezca el botón fungiforme '
 'presionado y reajuste la alarma con la diapositiva ALARMAS '
 'ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.bloqueos_wrap_posterior', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Bloqueos wrap posterior',
 'Las barreras fotoeléctricas de la zona del wrap posterior fueron '
 'intervenidas y bloquean el wrap posterior. Solución: compruebe el '
 'estado de las fotocélulas, restablezca la marcha del tramo '
 'posterior del wrap y reajuste la alarma con la diapositiva ALARMAS '
 'ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.anomalia_barrera_derecha', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Anomalía barrera derecha',
 'Tras el control efectuado en el funcionamiento de las barreras del '
 'wrap, se detectó una anomalía que bloquea el wrap. Solución: '
 'controle el estado de las barreras fotoeléctricas, restablezca la '
 'marcha del wrap y reajuste la alarma con la diapositiva ALARMAS '
 'ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.anomalia_barrera_izquierda', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Anomalía barrera izquierda',
 'Tras el control efectuado en el funcionamiento de las barreras del '
 'wrap, se detectó una anomalía que bloquea el wrap. Solución: '
 'controle el estado de las barreras fotoeléctricas, restablezca la '
 'marcha del wrap y reajuste la alarma con la diapositiva ALARMAS '
 'ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.anomalia_fungiformes_wrap', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Anomalía de los botones fungiformes wrap',
 'El control realizado en el funcionamiento de los botones '
 'fungiformes de emergencia detectó una anomalía que bloquea el '
 'wrap. Solución: controle los botones fungiformes de emergencia del '
 'wrap, restablezca la marcha del wrap y reajuste la alarma con la '
 'diapositiva ALARMAS ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.anomalia_tg_wrap', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Anomalía tg wrap',
 'Tras el control efectuado en el funcionamiento de los '
 'telerruptores de potencia del wrap, se detectó una anomalía que '
 'bloquea el wrap. Solución: controle el funcionamiento de los '
 'telerruptores de potencia del wrap, restablezca la marcha del wrap '
 'y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.'),

('bs08.dispositivos_seguridad.alarma.modulo_seguridad_en_anomalia', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Módulo k100/k101/k102/k110 en anomalía',
 'Anomalía en el módulo de seguridad correspondiente (k100, k101, '
 'k102 o k110). Solución: compruebe el estado del módulo dentro del '
 'panel. Para reconfigurar la alarma hay que apagar y volver a '
 'encender la máquina. Si la alarma se presenta frecuentemente, '
 'compruebe el estado de las conexiones del módulo y eventualmente '
 'sustituya el módulo.'),

('bs08.dispositivos_seguridad.alarma.emergencia_en_linea', 'BS08', 'Dispositivos de seguridad', 'alarma',
 'Dispositivos de seguridad: Emergencia en línea',
 'Emergencia en la línea activa que bloquea la puesta en marcha en '
 'el wrap. Solución: controle el estado de las emergencias en la '
 'línea.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- EMPUJADOR (distinto de "Empujador de bandejas" — ver aviso 3)
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.empujador.alarma.obstaculo_empuje', 'BS08', 'Empujador', 'alarma',
 'Empujador: Obstáculo empuje',
 'Durante el avance del empujador faltó la habilitación al avance. '
 'Solución, controle: posición fleje grande, posición fleje pequeño, '
 'posición flejes superiores, posición fondo jaula; cuota programada '
 'en la diapositiva SACACARTÓN-START CICLO EMPUJADOR y posición del '
 'sacacartón; cuota programada en la diapositiva EMPUJADOR-TEST '
 'OBSTÁCULO y posición del empujador; cuota diapositiva '
 'EMPUJADOR-BAJADA GUÍA CARTONES, posición depósitos cartones y '
 'funcionamiento de los sensores relativos.'),

('bs08.empujador.alarma.anomalia_mc_plato_bajo', 'BS08', 'Empujador', 'alarma',
 'Empujador: Anomalía mc plato bajo',
 'El sensor de plato de empuje bajo no está activo con el cilindro '
 'en reposo. Solución: comprobar el funcionamiento del cilindro y '
 'del sensor de plato bajo.'),

('bs08.empujador.alarma.anomalia_mc_plato_alto', 'BS08', 'Empujador', 'alarma',
 'Empujador: Anomalía mc plato alto',
 'El sensor de plato de empuje alto no está activo con el cilindro '
 'activo. Solución: comprobar el funcionamiento del cilindro y del '
 'sensor de plato alto.'),

('bs08.empujador.alarma.elevador_fuera_de_posicion', 'BS08', 'Empujador', 'alarma',
 'Empujador: Elevador fuera de posición',
 'El motor del elevador se ha bloqueado en su movimiento. Solución: '
 'comprobar el sensor del elevador y quitar los eventuales '
 'obstáculos que hayan bloqueado el motor; realizar la calibración '
 'del elevador. (Sin confirmar si este elevador es el mismo que la '
 'submáquina "Elevador" documentada aparte — ver aviso 3.)'),

('bs08.empujador.alarma.elevador_no_calibrado', 'BS08', 'Empujador', 'alarma',
 'Empujador: Elevador no calibrado',
 'El motor del elevador se ha bloqueado en su movimiento. Solución: '
 'comprobar el sensor del elevador y quitar los eventuales '
 'obstáculos que hayan bloqueado el motor; realizar la calibración '
 'del elevador. (Mismo texto que "Elevador fuera de posición"; sin '
 'confirmar si hay un matiz real que las distinga — ver aviso 3.)'),

('bs08.empujador.alarma.falta_plantilla', 'BS08', 'Empujador', 'alarma',
 'Empujador: Falta plantilla',
 'Al inicio del empuje de una pila hacia la jaula, al menos una de '
 'las dos fotocélulas de presencia cartón no está activa. Solución, '
 'controle: presencia del cartón delante de la jaula; funcionamiento '
 'de las dos fotocélulas de presencia cartón.'),

('bs08.empujador.alarma.to_empuje', 'BS08', 'Empujador', 'alarma',
 'Empujador: T.O. empuje',
 'El empujador no ha alcanzado la posición de fin del empuje en el '
 'tiempo máximo previsto durante el empuje de una pila hacia la '
 'jaula. Solución: comprobar el posible atascamiento del empujador, '
 'el funcionamiento del codificador y del motor.'),

('bs08.empujador.alarma.to_retorno', 'BS08', 'Empujador', 'alarma',
 'Empujador: T.O. retorno',
 'El empujador no ha alcanzado la posición atrás programada o el '
 'sensor de final de carrera atrás en el tiempo máximo previsto '
 'durante el retorno en espera. Solución: comprobar el posible '
 'atascamiento del empujador, el funcionamiento del codificador, el '
 'funcionamiento del sensor empujador atrás y del motor.'),

('bs08.empujador.alarma.cola_plantilla_seca', 'BS08', 'Empujador', 'alarma',
 'Empujador: Cola plantilla seca',
 'Al inicio del empuje de una pila hacia la jaula ha pasado el '
 'tiempo configurado para el secado de la cola. Solución: comprobar '
 'el valor del tiempo configurado para el secado de la cola y quitar '
 'el cartón presente delante de la jaula.'),

('bs08.empujador.alarma.tipo_carton', 'BS08', 'Empujador', 'alarma',
 'Empujador: Tipo cartón',
 'El cartón presente delante de la jaula no ha sido recogido del '
 'almacén correcto. Solución: quitar el cartón delante de la jaula.'),

('bs08.empujador.alarma.anomalia_reloj_jaula', 'BS08', 'Empujador', 'alarma',
 'Empujador: Anomalía reloj jaula',
 'El sensor de clock de la jaula no ha detectado la entrada de una '
 'caja en la jaula. Solución: comprobar el funcionamiento del sensor '
 'clock jaula y la posición del clock de la jaula.'),

('bs08.empujador.alarma.anomalia_hotmelt', 'BS08', 'Empujador', 'alarma',
 'Empujador: Anomalía hotmelt',
 'La máquina que suministra la cola en caliente presenta una '
 'anomalía. Solución: comprobar el estado de la máquina de la cola '
 'en caliente. (Misma alarma física que "Hotmelt: Anomalía cola '
 'caliente" — ver aviso 4.)'),

('bs08.empujador.alarma.no_calibrado', 'BS08', 'Empujador', 'alarma',
 'Empujador: No calibrado',
 'El motor del empujador requiere una calibración. Solución: '
 'realizar la calibración del empujador.'),

('bs08.empujador.alarma.anomalia_inverter', 'BS08', 'Empujador', 'alarma',
 'Empujador: Anomalía inverter',
 'El inverter presenta una anomalía. Solución: comprobar que el '
 'inversor y el motor conectado a él funcionen correctamente.'),

('bs08.empujador.alarma.anomalia_comunicacion_inverter', 'BS08', 'Empujador', 'alarma',
 'Empujador: Anomalía comunicación inverter',
 'Error de comunicaciones con inversor. Solución: comprobar el '
 'funcionamiento correcto de los inverters, la conexión correcta del '
 'cable de comunicación hacia los inverters y la configuración de '
 'los parámetros de comunicación de los inverters como se muestra en '
 'el esquema eléctrico del panel.'),

('bs08.empujador.alarma.tiempo_limite_comunicacion_inverter', 'BS08', 'Empujador', 'alarma',
 'Empujador: Tiempo límite comunicación inverter',
 'Timeout de comunicaciones con inverter. Solución: comprobar el '
 'funcionamiento correcto de los inverters, la conexión correcta del '
 'cable de comunicación hacia los inverters y la configuración de '
 'los parámetros de comunicación de los inverters como se muestra en '
 'el esquema eléctrico del panel.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- EMPUJADOR DE BANDEJAS (ya existían 22 filas — ver aviso 1)
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.empujador_bandejas.alarma.obstaculo_empuje', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Obstáculo empuje',
 'Durante el avance del empujador de bandejas faltó la habilitación '
 'al avance. El avance del empujador bandeja se realiza solo si el '
 'mandril está parado en la posición alta. Solución: comprobar la '
 'posición del mandril.'),

('bs08.empujador_bandejas.alarma.no_calibrado', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: No calibrado',
 'El motor del empujador de bandejas se ha bloqueado o ha alcanzado '
 'el final de carrera adelante en su movimiento. Solución: comprobar '
 'el sensor de atrás, el sensor de adelante, la cuota en la '
 'diapositiva EMPUJADOR BANDEJA-CUOTA FIN DEL EMPUJE, y quitar los '
 'posibles obstáculos que hayan bloqueado el motor; realizar la '
 'calibración del empujador de bandejas.'),

('bs08.empujador_bandejas.alarma.anomalia_mc_guia_abierto', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Anomalía mc guía abierto',
 'El sensor abierto de la guía del empujador bandeja no se excita '
 'con el cilindro de apertura de la guía empujador bandeja activo. '
 'Solución: comprobar el funcionamiento del sensor y de los '
 'cilindros del empujador de bandejas.'),

('bs08.empujador_bandejas.alarma.anomalia_mc_guia_cerrado', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Anomalía mc guía cerrado',
 'El sensor cerrado de la guía del empujador bandeja no se excita '
 'con el cilindro de cierre de la guía empujador bandeja activo. '
 'Solución: comprobar el funcionamiento del sensor y de los '
 'cilindros del empujador de bandejas.'),

('bs08.empujador_bandejas.alarma.sin_calibrar_derecha_mc_on', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Sin calibrar derecha mc on',
 'El motor necesita un calibrado: el sensor de calibración que '
 'debería haber dejado libre el movimiento del motor todavía está '
 'activado. Solución, compruebe: la posible presencia de obstáculos '
 'que bloquean el motor; el sensor de calibración. Para restablecer: '
 'coloque el wrap en modo manual; reconozca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; quite el cartón o material que ha '
 'bloqueado el motor; de ser necesario, restablezca las barreras, '
 'botones fungiformes, etc.; si no se activa, restablezca la marcha '
 'del wrap; calibre el motor; restablezca la alarma en la diapositiva '
 'ALARMAS ACTIVADAS; restablezca el wrap en modo automático.'),

('bs08.empujador_bandejas.alarma.sin_calibrar_izquierda_mc_on', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Sin calibrar izquierda mc on',
 'El motor necesita un calibrado: el sensor de calibración que '
 'debería haber dejado libre el movimiento del motor todavía está '
 'activado. Solución, compruebe: la posible presencia de obstáculos '
 'que bloquean el motor; el sensor de calibración. Para restablecer: '
 'coloque el wrap en modo manual; reconozca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; quite el cartón o material que ha '
 'bloqueado el motor; de ser necesario, restablezca las barreras, '
 'botones fungiformes, etc.; si no se activa, restablezca la marcha '
 'del wrap; calibre el motor; restablezca la alarma en la diapositiva '
 'ALARMAS ACTIVADAS; restablezca el wrap en modo automático.'),

('bs08.empujador_bandejas.alarma.sin_calibrar_derecha_mc_off', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Sin calibrar derecha mc off',
 'El motor necesita un calibrado: el sensor de calibración no está '
 'activado, aunque la posición del motor debería haberlo activado. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de calibración. Mismo procedimiento de '
 'restablecimiento que "Sin calibrar mc on".'),

('bs08.empujador_bandejas.alarma.sin_calibrar_izquierda_mc_off', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Sin calibrar izquierda mc off',
 'El motor necesita un calibrado: el sensor de calibración no está '
 'activado, aunque la posición del motor debería haberlo activado. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de calibración. Mismo procedimiento de '
 'restablecimiento que "Sin calibrar mc on".'),

('bs08.empujador_bandejas.alarma.sin_calibrar_derecha_mc_adelante', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Sin calibrar derecha mc adelante',
 'El motor necesita un calibrado: el movimiento del motor ha activado '
 'el sensor de adelante, que nunca debe alcanzar. Solución, '
 'compruebe: la posición del empujador de la bandeja; el sensor de '
 'adelante. Mismo procedimiento de restablecimiento que "Sin '
 'calibrar mc on".'),

('bs08.empujador_bandejas.alarma.sin_calibrar_izquierda_mc_adelante', 'BS08', 'Empujador de bandejas', 'alarma',
 'Empujador de bandejas: Sin calibrar izquierda mc adelante',
 'El motor necesita un calibrado: el movimiento del motor ha activado '
 'el sensor de adelante, que nunca debe alcanzar. Solución, '
 'compruebe: la posición del empujador de la bandeja; el sensor de '
 'adelante. Mismo procedimiento de restablecimiento que "Sin '
 'calibrar mc on".')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- ESCUADRADOR (ya existían 14 filas — ver aviso 1)
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.escuadrador.alarma.anomalia_mc_dcha_lateral', 'BS08', 'Escuadrador', 'alarma',
 'Escuadrador: Anomalía mc dcha lateral',
 'El sensor del cilindro derecho del escuadrador lateral no está '
 'excitado con el cilindro en reposo. Solución: comprobar el '
 'funcionamiento del cilindro y del relativo sensor.'),

('bs08.escuadrador.alarma.anomalia_mc_izq_lateral', 'BS08', 'Escuadrador', 'alarma',
 'Escuadrador: Anomalía mc izq. lateral',
 'El sensor del cilindro izquierdo del escuadrador lateral no está '
 'excitado con el cilindro en reposo. Solución: comprobar el '
 'funcionamiento del cilindro y del relativo sensor.'),

('bs08.escuadrador.alarma.anomalia_mc_dcho_frontal', 'BS08', 'Escuadrador', 'alarma',
 'Escuadrador: Anomalía mc dcho frontal',
 'El sensor del cilindro derecho del escuadrador frontal no está '
 'excitado con el cilindro en reposo. Solución: comprobar el '
 'funcionamiento del cilindro y del relativo sensor.'),

('bs08.escuadrador.alarma.anomalia_mc_izq_frontal', 'BS08', 'Escuadrador', 'alarma',
 'Escuadrador: Anomalía mc izq frontal',
 'El sensor del cilindro izquierdo del escuadrador frontal no está '
 'excitado con el cilindro en reposo. Solución: comprobar el '
 'funcionamiento del cilindro y del relativo sensor.'),

('bs08.escuadrador.alarma.anomalia_mc_dcho_trasero', 'BS08', 'Escuadrador', 'alarma',
 'Escuadrador: Anomalía mc dcho. trasero',
 'El sensor del cilindro derecho del escuadrador posterior no está '
 'excitado con el cilindro en reposo. Solución: comprobar el '
 'funcionamiento del cilindro y del relativo sensor.'),

('bs08.escuadrador.alarma.anomalia_mc_izq_trasero', 'BS08', 'Escuadrador', 'alarma',
 'Escuadrador: Anomalía mc izq. trasero',
 'El sensor del cilindro izquierdo del escuadrador posterior no está '
 'excitado con el cilindro en reposo. Solución: comprobar el '
 'funcionamiento del cilindro y del relativo sensor.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- TRACCIÓN PILAS WRAP
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.traccion_pilas_wrap.alarma.pila_desconocida', 'BS08', 'Tracción pilas wrap', 'alarma',
 'Tracción pilas wrap: Pila desconocida',
 'La fotocélula presente en la zona de entrada tracción pilas está '
 'activada pero ninguna pila debe estar presente. Solución, '
 'compruebe: que la fotocélula funcione; eventuales pilas presentes '
 'en la posición incorrecta. Para restablecer: coloque el wrap en '
 'modo manual; reconozca la alarma en la diapositiva ALARMAS '
 'ACTIVADAS; quite las pilas que estén presentes en tracción; '
 'restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; de ser '
 'necesario, restablezca las barreras, botones fungiformes, etc.; si '
 'no se activa, restablezca la marcha del wrap; restablezca el wrap '
 'en modo automático.'),

('bs08.traccion_pilas_wrap.alarma.to_transito_pila', 'BS08', 'Tracción pilas wrap', 'alarma',
 'Tracción pilas wrap: T.O. tránsito pila',
 'La pila de paso desde tracción línea hasta tracción wrap ha '
 'oscurecido la fotocélula presente en la zona de entrada tracción '
 'pilas durante un tiempo mayor al esperado. Solución, compruebe: '
 'que la fotocélula funcione; eventuales atascos de la pila en la '
 'zona fotocélula. Para restablecer: coloque el wrap en modo manual; '
 'reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite las '
 'pilas que estén presentes en tracción; restablezca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; de ser necesario, restablezca las '
 'barreras, botones fungiformes, etc.; si no se activa, restablezca '
 'la marcha del wrap; restablezca el wrap en modo automático.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- TRAMO POSTERIOR WRAP
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.tramo_posterior_wrap.alarma.configuracion_incorrecta', 'BS08', 'Tramo posterior wrap', 'alarma',
 'Tramo posterior wrap: configuración incorrecta',
 'Se ha detectado un error en los datos de configuración de la parte '
 'posterior del wrap. Solución: controle que los datos '
 'correspondientes estén programados correctamente consultando los '
 'esquemas eléctricos.'),

('bs08.tramo_posterior_wrap.alarma.anomalia_inverter', 'BS08', 'Tramo posterior wrap', 'alarma',
 'Tramo posterior wrap: anomalía inverter',
 'Los inverters del tramo posterior del wrap presentan anomalías. '
 'Solución: compruebe el funcionamiento correcto de los inverters y '
 'del motor conectado a éste.'),

('bs08.tramo_posterior_wrap.alarma.error_comunicacion_inverter', 'BS08', 'Tramo posterior wrap', 'alarma',
 'Tramo posterior wrap: error comunicación inverter',
 'Error de comunicaciones con inversor. Solución: compruebe el '
 'funcionamiento correcto de los inverters, la conexión correcta del '
 'cable de comunicación hacia los inverters y la configuración de '
 'los parámetros de comunicación de los inverters como se muestra en '
 'el esquema eléctrico del panel.'),

('bs08.tramo_posterior_wrap.alarma.anomalia_termicas', 'BS08', 'Tramo posterior wrap', 'alarma',
 'Tramo posterior wrap: anomalía térmicas',
 'Una protección magnetotérmica ha intervenido en la parte posterior '
 'del wrap.'),

('bs08.tramo_posterior_wrap.alarma.codigo_cero', 'BS08', 'Tramo posterior wrap', 'alarma',
 'Tramo posterior wrap: código cero',
 'Una caja llega a una fotocélula de tramo posterior del wrap en un '
 'tiempo no previsto por la ventana temporal configurada en el '
 'elemento ENLACE. A la caja en entrada en el enlace del tramo '
 'posterior se le asignó un código 0. Solución: controle si la caja '
 'queda bloqueada en los enlaces, si el motor y la fotocélula '
 'funcionan, y verifique el tiempo programado en el elemento '
 'ENLACE.'),

('bs08.tramo_posterior_wrap.alarma.timeout_fotocelula', 'BS08', 'Tramo posterior wrap', 'alarma',
 'Tramo posterior wrap: timeout fotocélula',
 'Durante el pasaje de una caja en los enlaces de la parte posterior '
 'del wrap, una fotocélula permanece excitada por encima del tiempo '
 'máximo previsto en los enlaces. Solución: controle si la caja '
 'queda bloqueada en los enlaces, si el motor y la fotocélula '
 'funcionan, y verifique el tiempo programado en TIMEOUT FT ENLACES '
 'en la diapositiva TRAMO POSTERIOR WRAP.'),

('bs08.tramo_posterior_wrap.alarma.timeout_comunicacion_inverters', 'BS08', 'Tramo posterior wrap', 'alarma',
 'Posterior wrap: timeout de comunicación inverters',
 'Timeout de comunicaciones con inverter. Solución: compruebe el '
 'funcionamiento correcto de los inverters, la conexión correcta del '
 'cable de comunicación hacia los inverters y la configuración de '
 'los parámetros de comunicación de los inverters como se muestra en '
 'el esquema eléctrico del panel.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- GIRACAJAS: DESCARTADO — mecanismo no instalado en esta máquina
-- (confirmado por el mecánico, 16/09/2026). No se incluyen sus 6
-- alarmas (timeout calibración, anomalía subida/bajada/rotación/
-- retorno, paquete sin girar).
-- =====================================================================

-- =====================================================================
-- BANDEJA → mapeado a submáquina existente "Mandril" (ver aviso 11)
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.mandril.alarma.bandeja_no_calibrado', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado',
 'El motor del mandril se ha bloqueado o no ha alcanzado el final de '
 'carrera bajo en su movimiento. Solución: comprobar el sensor de '
 'alto, el sensor de bajo, la cuota en la diapositiva '
 'MANDRIL-POSICIÓN BAJO, y quitar los posibles obstáculos que hayan '
 'bloqueado el motor. Realizar la calibración del mandril.'),

('bs08.mandril.alarma.anomalia_mc_abierto', 'BS08', 'Mandril', 'alarma',
 'Bandeja: Anomalía mc abierto',
 'Los sensores de fleje anterior abierto no se excitan con el '
 'cilindro de apertura de los flejes anteriores del mandril activo. '
 'Solución: comprobar el funcionamiento de los sensores y de los '
 'cilindros de los flejes anteriores del mandril.'),

('bs08.mandril.alarma.anomalia_mc_cerrado', 'BS08', 'Mandril', 'alarma',
 'Bandeja: Anomalía mc cerrado',
 'Los sensores de fleje anterior cerrado no se excitan con el '
 'cilindro de apertura de los flejes anteriores del mandril en '
 'reposo. Solución: comprobar el funcionamiento de los sensores y de '
 'los cilindros de los flejes anteriores del mandril.'),

('bs08.mandril.alarma.obstaculo_movimiento', 'BS08', 'Mandril', 'alarma',
 'Bandeja: Obstáculo movimiento',
 'Durante el movimiento del mandril faltó la habilitación. Solución: '
 'comprobar eventuales anomalías del empujador bandeja o del fondo '
 'jaula, la posición del empujador bandeja y la cuota de obstáculo '
 'en la diapositiva EMPUJADOR BANDEJA.'),

('bs08.mandril.alarma.aplastamiento', 'BS08', 'Mandril', 'alarma',
 'Bandeja: Aplastamiento',
 'Durante la bajada, el sensor de achatamiento del mandril se ha '
 'desexcitado. Solución: comprobar el funcionamiento del sensor de '
 'achatamiento del mandril y la cuota POSICIÓN BAJO en la '
 'diapositiva MANDRIL.'),

('bs08.mandril.alarma.tipo_carton', 'BS08', 'Mandril', 'alarma',
 'Bandeja: Tipo cartón',
 'La bandeja presente en el mandril no ha sido recogida del almacén '
 'deseado. Solución: quitar la bandeja del mandril.'),

('bs08.mandril.alarma.faltan_bandejas', 'BS08', 'Mandril', 'alarma',
 'Bandeja: Faltan bandejas',
 'Al inicio de la bajada de la bandeja, la fotocélula de presencia '
 'bandeja en el mandril no está activa. Solución: comprobar la '
 'presencia de la bandeja en el mandril y el funcionamiento de la '
 'fotocélula de presencia bandeja en el mandril.'),

('bs08.mandril.alarma.anomalia_mc_bloqueo_bandejas', 'BS08', 'Mandril', 'alarma',
 'Bandeja: Anomalía mc bloqueo bandejas',
 'Los sensores de bloqueo bandeja abierta en el mandril no se '
 'excitan con el cilindro de apertura del bloqueo bandeja activo. '
 'Solución: comprobar el funcionamiento de los sensores y de los '
 'cilindros del bloqueo bandeja en el mandril.'),

('bs08.mandril.alarma.to_bajada', 'BS08', 'Mandril', 'alarma',
 'Bandeja: T.O. bajada',
 'Durante una operación de bajada, el mandril no ha alcanzado la '
 'cuota de bajo en el tiempo máximo previsto. Solución: comprobar el '
 'posible atasco del mandril, el funcionamiento del motor, del '
 'codificador y la cuota programada de bajo del mandril.'),

('bs08.mandril.alarma.to_subida', 'BS08', 'Mandril', 'alarma',
 'Bandeja: T.O. subida',
 'Durante una operación de subida, el mandril no ha alcanzado el '
 'sensor de alto en el tiempo máximo previsto. Solución: comprobar '
 'el posible atasco del mandril, el funcionamiento del motor y el '
 'funcionamiento del sensor de alto.'),

('bs08.mandril.alarma.no_calibrado_derecho_sensor_atras_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado derecho sensor atrás activo',
 'El motor necesita un calibrado. El movimiento del motor debería '
 'haber dejado libre el sensor de calibración, que todavía está '
 'activado. Solución, compruebe: la posible presencia de obstáculos '
 'que bloquean el motor; el sensor de calibración. Para restablecer: '
 'coloque el wrap en modo manual; reconozca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que '
 'ha bloqueado el motor; de ser necesario, restablezca las barreras, '
 'botones fungiformes, etc.; si no se activa, restablezca la marcha '
 'del wrap; calibre el motor; restablezca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo '
 'automático. (Nombre tal cual figura en el manual — ver aviso 13.)'),

('bs08.mandril.alarma.no_calibrado_izquierdo_sensor_alto_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado izquierdo sensor alto activo',
 'El motor necesita un calibrado. El movimiento del motor debería '
 'haber dejado libre el sensor de calibración, que todavía está '
 'activado. Solución, compruebe: la posible presencia de obstáculos '
 'que bloquean el motor; el sensor de calibración. Para restablecer: '
 'coloque el wrap en modo manual; reconozca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que '
 'ha bloqueado el motor; de ser necesario, restablezca las barreras, '
 'botones fungiformes, etc.; si no se activa, restablezca la marcha '
 'del wrap; calibre el motor; restablezca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo '
 'automático. (Nombre tal cual figura en el manual — ver aviso 13.)'),

('bs08.mandril.alarma.no_calibrado_derecho_sensor_alto_no_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado derecho sensor alto no activo',
 'El motor necesita un calibrado. El sensor de calibración no está '
 'activado, aunque la posición del motor debería activar el sensor. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de calibración. Para restablecer: '
 'coloque el wrap en modo manual; reconozca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que '
 'ha bloqueado el motor; de ser necesario, restablezca las barreras, '
 'botones fungiformes, etc.; si no se activa, restablezca la marcha '
 'del wrap; calibre el motor; restablezca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo '
 'automático.'),

('bs08.mandril.alarma.no_calibrado_izquierdo_sensor_alto_no_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado izquierdo sensor alto no activo',
 'El motor necesita un calibrado. El sensor de calibración no está '
 'activado, aunque la posición del motor debería activar el sensor. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de calibración. Para restablecer: '
 'coloque el wrap en modo manual; reconozca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que '
 'ha bloqueado el motor; de ser necesario, restablezca las barreras, '
 'botones fungiformes, etc.; si no se activa, restablezca la marcha '
 'del wrap; calibre el motor; restablezca la alarma en la '
 'diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo '
 'automático.'),

('bs08.mandril.alarma.no_calibrado_derecho_sensor_bajo_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado derecho sensor bajo activo',
 'El motor necesita un calibrado. El movimiento del motor debería '
 'dejar libre el sensor de bajo, que todavía está activado. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de bajo. Para restablecer: coloque el '
 'wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS '
 'ACTIVADAS; quite el cartón o el material que ha bloqueado el '
 'motor; de ser necesario, restablezca las barreras, botones '
 'fungiformes, etc.; si no se activa, restablezca la marcha del '
 'wrap; calibre el motor; restablezca la alarma en la diapositiva '
 'ALARMAS ACTIVADAS; restablezca el wrap en modo automático.'),

('bs08.mandril.alarma.no_calibrado_izquierdo_sensor_bajo_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado izquierdo sensor bajo activo',
 'El motor necesita un calibrado. El movimiento del motor debería '
 'dejar libre el sensor de bajo, que todavía está activado. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de bajo. Para restablecer: coloque el '
 'wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS '
 'ACTIVADAS; quite el cartón o el material que ha bloqueado el '
 'motor; de ser necesario, restablezca las barreras, botones '
 'fungiformes, etc.; si no se activa, restablezca la marcha del '
 'wrap; calibre el motor; restablezca la alarma en la diapositiva '
 'ALARMAS ACTIVADAS; restablezca el wrap en modo automático.'),

('bs08.mandril.alarma.no_calibrado_derecho_sensor_bajo_no_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado derecho_sensor bajo no activo',
 'El motor necesita un calibrado. El sensor de bajo no está '
 'activado, aunque la posición del motor debería activar el sensor. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de bajo. Para restablecer: coloque el '
 'wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS '
 'ACTIVADAS; quite el cartón o el material que ha bloqueado el '
 'motor; de ser necesario, restablezca las barreras, botones '
 'fungiformes, etc.; si no se activa, restablezca la marcha del '
 'wrap; calibre el motor; restablezca la alarma en la diapositiva '
 'ALARMAS ACTIVADAS; restablezca el wrap en modo automático.'),

('bs08.mandril.alarma.no_calibrado_izquierdo_sensor_bajo_no_activo', 'BS08', 'Mandril', 'alarma',
 'Bandeja: No calibrado izquierdo_sensor bajo no activo',
 'El motor necesita un calibrado. El sensor de bajo no está '
 'activado, aunque la posición del motor debería activar el sensor. '
 'Solución, compruebe: la posible presencia de obstáculos que '
 'bloquean el motor; el sensor de bajo. Para restablecer: coloque el '
 'wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS '
 'ACTIVADAS; quite el cartón o el material que ha bloqueado el '
 'motor; de ser necesario, restablezca las barreras, botones '
 'fungiformes, etc.; si no se activa, restablezca la marcha del '
 'wrap; calibre el motor; restablezca la alarma en la diapositiva '
 'ALARMAS ACTIVADAS; restablezca el wrap en modo automático.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- WRAP GENERALES
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.wrap_generales.alarma.termicas_wrap', 'BS08', 'Wrap generales', 'alarma',
 'Wrap: Térmicas wrap',
 'Una protección magnetotérmica ha intervenido en la parte wrap.'),

('bs08.wrap_generales.alarma.anomalia_alimentacion_aire_comprimido', 'BS08', 'Wrap generales', 'alarma',
 'Wrap: Anomalía alimentación aire comprimido',
 'El presostato que detecta la presión del aire comprimido en la '
 'entrada de la máquina detectó una disminución en la presión por '
 'debajo del umbral configurado. Solución: comprobar la presión en '
 'la entrada de la máquina y la conexión del tubo del aire '
 'comprimido en la entrada de la máquina.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();

-- =====================================================================
-- WRAP NO PLANTILLA
-- =====================================================================

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.wrap_no_plantilla.alarma.faltan_cartones_bandejas', 'BS08', 'Wrap no plantilla', 'alarma',
 'Wrap: Faltan cartones / Wrap: Faltan bandejas',
 'El nivel de los cartones en los almacenes de cartones es bajo. '
 'Solución: agregar cartones en los almacenes.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
