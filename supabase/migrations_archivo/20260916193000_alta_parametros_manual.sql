-- ============================================================
-- Alta de parámetros del manual ausentes en ceria_documentacion_maquina
-- Proyecto: Motiv-produccion-V3
-- ============================================================
-- Cambios respecto a la propuesta anterior:
--   * Tabla correcta: ceria_documentacion_maquina (no "parametro").
--   * NO se mueve nada de "Jaula" a "Empujador": la submáquina
--     "Jaula" ya documenta el empujador de pila de forma coherente
--     (procesos, piezas, sensores, actuador y alarmas), así que
--     los 7 parámetros existentes se quedan donde están.
--   * Las submáquinas nuevas usan los nombres que la BD ya tiene
--     (Regulaciones, Wrap generales, Tracción pilas wrap, Tramo
--     posterior wrap) en vez de nombres inventados.
--   * No se dan de alta direcciones de inverter (24/28): se
--     mantiene lo que ya hay en la BD, tal como se acordó.
--
-- Los valores en `contenido` marcados como "valor de ejemplo
-- visto en el manual" no están confirmados para vuestra línea:
-- conviene revisarlos en máquina antes de darlos por buenos.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- REGULACIONES — cotas y presencia de elementos regulables
-- (manual 9.1 Máquina, tabla "Regulaciones")
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.regulaciones.parametro.cota_lados_abiertos', 'BS08', 'Regulaciones', 'parametro',
 'Cota lados abiertos [mm]',
 'Medida realizada con los lados del wrap abiertos al máximo. Configura el valor medido entre el externo de las cadenas de la tracción de las pilas, en mm. Sirve para la visualización de la posición de los lados del wrap.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.regulaciones.parametro.cota_longitudinal_cerrada', 'BS08', 'Regulaciones', 'parametro',
 'Cota longitudinal cerrada [mm]',
 'La regulación longitudinal permite desplazar el escuadrador frontal, divisor de pilas y elevador. Medida realizada con la regulación longitudinal wrap abierta al máximo, entre la paleta del escuadrador frontal y la paleta del escuadrador posterior en cierre. Sirve para la visualización de la posición longitudinal del wrap.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.regulaciones.parametro.cota_apoyo_bandeja_baja', 'BS08', 'Regulaciones', 'parametro',
 'Cota de apoyo de la bandeja baja [mm]',
 'Medida realizada con el apoyo bandeja baja al máximo, entre el punto de apoyo del cartón en el almacén y el punto de apoyo del cartón en el travesaño en movimiento. Sirve para la visualización de la posición del apoyo de la bandeja.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.regulaciones.parametro.cuota_guia_recipiente_abierta', 'BS08', 'Regulaciones', 'parametro',
 'Cuota guía recipiente abierta [mm]',
 'Medida realizada con la guía bandeja abierta al máximo, entre las dos guías de la bandeja. Sirve para la visualización de la posición de la guía de la bandeja.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.regulaciones.parametro.lados_presente', 'BS08', 'Regulaciones', 'parametro',
 'Lados presente',
 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.regulaciones.parametro.longitudinal_presente', 'BS08', 'Regulaciones', 'parametro',
 'Longitudinal presente',
 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.regulaciones.parametro.apoyo_bandejas_presente', 'BS08', 'Regulaciones', 'parametro',
 'Apoyo bandejas presente',
 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.regulaciones.parametro.guia_recipiente_presente', 'BS08', 'Regulaciones', 'parametro',
 'Guía recipiente presente',
 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.',
 true, now(), now());

-- ------------------------------------------------------------
-- WRAP GENERALES — identificación general del wrap
-- (manual 9.1 Máquina, Datos constructivos, primera pantalla)
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.wrap_generales.parametro.nombre_wrap', 'BS08', 'Wrap generales', 'parametro',
 'Nombre wrap',
 'Asigna un nombre que identifica el wrap.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.wrap_generales.parametro.tipo_linea_anterior', 'BS08', 'Wrap generales', 'parametro',
 'Tipo de línea anterior',
 'ATENCIÓN, dato de configuración: modificar solo si se está totalmente seguro. Configura el tipo de línea presente en el tramo anterior del wrap; selecciona el tipo de interconexión con la línea del tramo anterior.',
 true, now(), now());

-- ------------------------------------------------------------
-- TRACCIÓN PILAS WRAP — dinámica general de transporte de pilas
-- (manual 9.2.2, distinta del Divisor y del Escuadrador)
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.traccion_pilas_wrap.parametro.velocidad', 'BS08', 'Tracción pilas wrap', 'parametro',
 'Velocidad [mm/s]',
 'Velocidad máxima de transporte de pilas.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.traccion_pilas_wrap.parametro.aceleracion', 'BS08', 'Tracción pilas wrap', 'parametro',
 'Aceleración [mm/s^2]',
 'Aceleración/desaceleración de la tracción de transporte: configura la variación de velocidad en la unidad de tiempo durante las conmutaciones entre velocidad mínima y máxima. Cuando el valor aumenta, las variaciones de velocidad son menos rápidas.',
 true, now(), now());

-- ------------------------------------------------------------
-- SACABANDEJAS — parámetros del manual ausentes en la BD
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.sacabandejas.parametro.distancia_inicio_rotacion', 'BS08', 'Sacabandejas', 'parametro',
 'Distancia inicio rotación [mm]',
 'Cota en mm desde la posición de recogida de bandejas a la cual el eje de las ventosas inicia la rotación para alcanzar la posición de desenganche del cartón.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.sacabandejas.parametro.cuota_deposito_almacen_derecho', 'BS08', 'Sacabandejas', 'parametro',
 'Cuota depósito almacén derecho [mm]',
 'Configura la cuota de depósito del cartón. Los valores se expresan en mm y se refieren al final de carrera en el almacén derecho. Valor de ejemplo visto en el manual: 1200 mm — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.sacabandejas.parametro.cuota_deposito_almacen_izquierdo', 'BS08', 'Sacabandejas', 'parametro',
 'Cuota depósito almacén izquierdo [mm]',
 'Configura la cuota de depósito del cartón. Los valores se expresan en mm y se refieren al final de carrera en el almacén derecho (referencia común). Valor de ejemplo visto en el manual: 500 mm — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.sacabandejas.parametro.distancia_eje_rotacion_ventosas_vertice_bandeja', 'BS08', 'Sacabandejas', 'parametro',
 'Distancia eje rotación ventosas/vértice bandeja [mm]',
 'Distancia en mm entre el eje de rotación de las ventosas del sacabandejas y el vértice superior de la plantilla (cartón) apoyada en el almacén de bandejas.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.sacabandejas.parametro.tiempo_enganche', 'BS08', 'Sacabandejas', 'parametro',
 'Tiempo de enganche [ms]',
 'Tiempo de activación del mando de vacío de las ventosas de recogida de cartones. Valor de ejemplo visto en el manual: 100 ms — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.sacabandejas.parametro.tiempo_desenganche', 'BS08', 'Sacabandejas', 'parametro',
 'Tiempo de desenganche [ms]',
 'Retardo entre la desexcitación del mando de aspiración de las ventosas de recogida y la activación del motor del empujador de cartón. Valor de ejemplo visto en el manual: 50 ms — verificar en vuestra línea.',
 true, now(), now());

-- ------------------------------------------------------------
-- EMPUJADOR DE BANDEJAS — parámetros del manual ausentes en la BD
-- (No se repiten "posición final de empuje" ni "posición de
-- espera": ya existen y son compatibles con "Cuota final empuje"
-- / "Cota espera" del manual.)
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.empujador_bandejas.parametro.puntos_cola', 'BS08', 'Empujador de bandejas', 'parametro',
 'Puntos cola (1, 2)',
 'Dos parámetros que seleccionan las posiciones en el cartón en las que aplicar la cola. Configuran el retardo entre la excitación de la fotocélula de inyectores de cola y la activación del mando de los inyectores de cola.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.empujador_bandejas.parametro.cuota_salida_apoyo_central', 'BS08', 'Empujador de bandejas', 'parametro',
 'Cuota salida apoyo central [mm]',
 'Distancia en mm desde el final de carrera atrás en la que, durante el empuje del cartón hacia el mandril, se da el mando de salida al cilindro de apoyo central para sostener el cartón. Solo funciona con formatos mayores de 600 mm.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.empujador_bandejas.parametro.rociado_cola', 'BS08', 'Empujador de bandejas', 'parametro',
 'Rociado de la cola [ms]',
 'Tiempo de activación del mando a los inyectores de la cola. Valor de ejemplo visto en el manual: 0 ms — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.empujador_bandejas.parametro.secado_cola', 'BS08', 'Empujador de bandejas', 'parametro',
 'Secado de la cola [ms]',
 'Tiempo de retardo máximo entre la ejecución del primer rociado de cola y el uso del cartón. Si se supera sin usar el cartón, se genera la alarma COLA PLANTILLA SECA. Si se configura a 0, no se genera ninguna alarma. Valor de ejemplo visto en el manual: 0 ms — verificar en vuestra línea.',
 true, now(), now());

-- ------------------------------------------------------------
-- MANDRIL — parámetros del manual ausentes en la BD
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.mandril.parametro.descenso_plato_empuje', 'BS08', 'Mandril', 'parametro',
 'Descenso Plato Empuje [mm]',
 'Configura la cota en mm a la que, durante la bajada del mandril, se ordena la bajada del plato de empuje del empujador. Valor de ejemplo visto en el manual: 120 mm — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.mandril.parametro.subida_fondo_jaula', 'BS08', 'Mandril', 'parametro',
 'Subida del fondo de jaula [mm]',
 'Configura la cota en mm a la que, durante la bajada del mandril, se ordena la subida del fondo de jaula. Valor de ejemplo visto en el manual: 120 mm — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.mandril.parametro.anticipacion_empujador_recipiente', 'BS08', 'Mandril', 'parametro',
 'Anticipación empujador recipiente [mm]',
 'Configura la cuota en mm a la que, durante la subida del mandril, se anticipa el mando de empuje del empujador de recipientes. Con el valor igual a "Posición alta" el empuje empieza cuando el mandril llega arriba. Valor de ejemplo visto en el manual: 280 mm — verificar en vuestra línea.',
 true, now(), now());

-- ------------------------------------------------------------
-- TRAMO POSTERIOR WRAP — Enlace (x4 tramos en vuestra línea) e
-- Interfaz códigos.
-- Los parámetros de Enlace se dan de alta una vez (definición
-- genérica); si necesitáis una fila por cada uno de los 4
-- tramos, duplicar cada INSERT indicando el tramo en la clave
-- (p.ej. bs08.tramo_posterior_wrap.enlace1.parametro.tiempo_minimo).
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.tramo_posterior_wrap.parametro.timeout_ft_enlaces', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Timeout ft enlaces [x0,01s]',
 'Tiempo máximo de excitación de todas las fotocélulas presentes después del wrap. Si una fotocélula se queda tapada más tiempo del configurado, se genera la alarma TIMEOUT FT ELEMENTOS POSTERIORES WRAP. Configurando a cero se excluye el control de las fotocélulas. Valor de ejemplo visto en el manual: 400 (x0,01s = 4 s) — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.enlace.parametro.tiempo_minimo', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Enlace — Tiempo mínimo [x0,01s]',
 'Tiempo mínimo de recorrido de la caja en el enlace. Aplica a cada uno de los 4 tramos de enlace de la línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.enlace.parametro.tiempo_maximo', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Enlace — Tiempo máximo [x0,01s]',
 'Tiempo máximo de recorrido de la caja en el enlace. Si la caja no transita en este tiempo por la fotocélula de salida del enlace, se borra de la lista de cajas del enlace. Aplica a cada uno de los 4 tramos de enlace.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.enlace.parametro.tiempo_medio', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Enlace — Tiempo medio [x0,01s]',
 'Tiempo medio de recorrido de la caja en el enlace; se usa para poder parar las cajas cuando los elementos en el tramo posterior están saturados. Aplica a cada uno de los 4 tramos de enlace.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.enlace.parametro.volteador_anterior', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Enlace — Volteador anterior',
 'Configura si anteriormente al enlace se encuentra el elemento volteador.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.enlace.parametro.caja_unica', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Enlace — Caja única',
 'Configura el tipo de gestión del enlace. Sí: en el enlace puede haber solo una caja. No: en el enlace puede haber más de una caja.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.enlace.parametro.zona_saturacion_salida', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Enlace — Zona saturación en salida',
 'Configura la posición de parada por la fotocélula de salida cuando el elemento que sigue está parado o saturado.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.enlace.parametro.ft_salida_libre', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Enlace — Ft salida libre',
 'Se utiliza solo con "Caja única" en Sí. Sí: la caja se mantiene en el enlace hasta que se activa la ft de salida enlace. No: la caja desaparece del enlace en el frente positivo de la ft de salida del enlace.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.tramo_posterior_wrap.interfaz_codigos.parametro.habilitar_envio_proxima_caja', 'BS08', 'Tramo posterior wrap', 'parametro',
 'Interfaz códigos — Habilitar envío de la próxima caja',
 'Posibilidad de transmitir el código de la próxima caja en el frente negativo del strobe, según un protocolo de tiempos (strobe/bits) para impresoras predispuestas para este tipo de funcionamiento.',
 true, now(), now());

-- ------------------------------------------------------------
-- JAULA — lo que el manual describe realmente en 9.5 (jaula
-- motorizada / gestión de cajas), que NO está cubierto por los
-- parámetros ya existentes de "Jaula" (esos son del empujador
-- de pila, mecanismo distinto).
-- ------------------------------------------------------------

INSERT INTO ceria_documentacion_maquina (id, clave, maquina, submaquina, tipo, nombre, contenido, activo, created_at, updated_at)
VALUES
(gen_random_uuid(), 'bs08.jaula.parametro.habilita_jaula_motorizada', 'BS08', 'Jaula', 'parametro',
 'Habilita jaula motorizada',
 'Sí: jaula motorizada habilitada. No: jaula motorizada deshabilitada. Valor de ejemplo visto en el manual: No — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.jaula.parametro.cajas_paradas_en_jaula', 'BS08', 'Jaula', 'parametro',
 'Cajas paradas en jaula',
 'Dato dependiente de la presencia de jaula motorizada. Sí: las cajas/pilas se quedan en la jaula, salen cuando la próxima caja/pila entra; hay que programar el número de cajas/pilas que debe quedar en la jaula. No: las cajas/pilas no se paran en la jaula; en ese caso programar a 0 el número de cajas/pilas en la jaula. Valor de ejemplo visto en el manual: No — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.jaula.parametro.cajas_presentes_en_jaula', 'BS08', 'Jaula', 'parametro',
 'Cajas presentes en la jaula',
 'Número programable de cajas que pueden estar dentro de la jaula. Valor de ejemplo visto en el manual: 0 — verificar en vuestra línea.',
 true, now(), now()),

(gen_random_uuid(), 'bs08.jaula.parametro.tiempo_maximo_salida_pilas', 'BS08', 'Jaula', 'parametro',
 'Tiempo máximo de salida pilas [ms]',
 'En caso de jaula motorizada funcionante y cajas no paradas en jaula, tiempo máximo previsto para la salida de cajas de la jaula. Valor de ejemplo visto en el manual: 0 ms — verificar en vuestra línea.',
 true, now(), now());

COMMIT;
