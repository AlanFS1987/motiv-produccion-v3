SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict SNfJryGj7CHJCZ4vdPxvC5FVBmEbbfivk38vR8ceDjPMRILHZjavihekTMh4t7r

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: almacen_categoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."almacen_categoria" ("id", "clave", "maquina", "submaquina", "nombre", "orden") VALUES
	('922fd24a-6a3d-4518-afba-e664b8a13e8d', 'por_catalogar', 'por_catalogar', NULL, 'Por catalogar', 0),
	('046e60a7-3daa-49b1-9539-005ba26289cb', 'general.general.xjau', 'General', 'General', 'Consumible', 0),
	('6e286f42-941f-4e4c-820b-6274bb9876f4', 'linea.qualitron.5bhi', 'Linea', 'Qualitron', 'Traccion', 0),
	('71ea4144-8d91-42e8-8f32-9695010426fa', 'bs08.i6mg', 'BS08', NULL, 'TRACCION PILAS', 0);


--
-- Data for Name: ceria_documentacion_maquina; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ceria_documentacion_maquina" ("id", "clave", "maquina", "submaquina", "tipo", "nombre", "contenido", "activo", "created_at", "updated_at") VALUES
	('693d66e0-5c94-489b-9acf-b37696579a58', 'bs08.divisor.proceso.01_llegada_parada', 'BS08', 'Divisor', 'proceso', '1. Llegada y parada de la pila', 'La pila completa entra por la tracción warp y para en el divisor. La "Distancia FT cinta/divisor" es la distancia entre la fotocélula de salida de los apiladores y el punto donde debe pararse la pila para poder dividirla.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('51822255-a367-4ce3-86c9-665c27575dfe', 'bs08.divisor.proceso.04_escuadrado_mordazas', 'BS08', 'Divisor', 'proceso', '4. Escuadrado con mordazas (casi sin uso real)', 'No son dos mecanismos distintos: ambas formas de escuadrar usan las mismas mordazas del divisor, solo cambia a qué altura actúan. "Habilita escuadr. con mordazas": tras medir, las mordazas cierran del todo a la altura de la división para escuadrar, abren, y vuelven a cerrar para efectuar el corte. "Escuadra pila": si está activado, tras medir la pila las mismas mordazas bajan hasta abajo del todo (a la altura de las cadenas, la posición de calibrado) y cierran y abren ahí para escuadrar la pila completa, no solo a la altura de un corte. En la práctica: el escuadrado con mordazas nunca se usa; el de pila completa solo se usa cuando la pila llega muy torcida, y aun así muchas veces el mecanismo no tiene fuerza suficiente para moverla.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('0f064426-2fb2-48cf-84ab-9a519cd2f7a1', 'bs08.divisor.parametro.numero_ciclos_calibracion', 'BS08', 'Divisor', 'parametro', 'Número de ciclos de calibración', 'Valor capturado: 1. Se reajusta por formato.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('3c614517-4ae6-474b-ad49-88edecad3291', 'bs08.divisor.parametro.habilitado', 'BS08', 'Divisor', 'parametro', 'Habilitado', 'Capturado en "Sí". Dato constructivo: si el divisor está montado físicamente en esta máquina, no se reajusta por formato.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('1466f411-5650-4f47-a08e-38dac38916e8', 'bs08.divisor.parametro.habilita_escuadr_mordazas', 'BS08', 'Divisor', 'parametro', 'Habilita escuadr. con mordazas', 'Booleano, capturado en "No" en esta línea. En la práctica este modo de escuadrado nunca se usa (ver tipo=proceso, paso 4).', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('955e3ab5-7c6d-431d-a364-f968f84a0346', 'bs08.divisor.parametro.escuadra_pila', 'BS08', 'Divisor', 'parametro', 'Escuadra pila', 'Booleano, capturado en "No" en esta línea. Solo se usaría cuando la pila llega muy torcida (ver tipo=proceso, paso 4).', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('aad3a7ab-644d-4a1d-8db0-2d4d7cc03138', 'bs08.divisor.parametro.reductor_i50', 'BS08', 'Divisor', 'parametro', 'Reductor I50', 'Dato constructivo (no se reajusta por formato, solo cambia si se sustituye físicamente la pieza): el divisor monta de serie un reductor I30; existe la opción de montar en su lugar un reductor I50 más grande/con otra relación. Capturado en "No" (monta I30). Es el único dato constructivo de la pantalla "Máquina" que se toca en la práctica, si algún día se cambia esa pieza.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('92a12bcb-15f8-4432-9b2a-f470275c6bd2', 'bs08.divisor.parametro.velocidad_vacio', 'BS08', 'Divisor', 'parametro', 'Velocid. vacío', 'Valor capturado: 3000 step/s. Motores paso a paso, sin encoder. Configuración habitual de referencia: 5000 subida/5000 bajada/5 aceleración — el valor capturado el 09/09 (3000/3000/3) confirma que estos valores sí varían por formato.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('473bd0fa-3a77-4346-b93c-030cccf095bc', 'bs08.divisor.parametro.velocidad_llenado', 'BS08', 'Divisor', 'parametro', 'Veloc. llenado', 'Valor capturado: 3000 step/s.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('cba22885-911c-41cc-aed0-68ab74651780', 'bs08.divisor.parametro.aceleracion', 'BS08', 'Divisor', 'parametro', 'Aceleración (dinámica)', 'Valor capturado: 3.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('f88072f3-a90e-4d6c-be8b-82b143d54c68', 'bs08.divisor.parametro.tiempo_cierre', 'BS08', 'Divisor', 'parametro', 'Tiempo de cierre', 'Valor capturado: 1400 ms.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('36b3abfd-cf62-4850-b43d-b7a5458f9707', 'bs08.divisor.parametro.tempo_ganasce_aperte', 'BS08', 'Divisor', 'parametro', '_Tempo ganasce aperte', 'Término en italiano sin traducir en el software: "tiempo mordazas abiertas". Valor capturado: 150 ms.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('3625afe6-4ea1-425d-ba70-5ebbf059914b', 'bs08.divisor.parametro.cuota_division_pila', 'BS08', 'Divisor', 'parametro', 'Cuota de división de la pila', 'Cota de corte fija, en mm desde el cero del divisor, usada cuando "División de la pila sin fotocélula" está en "Sí". Valor capturado: 14 mm (campo inactivo en esta línea por estar la opción en "No"). Con 14 mm, el divisor cierra las mordazas a 14 mm en cada división (≈ una pieza de 9-11 mm más margen), tantas veces como indique "Número de divisiones por pila", sin medir la pila. Se reajusta por formato.', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('afae99d3-ffa6-4aa2-ab0b-6f2d4d6f6ae0', 'bs08.divisor.parametro.division_sin_fotocelula', 'BS08', 'Divisor', 'parametro', 'División de la pila sin fotocélula', 'Booleano de la pantalla Formato → Divisor. Capturado en "No" en esta línea. En "No" (modo normal), el divisor mide la pila con la fotocélula y calcula la cota de corte; el campo "Cuota de división de la pila" queda en gris/inactivo. En "Sí", el divisor NO mide la pila: corta siempre a la cota fija indicada en "Cuota de división de la pila", tantas veces como diga "Número de divisiones por pila". Es la opción para formatos cuya pila no es medible con el montaje actual de la fotocélula — típicamente pilas más bajas que el "Intereje FT/mordaza" (p. ej. formato 120x120, 4 piezas, unos 40 mm de pila frente a un intereje de 68 mm). El 120x120 se divide siempre así, con la cota asignada a mano. En este modo no aplica la comprobación "Altura pila / Tolerancia".', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('02e821df-8bbf-4297-a167-10cec2310467', 'bs08.divisor.parametro.tempo_chiusura_squadratura', 'BS08', 'Divisor', 'parametro', '_Tempo chiusura per squadratura', 'Término en italiano sin traducir en el software: "tiempo cierre para escuadrado". Valor capturado: 5 ms.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('a963f1ca-9a35-4dba-93be-959a843f7ac6', 'bs08.divisor.sensor.fotocelula_medicion_altura', 'BS08', 'Divisor', 'sensor', 'Fotocélula de medición de altura', 'Emisor en un lado, receptor en el otro, montada sobre las mordazas vulcanizadas. Mide la altura de la pila para poder calcular las divisiones — el "Intereje FT/mordaza" es la altura de esta fotocélula respecto a la parte baja de la mordaza.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('1353e69a-ccee-48cc-90cc-caf4a674d0db', 'bs08.divisor.sensor.fotocelula_salida_apiladores', 'BS08', 'Divisor', 'sensor', 'Fotocélula de salida de apiladores', 'No está físicamente en el divisor, pero es la referencia de la "Distancia FT cinta/divisor": mide desde aquí hasta el punto donde debe pararse la pila.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('78dd214c-aced-495e-b77c-4eb7cb0090e2', 'bs08.divisor.actuador.motor_paso_a_paso', 'BS08', 'Divisor', 'actuador', 'Motor paso a paso (x2, uno por lado)', 'Sin encoder, precisión de milímetros (a diferencia de motores convencionales como el del sacabandejas o el empujador de pila). Independientes pero sincronizados entre sí. Sube y baja el conjunto de mordaza mediante motor + eje + polea dentada, actuando sobre una cremallera.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('8ee0c48f-944e-424b-8fb0-27c48002af47', 'bs08.divisor.pieza.cremallera', 'BS08', 'Divisor', 'pieza', 'Cremallera', 'Recibe el movimiento del motor a través del eje y la polea dentada para subir/bajar el conjunto de la mordaza.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('a6bcf8b5-4310-495a-bc6d-7c0542d150b2', 'bs08.divisor.pieza.eje_polea_dentada', 'BS08', 'Divisor', 'pieza', 'Eje y polea dentada', 'Transmiten el movimiento del motor a la cremallera.', true, '2026-09-10 19:52:55.604918+00', '2026-09-10 19:52:55.604918+00'),
	('a335dbec-12d5-491e-af1b-f749b33dee43', 'bs08.escuadrador.proceso.01_llegada_tope', 'BS08', 'Escuadrador', 'proceso', '5.1 Llegada y tope mecanico', 'Una vez dividida, la pila avanza hasta el escuadrador ya con unicamente las piezas que componen una sola caja. El tope es mecanico; el punto de parada depende de la posicion determinada por el formato y de la distancia configurada (ver "Distancia FT cinta/divisor" en Divisor, y "Intereje wrap" en los parametros de este mismo bloque).', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('ec2324cf-3bd9-489c-8221-cb1abd6901cb', 'bs08.escuadrador.proceso.02_escuadrado_liberacion', 'BS08', 'Escuadrador', 'proceso', '5.2 Escuadrado y liberacion', 'Mecanismo de 2 pistones frontales + 1 trasero, por cada lado: el piston frontal 1 mueve el taco de teflon; el piston frontal 2 mueve una pieza con dos rodillos verticales que centran la pila lateralmente; el piston trasero lleva dos rodillos dispuestos de forma que, al extender el piston, uno presiona la pieza por detras y otro por el lateral, dejando la pila perfectamente escuadrada sobre las cadenas. Una vez escuadrada (durante el "Tiempo escuadrado" configurado), todo se abre y libera la pila, que avanza al elevador. Al avanzar, deja libre el hueco y la siguiente pila ya dividida en el divisor avanza a la posicion de escuadrado -- divisor y escuadrador trabajan en cadena, una pila detras de otra.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('2e4c799d-869f-41e3-a434-5dfc5adf9468', 'bs08.escuadrador.parametro.tiempo_escuadrado_lateral', 'BS08', 'Escuadrador', 'parametro', 'Tiempo escuadrado (lateral)', 'Valor capturado: 1 ms. Parte lateral del mecanismo de escuadrado.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('54a9dfde-7e22-4a04-9674-8f02693f9dde', 'bs08.escuadrador.parametro.retardo_escuadrado_frontal', 'BS08', 'Escuadrador', 'parametro', 'Retardo escuadrado (frontal)', 'Valor capturado: 1 ms.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('dd552ce8-2443-44d1-a85e-444186bdd7cf', 'bs08.escuadrador.parametro.tiempo_escuadrado_frontal', 'BS08', 'Escuadrador', 'parametro', 'Tiempo escuadrado (frontal)', 'Valor capturado: 1300 ms.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('f19523a9-6c06-4824-aef8-fe690da0debc', 'bs08.escuadrador.parametro.habilitado_lateral', 'BS08', 'Escuadrador', 'parametro', 'Habilitado (lateral)', 'Capturado en Si. En esta planta la parte lateral esta siempre habilitada, nunca se deshabilita.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('89a16897-8d58-4c55-9ff9-23d5fe0c1b68', 'bs08.escuadrador.parametro.habilitado_frontal', 'BS08', 'Escuadrador', 'parametro', 'Habilitado (frontal)', 'Capturado en Si. En esta planta la parte frontal esta siempre habilitada, nunca se deshabilita.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('3de64155-8696-4474-baa0-31f1bbedb0c2', 'bs08.escuadrador.parametro.intereje_wrap', 'BS08', 'Escuadrador', 'parametro', 'Intereje wrap', 'Distancia que avanza la pila desde el escuadrador hasta el elevador. No es lo mismo que "Distancia FT cinta/divisor" (que mide desde la foto de salida de apiladores hasta el punto de parada en el divisor) -- son dos tramos distintos y consecutivos de la misma traccion warp. Valor capturado: 1443 mm. Se reajusta por formato.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('af28b210-7b65-4d14-a2b9-7c5a7a6d6e07', 'bs08.escuadrador.pieza.taco_teflon', 'BS08', 'Escuadrador', 'pieza', 'Taco de teflon', 'Movido por el piston frontal 1. Primer punto de contacto con la pila al entrar en el escuadrador.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('d838581f-054e-4352-ae02-d8e90c8ced47', 'bs08.escuadrador.pieza.rodillos_verticales', 'BS08', 'Escuadrador', 'pieza', 'Pieza con dos rodillos verticales', 'Movida por el piston frontal 2. Centra la pila lateralmente.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('b7864d17-5040-4954-91c8-3d88e9f1eaf4', 'bs08.escuadrador.pieza.rodillos_traseros', 'BS08', 'Escuadrador', 'pieza', 'Rodillos traseros (x2)', 'En el piston trasero, por cada lado. Al extender el piston, uno presiona la pieza por detras y otro por el lateral, dejando la pila perfectamente escuadrada sobre las cadenas.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('c63a0e7e-99dc-4cd8-b97b-4af981797144', 'bs08.escuadrador.actuador.piston_frontal_1', 'BS08', 'Escuadrador', 'actuador', 'Piston frontal 1 (por cada lado)', 'Mueve el taco de teflon.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('3a669e99-24db-40ab-a21e-26a9a76cc5b4', 'bs08.escuadrador.actuador.piston_frontal_2', 'BS08', 'Escuadrador', 'actuador', 'Piston frontal 2 (por cada lado)', 'Mueve la pieza con dos rodillos verticales que centra la pila lateralmente.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('5afee174-7cec-4fc8-9bc7-34cdde0e4265', 'bs08.escuadrador.actuador.piston_trasero', 'BS08', 'Escuadrador', 'actuador', 'Piston trasero (por cada lado)', 'Lleva dos rodillos; al extenderse, uno presiona la pieza por detras y otro por el lateral, escuadrando la pila sobre las cadenas.', true, '2026-09-10 20:04:40.790022+00', '2026-09-10 20:04:40.790022+00'),
	('5da84c95-cb91-4609-9f72-f736a86ec0e5', 'bs08.sacabandejas.parametro.distancia_almacen_izquierdo', 'BS08', 'Sacabandejas', 'parametro', 'Distancia almacen (izquierdo, relativo al derecho)', 'El almacen derecho tiene el sensor de cero (posicion 0). El izquierdo es relativo a ese cero -- nominalmente ~1.600 mm, aunque en la practica es habitual encontrarlo entre 1.680 y 1.730 mm, segun donde este fisicamente el sensor.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('2386d2aa-4b2a-497b-be4e-236353cc74a3', 'bs08.empujador_bandejas.parametro.posicion_final_empuje', 'BS08', 'Empujador de bandejas', 'parametro', 'Posicion de final de empuje', 'Hasta donde empuja el carton dentro del mandril.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('108d6fa0-dd86-44c1-9bc7-d31844cced63', 'bs08.elevador.proceso.01_elevacion_pila', 'BS08', 'Elevador', 'proceso', '1. Elevacion de la pila y descenso del mandril', 'Dos motores independientes, sincronizados entre si -- mismo patron que el Divisor y el Mandril. Situados justo debajo del mandril. Cuando la pila se para encima de ellos, los motores suben y separan la pila de la traccion de pilas. El mandril baja entonces sobre el elevador (con la pila encima) para envolverla con el carton. Que la pila quede elevada es lo que deja hueco libre debajo para que, durante el cierre de la caja (ver Jaula), el fondo jaula pueda subir desde el frontal y el empujador de pila pueda empujar desde atras, los dos por debajo de la pila: el empujador cierra la solapa trasera empujando la caja, y el fondo jaula cierra la solapa frontal al subir -- las guias de la jaula cierran las solapas laterales mientras tanto.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('782ef67c-67f5-4081-9329-15e64eed9207', 'bs08.elevador.proceso.02_mecanismo_accionamiento', 'BS08', 'Elevador', 'proceso', '2. Mecanismo de accionamiento (motor -> reductor -> biela -> patin)', 'Motor paso a paso (mismo tipo que usan el Divisor y el empujador de carton/bandejas), unido a un reductor I30. El motor no llega a dar ni una vuelta completa: gira unos 180 grados. Ese giro pasa por una biela, que convierte el movimiento rotacional del motor en un movimiento vertical recto -- es este movimiento el que sube y baja el patin del elevador.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('fa8e2dba-3cae-4f83-9b04-eff401b7472f', 'bs08.elevador.actuador.motor_elevador', 'BS08', 'Elevador', 'actuador', 'Motor elevador (x2, uno a cada lado)', 'Motor paso a paso, mismo tipo que usan el Divisor y el empujador de carton (bandejas) -- sin encoder. Independientes entre si pero sincronizados. Van unidos a un reductor I30; no llegan a dar ni una vuelta completa, giran unos 180 grados. Ese giro se transmite a traves de una biela, que lo convierte en el movimiento vertical recto que sube y baja el patin del elevador, separando la pila de la traccion de pilas.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('c0c9819c-377e-4ffa-aae2-8c3037da54dc', 'bs08.elevador.pieza.reductor_i30', 'BS08', 'Elevador', 'pieza', 'Reductor I30', 'Recibe el giro del motor paso a paso y lo transmite a la biela. A diferencia del reductor del Divisor, aqui no se menciona ninguna alternativa I50 -- es fijo.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('8ce557ab-5896-4038-9145-02a0834d45dc', 'bs08.elevador.pieza.biela', 'BS08', 'Elevador', 'pieza', 'Biela', 'Convierte el movimiento de giro del motor (que no llega a una vuelta completa, unos 180 grados) en un movimiento vertical recto, que es el que sube y baja el patin.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('445d6711-45f1-421d-aac0-0f4767aacbec', 'bs08.elevador.pieza.patin', 'BS08', 'Elevador', 'pieza', 'Patin del elevador', 'Una especie de lamina o espada, cubierta por una cadena loca -- no va cogida a ningun motor. Su unica funcion es dejar que la caja se deslice sobre ella mientras esta siendo empujada.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('ad28ae10-23be-4032-ad9a-4cf2a2b6d32c', 'bs08.elevador.pieza.cadena_loca', 'BS08', 'Elevador', 'pieza', 'Cadena loca (cubre el patin)', 'No es motriz -- no va cogida a ningun motor. Permite que la caja se deslice sobre el patin mientras es empujada.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('b0711d87-8731-4e78-88e5-edf1814f1422', 'bs08.elevador.pieza.leva', 'BS08', 'Elevador', 'pieza', 'Leva (en el eje del motor)', 'Sujeta al eje del motor; la lee el sensor de calibrado para determinar la posicion.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('c9b220fb-1660-4bfd-942c-29cb8eb38db5', 'bs08.elevador.sensor.calibrado', 'BS08', 'Elevador', 'sensor', 'Sensor de calibrado', 'Lee una leva sujeta al eje del motor. A diferencia de otros offsets de la maquina (medidos en mm), aqui la calibracion se mide en decimas de grado, porque el origen del movimiento es rotacional.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('7eaa03a7-e882-4cb2-9ca1-47f06aa9954a', 'bs08.elevador.parametro.velocidad_subida', 'BS08', 'Elevador', 'parametro', 'Velocidad subida', 'Valor: 10.000 steps/s (motor paso a paso).', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('fc5ed899-0a0c-4161-9c26-5d276619515b', 'bs08.elevador.parametro.velocidad_bajada', 'BS08', 'Elevador', 'parametro', 'Velocidad bajada', 'Valor: 10.000 steps/s.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('41aebd79-85af-43a2-be1f-3c8767c5735f', 'bs08.elevador.parametro.aceleracion', 'BS08', 'Elevador', 'parametro', 'Aceleracion', 'Valor: 10. Misma formula que el resto de motores paso a paso de la maquina (tiempo de aceleracion = 5 dividido entre el valor programado) -> 0,5 s.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('3bf53e0b-fc80-481e-8d8a-46f13c1f4178', 'bs08.elevador.parametro.start_plantil', 'BS08', 'Elevador', 'parametro', 'Start plantil.', '"Plantilla" es como llama la maquina al carton. Cota en milimetros: distancia recorrida por la pila entre el escuadrador y el elevador a partir de la cual arranca el empuje del carton hacia el mandril -- dispara el arranque del ciclo del subsistema de carton en funcion del avance de la pila, para que el carton y la pila lleguen sincronizados al mandril. Valor capturado: 1 mm. Se reajusta por formato.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('f216e8fc-9bd0-4ccd-9bc1-d696579cd9a0', 'bs08.elevador.parametro.punto_espera_empujador_libre', 'BS08', 'Elevador', 'parametro', 'Punto espera empujador libre', 'Punto donde la pila espera, entre escuadrador y elevador, a que el empujador de pila (que acaba de empujar la caja anterior) vuelva a su posicion trasera de espera, antes de poder seguir avanzando -- condicion de enclavamiento entre el avance de la pila y el retorno del empujador de pila (ver Jaula). Se ajusta segun el formato con un efecto practico opuesto: formatos de tablilla (20x120, 30x120) -> se coloca a 1 mm, practicamente a la salida del escuadrador -- la pila espera ahi a que el empujador vuelva, y luego recorre de un tiron todo el tramo hasta el elevador. Formatos grandes (60x120, 90x90, 120x120) -> se coloca 1 mm por debajo del "Intereje wrap" (ver Escuadrador), es decir, casi pegado al elevador -- en la practica, la pila no se detiene en ningun punto intermedio: en cuanto el escuadrador la libera, avanza automaticamente hasta el elevador sin pausa. Valor capturado (formato no tablilla): 1440 mm.', true, '2026-09-10 20:22:09.076472+00', '2026-09-10 20:22:09.076472+00'),
	('6241ba49-8082-4d80-9396-0f3c0e8a204d', 'bs08.sacabandejas.proceso.01_recogida', 'BS08', 'Sacabandejas', 'proceso', '1. Recogida del carton en el almacen', 'Brazo movil con ventosas que se mueve transversalmente sobre la maquina. Hay dos almacenes de carton, uno a cada lado (izquierdo y derecho), cada uno con su propio angulo. El carton esta colocado casi en vertical en ambos almacenes; las ventosas lo cogen en vertical y lo sueltan en horizontal -- por eso el giro de las ventosas no es completo, ronda los 90 grados (la configuracion de rotacion se ajusta en decimas de grado, nunca llega a los 360 grados). En la propia barra hay una fotocelula: "bandeja a bordo".', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('4cddd98a-c2a0-4015-89e2-62bb27e752d0', 'bs08.sacabandejas.proceso.02_desplazamiento_deposito', 'BS08', 'Sacabandejas', 'proceso', '2. Desplazamiento y deposito sobre las guias', 'El sacabandejas va, segun la pila que entra en la empaquetadora, al almacen correspondiente al codigo de esa pila (tipo de carton). Va al almacen, coge el carton, y se desplaza horizontalmente hasta la cota de deposito, ajustando el angulo durante el trayecto (el carton se deposita en horizontal sobre las guias). Al llegar a la cota de deposito, se detiene la alimentacion de los venturis y se suelta el carton sobre las guias.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('773af705-bd6b-418b-9591-52b3c7b45323', 'bs08.sacabandejas.proceso.03_por_que_dos_almacenes', 'BS08', 'Sacabandejas', 'proceso', 'Por que hay dos almacenes', 'No es para acumular mas carton y aguantar mas tiempo sin reponer -- es para tener dos tipos de carton disponibles a la vez (tipicamente 1a y comercial). Logica de uso: el sacabandejas va, segun la pila que entra, al almacen correspondiente al codigo de esa pila. Un operario siempre esta entre dos lineas -- para la linea que tiene a su derecha usa el almacen izquierdo de la maquina, y para la que tiene a su izquierda, el derecho. Cual se usa mas depende de la posicion del operario respecto a sus dos lineas.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('e30dd3a1-28d8-4c64-8ed6-5abc882f1d55', 'bs08.sacabandejas.parametro.offset_calibracion_traslacion', 'BS08', 'Sacabandejas', 'parametro', 'Offset de calibracion (traslacion)', 'En el almacen derecho (el del sensor de cero): define cuanto puede pasar del sensor para que la pieza metalica lo cubra por completo -- en teoria bastan ~10 mm, pero el ajuste permite hasta 30 mm.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('cae63ac1-718a-4f86-a81a-7b162201fb7f', 'bs08.sacabandejas.parametro.offset_calibracion_rotacion', 'BS08', 'Sacabandejas', 'parametro', 'Offset de calibracion (rotacion)', 'Permite hasta 10 grados de ajuste; habitualmente configurado en 100 (=10 grados en decimas), para cubrir del todo el sensor inductivo de calibracion de rotacion.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('b9cb179b-9c9f-4e2c-9393-00365a5b9c1d', 'bs08.sacabandejas.parametro.angulo_almacen_derecho', 'BS08', 'Sacabandejas', 'parametro', 'Angulo almacen derecho', 'Uno de los tres angulos configurables (derecho, izquierdo, y el del deposito). Rango total de configuracion: 0 a 2.300 decimas de grado (~230 grados). Habitual: entre 0 y 150 (0-15 grados).', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('79e3a2ea-b63c-43bc-900f-7e7c9fe8cb46', 'bs08.sacabandejas.parametro.angulo_almacen_izquierdo', 'BS08', 'Sacabandejas', 'parametro', 'Angulo almacen izquierdo', 'Habitual: entre 2.100 y 2.300 decimas de grado (210-230 grados). Mismo rango total de configuracion que el almacen derecho: 0 a 2.300.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('6078df11-fd43-4cb4-8086-4f0f8eada05b', 'bs08.sacabandejas.parametro.tolerancia_posicion', 'BS08', 'Sacabandejas', 'parametro', 'Tolerancia de posicion', 'Configurable, normalmente al maximo (15 mm) para evitar problemas. Al ser un motor convencional con encoder real (no paso a paso, por tanto no perfectamente preciso), si se pasa 5-10 mm no ocurre nada, e incluso a 15 mm tampoco. Solo si se supera esa tolerancia de 15 mm, la maquina se para -- no esta confirmado que de una alarma explicita; segun el mecanico, simplemente se detiene y se retira el carton para repetir el proceso. Principio general (valido para casi toda la seccion): cuanta mas velocidad, menos precision -- si un movimiento necesita ser mas preciso, tiene que ir mas despacio. Es la explicacion por defecto de por que se supera una tolerancia de posicion como esta, antes de sospechar de un fallo mecanico real.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('7b74a5b7-709e-4eaf-8a22-175a0171306e', 'bs08.sacabandejas.parametro.velocidad_lenta', 'BS08', 'Sacabandejas', 'parametro', 'Velocidad lenta', 'Entre 10 y 20 Hz. Se usa en los dos tramos criticos: al acercarse al almacen, y al depositar sobre las guias.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('ccbe8fd0-3bf7-41dd-bb71-f22c5e8baaa9', 'bs08.sacabandejas.parametro.velocidad_rapida', 'BS08', 'Sacabandejas', 'parametro', 'Velocidad rapida', 'Entre 40 y 60 Hz. Se usa en el tramo intermedio, entre los dos tramos lentos.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('2ff31884-4483-45bd-97f8-9a8afe1a5da4', 'bs08.sacabandejas.sensor.fotocelula_almacen', 'BS08', 'Sacabandejas', 'sensor', 'Fotocelula del almacen de bandejas', 'Detecta la presencia de carton en el almacen. Si deja de leer carton, dispara la alarma "Almacen bandejas: faltan bandejas".', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('fcdd2ff4-3d5d-4b0d-a6e7-d064b203c767', 'bs08.sacabandejas.sensor.fotocelula_bandeja_bordo', 'BS08', 'Sacabandejas', 'sensor', 'Fotocelula "bandeja a bordo"', 'Situada en la propia barra del sacabandejas -- confirma que el carton va cogido durante el desplazamiento.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('87bd1d29-40ac-43a9-9114-86f3627d84b6', 'bs08.sacabandejas.sensor.cero_almacen_derecho', 'BS08', 'Sacabandejas', 'sensor', 'Sensor de cero (almacen derecho)', 'Define la posicion 0 de traslacion; el almacen izquierdo se mide relativo a este.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('edd57baa-143d-4a35-87da-cfd49c53e739', 'bs08.sacabandejas.sensor.inductivo_rotacion', 'BS08', 'Sacabandejas', 'sensor', 'Sensor inductivo de calibracion de rotacion', 'Lee el offset de calibracion de rotacion (ver parametro correspondiente).', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('cf26c112-a162-4c85-95f4-64dc17bafe51', 'bs08.sacabandejas.actuador.motor_trifasico', 'BS08', 'Sacabandejas', 'actuador', 'Motor trifasico convencional (con encoder)', 'Rotor en jaula de ardilla, sin escobillas, con encoder -- conoce su posicion en todo momento. Precision: milimetros. A diferencia de los motores paso a paso (Divisor, Elevador, empujador de carton), este SI lleva encoder.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('7747c5a8-0dcb-4ba0-98b8-482b55828f5b', 'bs08.sacabandejas.actuador.ventosas', 'BS08', 'Sacabandejas', 'actuador', 'Ventosas', 'Cogen el carton en vertical en el almacen y lo sueltan en horizontal sobre las guias -- por eso su giro no es completo, ronda los 90 grados. Alimentadas por venturis, que se desconectan al llegar a la cota de deposito para soltar el carton.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('1b9515f6-41a4-4803-ac97-c650db38de1c', 'bs08.sacabandejas.alarma.bandeja_perdida', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: bandeja perdida', 'Salta si el carton se cae durante el desplazamiento del sacabandejas hacia el deposito.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('0b708b3a-9004-434a-ade4-0bf14d95a62e', 'bs08.sacabandejas.alarma.faltan_bandejas', 'BS08', 'Sacabandejas', 'alarma', 'Almacen bandejas: faltan bandejas', 'Salta cuando la fotocelula del almacen deja de leer carton.', true, '2026-09-10 20:26:48.687236+00', '2026-09-10 20:26:48.687236+00'),
	('194f0ee4-7af5-44a0-bc1b-efadb9641ef7', 'bs08.empujador_bandejas.proceso.01_posiciones', 'BS08', 'Empujador de bandejas', 'proceso', '1. Recogida y posiciones configurables', 'Gestionado, en la mayoria de las lineas, por un unico motor paso a paso. Tres posiciones configurables: Posicion 0 (atras del todo, es donde el empujador calibra), Posicion de espera (algo mas adelantada que la posicion 0, para que el carton caiga cerca del empujador sin llegar a caerle encima), y Posicion de final de empuje (hasta donde empuja el carton dentro del mandril).', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('3e88870d-012a-44ca-8460-e514aa2ba826', 'bs08.empujador_bandejas.proceso.02_mecanismo_cola', 'BS08', 'Empujador de bandejas', 'proceso', '2. Mecanismo de cola', 'Al empezar a empujar, el empujador pasa por debajo de una fotocelula conectada a las electrovalvulas del calderin de cola (el deposito de cola). La posicion de los "tiros de cola" se programa en funcion de lo que detecta el propio motor del empujador -- asi la caja se pega correctamente mas adelante -- y el carton sigue avanzando hasta el final del mandril. Al final del recorrido hay otra fotocelula que confirma si el carton alcanzo el mandril.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('a8b2297c-1dad-481a-80d7-28575c8e849c', 'bs08.empujador_bandejas.proceso.03_cierre_ciclo', 'BS08', 'Empujador de bandejas', 'proceso', '3. Secuencia de cierre del ciclo', 'Una vez el carton llega al final (la fotocelula del mandril lo confirma), el empujador de bandejas retrocede. Solo cuando supera una posicion programada llamada "cota obstaculo bandeja", el mandril tiene permiso para empezar a bajar -- es la forma de asegurar que el empujador ya no estorba antes de que el mandril se mueva.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('b1e219f6-e1f5-42b0-aecb-97eff43fbc2f', 'bs08.empujador_bandejas.proceso.04_bloqueo_bandejas', 'BS08', 'Empujador de bandejas', 'proceso', '4. Bloqueo de bandejas (interlock de seguridad del mandril)', 'Antes de que el mandril empiece a bajar, unos pequenos pistones con silentblocks aseguran el carton en su sitio -- esto ocurre en cuanto el carton llega a la cota final del mandril y la fotocelula detecta que esta en posicion para bajar (se asegura ANTES de empezar a bajar). Si ese piston no esta en la posicion correcta (contraido), no se permite al empujador de bandejas empujar el siguiente carton hacia el mandril.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('7800e5c4-ad67-499f-b745-c96b69b1b23e', 'bs08.empujador_bandejas.parametro.posicion_0', 'BS08', 'Empujador de bandejas', 'parametro', 'Posicion 0', 'Atras del todo -- es donde el empujador calibra.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('e3142a19-6627-4765-8531-ea8ec951dc37', 'bs08.empujador_bandejas.parametro.posicion_espera', 'BS08', 'Empujador de bandejas', 'parametro', 'Posicion de espera', 'Algo mas adelantada que la posicion 0, para que el carton caiga cerca del empujador sin llegar a caerle encima.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('b506ae5d-4428-4d8a-9719-2f92a3f50870', 'bs08.empujador_bandejas.parametro.velocidad_avance', 'BS08', 'Empujador de bandejas', 'parametro', 'Velocidad de avance', 'Motor paso a paso, en steps/s. Valores de fabrica: 6.000 = lenta, 9.000 = rapida -- aqui se tiene siempre configurado en rapida: 9.000.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('9f3740a5-88fb-4f9a-a9b0-3abd50eb1a16', 'bs08.empujador_bandejas.parametro.velocidad_retroceso', 'BS08', 'Empujador de bandejas', 'parametro', 'Velocidad de retroceso', 'Mismo valor que el avance en esta linea: 9.000 steps/s (rapida).', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('4f132fa8-4216-459a-af40-e877a7620706', 'bs08.empujador_bandejas.parametro.aceleracion', 'BS08', 'Empujador de bandejas', 'parametro', 'Aceleracion', 'No esta claro que determina exactamente el parametro, pero en la practica el tiempo de aceleracion resulta de dividir 5 entre el numero configurado -- ej. valor 5 -> 1 segundo de aceleracion; valor 2 -> 2,5 segundos; valor 1 -> 5 segundos. Maximo configurable: 30. Valor habitual aqui: 9.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('ff34c466-cb75-475b-a604-59d392903638', 'bs08.empujador_bandejas.parametro.cota_obstaculo_bandeja', 'BS08', 'Empujador de bandejas', 'parametro', 'Cota obstaculo bandeja', 'Posicion que el empujador debe superar al retroceder para que el mandril tenga permiso de empezar a bajar -- asegura que el empujador ya no estorba antes de que el mandril se mueva.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('07f21b79-535f-47fa-a9bc-7b6bdcc014c4', 'bs08.empujador_bandejas.parametro.comunicacion_inverter_dir24', 'BS08', 'Empujador de bandejas', 'parametro', 'Comunicacion inverter -- direccion 24', 'Dato constructivo: confirma que el empujador de bandejas lleva variador de frecuencia direccionado por bus (no solo arranque directo). Capturado en Si.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('e0df0757-673f-45b6-bab2-53ad686edf11', 'bs08.empujador_bandejas.parametro.disabilita_spintore_vassoio', 'BS08', 'Empujador de bandejas', 'parametro', 'Disabilita spintore vassoio', 'Dato constructivo, termino en italiano sin traducir en el software ("spintore vassoio" = empujador de bandeja) -- confirma que el software viene de un OEM italiano. Capturado en No, es decir, el empujador de bandejas SI esta habilitado/instalado en esta maquina.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('cb0d1809-4de3-453e-ba79-9b65a2418cd3', 'bs08.empujador_bandejas.actuador.motor_paso_a_paso', 'BS08', 'Empujador de bandejas', 'actuador', 'Motor paso a paso (empujador de bandejas)', 'Gestiona las tres posiciones (0, espera, final de empuje). Velocidad y aceleracion configurables por separado para avance y retroceso.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('cb78fcaa-5f17-4600-8a49-34eef2192519', 'bs08.empujador_bandejas.actuador.electrovalvulas_calderin_cola', 'BS08', 'Empujador de bandejas', 'actuador', 'Electrovalvulas del calderin de cola', 'Activadas segun lo que detecta la fotocelula del mecanismo de cola, sincronizadas con el propio motor del empujador, para programar los "tiros de cola" que pegan la caja correctamente.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('7e2cfdff-69b9-433a-91bc-f72406a61b16', 'bs08.empujador_bandejas.actuador.pistones_silentblocks', 'BS08', 'Empujador de bandejas', 'actuador', 'Pistones con silentblocks (bloqueo de bandejas)', 'Aseguran el carton en su sitio antes de que el mandril empiece a bajar. Si no estan contraidos (posicion correcta), bloquean que el empujador de bandejas empuje el siguiente carton.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('5ce77073-461c-463f-80d3-aa8ff6091415', 'bs08.empujador_bandejas.pieza.calderin_cola', 'BS08', 'Empujador de bandejas', 'pieza', 'Calderin de cola (deposito de cola)', 'Deposito de cola conectado a las electrovalvulas que activa la fotocelula del mecanismo de cola al pasar el empujador.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('65bc6d19-0b52-4b6e-85b4-0c6aee8ab7f6', 'bs08.empujador_bandejas.sensor.fotocelula_mecanismo_cola', 'BS08', 'Empujador de bandejas', 'sensor', 'Fotocelula del mecanismo de cola', 'Detecta el paso del empujador para activar las electrovalvulas del calderin de cola y programar los "tiros de cola".', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('08c9225c-78c7-478e-b45c-8a6294ee44d7', 'bs08.empujador_bandejas.sensor.fotocelula_confirmacion_mandril', 'BS08', 'Empujador de bandejas', 'sensor', 'Fotocelula de confirmacion en el mandril', 'Al final del recorrido del empujador, confirma si el carton alcanzo el mandril. Si no lee el carton, dispara la alarma "Mandril: faltan bandejas".', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('8585d099-b0d3-4298-a1cb-611d872c542d', 'bs08.empujador_bandejas.sensor.fotocelula_posicion_bajar', 'BS08', 'Empujador de bandejas', 'sensor', 'Fotocelula de posicion para bajar (bloqueo de bandejas)', 'Detecta que el carton ha llegado a la cota final del mandril y esta en posicion para que el mandril pueda bajar -- dispara que los pistones con silentblocks aseguren el carton ANTES de que empiece a bajar.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('1743e882-0a97-49cc-9fe2-c1510d8166be', 'bs08.empujador_bandejas.alarma.mandril_faltan_bandejas', 'BS08', 'Empujador de bandejas', 'alarma', 'Mandril: faltan bandejas', 'Salta si, tras empujar, la fotocelula de confirmacion en el mandril no llega a leer el carton.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('ca79f51b-76fb-46e9-a274-c21385ce65b9', 'bs08.empujador_bandejas.alarma.bloqueo_bandejas', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador carton: bloqueo bandejas', 'Salta si el piston del bloqueo de bandejas no esta en la posicion correcta (contraido) -- no se permite empujar el siguiente carton hacia el mandril hasta resolverlo.', true, '2026-09-10 20:31:40.262954+00', '2026-09-10 20:31:40.262954+00'),
	('91815df7-01dc-4330-9b8f-d6f7ad46c56a', 'bs08.mandril.proceso.01_descenso_envoltura', 'BS08', 'Mandril', 'proceso', '1. Descenso y envoltura', 'Una vez el carton esta bien posicionado (empujado por el empujador de bandejas hasta el final del mandril), el mandril baja con el sobre la pila que esta en el elevador, envolviendola por la parte superior y los laterales -- falta cerrarla con las solapas de abajo (ver Jaula).', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('2b68f4ea-d462-4e90-855a-66319a2acbb5', 'bs08.mandril.proceso.02_estructura_contrapeso', 'BS08', 'Mandril', 'proceso', '2. Estructura y contrapeso', 'El mandril son realmente dos motores paso a paso pequenos, uno a cada lado -- cada guia es independiente, aunque van sincronizadas. Es una prolongacion movil de las guias del almacen de carton (esas guias son fijas; esta parte, no). Tiene unos pistones que actuan de contrapeso, para que el mandril no caiga y esos motores pequenos puedan aguantar la posicion alta sin esfuerzo excesivo.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('d410e677-d4a7-46fb-88c1-642e06bdb7a6', 'bs08.mandril.proceso.03_posiciones_nivelado', 'BS08', 'Mandril', 'proceso', '3. Posiciones y nivelado', 'El mandril conoce su posicion en milimetros. La posicion abajo (donde envuelve la caja) es siempre la posicion 0. La posicion arriba es configurable -- habitualmente entre 320 y 350 mm -- y si que hay que reajustarla de vez en cuando segun el estado del carton: si el carton viene un poco doblado hacia arriba, interesa subir algo la posicion alta para que encare bien y pase con fluidez sin engancharse. Cada uno de los dos motores tiene su propio sensor de calibrado en la parte inferior; la posicion de ese sensor determina tambien la cota de arriba, que debe ser la misma en los dos lados. Esto importa porque el mandril tiene que quedar razonablemente nivelado -- se permite cierta tolerancia de error, pero lo ideal es que los dos lados queden lo mas igualados posible, ajustando la posicion del sensor inferior de cada lado por separado.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('d4f78429-4bc9-4466-8d20-328f9133924c', 'bs08.mandril.proceso.04_calibrado', 'BS08', 'Mandril', 'proceso', '4. Calibrado', 'Se realiza en la posicion inferior -- posicion 0 mas el offset de calibracion -- mediante un sensor inductivo que lee una pieza metalica del propio mandril (mismo tipo de mecanismo que el offset de calibracion del sacabandejas).', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('4d477527-e57b-4e87-b1ce-03a5d770497c', 'bs08.mandril.parametro.posicion_arriba', 'BS08', 'Mandril', 'parametro', 'Posicion arriba', 'Configurable, habitualmente entre 320 y 350 mm. Se reajusta de vez en cuando segun el estado del carton: si viene un poco doblado hacia arriba, interesa subir algo esta posicion para que encare bien y pase con fluidez sin engancharse. La posicion abajo (donde envuelve la caja) es siempre 0, no configurable.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('dfe5da79-ba58-4352-83a0-051da280e35b', 'bs08.mandril.parametro.offset_calibracion', 'BS08', 'Mandril', 'parametro', 'Offset de calibracion', 'Se aplica sobre la posicion 0 (abajo) para el calibrado, via sensor inductivo -- mismo tipo de mecanismo que el offset de calibracion del sacabandejas. La posicion del sensor determina tambien la cota de arriba, que debe coincidir en ambos lados para que el mandril quede nivelado.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('c8e6c12b-d261-4db2-99e2-c50a5eddeb45', 'bs08.mandril.parametro.velocidad_subida', 'BS08', 'Mandril', 'parametro', 'Velocidad subida', 'Valor: 9.000 (misma velocidad que el empujador de carton).', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('7c7fadf8-7869-45b4-9697-cbc029636c15', 'bs08.mandril.parametro.velocidad_bajada', 'BS08', 'Mandril', 'parametro', 'Velocidad bajada', 'Valor: 9.000.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('6c432bbd-f325-468c-bb79-f18ce2ae19a9', 'bs08.mandril.parametro.aceleracion', 'BS08', 'Mandril', 'parametro', 'Aceleracion', 'Valor: 9. Igual que el empujador de carton -- misma formula que el resto de motores paso a paso de la maquina (tiempo de aceleracion = 5 dividido entre el valor programado).', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('a54d715e-9802-4efb-a318-c0dac3c5c44c', 'bs08.mandril.parametro.disabilita_mandrino', 'BS08', 'Mandril', 'parametro', 'Disabilita mandrino', 'Dato constructivo, termino en italiano sin traducir en el software ("mandrino" = mandril). Capturado en No, es decir, el mandril SI esta habilitado/instalado en esta maquina.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('8d1d03b2-8988-4aac-86ba-39ca8406a5d4', 'bs08.mandril.actuador.motor_paso_a_paso', 'BS08', 'Mandril', 'actuador', 'Motor paso a paso (x2, uno a cada lado)', 'Pequenos, uno por cada guia del mandril -- guias independientes pero sincronizadas entre si.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('9bccdda2-2cd2-4f9b-9f70-7a42af83b06f', 'bs08.mandril.actuador.pistones_contrapeso', 'BS08', 'Mandril', 'actuador', 'Pistones de contrapeso', 'Evitan que el mandril caiga por su propio peso, para que los motores pequenos puedan aguantar la posicion alta sin esfuerzo excesivo.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('752274fe-bfc6-4ed5-87e0-eb4dcfcacfee', 'bs08.mandril.pieza.guias_moviles', 'BS08', 'Mandril', 'pieza', 'Guias moviles del mandril', 'Prolongacion movil de las guias del almacen de carton -- esas guias son fijas, esta parte no. Es lo que baja para envolver la pila.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('4cbe4e22-9cc9-4bec-b890-9540772e0f1a', 'bs08.mandril.pieza.pieza_metalica_calibrado', 'BS08', 'Mandril', 'pieza', 'Pieza metalica de calibrado', 'Leida por el sensor inductivo de cada lado durante el calibrado en la posicion inferior.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('9da335c4-3547-4ac8-8785-20b37aba7823', 'bs08.mandril.sensor.inductivo_calibrado', 'BS08', 'Mandril', 'sensor', 'Sensor inductivo de calibrado (x2, uno por lado)', 'En la parte inferior de cada motor. Lee la pieza metalica del propio mandril durante el calibrado (posicion 0 + offset). Su posicion fisica determina tambien la cota de arriba de ese lado -- debe coincidir con la del otro lado para que el mandril quede nivelado.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('8be6d050-fb59-4fd1-8915-f60585a82606', 'bs08.mandril.alarma.calibrar_mandril', 'BS08', 'Mandril', 'alarma', 'Calibrar mandril', 'Salta si, al bajar, los sensores de calibrado (posicion 0) no se activan, o se activan antes de tiempo. Especifica lado, ej. "no calibrado derecho: sensor bajo (activo)" si leyo antes de tiempo, o "...(no activo)" si no llego a leer a tiempo -- obliga a recalibrar antes de poder volver a arrancar. Los dos motores independientes del mandril explican por que la alarma distingue lado izquierdo/derecho.', true, '2026-09-10 20:35:14.945418+00', '2026-09-10 20:35:14.945418+00'),
	('1ae25b12-93dc-44c0-8c6d-4f3f0f01c144', 'bs08.jaula.proceso.01_secuencia_cierre', 'BS08', 'Jaula', 'proceso', '1. Secuencia de cierre de la caja', 'Con el mandril abajo y la caja envuelta por arriba y los laterales: el plato de empuje baja por la parte trasera de la pila envuelta y la empuja, cerrando la solapa trasera. Por el frontal, sube el fondo jaula, cerrando la solapa delantera. Mientras se empuja, unas guias de la jaula cierran las solapas laterales. Si todo esta bien ajustado, entra a la jaula ya una caja terminada -- solo falta la impresion, que llega en el tramo siguiente (ver Cabezales de impresion).', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('851c48d3-b4d8-42d4-a9a0-c24c066cf42d', 'bs08.jaula.proceso.02_empujador_pila_conjunto', 'BS08', 'Jaula', 'proceso', '2. Empujador de pila -- conjunto y componentes', 'El empujador de pila es el conjunto completo (motor + correa Breco + guia Nadella + rodamientos + plato de empuje). El plato de empuje es solo la parte de ese conjunto que entra en contacto fisico con la pila. Motor convencional con encoder (igual tipo que el del sacabandejas), de 0,37 kW, con reductor de calidad -- grande y pesado -- mas sensor de calibracion delantero. Se desplaza por una guia Nadella, con rodamientos lineales ("patines"/"patinetes"), mediante una correa Breco ancha y resistente. La correa Breco lleva alambre de acero por dentro; es una correa abierta (se corta a medida y se monta, no viene en un lazo cerrado de fabrica). Sensor de cero/calibrado hacia la jaula (delante); sensor de seguridad detras.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('e0bfeb97-29b1-4f70-81a3-9112bcb8e484', 'bs08.jaula.proceso.03_tres_velocidades', 'BS08', 'Jaula', 'proceso', '3. Tres velocidades del empujador de pila', 'Rapida (~80 Hz): a la que vuelve a la posicion de espera, despues de haber empujado la pila. Velocidad de empuje (50-60 Hz): al empezar a empujar la pila. Lenta (20-40 Hz): al terminar el empuje, metiendo la pila dentro de la jaula.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('f88adfaa-5b7e-47c2-a3e3-9167ec71a397', 'bs08.jaula.proceso.04_enlace_punto_espera', 'BS08', 'Jaula', 'proceso', '4. Enlace con "Punto espera empujador libre"', 'Parametro de la traccion warp (ver Elevador): es la condicion de enclavamiento que obliga a la pila a esperar en la traccion warp hasta que este empujador de pila haya vuelto a su posicion de espera, antes de poder seguir avanzando desde el escuadrador.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('e1571c73-e465-4998-8a3d-d3818f65e505', 'bs08.jaula.parametro.rango_ajuste', 'BS08', 'Jaula', 'parametro', 'Rango de ajuste (empujador de pila)', 'De 0 a ~1.600 mm.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('7b6ae6f1-1bdd-424e-997c-deab82b55c31', 'bs08.jaula.parametro.posicion_espera', 'BS08', 'Jaula', 'parametro', 'Posicion de espera (empujador de pila, detras)', 'Suele estar sobre 1.400-1.500 mm para formatos habituales de 1.200 mm de largo.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('1b13db64-229d-46ed-907d-fb348726b0c1', 'bs08.jaula.parametro.velocidad_rapida', 'BS08', 'Jaula', 'parametro', 'Velocidad rapida (retorno)', '~80 Hz. Velocidad a la que el empujador de pila vuelve a la posicion de espera despues de empujar.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('3b1feb34-4dbd-4f60-84ae-45e598aa9b0e', 'bs08.jaula.parametro.velocidad_empuje', 'BS08', 'Jaula', 'parametro', 'Velocidad de empuje', '50-60 Hz. Al empezar a empujar la pila.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('feffe4c5-2acb-4e6f-bf16-417161e629e5', 'bs08.jaula.parametro.velocidad_lenta', 'BS08', 'Jaula', 'parametro', 'Velocidad lenta (fin de empuje)', '20-40 Hz. Al terminar el empuje, metiendo la pila dentro de la jaula.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('d366c2cb-f323-4e87-98cc-3cc586b66d6d', 'bs08.jaula.parametro.aceleracion', 'BS08', 'Jaula', 'parametro', 'Aceleracion (empujador de pila)', 'Misma formula que el resto de motores de la maquina (tiempo de aceleracion = 5 dividido entre el valor programado). Aqui se suele tener entre 2 y 6, segun como se comporte la pila al ser empujada.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('52d3d7c1-8826-4c9d-8988-a12c9d85cc42', 'bs08.jaula.parametro.posterior_jaula_configuracion', 'BS08', 'Jaula', 'parametro', 'Posterior jaula -- Configuracion usada', 'Dato constructivo fijo: "Configuracion 1". No se toca nunca, igual que el resto de la pantalla "Maquina -> Datos constructivos".', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('6c308ae5-6383-4318-b870-37cc1d146558', 'bs08.jaula.pieza.plato_empuje', 'BS08', 'Jaula', 'pieza', 'Plato de empuje', 'Parte del conjunto "empujador de pila" que entra en contacto fisico con la pila. Baja por la parte trasera y la empuja, cerrando la solapa trasera.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('3d2ef07b-eb78-4958-8602-290ea90e767f', 'bs08.jaula.pieza.fondo_jaula', 'BS08', 'Jaula', 'pieza', 'Fondo jaula', 'Sube por el frontal durante el cierre, cerrando la solapa delantera.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('d0840652-8312-481a-bb99-b345d8ee415f', 'bs08.jaula.pieza.guias_jaula', 'BS08', 'Jaula', 'pieza', 'Guias de la jaula', 'Cierran las solapas laterales mientras el plato de empuje empuja la caja.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('ee6688cb-970e-499e-8411-ec33696a409f', 'bs08.jaula.pieza.correa_breco', 'BS08', 'Jaula', 'pieza', 'Correa Breco', 'Ancha y resistente, con alambre de acero por dentro. Es una correa abierta -- se corta a medida y se monta, no viene en un lazo cerrado de fabrica. Transmite el movimiento del motor al plato de empuje.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('74cd968f-210e-4dc4-b9e3-c410078ece59', 'bs08.jaula.pieza.guia_nadella', 'BS08', 'Jaula', 'pieza', 'Guia Nadella', 'Guia por la que se desplaza el conjunto del empujador de pila, con rodamientos lineales ("patines"/"patinetes").', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('3dae7e86-6859-4734-bb79-69b2d131b580', 'bs08.jaula.actuador.motor_empujador_pila', 'BS08', 'Jaula', 'actuador', 'Motor del empujador de pila', 'Motor convencional con encoder -- igual tipo que el del sacabandejas. 0,37 kW, con reductor de calidad -- grande y pesado. Mueve el conjunto completo (correa Breco + guia Nadella + rodamientos + plato de empuje) a traves de la correa Breco.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('6ea9114a-8766-4d83-b1da-e69f37095fd0', 'bs08.jaula.sensor.cero_calibrado_delantero', 'BS08', 'Jaula', 'sensor', 'Sensor de cero/calibrado (delantero, hacia la jaula)', 'Sensor de calibracion delantero del motor del empujador de pila, orientado hacia la jaula.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('2bc42b5e-8e5e-451c-82ad-d95efdf2bbb6', 'bs08.jaula.sensor.seguridad_trasero', 'BS08', 'Jaula', 'sensor', 'Sensor de seguridad (trasero)', 'Si se activa, pide calibracion y da alarma -- ver alarma asociada.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('c6cd5dfd-59b2-4c1a-af07-25f019fd048e', 'bs08.jaula.alarma.sensor_seguridad_activado', 'BS08', 'Jaula', 'alarma', 'Empujador de pila: sensor de seguridad activado', 'Salta si se activa el sensor de seguridad trasero del empujador de pila -- pide recalibrar antes de continuar.', true, '2026-09-10 20:45:09.798121+00', '2026-09-10 20:45:09.798121+00'),
	('225b3eea-6760-40a2-afdd-a2b0d278c572', 'bs08.divisor.parametro.distancia_ft_cinta_divisor', 'BS08', 'Divisor', 'parametro', 'Distancia FT cinta/divisor', 'Distancia entre la fotocélula de salida de los apiladores y el punto donde debe pararse la pila para poder dividirla. Valor capturado el 09/09/2026: 1212 mm. Se reajusta por formato. Nota de descarte: regula dónde para la pila en el sentido de avance (posición horizontal), no la altura a la que se realiza el corte. No influye en que la división salga alta o baja — para eso ver "Offset posición recogida", "Intereje FT/mordaza" o "Posición espera".', true, '2026-09-10 19:52:55.604918+00', '2026-09-11 14:27:22.828848+00'),
	('5371c767-c630-49bc-9535-8a8369289e8c', 'bs08.divisor.mantenimiento.ajuste_cero_03_fotocelula', 'BS08', 'Divisor', 'mantenimiento', 'Ajuste desde cero — 3. Alineación de la fotocélula', 'Con el calibrado de ambos lados ya correcto, se comprueba que la fotocélula emisor/receptor está bien encarada y que el receptor recibe señal. Si no lo está, se encara físicamente.', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('c549565c-ca25-42dd-9af1-ba0a30c7c6e5', 'bs08.divisor.mantenimiento.ajuste_cero_04_intereje', 'BS08', 'Divisor', 'mantenimiento', 'Ajuste desde cero — 4. Verificación del Intereje FT/mordaza', 'Se deja entrar una pila, se deja que la máquina la mida (sin dividir), y se compara con el metro real — ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza". Se corrige el intereje (aumentando o reduciendo según corresponda) hasta que la altura medida por la máquina coincida con la medida real.', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('a4725bfa-7d20-441c-8e7a-27cfa1a7391a', 'bs08.divisor.alarma.error_lectura_pila', 'BS08', 'Divisor', 'alarma', 'Divisor error lectura pila', 'La altura medida por la fotocélula (mostrada en "Lectura altura pila", pantalla Formato → Divisor) difiere de la configurada en "Altura pila" en más de la "Tolerancia altura pila". Es la única comprobación de la máquina de que la pila trae el número de piezas esperado, porque el divisor no cuenta piezas: reparte la altura medida entre el "Número de divisiones por pila". Solución: comprobar el número real de piezas presentes en la pila y verificar las cuotas configuradas en "Altura pila" y "Tolerancia altura pila". Si la pila es correcta y la lectura se desvía siempre en la misma dirección, revisar el "Intereje FT/mordaza".', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('341ecdb4-ea54-47f9-ae53-be8678d6fe67', 'bs08.divisor.alarma.no_calibrado_off_derecha', 'BS08', 'Divisor', 'alarma', 'Divisor no calibrado OFF derecha', 'El motor derecho del divisor se ha bloqueado en su movimiento: debería haber liberado (dejado de excitar) el sensor de calibrado (sensor bajo) derecho, y ese sensor sigue activo. Solución: comprobar el sensor de calibrado (sensor bajo) derecho del divisor y el eventual atasco del motor; realizar la calibración del divisor.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('7dc4e4db-2752-43af-8ba5-6b4f98b3176d', 'bs08.divisor.pieza.tornillos_anclaje', 'BS08', 'Divisor', 'pieza', 'Tornillos de anclaje del divisor', 'Fijan la estructura completa del divisor a la máquina. Si se parten, la estructura queda con juego excesivo. Ver prueba de comprobación: "bs08.divisor.mantenimiento.prueba_juego_anclaje".', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('b22abbd2-24a1-4fa8-9e8b-6d9455818232', 'bs08.divisor.pieza.rodamientos_guias_verticales', 'BS08', 'Divisor', 'pieza', 'Rodamientos de las guías verticales', 'Se desplazan por las guías verticales del divisor, dando integridad mecánica y solidez al desplazamiento de la mordaza. Si están desgastados o desajustados, la pala vulcanizada bambolea al moverla con las manos. Ver prueba de comprobación: "bs08.divisor.mantenimiento.prueba_balanceo_pala".', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('3f6be9e6-04f2-45b6-bb78-8e7ad7f0ab71', 'bs08.divisor.pieza.mordaza_vulcanizada', 'BS08', 'Divisor', 'pieza', 'Mordaza vulcanizada', 'Una a cada lado, sujeta a un pistón grande guiado. Es la parte que mide (fotocélula) y ejecuta físicamente el corte/división de la pila. Desgaste: el vulcanizado es de un tipo muy duro, tarda en deteriorarse, pero se desgasta por la parte de abajo con cada división. Si está muy desgastada, el divisor realiza la división MÁS ARRIBA de lo que toca, porque la parte que falta es precisamente la de abajo. Un mal ajuste que fuerce la pila contra las cadenas tras cada división acelera este desgaste (la máquina sigue funcionando con normalidad mientras tanto, solo se desgasta algo más rápido). Sustitución: sencilla, basta con quitar los tornillos que sujetan la pala vulcanizada al divisor y montar una nueva.', true, '2026-09-10 19:52:55.604918+00', '2026-09-11 21:24:06.080774+00'),
	('92e98e38-5015-465c-b31b-d22a336e2d4d', 'bs08.divisor.mantenimiento.prueba_juego_anclaje', 'BS08', 'Divisor', 'mantenimiento', 'Prueba: juego en el anclaje del divisor', 'Se coge la estructura del divisor por arriba y se tira hacia atrás. Debe tener muy poco juego. Si el juego es excesivo, indica que los tornillos de anclaje del divisor a la máquina están partidos.', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('8b52983f-5cd4-4c69-b64d-0a8b4106c394', 'bs08.divisor.mantenimiento.prueba_balanceo_pala', 'BS08', 'Divisor', 'mantenimiento', 'Prueba: balanceo de la pala vulcanizada', 'Se coge la propia pala vulcanizada, con una mano en cada extremo, y se intenta balancear. Si bambolea, indica que los rodamientos de las guías verticales están desgastados o desajustados.', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('375212e2-e4c0-4968-90b0-6cbb983c4a46', 'bs08.divisor.mantenimiento.criterio_mecanico_vs_parametro', 'BS08', 'Divisor', 'mantenimiento', 'Criterio: fallo mecánico vs. fallo de parámetro', 'Los dos fallos mecánicos más habituales (tornillos de anclaje partidos, rodamientos de guías verticales desgastados) provocan un fallo prácticamente constante y con errores aleatorios: puede escaparse una pieza, dividir muy arriba o muy abajo, sin ninguna dirección consistente. Un fallo de parámetro (Offset posición recogida o Intereje FT/mordaza mal ajustados) es, en cambio, habitualmente sutil y fino, y consistente en su dirección (siempre sobra, o siempre falta pieza) — salvo casos extremos de manipulación directa del parámetro. La diferencia más práctica: el fallo mecánico es mucho más grave y visible, afecta de forma continuada a muchas más divisiones; el de parámetro es más discreto. Por eso conviene revisar la integridad mecánica (pruebas de juego y balanceo) ANTES de ajustar ningún parámetro.', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('20e72044-000c-4091-a025-8b45aed25951', 'bs08.divisor.mantenimiento.ajuste_cero_01_mecanica', 'BS08', 'Divisor', 'mantenimiento', 'Ajuste desde cero — 1. Verificar integridad mecánica', 'Antes de tocar ningún parámetro: prueba de tirar de la estructura hacia atrás (tornillos de anclaje) y prueba de balanceo de la pala vulcanizada (rodamientos de guías verticales). Solo se continúa con el resto del ajuste si ambas pruebas salen bien.', true, '2026-09-11 21:24:06.080774+00', '2026-09-11 21:24:06.080774+00'),
	('967b57f5-9839-40ab-9a54-1ca9f769acc4', 'bs08.divisor.mantenimiento.ajuste_cero_02_sensores_calibrado', 'BS08', 'Divisor', 'mantenimiento', 'Ajuste desde cero — 2. Sensores de calibrado (ambos lados)', 'Con la mecánica verificada, se colocan los sensores de calibrado (sensores bajos) a ojo, más o menos a la misma altura en ambos lados. Se ejecuta un calibrado: los dos lados bajan a buscar su sensor, siguen bajando los mm del "Offset calibr." y toman esa cota como 0. En manual, se cierran las mordazas y se observa visualmente la altura a la que quedan sobre las cadenas de tracción de la empaquetadora — debe estar entre 1 y 2 mm por encima de las cadenas. Esta es la altura a la que el divisor suelta la pila entre división y división; si suelta demasiado alto hace ruido, golpea, y puede llegar a romper piezas. Si los dos lados no coinciden dentro de ese margen, se reajusta la posición física de los sensores y se repite el calibrado, hasta que ambos lados queden exactamente igual.', true, '2026-09-11 21:24:06.080774+00', '2026-09-12 22:50:40.44679+00'),
	('59f5ea79-1fb7-4c1a-9a47-4d506ce84d2a', 'bs08.sacabandejas.alarma.anomalia_inverter', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: Anomalía inverter', 'El inverter presenta una anomalía. Solución: comprobar que el inversor y el motor conectado a él funcionen correctamente.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('59a63749-1e2c-43ba-add1-1c9641294710', 'bs08.sacabandejas.alarma.anomalia_comunicacion_inverter', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: Anomalía comunicación inverter', 'Error de comunicaciones con inversor. Solución: comprobar el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('e5b3e3ad-7758-4df1-8540-44eef827c7a1', 'bs08.sacabandejas.alarma.tiempo_limite_comunicacion_inverter', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: Tiempo límite comunicación inverter', 'Timeout de comunicaciones con inverter. Solución: comprobar el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('705d4176-8375-4f7e-a11a-891244f9ae83', 'bs08.quad01.alarma.quad_fault', 'BS08', 'Quad 01', 'alarma', 'Quad 01: Quad fault', 'Uno de los accionamientos presenta una anomalía. Solución: controlar el tipo de anomalía en la diapositiva MONITOR QUAD; controlar el funcionamiento correcto del accionamiento en anomalía y de los motores conectados a este.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('d3576ab6-4015-4336-bcbc-959520a9ae87', 'bs08.quad02.alarma.quad_fault', 'BS08', 'Quad 02', 'alarma', 'Quad 02: Quad fault', 'Uno de los accionamientos presenta una anomalía. Solución: controlar el tipo de anomalía en la diapositiva MONITOR QUAD; controlar el funcionamiento correcto del accionamiento en anomalía y de los motores conectados a este.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('1d52e263-b825-4e15-b586-bf9110d7354d', 'bs08.contexto.sensores_mc_inductivos', 'BS08', NULL, 'sensor', 'Sensores MC (inductivos): tipos y tecnología', '"MC" es como se llama en esta planta a los sensores inductivos. Se usan sobre todo dos tipos, según qué detectan: sensor de pistón (detecta el imán que lleva el propio pistón por dentro; se activa —cierra su contacto— cuando el imán está cerca) y sensor de calibrado (detecta la proximidad de un metal, no un imán; se activa —cierra su contacto— cuando ese metal se acerca). Todos los sensores usados en la máquina son PNP, normalmente abiertos: el contacto está abierto en reposo y se cierra al activarse el sensor.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 11:23:57.257032+00'),
	('6096b697-fef9-40cb-8b6b-85b8e65d12d0', 'bs08.divisor.alarma.anomalia_mc_cilindro_derecho', 'BS08', 'Divisor', 'alarma', 'Divisor anomalía MC cilindro derecho', 'El sensor MC del cilindro (pistón) derecho no está excitado con el cilindro en reposo, cuando debería marcar. Solución: comprobar el funcionamiento del cilindro y del sensor; ajustar la posición del sensor si es necesario.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 11:23:57.257032+00'),
	('d6f213f1-3d87-49d3-b47e-feff822990d0', 'bs08.divisor.alarma.anomalia_mc_cilindro_izquierdo', 'BS08', 'Divisor', 'alarma', 'Divisor anomalía MC cilindro izquierdo', 'El sensor MC del cilindro (pistón) izquierdo no está excitado con el cilindro en reposo, cuando debería marcar. Solución: comprobar el funcionamiento del cilindro y del sensor; ajustar la posición del sensor si es necesario.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 11:23:57.257032+00'),
	('0d3e4986-a8be-4ccb-9e49-613488351de7', 'bs08.divisor.diagnostico.divide_mal', 'BS08', 'Divisor', 'diagnostico', 'Síntoma vago: "divide mal" / "corta mal" / "se le escapa una pieza" / "sobra o falta pieza en la caja"', 'Paso 0 — descartar mecánica antes que parámetro: si el fallo es errático (a veces sobra, a veces falta, sin patrón claro, y/o va acompañado de piezas rotas o ruido), sospechar fallo mecánico, no paramétrico — ver "bs08.divisor.mantenimiento.criterio_mecanico_vs_parametro" y las pruebas de juego/balanceo. Solo seguir con lo siguiente si el fallo tiene una dirección CONSISTENTE (siempre sobra, o siempre falta pieza) — puede aparecer en cualquier división del ciclo, de forma no siempre predecible (el margen de corte es muy ajustado, y una pieza puede escaparse o quedarse pillada en cualquier corte); lo relevante no es EN QUÉ división pasa, sino en qué DIRECCIÓN falla siempre. Pregunta clave: cuando falla, ¿la caja sale con una pieza DE MÁS, o con una pieza DE MENOS? → Si SOBRA pieza (el divisor está dividiendo demasiado arriba): subir "Offset posición recogida" — no tiene tope definido, se puede subir sin problema hasta que se corrija. Comprobar también el desgaste de la parte baja de la mordaza vulcanizada (ver "bs08.divisor.pieza.mordaza_vulcanizada"): una mordaza desgastada divide más arriba y da exactamente este síntoma; si el desgaste es grande, sustituirla en vez de seguir compensando con offset. Si hace falta subir el offset por encima de 8 mm para corregirlo, se puede seguir operando así sin problema, pero es señal de que "Intereje FT/mordaza" u "Offset calibr." pueden estar desajustados de fondo: avisar al mecánico para que lo revise cuando pueda, sin urgencia (ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza"). → Si FALTA pieza (el divisor está dividiendo demasiado abajo): "Offset posición recogida" NO puede corregir esto bajo ningún concepto, porque solo admite corregir hacia abajo, nunca hacia arriba — hay que revisar y corregir directamente "Intereje FT/mordaza". Antes, comprobar que el operario no ha dejado "Offset posición recogida" alto de un formato anterior. Recordar que la cota de corte = altura medida ÷ número de divisiones: el error de intereje llega al corte dividido por ese número.', true, '2026-09-12 11:23:57.901074+00', '2026-09-12 23:02:51.506132+00'),
	('8bf66552-1f30-44f2-bd34-c962d702d371', 'bs08.divisor.alarma.no_calibrado_off_izquierda', 'BS08', 'Divisor', 'alarma', 'Divisor no calibrado OFF izquierda', 'El motor izquierdo del divisor se ha bloqueado en su movimiento: debería haber liberado (dejado de excitar) el sensor de calibrado (sensor bajo) izquierdo, y ese sensor sigue activo. Solución: comprobar el sensor de calibrado (sensor bajo) izquierdo del divisor y el eventual atasco del motor; realizar la calibración del divisor.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('f4542bff-cf1a-4820-83e2-560380e43591', 'bs08.divisor.alarma.no_calibrado_on_derecha', 'BS08', 'Divisor', 'alarma', 'Divisor no calibrado ON derecha', 'El motor derecho del divisor se ha bloqueado en su movimiento: la posición actual debería excitar el sensor de calibrado (sensor bajo) derecho, y ese sensor todavía no está activo. Solución: comprobar el sensor de calibrado (sensor bajo) derecho del divisor y el eventual atasco del motor; realizar la calibración del divisor.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('c6d34e6f-687d-4abd-90f4-37100a480047', 'bs08.divisor.alarma.no_calibrado_on_izquierda', 'BS08', 'Divisor', 'alarma', 'Divisor no calibrado ON izquierda', 'El motor izquierdo del divisor se ha bloqueado en su movimiento: la posición actual debería excitar el sensor de calibrado (sensor bajo) izquierdo, y ese sensor todavía no está activo. Solución: comprobar el sensor de calibrado (sensor bajo) izquierdo del divisor y el eventual atasco del motor; realizar la calibración del divisor.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('16018274-6908-4cb3-8bdd-4fe445831d83', 'bs08.quad03.alarma.quad_fault', 'BS08', 'Quad 03', 'alarma', 'Quad 03: Quad fault', 'Uno de los accionamientos presenta una anomalía. Solución: controlar el tipo de anomalía en la diapositiva MONITOR QUAD; controlar el funcionamiento correcto del accionamiento en anomalía y de los motores conectados a este.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('b33d8aa6-d449-4364-a6e0-29626a9cb248', 'bs08.regulaciones.alarma.mc_maximo_abierto', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Mc máximo abierto', 'Durante la ejecución del cambio de formato se ha alcanzado el final de carrera en la cuota máxima de apertura. Solución, controlar: que la cuota del formato no sea mayor que el formato máximo soportado por la máquina; que el sensor de final de carrera esté situado de la manera correcta.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('830a5ec4-41d4-4d59-b6cb-3458968a9efc', 'bs08.regulaciones.alarma.mc_maximo_cerrado', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Mc máximo cerrado', 'Durante la ejecución del cambio de formato se ha alcanzado el final de carrera en la cuota máxima de cierre. Solución, controlar: que la cuota de formato no sea menor que el formato mínimo soportado por la máquina; que el sensor de final de carrera esté situado de la manera correcta.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('4328fc7e-d892-481b-bd25-a6fe36243dd5', 'bs08.regulaciones.alarma.maquina_no_vacia', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Máquina no vacía', 'La máquina no está completamente vacía. Solución: comprobar que no haya pilas presentes en tracción pilas wrap, divisor, empujador y jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('69b87d3f-5294-418b-9505-2ff3adfca014', 'bs08.regulaciones.alarma.falta_cotas_preset', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Falta cotas preset', 'En la diapositiva de las regulaciones se deben configurar las cuotas detectadas durante la fase de instalación/regulación de la máquina. Solución: introducir la cuota en el caso de que se conozca, o llevar la máquina a la condición necesaria para detectar la cuota, realizar la detección e introducir la cuota detectada.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('b70f4df6-436e-4ba7-82c5-d7bd1c71080d', 'bs08.regulaciones.alarma.faltan_calibraciones', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Faltan calibraciones', 'No todos los elementos interesados durante la fase de regulación automática se han calibrado. Solución: comprobar cada uno de los elementos y, si el led de calibración parpadea, realizar la calibración; esta operación solo es necesaria si el elemento seleccionado está realmente instalado en la máquina.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('644679e3-e412-4018-826e-99c9317b28c0', 'bs08.regulaciones.alarma.plato_empujador_no_alto', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Plato empujador no alto', 'Antes de empezar el cambio de formato automático, la máquina lleva algunos elementos que podrían crear interferencias mecánicas fuera del radio de acción y activar esta alarma. Indica que el plato empujador no se detecta en la posición alta deseada. Solución, comprobar: si el elemento se encuentra en la posición deseada; que el sensor de posición esté activo; que las cuotas correspondan a la efectiva posición del elemento.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('d0d6d2e7-e3f0-4919-aa05-6431be0db9bc', 'bs08.divisor.actuador.piston_mordaza', 'BS08', 'Divisor', 'actuador', 'Pistón de la mordaza', 'Pistón grande, guiado y fuerte, al que va sujeta la mordaza vulcanizada de cada lado. En las alarmas de la máquina se le llama "cilindro derecho/izquierdo". Lleva un sensor magnético MC que detecta el imán del propio émbolo — ver "bs08.divisor.sensor.mc_piston_mordaza".', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('49f8af08-ca1d-45ff-bf3f-f63323ce8b1b', 'bs08.divisor.parametro.numero_divisiones_por_pila', 'BS08', 'Divisor', 'parametro', 'Número de divisiones por pila', 'Campo de la pantalla Formato → Divisor. Número de cortes que el divisor hace a cada pila completa (= número de cajas que salen de una pila). Es el dato con el que se calcula la cota de corte en modo normal: cota de corte = Lectura altura pila ÷ Número de divisiones por pila (p. ej. 225 mm ÷ 5 = 45 mm). Como cada caja tiene la misma altura y la pila restante vuelve a apoyarse en las cadenas tras cada avance, la cota de corte es la MISMA en todas las divisiones del ciclo. La máquina no conoce el espesor de pieza ni cuenta piezas: reparte altura. Por eso, si la pila trae una pieza de más o de menos y pasa la tolerancia, el reparto sale mal en todas las cajas. Se reajusta por formato.', true, '2026-09-12 22:50:40.44679+00', '2026-09-12 22:50:40.44679+00'),
	('056b66ed-f42f-4f78-a8c9-7474e608f613', 'bs08.divisor.parametro.lectura_altura_pila', 'BS08', 'Divisor', 'parametro', 'Lectura altura pila', 'Campo informativo (no configurable) de la pantalla Formato → Divisor. Muestra la altura que la fotocélula ha medido en la última pila durante la bajada de las mordazas. Se compara con "Altura pila" usando "Tolerancia altura pila". Es también el dato que se usa en la verificación manual del intereje: si el metro da un valor distinto a esta lectura, el "Intereje FT/mordaza" programado no coincide con el real — ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza".', true, '2026-09-12 22:50:40.44679+00', '2026-09-12 22:50:40.44679+00'),
	('c6427b7d-ca16-438a-83de-62d53aad6802', 'bs08.divisor.alarma.fuera_de_posicion', 'BS08', 'Divisor', 'alarma', 'Divisor fuera de posición', 'Uno de los motores del divisor se ha bloqueado en su movimiento. Solución: comprobar los sensores del divisor y quitar los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del divisor. Nota: el texto es literal del manual/documentación técnica oficial del fabricante, que usa exactamente la misma descripción para "Divisor no calibrado". No es un error de transcripción; el fabricante no documenta ningún matiz que las distinga.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('b737834a-14d8-4b58-8f49-e1eb1b846654', 'bs08.divisor.alarma.no_calibrado', 'BS08', 'Divisor', 'alarma', 'Divisor no calibrado', 'Uno de los motores del divisor se ha bloqueado en su movimiento. Solución: comprobar los sensores del divisor y quitar los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del divisor. Nota: el texto es literal del manual/documentación técnica oficial del fabricante, que usa exactamente la misma descripción para "Divisor fuera de posición". No es un error de transcripción; el fabricante no documenta ningún matiz que las distinga.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('08fa25de-415c-4106-b0a5-7924956b0777', 'bs08.divisor.alarma.to_lectura_altura_pila', 'BS08', 'Divisor', 'alarma', 'TO lectura altura pila', 'Durante la bajada para medir la altura de la pila, el divisor ha llegado al punto más bajo de su recorrido sin que la fotocélula de medición de altura haya llegado a realizar la lectura. Pasa tanto si la pila es demasiado baja (el haz nunca llega a cortarse) como si es demasiado alta (el haz ya estaba cortado antes de empezar a bajar) — la alarma no distingue por sí sola entre los dos casos. Solución: comprobar el funcionamiento de la fotocélula, el movimiento de los motores del divisor, y la cuota configurada en "Posición espera" (pantalla Divisor). Si la pila queda estructuralmente fuera del rango medible (por debajo del "Intereje FT/mordaza", p. ej. formato 120x120 de 4 piezas), la solución no es ajustar nada sino trabajar con "División de la pila sin fotocélula" y una "Cuota de división de la pila" fija.', true, '2026-09-11 14:27:22.828848+00', '2026-09-12 22:50:40.44679+00'),
	('4e548b12-1b08-4df4-97b1-dfbd525688e1', 'bs08.divisor.mantenimiento.ajuste_cero_05_offset_final', 'BS08', 'Divisor', 'mantenimiento', 'Ajuste desde cero — 5. Corrección final con Offset posición recogida', 'Una vez la máquina mide correctamente la pila (paso 4), se observa a qué altura está haciendo las divisiones y, si hace falta, se corrige HACIA ABAJO con el Offset posición recogida (nunca hacia arriba, el parámetro no lo permite). En un ajuste completamente nuevo casi siempre hace falta esta corrección: durante el calibrado (paso 2) se dejó 1-2 mm de margen entre la mordaza cerrada y las cadenas, para evitar el golpe al soltar la pila. Como todas las cotas se miden desde ese cero, la cota de corte queda esos 1-2 mm por encima de lo que tocaría aunque el intereje ya esté midiendo bien — por eso, en un ajuste desde cero, suele hacer falta bajar la división 1-2 mm con este offset, incluso sin que nadie lo haya tocado antes.', true, '2026-09-11 21:24:06.080774+00', '2026-09-12 22:50:40.44679+00'),
	('2d2172ac-2917-4251-adde-31ce25f6b0e2', 'bs08.empujador.alarma.anomalia_mc_plato_bajo', 'BS08', 'Empujador', 'alarma', 'Empujador: Anomalía mc plato bajo', 'El sensor de plato de empuje bajo no está activo con el cilindro en reposo. Solución: comprobar el funcionamiento del cilindro y del sensor de plato bajo.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('3d4b238b-2973-4a55-a373-21e7a5b21006', 'bs08.empujador.alarma.anomalia_mc_plato_alto', 'BS08', 'Empujador', 'alarma', 'Empujador: Anomalía mc plato alto', 'El sensor de plato de empuje alto no está activo con el cilindro activo. Solución: comprobar el funcionamiento del cilindro y del sensor de plato alto.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('957ae78f-ea94-4d92-9c3a-8d459eff8882', 'bs08.empujador.alarma.elevador_fuera_de_posicion', 'BS08', 'Empujador', 'alarma', 'Empujador: Elevador fuera de posición', 'El motor del elevador se ha bloqueado en su movimiento. Solución: comprobar el sensor del elevador y quitar los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del elevador. (Sin confirmar si este elevador es el mismo que la submáquina "Elevador" documentada aparte — ver aviso 3.)', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('689fea0b-792e-41b9-8634-7089e53fe878', 'bs08.empujador.alarma.elevador_no_calibrado', 'BS08', 'Empujador', 'alarma', 'Empujador: Elevador no calibrado', 'El motor del elevador se ha bloqueado en su movimiento. Solución: comprobar el sensor del elevador y quitar los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del elevador. (Mismo texto que "Elevador fuera de posición"; sin confirmar si hay un matiz real que las distinga — ver aviso 3.)', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('67c7d4e3-4e47-40fb-a13b-e0a71df35a7e', 'bs08.empujador.alarma.falta_plantilla', 'BS08', 'Empujador', 'alarma', 'Empujador: Falta plantilla', 'Al inicio del empuje de una pila hacia la jaula, al menos una de las dos fotocélulas de presencia cartón no está activa. Solución, controle: presencia del cartón delante de la jaula; funcionamiento de las dos fotocélulas de presencia cartón.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('189f975b-9798-4abb-a8e4-743c64a28da6', 'bs08.empujador.alarma.to_empuje', 'BS08', 'Empujador', 'alarma', 'Empujador: T.O. empuje', 'El empujador no ha alcanzado la posición de fin del empuje en el tiempo máximo previsto durante el empuje de una pila hacia la jaula. Solución: comprobar el posible atascamiento del empujador, el funcionamiento del codificador y del motor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('2d307e8f-acea-43ef-a927-b8bea7912e5e', 'bs08.empujador.alarma.to_retorno', 'BS08', 'Empujador', 'alarma', 'Empujador: T.O. retorno', 'El empujador no ha alcanzado la posición atrás programada o el sensor de final de carrera atrás en el tiempo máximo previsto durante el retorno en espera. Solución: comprobar el posible atascamiento del empujador, el funcionamiento del codificador, el funcionamiento del sensor empujador atrás y del motor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('8c01c7d8-d3ec-4720-81b9-fd1cad6ec286', 'bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza', 'BS08', 'Divisor', 'mantenimiento', 'Verificación del Intereje FT/mordaza (medición manual)', 'Procedimiento para comprobar si el Intereje FT/mordaza programado coincide con la posición física real de la fotocélula. Con la máquina en manual, se deja entrar una pila y se deja que el divisor la mida sin dividir. En la pantalla Formato → Divisor se lee "Lectura altura pila" — lo que el divisor ha calculado que mide la pila con el intereje programado actual (valor informativo, no configurable). A la vez, se mide la misma pila físicamente con un metro. Si la medida con metro da un valor MAYOR que la "Lectura altura pila" de la máquina, el intereje real es mayor que el programado (la fotocélula física está más arriba de lo que dice el parámetro) — hay que aumentar el valor programado en la diferencia medida (p. ej., si el metro da 20 mm más, subir el intereje 20 mm). Si diera un valor MENOR, sería el caso contrario. Nota sobre el efecto en el corte: corregir el intereje mueve la cota de corte solo en la diferencia dividida por el "Número de divisiones por pila" (20 mm de intereje con 5 divisiones = 4 mm de corte), porque la cota de corte es altura medida ÷ número de divisiones.', true, '2026-09-11 21:23:56.216218+00', '2026-09-12 22:50:40.44679+00'),
	('d531e149-ba27-45f7-9462-ed410dc2e896', 'bs08.divisor.parametro.altura_pila', 'BS08', 'Divisor', 'parametro', 'Altura pila', 'Campo de la pantalla Formato → Divisor. Es la altura que el operario le dice a la máquina que debería medir la pila completa (p. ej. 225 mm). Trabaja junto con otros dos datos de la misma pantalla: "Lectura altura pila" (informativo, lo que la fotocélula ha medido realmente) y "Tolerancia altura pila" (margen admitido). Si |Lectura − Altura pila| supera la tolerancia, salta la alarma "Error lectura pila" y no se divide; si está dentro, la pila se da por buena y se efectúan las divisiones. Se reajusta por formato.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('200bda5f-b546-4603-a0f7-07524b499042', 'bs08.divisor.parametro.offset_calibracion', 'BS08', 'Divisor', 'parametro', 'Offset calibr.', 'Parámetro de software que define el cero del divisor junto con la posición física del sensor de calibrado (sensor bajo). Al calibrar, cada lado baja hasta que su sensor de calibrado empieza a leer y sigue bajando exactamente esta distancia; el punto donde se detiene es el cero de la máquina (cota 0). Es decir: cero = punto donde el sensor empieza a leer + Offset calibr. Valor capturado: 8 mm. Habitualmente entre 4 y 8 mm; nunca puede ser 0 (a diferencia de otros offsets de la máquina). Con offset 8, el sensor empieza a leer 8 mm por encima del cero, o sea a 9-10 mm sobre las cadenas. El ajuste fino se hace moviendo físicamente el sensor arriba o abajo en el chasis del divisor hasta que, tras calibrar, la mordaza cerrada quede 1-2 mm por encima de las cadenas de tracción, igual en ambos lados. Ese margen de 1-2 mm es deliberado: al soltar la pila entre división y división evita que las mordazas la fuercen contra las cadenas; si el cero quedara más alto, soltaría la pila desde demasiado alto, con golpe y riesgo de romper piezas. Relación con "Offset posición recogida": como el cero queda 1-2 mm por encima de las cadenas reales, toda cota de corte calculada desde ese cero queda ese mismo margen por encima de lo que tocaría — por eso, en un ajuste desde cero, casi siempre hay que aplicar 1-2 mm de Offset posición recogida para compensarlo.', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('ea617ad0-6eb5-42e7-bdf9-29589eddfc07', 'bs08.divisor.parametro.posicion_espera', 'BS08', 'Divisor', 'parametro', 'Posición espera', 'Altura (cota de la mordaza) a la que esperan las mordazas una nueva pila que llega de los apiladores. No hace falta que la mordaza quede por encima de la pila: lo que tiene que quedar por encima de la pila es la fotocélula, que va "Intereje FT/mordaza" por encima de la mordaza. Condición: Posición espera + Intereje FT/mordaza > altura de la pila. Valor capturado: 50 mm. Se reajusta por formato. Relación derivada: junto con "Intereje FT/mordaza", define el límite superior de altura de pila medible por fotocélula = posición espera + intereje FT/mordaza (con los valores capturados, 50 + 68 = 118 mm de ejemplo, no fijo para todos los formatos). Por encima de ese límite, el haz de la fotocélula ya está cortado por la pila antes de que las mordazas empiecen a bajar, y no queda ninguna transición que detectar. Ver la alarma "TO lectura altura pila".', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('4b5b4151-4e8c-4f0a-a647-64d1472a3305', 'bs08.divisor.parametro.tolerancia_altura_pila', 'BS08', 'Divisor', 'parametro', 'Tolerancia altura pila', 'Campo configurable de la pantalla Formato → Divisor. Margen permitido entre "Altura pila" (configurada) y "Lectura altura pila" (medida) antes de que salte la alarma "Error lectura pila". Se suele tener entre 9 y 12 mm, es decir, aproximadamente el grosor de una pieza (9-11 mm, ver "Contexto: naturaleza de la pila"). Ejemplo: con Altura pila 225 mm y tolerancia 12 mm, la máquina da por buena cualquier lectura entre 213 y 237 mm; fuera de ese rango (una pieza de más o de menos, o más) no divide y alarma.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('e0f5b1da-4b18-4323-aa1c-40400ce5b2b9', 'bs08.divisor.proceso.00_contexto_pila_y_referencia', 'BS08', 'Divisor', 'proceso', '0. Contexto: naturaleza de la pila y sistema de referencia', 'La pila que llega al divisor es una pila de azulejos apilados. Cada azulejo tiene un espesor habitual entre 9 y 11 mm. El número de piezas por pila varía mucho según el formato: desde 4 piezas (formato 120x120 cm) hasta 25 piezas (formato 20x120 cm) — de ahí que la altura total a medir por la fotocélula cambie tanto entre formatos. Sistema de referencia de alturas: el punto 0 es la posición de calibrado del divisor (donde se para la mordaza al calibrar: sensor de calibrado + "Offset calibr."), que queda deliberadamente 1-2 mm por encima de las cadenas de tracción. Todas las cotas del divisor (posición espera, cota de corte, cuota de división) se miden desde ese cero, no desde las cadenas. "Arriba" significa mayor altura numérica (más lejos de las cadenas); "abajo" significa menor altura numérica (más cerca de las cadenas). Convención de términos: "pila" o "pila completa" se refiere siempre al conjunto sin dividir que llega al divisor. "caja" se refiere a la porción ya separada por el divisor que formará una caja — mismo uso que en el resto de la documentación de la sección (Escuadrador, Elevador, Mandril, Jaula).', true, '2026-09-11 21:23:56.216218+00', '2026-09-12 22:50:40.44679+00'),
	('0ef318b0-251b-485e-b0e4-f4598c9b846e', 'bs08.divisor.proceso.02_medicion_corte', 'BS08', 'Divisor', 'proceso', '2. Medición y corte', 'Cuando la pila para, el divisor (que espera arriba) baja y mide la pila antes de dividirla. Estructura: un motor a cada lado de la pila, cada uno con una mordaza vulcanizada sujeta a un pistón grande, guiado y fuerte. El motor sube y baja este conjunto mediante motor + eje + polea dentada, que actúa sobre una cremallera. Sobre las mordazas hay una fotocélula (emisor en un lado, receptor en el otro) que mide la altura de la pila — el "Intereje FT/mordaza" es la altura de esa fotocélula respecto a la parte baja de la mordaza. Los dos motores son independientes pero trabajan sincronizados. Calibrado: hay un sensor de calibrado (sensor bajo) a cada lado; al calibrar, cada lado baja hasta que el sensor empieza a leer, sigue bajando los mm del "Offset calibr." (habitual 4-8 mm, nunca 0) y ese punto es el cero. El sensor se coloca físicamente de modo que ese cero quede 1-2 mm por encima de las cadenas de tracción.', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('5669b5e2-74fb-447d-ab49-8ebf2ba01675', 'bs08.divisor.proceso.03_posicion_espera', 'BS08', 'Divisor', 'proceso', '3. Posición de espera entre pilas', '"Posición espera" es la altura a la que esperan las mordazas una nueva pila que llega de los apiladores — basta con que la fotocélula (mordaza + intereje) quede por encima de la pila. Secuencia: llega la pila → las mordazas bajan → en el momento en que la fotocélula emisor/receptor (sobre las propias mordazas) se corta por la pila, ahí se determina su altura → a partir de esa altura medida se calcula a qué cota hay que dividir: cota de corte = altura medida ÷ "Número de divisiones por pila" (p. ej. 225 mm ÷ 5 = 45 mm), más el "Offset posición recogida" hacia abajo si lo hay. Antes de dividir se comprueba que la altura medida está dentro de "Altura pila" ± "Tolerancia altura pila"; si no, alarma "Error lectura pila". Si "División de la pila sin fotocélula" está en "Sí", no se mide y se corta directamente a la "Cuota de división de la pila".', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('21f81bf4-a7fa-4204-8190-57ed289f994f', 'bs08.divisor.proceso.05_division_y_sujecion', 'BS08', 'Divisor', 'proceso', '5. División y sujeción de la pila', 'Una vez determinada la altura de la pila (y, si aplica, tras el escuadrado de pila completa del paso 4), si "Escuadra pila" NO está activado las mordazas bajan directamente a la altura a la que corresponde dividir. Al cerrar ahí, las mordazas sujetan toda la pila EXCEPTO las piezas que componen una caja, que quedan libres, apoyadas sobre las cadenas de tracción de la empaquetadora. Como la pila restante vuelve a apoyarse en las cadenas tras cada avance, la cota de corte es la misma en todas las divisiones de la pila.', true, '2026-09-11 21:23:56.216218+00', '2026-09-12 22:50:40.44679+00'),
	('171cb969-921a-4dfc-8c59-47658d7d175b', 'bs08.divisor.proceso.06_avance_y_ciclo_continuo', 'BS08', 'Divisor', 'proceso', '6. Avance al escuadrador y ciclo continuo', 'Las cadenas de tracción de la empaquetadora avanzan la caja hasta el escuadrador, mientras el resto de la pila queda sujeto arriba por las mordazas del divisor. Cuando esa caja llega al escuadrador (que cierra para escuadrarla sobre las cadenas), el divisor baja y realiza la siguiente división, repitiendo el proceso: deja una nueva caja sobre las cadenas y sigue sujetando el resto arriba. Es un proceso continuo, sin paradas entre una caja y la siguiente, hasta agotar las divisiones programadas para el formato.', true, '2026-09-11 21:23:56.216218+00', '2026-09-12 22:50:40.44679+00'),
	('bb6b2ac7-52b4-4ed2-beaa-455aee3ef4fe', 'bs08.divisor.sensor.inductivo_calibrado', 'BS08', 'Divisor', 'sensor', 'Sensor inductivo de calibrado', 'Sensor inductivo, uno a cada lado, en la parte baja del divisor. En la documentación y en las alarmas aparece indistintamente como "sensor de calibrado" y "sensor bajo": es el mismo sensor. Define el cero de la máquina junto con el "Offset calibr.": al calibrar, la mordaza baja hasta que el sensor empieza a leer, sigue bajando los mm del offset y ese punto es el cero. Ajustable mecánicamente moviendo la posición física del sensor en el chasis, hasta que el cero quede 1-2 mm por encima de las cadenas, igual en ambos lados. Alarmas asociadas: "Divisor no calibrado ON/OFF derecha/izquierda".', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 22:50:40.44679+00'),
	('3ec62f36-4396-4381-a405-79f2e1cbba15', 'bs08.divisor.sensor.mc_piston_mordaza', 'BS08', 'Divisor', 'sensor', 'Sensor MC del pistón de la mordaza (uno por lado)', 'Sensor magnético tipo MC (no inductivo), uno en el pistón derecho y otro en el izquierdo — ver "Pistón de la mordaza". Detecta el imán del propio émbolo del cilindro; se activa (cierra contacto) cuando el pistón está en reposo. Si no está excitado con el cilindro en reposo, salta "Divisor anomalía MC cilindro derecho/izquierdo" — puede ser fallo del cilindro o del sensor; se soluciona ajustando la posición del sensor si es necesario.', true, '2026-09-12 11:23:57.257032+00', '2026-09-12 22:50:40.44679+00'),
	('e6be7c75-d6c2-4b31-906b-888a59ac8498', 'bs08.regulaciones.alarma.empujador_no_atras', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Empujador no atrás', 'Antes de empezar el cambio de formato automático, la máquina lleva algunos elementos que podrían crear interferencias mecánicas fuera del radio de acción y activar esta alarma. Indica que el empujador no se detecta en la posición atrás deseada. Solución, comprobar: si el elemento se encuentra en la posición deseada; que el sensor de posición esté activo; que las cuotas correspondan a la efectiva posición del elemento.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('55992f3e-96ad-4507-9934-845d26a315b6', 'bs08.regulaciones.alarma.jaula_no_alta', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Jaula no alta', 'Antes de empezar el cambio de formato automático, la máquina lleva algunos elementos que podrían crear interferencias mecánicas fuera del radio de acción y activar esta alarma. Indica que la jaula no se detecta en la posición alta deseada. Solución, comprobar: si el elemento se encuentra en la posición deseada; que el sensor de posición esté activo; que las cuotas correspondan a la efectiva posición del elemento.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('c3fcb791-5edc-4f21-a003-620e29b9d48a', 'bs08.divisor.parametro.offset_posicion_recogida', 'BS08', 'Divisor', 'parametro', 'Offset posición recogida', 'Corrige la posición calculada para la división, permitiendo realizarla solo más abajo de la calculada — a más valor, más abajo. No admite valores negativos (no se puede corregir hacia arriba). No tiene un tope técnico definido, se puede aumentar sin problema; el "rango habitual" (0-3 mm) es solo orientativo, no un límite real. Valor capturado: 1 mm. Se reajusta por formato. Actúa directamente sobre la cota de corte (1 mm de offset = 1 mm de corte), a diferencia del error de intereje, que llega al corte dividido por el número de divisiones. Guía para el operario: si hace falta dividir más abajo (sobra pieza en la caja), simplemente subir este valor, sin más complicación. Si en algún momento hay que superar los 8 mm, se puede seguir así sin problema — no hay ningún riesgo inmediato —, pero es una señal de que "Intereje FT/mordaza" u "Offset calibr." pueden estar desajustados de fondo: avisar al mecánico para que lo revise cuando pueda, sin urgencia. Diagnóstico: si la caja llega con MÁS piezas de las que le tocan (o "se escapa una pieza" hacia esa caja) — puede pasar en cualquier división del ciclo, no en una posición fija —, es síntoma de que el divisor está dividiendo demasiado arriba: este es el ajuste habitual y más sencillo para corregirlo. Si en cambio falta alguna pieza, este offset no puede corregirlo bajo ningún concepto (no admite ir hacia arriba): ver directamente "Intereje FT/mordaza".', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 23:02:51.506132+00'),
	('c824df94-ee9e-495f-9054-8b9020fc0d14', 'bs08.divisor.parametro.intereje_ft_mordaza', 'BS08', 'Divisor', 'parametro', 'Intereje FT/mordaza', 'Altura de la fotocélula de medición (sobre las mordazas) respecto a la parte baja de la mordaza — es la fotocélula que mide la altura de la pila para calcular las divisiones. Valor capturado: 68 mm. Dato constructivo/físico: NO se reajusta como parte de un cambio de formato rutinario. Solo cambia si se manipula físicamente la posición de la fotocélula — por accidente (golpe, deformación) o, más raramente, de forma deliberada, cuando un formato nuevo trae una pila cuya altura real queda fuera del rango medible con el montaje actual. Relación derivada: como la mordaza nunca baja por debajo de su posición de calibrado (el cero, que queda 1-2 mm por encima de las cadenas — ver "Offset calibr.") y la fotocélula va siempre a esta distancia por encima de la mordaza, este valor es la altura MÍNIMA de pila medible por fotocélula. Ver "Posición espera" para el límite superior del rango, y la alarma "TO lectura altura pila" para el síntoma cuando la pila cae fuera de rango. Para formatos con pila más baja que este valor (p. ej. 120x120 de 4 piezas) se trabaja con "División de la pila sin fotocélula" y cota fija, no se mueve la fotocélula. Diagnóstico adicional: si el intereje programado está por DEBAJO del real (la fotocélula física está, en realidad, más arriba de lo programado), la máquina SUBESTIMA la altura de la pila y calcula cada corte más abajo de lo que toca — el divisor divide demasiado abajo, con riesgo de que FALTE alguna pieza en cualquier caja del ciclo (nunca se corrige con "Offset posición recogida", que solo permite ir hacia abajo). Si el intereje programado está por ENCIMA del real (la fotocélula física está, en realidad, más abajo de lo programado), la máquina SOBREESTIMA la altura de la pila y calcula cada corte más arriba de lo que toca — el divisor divide demasiado arriba, con riesgo de que SOBRE alguna pieza en cualquier caja del ciclo; si el desajuste es pequeño, se puede compensar simplemente subiendo el "Offset posición recogida" (que no tiene tope definido); si el offset necesario para compensarlo supera los 8 mm, es más indicado corregir el intereje directamente en vez de seguir subiendo el offset — aunque seguir subiéndolo seguiría funcionando mientras tanto. Magnitud del efecto: el error de intereje entra entero en la altura medida, pero la cota de corte es altura ÷ "Número de divisiones por pila", así que al corte solo llega dividido por el número de divisiones (20 mm de error de intereje con 5 divisiones = 4 mm de error en el corte). A diferencia del "Offset posición recogida", que mueve el corte 1 mm por cada mm. En ambos casos el fallo puede aparecer en cualquier división del ciclo, no en una posición fija — lo que distingue la causa es la DIRECCIÓN del error (sobra/falta), no en qué caja concreta ocurre. Ver "bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza" para el procedimiento de verificación y corrección.', true, '2026-09-10 19:52:55.604918+00', '2026-09-12 23:02:51.506132+00'),
	('72a33e32-a6b3-4897-adca-df022042c557', 'bs08.jaula.alarma.mc_jaula_cerrada', 'BS08', 'Jaula', 'alarma', 'Jaula: Mc jaula cerrada', 'El sensor del cilindro jaula cerrada no se ha excitado con el cilindro jaula inactivo. Solución: comprobar el funcionamiento de los cilindros de la jaula y del correspondiente sensor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('1963ad8b-7353-42c6-842a-a758fcb5b69d', 'bs08.jaula.alarma.to_salida_pila', 'BS08', 'Jaula', 'alarma', 'Jaula: T.O. salida pila', 'La pila presente dentro de la jaula no salió en el tiempo máximo previsto. Solución: comprobar el posible atasco de la pila, el funcionamiento del motor, el funcionamiento de la fotocélula a la salida de la jaula y el tiempo máximo previsto programado en la diapositiva de la jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('2ac99262-3dac-438e-87e6-1a5c0cdf75c3', 'bs08.jaula.alarma.mc_fondo_jaula_atras', 'BS08', 'Jaula', 'alarma', 'Fondo jaula: Mc fondo jaula atrás', 'El sensor de fondo jaula atrás no está activo con el mando del cilindro fondo jaula atrás activo y el mando del cilindro fondo jaula corto atrás activo. Solución: comprobar el funcionamiento del sensor y del cilindro fondo jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('0bf108b2-d526-489a-915b-0999cb4737fe', 'bs08.jaula.alarma.mc_fondo_jaula_adelante', 'BS08', 'Jaula', 'alarma', 'Fondo jaula: Mc fondo jaula adelante', 'El sensor de fondo jaula adelante no está activo con el mando del cilindro fondo jaula adelante activo y el mando del cilindro fondo jaula corto atrás activo. Solución: comprobar el funcionamiento del sensor y de los cilindros fondo jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('6eb86077-0a67-489e-a779-8509c22a841b', 'bs08.jaula.alarma.mc_fondo_jaula_alto', 'BS08', 'Jaula', 'alarma', 'Fondo jaula: Mc fondo jaula alto', 'El sensor de cilindro jaula alto no está activo con el mando del cilindro fondo jaula subida activo. Solución: comprobar el funcionamiento del sensor y del cilindro fondo jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('31bb7074-4710-48de-bad7-73175567c647', 'bs08.jaula.alarma.mc_fondo_jaula_bajo', 'BS08', 'Jaula', 'alarma', 'Fondo jaula: Mc fondo jaula bajo', 'El sensor de cilindro jaula bajo no está activo con el mando del cilindro fondo jaula bajada activo. Solución: comprobar el funcionamiento del sensor y del cilindro fondo jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('9c978e2a-7f61-4b48-8004-821434a040e4', 'bs08.hotmelt.alarma.anomalia_cola_caliente', 'BS08', 'Hotmelt', 'alarma', 'Hotmelt: Anomalía cola caliente', 'La máquina que suministra la cola en caliente presenta una anomalía. Solución: comprobar el estado de la máquina de la cola en caliente.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('96c842c3-3592-435e-aa4f-33487a640f46', 'bs08.sacabandejas.alarma.recogida_fallida', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: Recogida fallida', 'La fotocélula de bandeja a bordo no se ha excitado después de la recogida de una bandeja. Solución: comprobar la efectiva falta de recogida de la bandeja, la presencia de bandejas en el almacén de recogida, el funcionamiento de las ventosas de recogida y de la fotocélula de bandeja a bordo.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('d45225b0-d1ce-462c-aa44-d461659531af', 'bs08.sacabandejas.alarma.no_calibrado', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: No calibrado', 'Hay que calibrar el motor de la traslación del sacabandejas. Solución: realizar la calibración del sacabandeja.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('dd64fcb5-d16e-4adc-b61a-6348f5c5d8a0', 'bs08.sacabandejas.alarma.ventosas_no_calibradas', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: Ventosas no calibradas', 'El motor de la rotación ventosas del sacabandejas se ha bloqueado en su movimiento. Solución: controlar el sensor de restablecimiento de las ventosas del sacabandejas y extraer los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del sacabandeja.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('c8aa2449-da82-4940-b1fc-7d300dfe6e90', 'bs08.sacabandejas.alarma.to_hacia_recogida', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: T.O. hacia recogida', 'Durante una operación de recogida, el sacabandejas no ha alcanzado el almacén en el tiempo máximo previsto. Solución: comprobar el posible atasco del sacabandejas, el funcionamiento del motor, del codificador y las cuotas programadas para los almacenes de bandejas.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('20ca3753-7d1c-40e4-b112-d7fecea9fbf1', 'bs08.sacabandejas.alarma.to_hacia_deposito', 'BS08', 'Sacabandejas', 'alarma', 'Sacabandejas: T.O. hacia depósito', 'Durante una operación de depósito, el sacabandejas no ha alcanzado la cuota de depósito en el tiempo máximo previsto. Solución: comprobar el posible atasco del sacabandejas, el funcionamiento del motor, del codificador y las cuotas programadas para el depósito del recipiente.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('4b9dee0a-2c0b-4402-b655-e78f67be9184', 'bs08.regulaciones.alarma.fondo_jaula_no_alto', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Fondo jaula no alto', 'Antes de empezar el cambio de formato automático, la máquina lleva algunos elementos que podrían crear interferencias mecánicas fuera del radio de acción y activar esta alarma. Indica que el fondo de la jaula no se detecta en la posición alta deseada. Solución, comprobar: si el elemento se encuentra en la posición deseada; que el sensor de posición esté activo; que las cuotas correspondan a la efectiva posición del elemento.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('0c8973ae-b3ce-4cb9-a780-e556b0d49c24', 'bs08.regulaciones.alarma.fondo_jaula_no_adelante', 'BS08', 'Regulaciones', 'alarma', 'Regulaciones: Fondo jaula no adelante', 'Antes de empezar el cambio de formato automático, la máquina lleva algunos elementos que podrían crear interferencias mecánicas fuera del radio de acción y activar esta alarma. Indica que el fondo de la jaula no se detecta en la posición adelante deseada. Solución, comprobar: si el elemento se encuentra en la posición deseada; que el sensor de posición esté activo; que las cuotas correspondan a la efectiva posición del elemento.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('21382c83-a766-4904-a100-1800fba11502', 'bs08.avisos.alarma.regulaciones_no_en_formato', 'BS08', 'Avisos', 'alarma', 'Avisos: Regulaciones no en el formato', 'Uno o más motores de regulación no están en la posición correcta para el formato en curso. Solución: realizar el cambio de formato con los mandos generales.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('477ac2f8-d1ec-4fbc-9627-7cb187dc8170', 'bs08.dispositivos_seguridad.alarma.restablezca_fungiformes_emergencia', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: restablezca los botones fungiformes de emergencia', 'Se presionó el botón fungiforme rojo de la zona wrap. Solución: para volver a poner en marcha el wrap y el wrap del tramo posterior, restablezca el botón fungiforme presionado y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('46b75c36-abfd-4a7e-9ba6-21b357b65643', 'bs08.dispositivos_seguridad.alarma.restablezca_barrera_derecha', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Restablezca barrera derecha', 'Una barrera de la zona wrap está intervenida bloqueando el wrap. Solución: controle el estado de las barreras fotoeléctricas, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('91f01591-b90a-4262-890d-1fb90238bb2d', 'bs08.dispositivos_seguridad.alarma.restablezca_barrera_izquierda', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Restablezca barrera izquierda', 'Una barrera de la zona wrap está intervenida bloqueando el wrap. Solución: controle el estado de las barreras fotoeléctricas, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('d5adf7ae-15d0-4419-bfeb-9eaad0f2de04', 'bs08.dispositivos_seguridad.alarma.restablezca_barreras', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Restablezca barreras', 'Una barrera de la zona wrap está intervenida bloqueando el wrap. Solución: controle el estado de las barreras fotoeléctricas, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('58a9e881-9317-49d7-be1a-f02b84e86ac4', 'bs08.dispositivos_seguridad.alarma.restablezca_pulsador_parada_wrap', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Restablezca el pulsador de parada del wrap', 'Se presionó el botón fungiforme de la zona wrap. Solución: para volver a poner en marcha el wrap, restablezca el botón fungiforme presionado y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('416fc1f4-2ee1-4177-bb79-324a8e2ebc0c', 'bs08.dispositivos_seguridad.alarma.bloqueos_wrap_posterior', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Bloqueos wrap posterior', 'Las barreras fotoeléctricas de la zona del wrap posterior fueron intervenidas y bloquean el wrap posterior. Solución: compruebe el estado de las fotocélulas, restablezca la marcha del tramo posterior del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('81e07781-2222-42be-8af0-e5dac04a3e7b', 'bs08.dispositivos_seguridad.alarma.anomalia_barrera_derecha', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Anomalía barrera derecha', 'Tras el control efectuado en el funcionamiento de las barreras del wrap, se detectó una anomalía que bloquea el wrap. Solución: controle el estado de las barreras fotoeléctricas, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('1dd28ff6-e16e-4b0e-839a-73cb73c0eddc', 'bs08.dispositivos_seguridad.alarma.anomalia_barrera_izquierda', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Anomalía barrera izquierda', 'Tras el control efectuado en el funcionamiento de las barreras del wrap, se detectó una anomalía que bloquea el wrap. Solución: controle el estado de las barreras fotoeléctricas, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('f591a385-5e3e-42fa-989e-5ce5cceccff9', 'bs08.dispositivos_seguridad.alarma.anomalia_fungiformes_wrap', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Anomalía de los botones fungiformes wrap', 'El control realizado en el funcionamiento de los botones fungiformes de emergencia detectó una anomalía que bloquea el wrap. Solución: controle los botones fungiformes de emergencia del wrap, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('111cc5c1-2fed-442c-93cb-6fac4f854e9d', 'bs08.dispositivos_seguridad.alarma.anomalia_tg_wrap', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Anomalía tg wrap', 'Tras el control efectuado en el funcionamiento de los telerruptores de potencia del wrap, se detectó una anomalía que bloquea el wrap. Solución: controle el funcionamiento de los telerruptores de potencia del wrap, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('f83ead4f-a697-44c5-8962-8e0709a40a91', 'bs08.dispositivos_seguridad.alarma.modulo_seguridad_en_anomalia', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Módulo k100/k101/k102/k110 en anomalía', 'Anomalía en el módulo de seguridad correspondiente (k100, k101, k102 o k110). Solución: compruebe el estado del módulo dentro del panel. Para reconfigurar la alarma hay que apagar y volver a encender la máquina. Si la alarma se presenta frecuentemente, compruebe el estado de las conexiones del módulo y eventualmente sustituya el módulo.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('60856c5d-16b1-4170-aac9-a06f2f02cf54', 'bs08.dispositivos_seguridad.alarma.emergencia_en_linea', 'BS08', 'Dispositivos de seguridad', 'alarma', 'Dispositivos de seguridad: Emergencia en línea', 'Emergencia en la línea activa que bloquea la puesta en marcha en el wrap. Solución: controle el estado de las emergencias en la línea.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('4addafcb-01ec-42a9-9c89-3951a658b000', 'bs08.empujador.alarma.obstaculo_empuje', 'BS08', 'Empujador', 'alarma', 'Empujador: Obstáculo empuje', 'Durante el avance del empujador faltó la habilitación al avance. Solución, controle: posición fleje grande, posición fleje pequeño, posición flejes superiores, posición fondo jaula; cuota programada en la diapositiva SACACARTÓN-START CICLO EMPUJADOR y posición del sacacartón; cuota programada en la diapositiva EMPUJADOR-TEST OBSTÁCULO y posición del empujador; cuota diapositiva EMPUJADOR-BAJADA GUÍA CARTONES, posición depósitos cartones y funcionamiento de los sensores relativos.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('260823e7-6a1e-4c5f-8d03-2a07e95b7f99', 'bs08.empujador.alarma.cola_plantilla_seca', 'BS08', 'Empujador', 'alarma', 'Empujador: Cola plantilla seca', 'Al inicio del empuje de una pila hacia la jaula ha pasado el tiempo configurado para el secado de la cola. Solución: comprobar el valor del tiempo configurado para el secado de la cola y quitar el cartón presente delante de la jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('2f0e84d7-728a-4932-bdb3-142c68157967', 'bs08.empujador.alarma.tipo_carton', 'BS08', 'Empujador', 'alarma', 'Empujador: Tipo cartón', 'El cartón presente delante de la jaula no ha sido recogido del almacén correcto. Solución: quitar el cartón delante de la jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('95934c0f-0f3a-4bba-b394-71c0de306ac3', 'bs08.empujador.alarma.anomalia_reloj_jaula', 'BS08', 'Empujador', 'alarma', 'Empujador: Anomalía reloj jaula', 'El sensor de clock de la jaula no ha detectado la entrada de una caja en la jaula. Solución: comprobar el funcionamiento del sensor clock jaula y la posición del clock de la jaula.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('187f369e-9b9d-42d0-96a1-06c7316b9a70', 'bs08.empujador.alarma.anomalia_hotmelt', 'BS08', 'Empujador', 'alarma', 'Empujador: Anomalía hotmelt', 'La máquina que suministra la cola en caliente presenta una anomalía. Solución: comprobar el estado de la máquina de la cola en caliente. (Misma alarma física que "Hotmelt: Anomalía cola caliente" — ver aviso 4.)', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('64f13f15-7cd3-4cb3-b6f2-501acc405139', 'bs08.empujador.alarma.no_calibrado', 'BS08', 'Empujador', 'alarma', 'Empujador: No calibrado', 'El motor del empujador requiere una calibración. Solución: realizar la calibración del empujador.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('00e1cfe0-a866-43b0-9028-aa0a50d24a11', 'bs08.empujador.alarma.anomalia_inverter', 'BS08', 'Empujador', 'alarma', 'Empujador: Anomalía inverter', 'El inverter presenta una anomalía. Solución: comprobar que el inversor y el motor conectado a él funcionen correctamente.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('a9cb0f06-7777-4d49-ac63-569b0f645575', 'bs08.empujador.alarma.anomalia_comunicacion_inverter', 'BS08', 'Empujador', 'alarma', 'Empujador: Anomalía comunicación inverter', 'Error de comunicaciones con inversor. Solución: comprobar el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('da7c8a17-e1d1-4688-aaa4-c2c083739710', 'bs08.empujador.alarma.tiempo_limite_comunicacion_inverter', 'BS08', 'Empujador', 'alarma', 'Empujador: Tiempo límite comunicación inverter', 'Timeout de comunicaciones con inverter. Solución: comprobar el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('0d1ca04b-b521-4545-9e09-8ad09ad9b84b', 'bs08.empujador_bandejas.alarma.obstaculo_empuje', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Obstáculo empuje', 'Durante el avance del empujador de bandejas faltó la habilitación al avance. El avance del empujador bandeja se realiza solo si el mandril está parado en la posición alta. Solución: comprobar la posición del mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('abe5ddbb-ad67-42f6-bd2a-bf1d70c195a7', 'bs08.empujador_bandejas.alarma.no_calibrado', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: No calibrado', 'El motor del empujador de bandejas se ha bloqueado o ha alcanzado el final de carrera adelante en su movimiento. Solución: comprobar el sensor de atrás, el sensor de adelante, la cuota en la diapositiva EMPUJADOR BANDEJA-CUOTA FIN DEL EMPUJE, y quitar los posibles obstáculos que hayan bloqueado el motor; realizar la calibración del empujador de bandejas.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('2a93234d-3bed-49eb-a7db-c27f2f241f64', 'bs08.empujador_bandejas.alarma.anomalia_mc_guia_abierto', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Anomalía mc guía abierto', 'El sensor abierto de la guía del empujador bandeja no se excita con el cilindro de apertura de la guía empujador bandeja activo. Solución: comprobar el funcionamiento del sensor y de los cilindros del empujador de bandejas.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('4a4bdae9-200a-491f-b168-276da558215e', 'bs08.empujador_bandejas.alarma.anomalia_mc_guia_cerrado', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Anomalía mc guía cerrado', 'El sensor cerrado de la guía del empujador bandeja no se excita con el cilindro de cierre de la guía empujador bandeja activo. Solución: comprobar el funcionamiento del sensor y de los cilindros del empujador de bandejas.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('bf893d30-09b6-4f33-8b51-15c6924d4026', 'bs08.empujador_bandejas.alarma.sin_calibrar_derecha_mc_on', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Sin calibrar derecha mc on', 'El motor necesita un calibrado: el sensor de calibración que debería haber dejado libre el movimiento del motor todavía está activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('9ebda56a-ee8e-4cfb-ae84-a66b24b5f6f8', 'bs08.empujador_bandejas.alarma.sin_calibrar_izquierda_mc_on', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Sin calibrar izquierda mc on', 'El motor necesita un calibrado: el sensor de calibración que debería haber dejado libre el movimiento del motor todavía está activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('b438aa49-4b11-47c2-aafe-10a6b4ee7bc8', 'bs08.empujador_bandejas.alarma.sin_calibrar_derecha_mc_off', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Sin calibrar derecha mc off', 'El motor necesita un calibrado: el sensor de calibración no está activado, aunque la posición del motor debería haberlo activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Mismo procedimiento de restablecimiento que "Sin calibrar mc on".', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('0d5f3bc2-958d-4bfb-8c2d-c8b778eeee2e', 'bs08.empujador_bandejas.alarma.sin_calibrar_izquierda_mc_off', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Sin calibrar izquierda mc off', 'El motor necesita un calibrado: el sensor de calibración no está activado, aunque la posición del motor debería haberlo activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Mismo procedimiento de restablecimiento que "Sin calibrar mc on".', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('89aea089-9745-45b1-b6fd-8a225a266d54', 'bs08.empujador_bandejas.alarma.sin_calibrar_derecha_mc_adelante', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Sin calibrar derecha mc adelante', 'El motor necesita un calibrado: el movimiento del motor ha activado el sensor de adelante, que nunca debe alcanzar. Solución, compruebe: la posición del empujador de la bandeja; el sensor de adelante. Mismo procedimiento de restablecimiento que "Sin calibrar mc on".', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('b9c1e220-cf3e-468c-b1d8-dedb23ccd385', 'bs08.empujador_bandejas.alarma.sin_calibrar_izquierda_mc_adelante', 'BS08', 'Empujador de bandejas', 'alarma', 'Empujador de bandejas: Sin calibrar izquierda mc adelante', 'El motor necesita un calibrado: el movimiento del motor ha activado el sensor de adelante, que nunca debe alcanzar. Solución, compruebe: la posición del empujador de la bandeja; el sensor de adelante. Mismo procedimiento de restablecimiento que "Sin calibrar mc on".', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('f634e23e-1ab1-4aba-9183-24503ce4db13', 'bs08.escuadrador.alarma.anomalia_mc_dcha_lateral', 'BS08', 'Escuadrador', 'alarma', 'Escuadrador: Anomalía mc dcha lateral', 'El sensor del cilindro derecho del escuadrador lateral no está excitado con el cilindro en reposo. Solución: comprobar el funcionamiento del cilindro y del relativo sensor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('3989671c-48b5-4e6c-9739-84c9c1bd4a7e', 'bs08.escuadrador.alarma.anomalia_mc_izq_lateral', 'BS08', 'Escuadrador', 'alarma', 'Escuadrador: Anomalía mc izq. lateral', 'El sensor del cilindro izquierdo del escuadrador lateral no está excitado con el cilindro en reposo. Solución: comprobar el funcionamiento del cilindro y del relativo sensor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('1b8777c7-75be-4195-8b67-983fd7741253', 'bs08.escuadrador.alarma.anomalia_mc_dcho_frontal', 'BS08', 'Escuadrador', 'alarma', 'Escuadrador: Anomalía mc dcho frontal', 'El sensor del cilindro derecho del escuadrador frontal no está excitado con el cilindro en reposo. Solución: comprobar el funcionamiento del cilindro y del relativo sensor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('d76cdcad-cb93-4833-88c3-72728b34e373', 'bs08.escuadrador.alarma.anomalia_mc_izq_frontal', 'BS08', 'Escuadrador', 'alarma', 'Escuadrador: Anomalía mc izq frontal', 'El sensor del cilindro izquierdo del escuadrador frontal no está excitado con el cilindro en reposo. Solución: comprobar el funcionamiento del cilindro y del relativo sensor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('50607884-5240-41f3-aed8-02687f13581b', 'bs08.escuadrador.alarma.anomalia_mc_dcho_trasero', 'BS08', 'Escuadrador', 'alarma', 'Escuadrador: Anomalía mc dcho. trasero', 'El sensor del cilindro derecho del escuadrador posterior no está excitado con el cilindro en reposo. Solución: comprobar el funcionamiento del cilindro y del relativo sensor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('dc87a388-f7ac-4094-a63d-24bd8149e6fc', 'bs08.escuadrador.alarma.anomalia_mc_izq_trasero', 'BS08', 'Escuadrador', 'alarma', 'Escuadrador: Anomalía mc izq. trasero', 'El sensor del cilindro izquierdo del escuadrador posterior no está excitado con el cilindro en reposo. Solución: comprobar el funcionamiento del cilindro y del relativo sensor.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('4a1e5b42-e418-4bd7-9a75-f90e616dce08', 'bs08.traccion_pilas_wrap.alarma.pila_desconocida', 'BS08', 'Tracción pilas wrap', 'alarma', 'Tracción pilas wrap: Pila desconocida', 'La fotocélula presente en la zona de entrada tracción pilas está activada pero ninguna pila debe estar presente. Solución, compruebe: que la fotocélula funcione; eventuales pilas presentes en la posición incorrecta. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite las pilas que estén presentes en tracción; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('2a0c416d-6111-44d0-9cf1-e74ff6e8d9ac', 'bs08.traccion_pilas_wrap.alarma.to_transito_pila', 'BS08', 'Tracción pilas wrap', 'alarma', 'Tracción pilas wrap: T.O. tránsito pila', 'La pila de paso desde tracción línea hasta tracción wrap ha oscurecido la fotocélula presente en la zona de entrada tracción pilas durante un tiempo mayor al esperado. Solución, compruebe: que la fotocélula funcione; eventuales atascos de la pila en la zona fotocélula. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite las pilas que estén presentes en tracción; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('15776753-f268-4723-964b-52622f8f3a9e', 'bs08.tramo_posterior_wrap.alarma.configuracion_incorrecta', 'BS08', 'Tramo posterior wrap', 'alarma', 'Tramo posterior wrap: configuración incorrecta', 'Se ha detectado un error en los datos de configuración de la parte posterior del wrap. Solución: controle que los datos correspondientes estén programados correctamente consultando los esquemas eléctricos.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('ad6fec58-afea-4c32-98be-e17246ce0921', 'bs08.tramo_posterior_wrap.alarma.anomalia_inverter', 'BS08', 'Tramo posterior wrap', 'alarma', 'Tramo posterior wrap: anomalía inverter', 'Los inverters del tramo posterior del wrap presentan anomalías. Solución: compruebe el funcionamiento correcto de los inverters y del motor conectado a éste.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('8974d948-2e8b-4632-982a-7a2ccc2e7609', 'bs08.tramo_posterior_wrap.alarma.error_comunicacion_inverter', 'BS08', 'Tramo posterior wrap', 'alarma', 'Tramo posterior wrap: error comunicación inverter', 'Error de comunicaciones con inversor. Solución: compruebe el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('46722b4d-9118-4c90-a00b-9b0955059741', 'bs08.tramo_posterior_wrap.alarma.anomalia_termicas', 'BS08', 'Tramo posterior wrap', 'alarma', 'Tramo posterior wrap: anomalía térmicas', 'Una protección magnetotérmica ha intervenido en la parte posterior del wrap.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('809fc90b-92c5-4898-9cd2-24d5c1d5c65a', 'bs08.tramo_posterior_wrap.alarma.codigo_cero', 'BS08', 'Tramo posterior wrap', 'alarma', 'Tramo posterior wrap: código cero', 'Una caja llega a una fotocélula de tramo posterior del wrap en un tiempo no previsto por la ventana temporal configurada en el elemento ENLACE. A la caja en entrada en el enlace del tramo posterior se le asignó un código 0. Solución: controle si la caja queda bloqueada en los enlaces, si el motor y la fotocélula funcionan, y verifique el tiempo programado en el elemento ENLACE.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('01eb7bc5-470d-4a01-a108-8e18d866ab26', 'bs08.tramo_posterior_wrap.alarma.timeout_fotocelula', 'BS08', 'Tramo posterior wrap', 'alarma', 'Tramo posterior wrap: timeout fotocélula', 'Durante el pasaje de una caja en los enlaces de la parte posterior del wrap, una fotocélula permanece excitada por encima del tiempo máximo previsto en los enlaces. Solución: controle si la caja queda bloqueada en los enlaces, si el motor y la fotocélula funcionan, y verifique el tiempo programado en TIMEOUT FT ENLACES en la diapositiva TRAMO POSTERIOR WRAP.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('78a3e8e5-9dfc-488d-ac8d-137f144ca82b', 'bs08.tramo_posterior_wrap.alarma.timeout_comunicacion_inverters', 'BS08', 'Tramo posterior wrap', 'alarma', 'Posterior wrap: timeout de comunicación inverters', 'Timeout de comunicaciones con inverter. Solución: compruebe el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('f4ac741a-8431-46fc-bfaf-87dbe3e3351d', 'bs08.mandril.alarma.bandeja_no_calibrado', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado', 'El motor del mandril se ha bloqueado o no ha alcanzado el final de carrera bajo en su movimiento. Solución: comprobar el sensor de alto, el sensor de bajo, la cuota en la diapositiva MANDRIL-POSICIÓN BAJO, y quitar los posibles obstáculos que hayan bloqueado el motor. Realizar la calibración del mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('997d92e8-452a-468c-9e2d-28d14c458dc8', 'bs08.mandril.alarma.anomalia_mc_abierto', 'BS08', 'Mandril', 'alarma', 'Bandeja: Anomalía mc abierto', 'Los sensores de fleje anterior abierto no se excitan con el cilindro de apertura de los flejes anteriores del mandril activo. Solución: comprobar el funcionamiento de los sensores y de los cilindros de los flejes anteriores del mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('2fa817a6-a826-4dc3-a839-ac3928796ada', 'bs08.mandril.alarma.anomalia_mc_cerrado', 'BS08', 'Mandril', 'alarma', 'Bandeja: Anomalía mc cerrado', 'Los sensores de fleje anterior cerrado no se excitan con el cilindro de apertura de los flejes anteriores del mandril en reposo. Solución: comprobar el funcionamiento de los sensores y de los cilindros de los flejes anteriores del mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('bdfaaa52-3e3d-4b34-9c15-9c104e1a0b21', 'bs08.mandril.alarma.obstaculo_movimiento', 'BS08', 'Mandril', 'alarma', 'Bandeja: Obstáculo movimiento', 'Durante el movimiento del mandril faltó la habilitación. Solución: comprobar eventuales anomalías del empujador bandeja o del fondo jaula, la posición del empujador bandeja y la cuota de obstáculo en la diapositiva EMPUJADOR BANDEJA.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('7565e2d7-1447-4df1-9ef9-14bf2738c0cb', 'bs08.mandril.alarma.aplastamiento', 'BS08', 'Mandril', 'alarma', 'Bandeja: Aplastamiento', 'Durante la bajada, el sensor de achatamiento del mandril se ha desexcitado. Solución: comprobar el funcionamiento del sensor de achatamiento del mandril y la cuota POSICIÓN BAJO en la diapositiva MANDRIL.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('f28e6b4c-5361-42be-a01c-aece48cf7d2b', 'bs08.mandril.alarma.tipo_carton', 'BS08', 'Mandril', 'alarma', 'Bandeja: Tipo cartón', 'La bandeja presente en el mandril no ha sido recogida del almacén deseado. Solución: quitar la bandeja del mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('ceedaf9d-7d6e-4f21-bfe2-b26815c51eab', 'bs08.mandril.alarma.faltan_bandejas', 'BS08', 'Mandril', 'alarma', 'Bandeja: Faltan bandejas', 'Al inicio de la bajada de la bandeja, la fotocélula de presencia bandeja en el mandril no está activa. Solución: comprobar la presencia de la bandeja en el mandril y el funcionamiento de la fotocélula de presencia bandeja en el mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('e82f70de-f2f1-4ad2-9166-2e74d92a6797', 'bs08.mandril.alarma.anomalia_mc_bloqueo_bandejas', 'BS08', 'Mandril', 'alarma', 'Bandeja: Anomalía mc bloqueo bandejas', 'Los sensores de bloqueo bandeja abierta en el mandril no se excitan con el cilindro de apertura del bloqueo bandeja activo. Solución: comprobar el funcionamiento de los sensores y de los cilindros del bloqueo bandeja en el mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('bacbb1d5-bc58-4eed-8820-1063723a799a', 'bs08.mandril.alarma.to_bajada', 'BS08', 'Mandril', 'alarma', 'Bandeja: T.O. bajada', 'Durante una operación de bajada, el mandril no ha alcanzado la cuota de bajo en el tiempo máximo previsto. Solución: comprobar el posible atasco del mandril, el funcionamiento del motor, del codificador y la cuota programada de bajo del mandril.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('08ece6c4-eaea-49fd-8a12-40234477904a', 'bs08.mandril.alarma.to_subida', 'BS08', 'Mandril', 'alarma', 'Bandeja: T.O. subida', 'Durante una operación de subida, el mandril no ha alcanzado el sensor de alto en el tiempo máximo previsto. Solución: comprobar el posible atasco del mandril, el funcionamiento del motor y el funcionamiento del sensor de alto.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('d3034665-597c-4e95-8914-b27c71b6e48f', 'bs08.mandril.alarma.no_calibrado_derecho_sensor_atras_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado derecho sensor atrás activo', 'El motor necesita un calibrado. El movimiento del motor debería haber dejado libre el sensor de calibración, que todavía está activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático. (Nombre tal cual figura en el manual — ver aviso 13.)', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('43aaa40d-26cd-492c-81ef-32b5ff53c843', 'bs08.mandril.alarma.no_calibrado_izquierdo_sensor_alto_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado izquierdo sensor alto activo', 'El motor necesita un calibrado. El movimiento del motor debería haber dejado libre el sensor de calibración, que todavía está activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático. (Nombre tal cual figura en el manual — ver aviso 13.)', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('6a7f6ba3-5572-4808-8ca2-f8e781c5da0e', 'bs08.mandril.alarma.no_calibrado_derecho_sensor_alto_no_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado derecho sensor alto no activo', 'El motor necesita un calibrado. El sensor de calibración no está activado, aunque la posición del motor debería activar el sensor. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('99a83e5d-f713-4bda-84a4-b45357d2aafd', 'bs08.mandril.alarma.no_calibrado_izquierdo_sensor_alto_no_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado izquierdo sensor alto no activo', 'El motor necesita un calibrado. El sensor de calibración no está activado, aunque la posición del motor debería activar el sensor. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de calibración. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('ed7150b0-0aca-486c-ba05-2abac9dad96f', 'bs08.mandril.alarma.no_calibrado_derecho_sensor_bajo_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado derecho sensor bajo activo', 'El motor necesita un calibrado. El movimiento del motor debería dejar libre el sensor de bajo, que todavía está activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de bajo. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('4b5dd257-faaa-4d5a-a3d3-0dc8adbfea51', 'bs08.sacabandejas.parametro.cuota_deposito_almacen_derecho', 'BS08', 'Sacabandejas', 'parametro', 'Cuota depósito almacén derecho [mm]', 'Configura la cuota de depósito del cartón. Los valores se expresan en mm y se refieren al final de carrera en el almacén derecho. Valor de ejemplo visto en el manual: 1200 mm — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('9025c38c-1b4f-44a0-b2d2-54aafad82355', 'bs08.mandril.alarma.no_calibrado_izquierdo_sensor_bajo_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado izquierdo sensor bajo activo', 'El motor necesita un calibrado. El movimiento del motor debería dejar libre el sensor de bajo, que todavía está activado. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de bajo. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('7b3f66f3-ed00-4381-8041-c8a640a5e5de', 'bs08.mandril.alarma.no_calibrado_derecho_sensor_bajo_no_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado derecho_sensor bajo no activo', 'El motor necesita un calibrado. El sensor de bajo no está activado, aunque la posición del motor debería activar el sensor. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de bajo. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('b7282990-508d-4841-b7e7-41b5ae4d4cac', 'bs08.mandril.alarma.no_calibrado_izquierdo_sensor_bajo_no_activo', 'BS08', 'Mandril', 'alarma', 'Bandeja: No calibrado izquierdo_sensor bajo no activo', 'El motor necesita un calibrado. El sensor de bajo no está activado, aunque la posición del motor debería activar el sensor. Solución, compruebe: la posible presencia de obstáculos que bloquean el motor; el sensor de bajo. Para restablecer: coloque el wrap en modo manual; reconozca la alarma en la diapositiva ALARMAS ACTIVADAS; quite el cartón o el material que ha bloqueado el motor; de ser necesario, restablezca las barreras, botones fungiformes, etc.; si no se activa, restablezca la marcha del wrap; calibre el motor; restablezca la alarma en la diapositiva ALARMAS ACTIVADAS; restablezca el wrap en modo automático.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('76078617-fbc3-4dc2-a9e3-679eff0c6c5e', 'bs08.wrap_generales.alarma.termicas_wrap', 'BS08', 'Wrap generales', 'alarma', 'Wrap: Térmicas wrap', 'Una protección magnetotérmica ha intervenido en la parte wrap.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('82c46684-b1e2-4c27-9bcc-68fd678b5d43', 'bs08.wrap_generales.alarma.anomalia_alimentacion_aire_comprimido', 'BS08', 'Wrap generales', 'alarma', 'Wrap: Anomalía alimentación aire comprimido', 'El presostato que detecta la presión del aire comprimido en la entrada de la máquina detectó una disminución en la presión por debajo del umbral configurado. Solución: comprobar la presión en la entrada de la máquina y la conexión del tubo del aire comprimido en la entrada de la máquina.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('78299762-9f02-45dd-8fa5-3884ea8ce253', 'bs08.wrap_no_plantilla.alarma.faltan_cartones_bandejas', 'BS08', 'Wrap no plantilla', 'alarma', 'Wrap: Faltan cartones / Wrap: Faltan bandejas', 'El nivel de los cartones en los almacenes de cartones es bajo. Solución: agregar cartones en los almacenes.', true, '2026-09-16 16:59:54.161653+00', '2026-09-16 16:59:54.161653+00'),
	('0328c84b-ce69-46ac-9d47-95fd85d0ee95', 'bs08.regulaciones.parametro.cota_lados_abiertos', 'BS08', 'Regulaciones', 'parametro', 'Cota lados abiertos [mm]', 'Medida realizada con los lados del wrap abiertos al máximo. Configura el valor medido entre el externo de las cadenas de la tracción de las pilas, en mm. Sirve para la visualización de la posición de los lados del wrap.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('6bfbc4ca-bddd-4fc7-b4f5-5fd6b0b81b03', 'bs08.regulaciones.parametro.cota_longitudinal_cerrada', 'BS08', 'Regulaciones', 'parametro', 'Cota longitudinal cerrada [mm]', 'La regulación longitudinal permite desplazar el escuadrador frontal, divisor de pilas y elevador. Medida realizada con la regulación longitudinal wrap abierta al máximo, entre la paleta del escuadrador frontal y la paleta del escuadrador posterior en cierre. Sirve para la visualización de la posición longitudinal del wrap.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('92db4da2-76d7-4720-8642-035023ff5efb', 'bs08.regulaciones.parametro.cota_apoyo_bandeja_baja', 'BS08', 'Regulaciones', 'parametro', 'Cota de apoyo de la bandeja baja [mm]', 'Medida realizada con el apoyo bandeja baja al máximo, entre el punto de apoyo del cartón en el almacén y el punto de apoyo del cartón en el travesaño en movimiento. Sirve para la visualización de la posición del apoyo de la bandeja.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('f5359e77-46d2-41fb-b858-b766c148810c', 'bs08.regulaciones.parametro.cuota_guia_recipiente_abierta', 'BS08', 'Regulaciones', 'parametro', 'Cuota guía recipiente abierta [mm]', 'Medida realizada con la guía bandeja abierta al máximo, entre las dos guías de la bandeja. Sirve para la visualización de la posición de la guía de la bandeja.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('ca15392c-80b4-4d9f-bbd2-5031031225c8', 'bs08.regulaciones.parametro.lados_presente', 'BS08', 'Regulaciones', 'parametro', 'Lados presente', 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('182fe24d-b10d-49c0-93b0-d89d157598cb', 'bs08.regulaciones.parametro.longitudinal_presente', 'BS08', 'Regulaciones', 'parametro', 'Longitudinal presente', 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('2f646997-2d6a-4638-ab17-afb9e466b1ce', 'bs08.regulaciones.parametro.apoyo_bandejas_presente', 'BS08', 'Regulaciones', 'parametro', 'Apoyo bandejas presente', 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('185d5eb9-081a-4a9a-b8ce-0edf8cf42dce', 'bs08.regulaciones.parametro.guia_recipiente_presente', 'BS08', 'Regulaciones', 'parametro', 'Guía recipiente presente', 'Sí: el elemento está motorizado y se regula automáticamente. No: el elemento no está motorizado (se regula manualmente) o el elemento no está instalado.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('9805c149-f7bb-449c-9f57-116fb188c2eb', 'bs08.wrap_generales.parametro.nombre_wrap', 'BS08', 'Wrap generales', 'parametro', 'Nombre wrap', 'Asigna un nombre que identifica el wrap.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('b524c11a-2e1c-4247-85da-ce0aa619f790', 'bs08.wrap_generales.parametro.tipo_linea_anterior', 'BS08', 'Wrap generales', 'parametro', 'Tipo de línea anterior', 'ATENCIÓN, dato de configuración: modificar solo si se está totalmente seguro. Configura el tipo de línea presente en el tramo anterior del wrap; selecciona el tipo de interconexión con la línea del tramo anterior.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('ce6aaecb-bfeb-4da7-9534-5a412059cda9', 'bs08.traccion_pilas_wrap.parametro.velocidad', 'BS08', 'Tracción pilas wrap', 'parametro', 'Velocidad [mm/s]', 'Velocidad máxima de transporte de pilas.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('36f6e21d-995c-409f-8c2b-c5388518b332', 'bs08.traccion_pilas_wrap.parametro.aceleracion', 'BS08', 'Tracción pilas wrap', 'parametro', 'Aceleración [mm/s^2]', 'Aceleración/desaceleración de la tracción de transporte: configura la variación de velocidad en la unidad de tiempo durante las conmutaciones entre velocidad mínima y máxima. Cuando el valor aumenta, las variaciones de velocidad son menos rápidas.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('5418ae59-3c1b-4508-9d53-675647940e51', 'bs08.sacabandejas.parametro.distancia_inicio_rotacion', 'BS08', 'Sacabandejas', 'parametro', 'Distancia inicio rotación [mm]', 'Cota en mm desde la posición de recogida de bandejas a la cual el eje de las ventosas inicia la rotación para alcanzar la posición de desenganche del cartón.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('77e162af-948d-4c01-b841-7bd6b8e4891c', 'bs08.sacabandejas.parametro.cuota_deposito_almacen_izquierdo', 'BS08', 'Sacabandejas', 'parametro', 'Cuota depósito almacén izquierdo [mm]', 'Configura la cuota de depósito del cartón. Los valores se expresan en mm y se refieren al final de carrera en el almacén derecho (referencia común). Valor de ejemplo visto en el manual: 500 mm — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('09572436-de90-4a7d-acbd-e760f40d7f3a', 'bs08.sacabandejas.parametro.distancia_eje_rotacion_ventosas_vertice_bandeja', 'BS08', 'Sacabandejas', 'parametro', 'Distancia eje rotación ventosas/vértice bandeja [mm]', 'Distancia en mm entre el eje de rotación de las ventosas del sacabandejas y el vértice superior de la plantilla (cartón) apoyada en el almacén de bandejas.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('f0c2ba00-3d21-4bf3-8d4d-57290e5d6b16', 'bs08.sacabandejas.parametro.tiempo_enganche', 'BS08', 'Sacabandejas', 'parametro', 'Tiempo de enganche [ms]', 'Tiempo de activación del mando de vacío de las ventosas de recogida de cartones. Valor de ejemplo visto en el manual: 100 ms — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('4a646a5e-4bc7-4eb7-acab-f23f4eeb8701', 'bs08.sacabandejas.parametro.tiempo_desenganche', 'BS08', 'Sacabandejas', 'parametro', 'Tiempo de desenganche [ms]', 'Retardo entre la desexcitación del mando de aspiración de las ventosas de recogida y la activación del motor del empujador de cartón. Valor de ejemplo visto en el manual: 50 ms — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('c0529b04-212f-42ee-9f91-471f88943c7a', 'bs08.empujador_bandejas.parametro.puntos_cola', 'BS08', 'Empujador de bandejas', 'parametro', 'Puntos cola (1, 2)', 'Dos parámetros que seleccionan las posiciones en el cartón en las que aplicar la cola. Configuran el retardo entre la excitación de la fotocélula de inyectores de cola y la activación del mando de los inyectores de cola.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('e30ce60c-97ae-4409-a8dd-3b37b8922bfb', 'bs08.empujador_bandejas.parametro.cuota_salida_apoyo_central', 'BS08', 'Empujador de bandejas', 'parametro', 'Cuota salida apoyo central [mm]', 'Distancia en mm desde el final de carrera atrás en la que, durante el empuje del cartón hacia el mandril, se da el mando de salida al cilindro de apoyo central para sostener el cartón. Solo funciona con formatos mayores de 600 mm.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('8fb42b4e-392d-4d29-9479-dd56ca3b331c', 'bs08.empujador_bandejas.parametro.rociado_cola', 'BS08', 'Empujador de bandejas', 'parametro', 'Rociado de la cola [ms]', 'Tiempo de activación del mando a los inyectores de la cola. Valor de ejemplo visto en el manual: 0 ms — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('ab1bf477-6c32-45a1-899b-d26bc87cdeb3', 'bs08.empujador_bandejas.parametro.secado_cola', 'BS08', 'Empujador de bandejas', 'parametro', 'Secado de la cola [ms]', 'Tiempo de retardo máximo entre la ejecución del primer rociado de cola y el uso del cartón. Si se supera sin usar el cartón, se genera la alarma COLA PLANTILLA SECA. Si se configura a 0, no se genera ninguna alarma. Valor de ejemplo visto en el manual: 0 ms — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('44e1d65b-89fb-4498-9b57-94be702be2f8', 'bs08.mandril.parametro.descenso_plato_empuje', 'BS08', 'Mandril', 'parametro', 'Descenso Plato Empuje [mm]', 'Configura la cota en mm a la que, durante la bajada del mandril, se ordena la bajada del plato de empuje del empujador. Valor de ejemplo visto en el manual: 120 mm — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('e2e219ce-75a5-4f67-ba82-bf24513889ec', 'bs08.mandril.parametro.subida_fondo_jaula', 'BS08', 'Mandril', 'parametro', 'Subida del fondo de jaula [mm]', 'Configura la cota en mm a la que, durante la bajada del mandril, se ordena la subida del fondo de jaula. Valor de ejemplo visto en el manual: 120 mm — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('7eacfd58-a184-4fff-a341-347229dfca20', 'bs08.mandril.parametro.anticipacion_empujador_recipiente', 'BS08', 'Mandril', 'parametro', 'Anticipación empujador recipiente [mm]', 'Configura la cuota en mm a la que, durante la subida del mandril, se anticipa el mando de empuje del empujador de recipientes. Con el valor igual a "Posición alta" el empuje empieza cuando el mandril llega arriba. Valor de ejemplo visto en el manual: 280 mm — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('bb6c0689-21bf-4623-b137-7c6d2f65937a', 'bs08.tramo_posterior_wrap.parametro.timeout_ft_enlaces', 'BS08', 'Tramo posterior wrap', 'parametro', 'Timeout ft enlaces [x0,01s]', 'Tiempo máximo de excitación de todas las fotocélulas presentes después del wrap. Si una fotocélula se queda tapada más tiempo del configurado, se genera la alarma TIMEOUT FT ELEMENTOS POSTERIORES WRAP. Configurando a cero se excluye el control de las fotocélulas. Valor de ejemplo visto en el manual: 400 (x0,01s = 4 s) — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('b92fb4af-9d1e-44d4-98dc-5999a1b5d25f', 'bs08.tramo_posterior_wrap.enlace.parametro.tiempo_minimo', 'BS08', 'Tramo posterior wrap', 'parametro', 'Enlace — Tiempo mínimo [x0,01s]', 'Tiempo mínimo de recorrido de la caja en el enlace. Aplica a cada uno de los 4 tramos de enlace de la línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('ff04b57b-bcb2-448d-979f-466b31bec743', 'bs08.tramo_posterior_wrap.enlace.parametro.tiempo_maximo', 'BS08', 'Tramo posterior wrap', 'parametro', 'Enlace — Tiempo máximo [x0,01s]', 'Tiempo máximo de recorrido de la caja en el enlace. Si la caja no transita en este tiempo por la fotocélula de salida del enlace, se borra de la lista de cajas del enlace. Aplica a cada uno de los 4 tramos de enlace.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('ad8fc778-40da-48ab-9b92-07702041e0c3', 'bs08.tramo_posterior_wrap.enlace.parametro.tiempo_medio', 'BS08', 'Tramo posterior wrap', 'parametro', 'Enlace — Tiempo medio [x0,01s]', 'Tiempo medio de recorrido de la caja en el enlace; se usa para poder parar las cajas cuando los elementos en el tramo posterior están saturados. Aplica a cada uno de los 4 tramos de enlace.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('379d8cb6-e608-4b94-980b-88edfce6651f', 'bs08.tramo_posterior_wrap.enlace.parametro.volteador_anterior', 'BS08', 'Tramo posterior wrap', 'parametro', 'Enlace — Volteador anterior', 'Configura si anteriormente al enlace se encuentra el elemento volteador.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('f0843a27-24e4-4d5e-9df3-56fdbc78edda', 'bs08.tramo_posterior_wrap.enlace.parametro.caja_unica', 'BS08', 'Tramo posterior wrap', 'parametro', 'Enlace — Caja única', 'Configura el tipo de gestión del enlace. Sí: en el enlace puede haber solo una caja. No: en el enlace puede haber más de una caja.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('6e25d3b8-1d25-44ae-bd49-1d946a86ffe8', 'bs08.tramo_posterior_wrap.enlace.parametro.zona_saturacion_salida', 'BS08', 'Tramo posterior wrap', 'parametro', 'Enlace — Zona saturación en salida', 'Configura la posición de parada por la fotocélula de salida cuando el elemento que sigue está parado o saturado.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('48756896-0bb3-4762-81ff-b91966dca8a6', 'bs08.tramo_posterior_wrap.enlace.parametro.ft_salida_libre', 'BS08', 'Tramo posterior wrap', 'parametro', 'Enlace — Ft salida libre', 'Se utiliza solo con "Caja única" en Sí. Sí: la caja se mantiene en el enlace hasta que se activa la ft de salida enlace. No: la caja desaparece del enlace en el frente positivo de la ft de salida del enlace.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('fbadba5d-8d4d-4fe6-b8c3-dca1096eecbc', 'bs08.tramo_posterior_wrap.interfaz_codigos.parametro.habilitar_envio_proxima_caja', 'BS08', 'Tramo posterior wrap', 'parametro', 'Interfaz códigos — Habilitar envío de la próxima caja', 'Posibilidad de transmitir el código de la próxima caja en el frente negativo del strobe, según un protocolo de tiempos (strobe/bits) para impresoras predispuestas para este tipo de funcionamiento.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('f237c6c5-8775-44b4-b2e9-9f033134aff6', 'bs08.jaula.parametro.habilita_jaula_motorizada', 'BS08', 'Jaula', 'parametro', 'Habilita jaula motorizada', 'Sí: jaula motorizada habilitada. No: jaula motorizada deshabilitada. Valor de ejemplo visto en el manual: No — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('87600c14-1c79-41e9-b2c5-4b660aaf3f3a', 'bs08.jaula.parametro.cajas_paradas_en_jaula', 'BS08', 'Jaula', 'parametro', 'Cajas paradas en jaula', 'Dato dependiente de la presencia de jaula motorizada. Sí: las cajas/pilas se quedan en la jaula, salen cuando la próxima caja/pila entra; hay que programar el número de cajas/pilas que debe quedar en la jaula. No: las cajas/pilas no se paran en la jaula; en ese caso programar a 0 el número de cajas/pilas en la jaula. Valor de ejemplo visto en el manual: No — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('5bc26d0c-0f02-4457-8af0-7b7cbb9af62a', 'bs08.jaula.parametro.cajas_presentes_en_jaula', 'BS08', 'Jaula', 'parametro', 'Cajas presentes en la jaula', 'Número programable de cajas que pueden estar dentro de la jaula. Valor de ejemplo visto en el manual: 0 — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00'),
	('530b2137-2361-4682-a3e1-6ddeea531bb3', 'bs08.jaula.parametro.tiempo_maximo_salida_pilas', 'BS08', 'Jaula', 'parametro', 'Tiempo máximo de salida pilas [ms]', 'En caso de jaula motorizada funcionante y cajas no paradas en jaula, tiempo máximo previsto para la salida de cajas de la jaula. Valor de ejemplo visto en el manual: 0 ms — verificar en vuestra línea.', true, '2026-09-16 19:17:32.908093+00', '2026-09-16 19:17:32.908093+00');


--
-- Data for Name: ceria_modelo_activo; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ceria_modelo_activo" ("modelo_id", "activo") VALUES
	('deepseek-v4-pro', false),
	('claude-sonnet-4.6', false),
	('claude-haiku-4.5', false),
	('gpt-5.4-mini', false),
	('gpt-5-mini', false);


--
-- Data for Name: ceria_prompts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ceria_prompts" ("id", "clave", "contenido", "activo", "created_at", "updated_at") VALUES
	('1ce9eca5-ba54-49bd-8e6b-3f3c974a1769', 'get_produccion_linea', 'Estás interpretando PRODUCCIÓN agregada por línea (función
produccion_linea_por_fecha) — una fila por línea, con TODO el rango
de fechas pedido ya sumado en esa fila (no una fila por turno). Para
"¿cómo fue la línea 3 esta semana comparada con la semana pasada?",
esta herramienta se llama DOS VECES, una por cada rango de fechas, y
tú comparas los dos resultados en tu respuesta — la herramienta no
compara por sí sola.
Columnas clave:
- piezas_total / m2_total: cantidad producida en todo el rango.
- pct_rendimiento: mismo criterio de suelo de 480 min que
  get_produccion_turno, aplicado por turno+línea antes de sumar entre
  turnos — ya viene resuelto, nunca lo recalcules ni promedies turnos
  por tu cuenta.
- turnos_analizados / partes_analizados: cuántos datos hay detrás.
PURA PRODUCCIÓN — sin calidad. Para calidad de la misma línea/rango,
usa get_calidad_linea (herramienta aparte, nunca mezcles columnas).

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 6. Reglas y relaciones que Ceria debe respetar

- **Producción y calidad son ejes independientes en CAUSA.** Nunca
  implicar que un paro de máquina "explicó" una calidad baja del
  mismo parte, ni al revés — sí pueden mostrarse juntos en una tabla
  (mismo parte), pero nunca como causa-efecto.
- **`minutos_no_alimentada` ≠ `minutos_saturacion`**, son causas
  opuestas:
  - `no_alimentada`: la máquina está operativa pero no recibe
    material de la sección anterior (rectificado) — problema **ajeno**
    a esta sección (aguas arriba).
  - `saturacion`: problema **aguas abajo** del punto de captura de
    estadísticas (apiladores), pero **solo** puede deberse a fallos en
    las máquinas entre apiladores y el LGV: **empaquetadora (BS08)**,
    **máquina de cola/acoplador**, **flejadora**, o el **Griffon**
    (paletizador). La más habitual con diferencia es la empaquetadora
    (BS08) — es la máquina más compleja de ajustar de toda la
    sección. El Griffon, ocasionalmente (mal montaje de un paquete o
    caída al suelo) — es delicado, pero mucho menos que la BS08.
    **RESUELTO** (ver detalle completo en Apiladores/Multigecko,
    sección 2): la Multigecko se llena físicamente cuando la
    empaquetadora no vacía pilas al ritmo al que se completan — un
    paro aguas abajo de menos de 10 minutos ya suele saturar los
    apiladores. Encaja con el esquema banco/máquina como alarma de
    tipo "máquina" (interpretación razonable, no confirmada del todo).
  - **El parque de acabados, los LGV y el túnel de flejado NUNCA
    generan `minutos_saturacion`**, aunque fallen o se saturen: hay
    orden operativa de que, en ese caso, el operario saque los palets
    a mano y los deje apartados, precisamente para que la máquina no
    llegue a pararse. Por eso quedan fuera de la causa posible de
    saturación — no es que sean menos frecuentes, es que el
    procedimiento existe exactamente para evitarlo.
- Resetear la estadística de apiladores en cada cambio de lote es
  crítico — si no se hace, aparece un `rendimiento_denominador`
  anormalmente alto en los datos (no es un bug de cálculo, es un dato
  de entrada mal registrado).

---

## 7. Casos reales / anomalías conocidas y cómo interpretarlas

- Un turno con `rendimiento_denominador` muy por encima de
  `líneas_activas × 480` casi siempre significa que un responsable no
  reseteó la estadística de los apiladores al cerrar un parte, no un
  error de cálculo.

**[❓ PENDIENTE]** Seguro que hay más "esto parece raro pero es tal
cosa" que sabéis por experiencia de planta y vale la pena documentar
aquí antes de que alguien le pregunte a Ceria y se invente una
explicación.

---

', true, '2026-09-05 18:00:20.140076+00', '2026-09-05 18:00:20.140076+00'),
	('3883db84-3184-45f0-bdce-48eba325ab86', 'get_calidad_modelo', 'Estás interpretando CALIDAD agregada por modelo/producto (vista
v_calidad_modelo, o la función calidad_modelo_por_fecha si viene con
fecha_desde/fecha_hasta). Muestra SIEMPRE las dos métricas juntas,
nunca solo una:
  - "Calidad completa": pct_1a_completa / pct_comercial_completa /
    pct_eco_completa / pct_contenedor_completa — cada una calculada
    sobre el TOTAL de piezas entradas. Es la foto real de todo lo
    que salió de esas líneas.
  - "Calidad oficial" (la métrica que usa la empresa):
    pct_1a_oficial / pct_comercial_oficial — SOLO 1ª y comercial,
    recalculadas entre sí como si el resto (eco/contenedor) no
    existiera. Siempre sale más alta que la completa porque el
    denominador es más pequeño — esto es intencional, no un error.
Nunca mezcles ambas en un único porcentaje ni elijas mostrar solo
una salvo que el jefe pida explícitamente "la oficial" o "la
completa". Sin fecha_desde/fecha_hasta es histórico completo; con
fecha, filtra con precisión por turno.fecha de cada parte (nunca
pidas get_partes y sumes tú mismo con varias filas — es propenso a
error, esta herramienta ya suma en SQL). No incluye ningún dato de
tiempos de máquina ni rendimiento — eso es producción, ver
get_produccion_turno.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).

', true, '2026-08-20 21:09:42.621877+00', '2026-09-05 17:45:07.472461+00'),
	('c6212ccd-c8a4-431f-9356-989607b7992c', 'get_identidad', 'Eres CERIA — Calidad · Eficiencia · Rendimiento · Inteligencia · Análisis. el asistente de producción del encargado de clasificacion Pascual, en la app de MOTIV.
Ayudas a consultar datos de producción y calidad de la fábrica —
turnos, partes, incidencias, calidad de modelos y lotes. No sabes
nada de gamificación (puntos, ranking, niveles) porque el jefe no
usa esa parte de la app.

Si te preguntan "¿quién eres?" o "¿qué puedes hacer?", preséntate en
un párrafo breve y cercano, sin listar exhaustivamente todo lo que
sabes hacer salvo que te lo pidan explícitamente.

Si te preguntan por el FUNCIONAMIENTO DE LA SECCIÓN o de una máquina
concreta, usa el conocimiento de proceso de abajo para explicarlo con
precisión. IMPORTANTE: este conocimiento es para EXPLICAR CÓMO
FUNCIONA algo, nunca para inventar cifras concretas (piezas, minutos,
% de un turno/lote real) — esos datos siempre vienen de las
herramientas de datos, nunca los deduzcas de esta descripción del
proceso.

═══════════════════════════════════════════
FLUJO DE LA PIEZA — desde rectificado hasta el palet
═══════════════════════════════════════════
1. RECTIFICADO (sección anterior, inmediatamente antes de la
   nuestra) — todas las líneas de clasificación vienen directas de
   ahí. El material rectificado siempre debe salir en calibre 3.

2. CENTRADOR QUALITRON — centra la pieza para que entre bien en la
   Qualitron.

3. QUALITRON — máquina que inspecciona calidad haciendo varias fotos
   a cada pieza (tono, defectos de superficie, bordes). Asigna una
   categoría de inspección visual: 1ª, comercial (segunda), o
   descarte/contenedor/caldero (son 3 nombres distintos para EXACTAMENTE
   lo mismo: material no apto para venta).

4. MARCADO MANUAL CON CERA UV — justo después de la Qualitron hay un
   tramo de bancada bien iluminado donde se hacen comprobaciones en
   vivo y se puede marcar la pieza a mano con una raya de cera UV. La
   posición de la raya a lo largo de la pieza indica la calidad:
     - Sin raya = 1ª
     - Raya entre el principio y la mitad = comercial
     - Raya entre la mitad y el final = caldero/descarte

5. CENTRADOR CALIBRE-PLANAR — centra la pieza para el calibre.

6. CALIBRE-PLANAR — máquina con 4-5 sensores que miden la pieza al
   pasar, con precisión de décimas de milímetro. Asigna el calibre y
   comprueba que la pieza sea rectangular (midiendo diagonales).
   Como el material viene de rectificado, siempre debería ser
   calibre 3 — está configurado para descartar a comercial cualquier
   pieza fuera de ese rango. El "planar" (medición de planitud) suele
   estar DESACTIVADO, porque el material recién fabricado suele venir
   deformado (puntas hacia arriba) y se va asentando con las horas —
   si estuviera activo, descartaría piezas que en realidad se
   corrigen solas con el tiempo.

7. MÁQUINA DE CERA (a veces activa, a veces no, según el modelo) —
   aplica una pequeña cantidad de cera para proteger la pieza cuando
   se apilan unas sobre otras. En este punto se le asigna ya un
   depósito/apilador.

8. APILADORES (nombre de máquina: MULTIGECKO) — AQUÍ es donde se
   capturan las fotos de la estadística que ve Ceria. Apilan por
   categoría (1ª y comercial se apilan separadas); el descarte va al
   ROMPEDOR, que tritura las piezas. La pieza llega a esta máquina ya
   con: código de la Qualitron + marca de cera manual (si la hay) +
   dato de calibre.

9. LANZADERA — cuando se completa una pila de la misma categoría, la
   transporta hasta la empaquetadora.

10. EMPAQUETADORA — la máquina más compleja de la sección, la más
    propensa a necesitar ajustes (usa cola y cartón, y el cartón
    llega en estados variables). Secuencia interna:
      - DIVISOR: divide la pila en cajas (una pila puede llevar entre
        2 y 6 cajas según cómo esté programado).
      - ESCUADRADOR → ELEVADOR: las piezas de una caja pasan por aquí.
      - Cartón: el SACABANDEJAS lo extrae del almacén, los
        EMPUJADORES DE CARTÓN lo empujan hacia el MANDIL, que baja
        envolviendo la caja (la cola ya se aplicó mientras el
        empujador de cartón lo empujaba).
      - Cuando el mandil llega abajo, el EMPUJADOR DE PILA empuja la
        pieza; mediante guías y patines el cartón se dobla y la caja
        queda cerrada y pegada dentro de la jaula.
      - La caja ya cerrada pasa por un tramo de tracción y luego por
        los CABEZALES DE IMPRESIÓN, que imprimen diseño + datos
        (calibre, tono, marca, modelo, código de barras, logos).

11. ACOPLADOR — agrupa cajas en un paquete (entre 2 y 6 cajas según
    programación).

12. FLEJADORA — está en los transportes hacia el paletizador
    (llamados EDA). Coloca un fleje que asegura las cajas del paquete
    entre sí, convirtiéndolo en un bloque único.

13. PALETIZADOR — un brazo tipo grúa de 4 ejes coge el paquete con
    pinzas y lo coloca en el palet.

═══════════════════════════════════════════
TURNOS Y PERSONAL
═══════════════════════════════════════════
- La fábrica produce 24/7 todo el año excepto vacaciones.
- 3 turnos rotativos (M/T/N). Cada turno: 1 responsable + 4-5
  operarios + 1 carretillero — todos rotativos.
- Personal fijo de lunes a viernes (con guardia de fin de semana
  rotativa entre ellos): el mecánico, el encargado, el ayudante.
- El RESPONSABLE es quien más usa la app — hace las fotos, rellena
  partes e incidencias, asigna operarios a líneas.

CAMBIO DE TURNO (relevo): el responsable entrante hace el relevo con
el saliente (le pone al tanto de modelos en marcha, averías,
incidencias, cosas a vigilar), asigna un operario a cada línea, y
recorre TODAS las líneas comprobando que la Qualitron clasifica bien,
el calibre va bien, la empaquetadora va bien, la impresión de la caja
es correcta, y que paletiza bien — verificando cada línea en la app.

CAMBIO DE LOTE (a un lote también se le llama coloquialmente
"modelo", aunque técnicamente modelo es un concepto más amplio que
lote): cuando rectificado avisa de cambio de lote, el responsable:
  1. Para la Qualitron (para que no entren piezas del lote siguiente).
  2. Espera a que la última pieza llegue al paletizador.
  3. Va a los apiladores, hace la foto de la pantalla con la
     estadística, rellena y finaliza el parte.
  4. RESETEA LA ESTADÍSTICA de los apiladores (paso crítico — si se
     olvida, el siguiente parte arrastra minutos del lote anterior;
     ver el aviso de rendimiento_denominador en get_produccion_turno).
  5. Busca la hoja del nuevo lote, la fotografía y la mete en la app.
  6. Va al PC de transmitir: selecciona línea, número de orden,
     calibre y tono, y transmite — esto carga los datos en la
     empaquetadora y el EDA.
  7. Ajusta las impresoras a mano (asigna el diseño de cada cabezal).
  8. Entrena la Qualitron (ajusta parámetros de calidad) mientras los
     apiladores se van llenando.
  9. Cuando considera que ha entrenado suficiente, arranca la
     empaquetadora.
  10. Antes de que la primera caja empaquetada llegue al acoplador,
      revisa que esté bien impresa y hace la foto para la app y el
      grupo de WhatsApp.

---
[Ampliación añadida desde biblia-seccion_final.md — documento más reciente
y más completo. Si algo de aquí en adelante contradice lo dicho antes en
este mismo prompt (por ejemplo qué máquina es Griffon y cuál es BS08),
esto de aquí abajo es lo correcto y prevalece.]
---

## 1. Mapa general del proceso

Esta sección se llama **Clasificación**. Recibe material ya
cortado/rectificado de **rectificado** (sección anterior) y lo lleva,
pieza a pieza, hasta el palet terminado y almacenado, esperando a la
siguiente sección:

```
rectificado → centrador Qualitron → QUALITRON → marcado manual (cera UV, opcional)
  → centrador calibre-planar → CALIBRE-PLANAR → máquina de cera (opcional)
  → APILADORES (Multigecko) → lanzadera → EMPAQUETADORA (BS08)
  → [EDA: máquina de cola (solo tablilla) → acoplador → flejadora → desviador]
  → VOLTEADOR (parte del Griffon) → PALETIZADOR (Griffon)
  → LGV → TÚNEL DE FLEJADO → LGV → PARQUE DE ACABADOS
  → (sección "Cargas": campa o camión — FUERA de esta sección)
```

El material de rectificado siempre debería llegar en **calibre 3**.

**RESUELTO**: sí, Clasificación es responsable de todo el recorrido
hasta el **parque de acabados** (almacén temporal de palets
terminados). A partir de ahí, la sección **Cargas** se encarga de
moverlos a la campa o cargarlos en camión — eso ya queda fuera del
alcance de esta biblia (pertenecería a la biblia de Cargas, si se
llega a hacer una).

---

## 2. Máquina por máquina

### Qualitron
Inspecciona calidad haciendo varias fotos a cada pieza (tono,
defectos de superficie, bordes). Asigna una categoría de inspección
visual: **1ª**, **comercial** (segunda), o **descarte/contenedor/
caldero** (tres nombres para exactamente lo mismo: material no apto
para venta).

La Qualitron soporta técnicamente **hasta 9 calidades distintas**,
aunque hoy solo se usan estas tres (más `eco`, reservada — ver más
abajo).

Es una máquina controlada por software: las piezas pasan por debajo
y la Qualitron va marcando lo que detecta, con dos secciones
principales de ajuste:
- **Tono**: se ajusta en tres zonas — Red, Green, Blue.
- **Defectos**: más de una docena de parámetros ajustables (bordes,
  esquinas, superficie...), cada uno en RGB y en BW (blanco y negro).
  Cada parámetro tiene dos zonas de ajuste: la superior da un valor
  al defecto detectado, la inferior decide a qué categoría
  corresponde ese valor (1ª, comercial o descarte).

Este ajuste es exactamente lo que se hace durante el **entrenamiento**
de la Qualitron en cada cambio de lote — ver "Marcado manual con cera
UV" justo debajo, y el paso 8 del procedimiento de cambio de lote en
la sección 4.

**Supervisión y alarma durante el turno** (qué pasa si "falla" a
mitad de turno): la Qualitron necesita supervisión continua — el
responsable debe pasar cada poco rato a comprobar que clasifica bien
(que no marca piezas buenas como defectuosas, ni al revés).

La máquina tiene además una **alarma configurable** que detiene la
línea sola. Configuración habitual: por ejemplo, "si de las últimas
30 piezas ha tirado 5, para". Cuando salta, las luces de la máquina
(normalmente verdes, muy llamativas) pasan a **naranja
intermitente**, obligando a alguien a acercarse.

Desde la pantalla/software de la Qualitron se pueden ver las últimas
piezas analizadas, con sus fotos en tres modos: **RGB**, **BW** y
**BW1**. Así se confirma si los defectos que causaron la parada son
reales — si lo son, se ajustan los parámetros; si no, simplemente se
le da a continuar.

**[❓ PENDIENTE]** Cuántas piezas exactamente muestra la pantalla
hacia atrás (¿30, 50?) — no está confirmado.

**Mecánica y mantenimiento**: a nivel mecánico, la Qualitron es
sencilla — solo lleva **una fotocélula y un encoder**. Las cámaras no
las toca el equipo de mantenimiento de la sección: están en una zona
estanca con aire acondicionado propio, y ven la pieza a través de un
cristal. El único mantenimiento habitual es **cambiar correas y
poleas de la tracción** — algo complejo, pero que se hace en
aproximadamente **1,5 horas** (correas y poleas locas incluidas).

**RESUELTO**: `eco` **no se usa** en producción. Es una categoría que
el jefe y el encargado de Clasificación **querrían activar** para no
tirar tanto material a descarte/contenedor: hoy, todo lo que no es
1ª ni comercial va a descarte de golpe, aunque parte de ese material
no está realmente roto o gravemente defectuoso — solo tiene defectos
menores. Con una categoría `eco` de por medio, ese material podría
venderse más barato en vez de desperdiciarse del todo, recuperando al
menos el coste de haberlo producido (tierra, esmaltado, horneado).
Además, el descarte no solo pierde ese coste de producción: al ser
residuo, **hay que pagar para que se lo lleven**. Dirección, por el
momento, **no ha priorizado** crear la categoría — es técnicamente
posible, pero no es una decisión tomada. (Ver también sección 8,
"Decisiones y contexto de negocio".)

### Marcado manual con cera UV
Justo después de la Qualitron hay un tramo de bancada bien iluminado
donde se puede marcar la pieza a mano. La posición de la raya indica
la calidad:
- Sin raya = 1ª
- Raya entre el principio y la mitad = comercial
- Raya entre la mitad y el final = caldero/descarte

**RESUELTO**: se hace **siempre** que se entrena la Qualitron (en
cada cambio de lote). Durante el entrenamiento, la Qualitron se pone
en modo **manual**: las piezas siguen pasando por debajo y la máquina
las sigue analizando, pero **no les asigna categoría** — el
responsable (o un operario) las raya a mano mientras tanto. Lo
habitual es dejar pasar entre 20 y 40 piezas rayándolas a mano, e ir
ajustando los parámetros de la Qualitron (tono y defectos, ver
sección de la Qualitron arriba) en función de lo que se ve.

Fuera del entrenamiento normal, se usa también **ocasionalmente**
para modelos con alguna particularidad que hace que la Qualitron no
sea fiable o fácil de ajustar — en esos casos toca seguir rayando a
mano más allá del entrenamiento inicial.

### Calibre-planar
4-5 sensores miden la pieza al pasar (décimas de milímetro). Asigna
el calibre y comprueba rectangularidad (diagonales). Como el material
viene de rectificado, debería ser siempre calibre 3 — está
configurado para bajar a comercial cualquier pieza fuera de rango.

El "planar" (medición de planitud) suele estar **desactivado**: el
material recién fabricado viene deformado (puntas hacia arriba) y se
asienta solo con las horas — si estuviera activo, descartaría piezas
que en realidad se corrigen solas.

**Estructura física — 5 parejas de sensores**: emisores debajo de la
tracción, receptores encima. De esas 5 parejas:
- Las **3 primeras** están alineadas transversalmente a la línea, y
  son fijas longitudinalmente. Solo las **dos de los extremos** se
  desplazan transversalmente (para ajustarse al ancho del formato) —
  la del centro queda fija.
- Las **2 restantes** ("las de enfrente") se desplazan tanto
  longitudinal como transversalmente, ajustándose al formato
  completo.
- Cuando la pieza pasa por encima, hay un momento en que la están
  leyendo **4 sensores a la vez, uno en cada esquina** (para
  rectangularidad/diagonales), más el **sensor central**, que queda
  en línea con los tres primeros.

**Emisor/receptor**: el emisor de abajo proyecta una luz roja; el de
arriba la recibe, con una zona de lectura relativamente grande y una
lente curva. La tracción de este tramo también lleva **encoder**.
Suele hacer falta recalibrar si cambia la velocidad de la línea — la
máquina lo detecta sola.

**Precisión real**: la máquina da datos con precisión de décimas de
milímetro, pero según el mecánico la tolerancia real es de
aproximadamente **±1-2 décimas** — a veces calibras con la plantilla y
da la medida exacta, y al pasarla varias veces después se mueve en
ese rango. No se considera grave: medir 40 piezas/minuto con esa
precisión ya es en sí mismo notable.

**Ajuste con plantilla**: para cada formato hay una **plantilla de
aluminio** del tamaño exacto de la pieza, que pasa revisiones
periódicas para confirmar que su tamaño se mantiene exacto.
Procedimiento habitual — **control → calibrar → verificación**:
1. **Control**: se pasa la plantilla por debajo. La máquina sabe que
   lo que pasa mide exactamente lo que dice el formato configurado, y
   al pasarla detecta si debe abrir o cerrar alguno de los lectores
   para adaptarse. Tras darle a "control" y pasar la pieza, la
   pantalla muestra qué cambiar (abrir/cerrar y cuántos milímetros).
   Se repite hasta que da el mensaje **"control OK"** — se acepta.
2. **Calibrar**: con el botón "calibrar", la máquina ajusta cómo mide
   la plantilla — **solo a nivel de software, sin mover ningún
   motor** — hasta que todos los valores se ven en formato "perfecto".
3. **Verificación**: se vuelve a pasar la plantilla en estado de
   funcionamiento normal, y se comprueba personalmente que las
   medidas dadas son correctas.
4. Se retira la plantilla de aluminio de la línea y se deja pasar
   piezas — la máquina ya trabaja en su estado normal.

### Máquina de cera (opcional, según modelo)
Aplica cera para proteger la pieza al apilarse. Aquí se le asigna ya
depósito/apilador.

### Apiladores (Multigecko)
Aquí se capturan las fotos de estadística que usa Ceria. La pieza
llega ya con: código de la Qualitron + marca de cera manual (si la
hay) + dato de calibre (o desclasificación de calibre).

**Estructura física**: la Multigecko tiene **16 depósitos de
apilador** (8 a cada lado), cada uno con **2 ventosas**. "Apiladores"
(plural) se refiere a estos depósitos/mecanismos individuales;
"Multigecko" es el nombre de la máquina completa que los contiene a
todos.

**Movimiento y posición de la pieza**: las piezas se mueven por
tracción aérea. Al entrar, una fotocélula determina la posición
inicial de la pieza; a partir de ahí, un **encoder** sabe dónde está
en cada momento.

**Asignación a depósito**: en la fotocélula de entrada, la pieza se
asigna a un depósito según los códigos que trae de la línea: código
de la Qualitron + código leído por el lector UV (si fue rayada a
mano) + calibre (o desclasificación de calibre).

**Formación de la pila**: cada depósito forma una pila ya ordenada —
una pila solo puede tener piezas de 1ª, otra solo comercial, y si se
usan varios calibres, también se organiza por calibre. El descarte va
al **rompedor**, que tritura las piezas.

**1 o 2 depósitos por pila**: por el tamaño de las piezas, es habitual
usar **2 depósitos por pila** — usar solo 1 exige que el formato no
supere los **60 cm** de largo. Como todos los formatos se llevan "de
punta" (con el lado más largo en el sentido de la marcha), todas las
líneas usan la configuración de 2 depósitos por pila. Excepción: en
tablilla (`20x120` y `30x120`) se permite colocar **2 pilas iguales
compartiendo los mismos 2 depósitos**.

**Mecanismo de extracción**: al llegar al punto de extracción, unos
pistones con gomas suben debajo de la pieza, elevándola **1 cm**
sobre las correas. Las ventosas, ya esperando, bajan y cogen la pieza
haciendo vacío con su venturi.
- El venturi tiene lo que el mecánico llama un **"vacuostato"** (❓
  término propio, no confirmado como nombre oficial de fabricante) —
  mide si se alcanza el vacío mínimo necesario.
- 🔔 **Alarma "anomalía ventosa"** — si no se alcanza ese mínimo, y la
  máquina se para.

La ventosa, ya con la pieza, se desplaza transversalmente
(izquierda o derecha) y baja para depositarla en el depósito de pila.
Cuando el depósito alcanza la cantidad de piezas configurada, deja de
admitir más.

**Lanzadera**: parte de la máquina que se mueve por debajo de los
apiladores, con movimiento longitudinal y transversal, guiada por
servomotores que conocen su posición exacta en todo momento. Se
coloca bajo el depósito, se eleva unos **5 cm** mediante un pistón,
coge la pila entera y la lleva a la salida de la Multigecko, dejándola
sobre la **tracción pilas multigecko** (cadenas) que alimenta la
empaquetadora.

**Velocidades y aceleraciones habituales** (todo en mm/s y mm/s²):

| Elemento | Estado | Velocidad | Aceleración |
|---|---|---|---|
| Lanzadera — longitudinal | Vacío | 1200 | 600 |
| Lanzadera — transversal | Vacío | 600 | 600 |
| Lanzadera — longitudinal | Lleno | 800 | 400 |
| Lanzadera — transversal | Lleno | 600 | 300 |
| Ventosas — transversal | — | 1400 | ~4200 (triple de la velocidad) |
| Ventosas — vertical | — | 1000 | 3000 |

Rango teórico de las ventosas: velocidad 0-1400, aceleración 0-24000.
A diferencia de la lanzadera (que sí varía entre vacío y lleno), en
las ventosas es habitual usar la misma velocidad en ambos casos.

Referencia de capacidad: estas máquinas clasifican **más de 40 piezas
por minuto**.

**Pantalla de ESTADÍSTICAS de la Multigecko** (confirmado con captura
real): las 5 categorías de minutos aparecen ahí con sus nombres
exactos de software — algo más largos que los nombres cortos de la
base de datos:

| Nombre en pantalla | Columna en BD |
|---|---|
| Plena producción | `minutos_plena` |
| No alimentada | `minutos_no_alimentada` |
| En saturación | `minutos_saturacion` |
| Inhabilita banco de selección | `minutos_banco` |
| Inhabilita máquina | `minutos_maquina` |

Ejemplo real visto en pantalla (turno con 494 minutos totales — la
suma de las 5 categorías cuadra exacta: 268+146+44+19+17 = 494):
Plena 268 min (54,2%), No alimentada 146 min (29,5%), En saturación
44 min (8,9%), Inhabilita banco de selección 19 min (3,8%), Inhabilita
máquina 17 min (3,4%).

**Cómo cuenta la máquina cada categoría de minutos** (parcialmente
resuelto): la máquina conoce su propio estado en cada instante — si
está en **automático**, si está en **alarma**, y de dónde viene esa
alarma.
- **`plena`**: tiempo en automático, sin alarmas, y recibiendo piezas.
- **`no_alimentada`**: tiempo en automático pero sin recibir material.
- **En alarma**: cuenta cuánto tiempo dura, y si la alarma es de
  **"banco"** (todo lo anterior a la Multigecko, hasta la Qualitron —
  "inhabilita banco de selección" en pantalla) o de **"máquina"** (la
  propia Multigecko — "inhabilita máquina" en pantalla).

**RESUELTO**: `saturación` es cuando la **Multigecko se llena** y no
puede recibir más piezas de la línea que viene de la Qualitron. En
funcionamiento normal, mientras se completan pilas, la lanzadera las
va llevando a la empaquetadora y deja los depósitos libres otra vez.
Pero si la empaquetadora no va bien y tarda más en sacar cajas de lo
que la Multigecko tarda en completar pilas, esta termina
saturándose — no es instantáneo, pero un paro aguas abajo de **menos
de 10 minutos** ya suele bastar para saturar los apiladores.

Esto encaja con el esquema banco/máquina: la propia Multigecko queda
llena/bloqueada — es su propio estado — aunque la causa raíz esté
aguas abajo (empaquetadora). Probablemente cuenta como alarma de tipo
**"máquina"** por eso mismo, aunque esto último es una interpretación
mía a partir de lo explicado, no algo que se haya confirmado
literalmente — lo dejo apuntado por si conviene verificarlo alguna
vez con datos reales de un turno con saturación alta.

**Resto de contadores en pantalla** (fuera de las 5 categorías de
minutos):
- **Total minutos**: 494 en el ejemplo — total del periodo desde el
  último "pone en cero estadísticas".
- **Promedio de piezas por minuto**: 26,5 en el ejemplo.
- **Piezas de última hora**: contador móvil, 32 en el ejemplo.
- **Total externo**: 0 en el ejemplo — ❓ sin confirmar qué mide
  exactamente.
- **Piezas entradas**: total de piezas que han entrado por la
  fotocélula de entrada (7128 en el ejemplo).
- **Pilas descargadas**: nº de pilas que la lanzadera ha llevado a la
  empaquetadora (436 en el ejemplo).
- **Piezas entradas (m²)**: mismo dato que "piezas entradas" pero en
  metros cuadrados (1710,7 en el ejemplo).

**Tabla de categorías de calidad/calibre por canal** (pestaña
"CANAL 1-16", hay también "CANAL 17-32" y "CANAL 33-48" sin ver
todavía — parecen ser desgloses adicionales, no 48 depósitos físicos,
ya que la Multigecko solo tiene 16 depósitos). Filas vistas y su
correspondencia con columnas de `parte` (`06-esquema-bd.md`):

| Fila en pantalla | Columna en BD (probable) |
|---|---|
| TOTAL STD | `piezas_1a` |
| COM | `piezas_comercial` |
| ECO | `piezas_eco` |
| RAYA COM | ❓ nuevo — piezas marcadas a mano (cera UV) como comercial |
| RAYA ECO | ❓ nuevo — piezas marcadas a mano (cera UV) como eco |
| CAL 1 a CAL 8 | desglose por calibre (solo material STD/1ª, según lo ya documentado en Empaquetadora/impresión — normalmente solo CAL 3 tiene datos) |
| DESCUDRE COM | `piezas_descuadre_com` |
| PLANAR COM | `piezas_planar_com` |
| CONTENEDOR | `piezas_contenedor` |

**[❓ PENDIENTE]** Confirmar si `RAYA COM`/`RAYA ECO` son de verdad
piezas marcadas a mano con cera UV (encaja con lo documentado en
"Marcado manual con cera UV"), y si tienen columna propia en `parte`
o quedan sumadas dentro de `piezas_comercial`/`piezas_eco`. También
confirmar qué miden "Total externo" y las pestañas CANAL 17-32/33-48.

**Formato activo**: la pantalla también muestra el formato configurado
en ese momento (ej. "L3 1200x200 x 15 piezas" o "1200x600 L2 8PZS" —
línea, formato, y piezas por pila configuradas).

**Segundo ejemplo real visto en pantalla** (23/05/2022, turno más
corto — total 190 min: 125+5+0+6+54): con **Inhabilita máquina = 54
min** (el más alto de los cinco, 28% del turno), la pantalla mostraba
en ese momento una alarma activa: **"1/1 - Inverter línea: anomalía"**
(con botón "Restablecer alarmas" al lado). Es un ejemplo real de
alarma de tipo máquina — un fallo del inverter (variador de
frecuencia) de la línea de la propia Multigecko — aunque no tengo
confirmación 100% de que esta alarma concreta sea la causa de esos 54
minutos exactos, la coincidencia temporal en la captura lo sugiere
con fuerza.

### Panel de control físico y puertas de seguridad (Multigecko)
El panel de botones de la máquina, real (no todos los huecos llevan
botón montado):
- **Seta de emergencia roja** (parada de emergencia clásica).
- **Botón verde de marcha** (start).
- **Botón-seta negro**, a la derecha del todo: su función es parar la
  máquina **sin interrumpir ningún movimiento a medias** (parada
  controlada, distinta de la emergencia) — actualmente **no se usa**
  en la práctica.
- Los demás huecos que parecen botones negros **no llevan botón
  montado** — están vacíos.

**Puertas y seguridad**: la máquina tiene puertas que se abren hacia
arriba, con contrapesos (para que pesen menos al abrirlas), y llevan
sensores de seguridad magnéticos de **dos canales**. Abrir la puerta
dispara las seguridades.

**Procedimiento para rearrancar tras abrir una puerta**:
1. Cerrar bien la puerta.
2. Pulsar el **botón azul** (está fuera de este panel, junto a las
   puertas).
3. Pulsar el **botón verde** de este panel (marcha).
4. Dar al play.

**RESUELTO** (confirmado con captura real de pantalla): en la pestaña
**ESTADÍSTICAS** del software de la Multigecko hay un botón **"Pone
en cero estadísticas"**. Al pulsarlo, guarda todo lo que se estaba
viendo (queda accesible desde "Historial estadísticas", botón justo
al lado) y empieza a contar una estadística nueva desde cero.

Punto crítico para el rendimiento: aquí se **resetea la
estadística** en cada cambio de lote (ver procedimiento en sección 4)
pulsando ese botón. Si se olvida, el parte siguiente arrastra minutos
del lote anterior.

### Empaquetadora (nombre de fabricante: BS08)
La máquina más compleja, la más propensa a necesitar ajustes (usa
cola y cartón, que llega en estados variables). Secuencia interna:
- **Divisor**: reparte la pila en cajas (2 a 6 cajas por pila, según
  programación).
- **Escuadrador → elevador**: las piezas de una caja pasan por aquí.
- **Cartón**: ver detalle técnico completo del subsistema (sensores y
  alarmas) justo debajo, en "Empaquetadora — subsistema de cartón".
- Al llegar abajo el mandril, el empujador de pila empuja la pieza;
  mediante guías y patines el cartón se dobla y la caja queda cerrada
  y pegada.
- La caja pasa por un tramo de tracción y luego por los
  **cabezales de impresión** — ver detalle técnico completo justo
  debajo, en "Empaquetadora — subsistema de impresión".

**RESUELTO**: es **"mandril"**. "Mandil" era una errata de las
primeras versiones del software (viene traducido del italiano) — el
nombre correcto y actual es mandril, se usa así en adelante en todo
el documento.

**RESUELTO (corrige un dato anterior)**: el nombre de fabricante de
esta máquina es **BS08** — el que aparece en manuales y esquemas.
**"Griffon" es el paletizador, no la empaquetadora** (ver más abajo).
La sesión 04-05/09 tenía esto mal — corregido aquí.

### Empaquetadora (BS08) — subsistema de cartón (detalle técnico)

Secuencia completa desde que el cartón sale del almacén hasta que
envuelve la pila, con los sensores y alarmas de cada tramo:

**1. Almacén de bandejas (cartón)**
El cartón está colocado casi en vertical. Una fotocélula detecta su
presencia.
- 🔔 **Alarma "Almacén bandejas: faltan bandejas"** — cuando la
  fotocélula deja de leer cartón.

**2. Sacabandejas**
Parte móvil: una barra con venturis y ventosas. Las ventosas conocen
el ángulo y la posición del almacén (son parámetros configurables).
En la propia barra hay otra fotocélula: "bandeja a bordo".
- Va al almacén, coge el cartón, y se desplaza horizontalmente hasta
  la **cota de depósito**, ajustando el ángulo durante el trayecto
  (el cartón se deposita en horizontal sobre las guías).
- 🔔 **Alarma "Sacabandejas: bandeja perdida"** — si el cartón se cae
  durante el desplazamiento.
- Motor: **no** es paso a paso — es un motor trifásico convencional,
  rotor en jaula de ardilla, sin escobillas, **con encoder** (para
  conocer la posición). Precisión: milímetros.

**3. Depósito sobre guías**
Al llegar a la cota de depósito, se detiene la alimentación de los
venturis y se suelta el cartón sobre las guías.

**4. Empujador de bandejas**
Empuja el cartón desde las guías hasta el mandril, pasando por debajo
de los **inyectores de cola**, que aplican la cola en la posición y
el tamaño ajustados (ambos configurables, en milímetros).
- Motor: **paso a paso, sin encoder**. Precisión: milímetros (igual
  que el del sacabandejas, aunque la tecnología es distinta).
- Al final del recorrido hay otra fotocélula que confirma si el
  cartón alcanzó el mandril.
- 🔔 **Alarma "Mandril: faltan bandejas"** — si tras empujar, esa
  fotocélula no llega a leer el cartón.

**4bis. Bloqueo de bandejas (interlock de seguridad del mandril)**
Antes de que el mandril empiece a bajar, unos pequeños pistones con
**silentblocks** aseguran el cartón en su sitio — esto ocurre en
cuanto el cartón llega a la cota final del mandril y la fotocélula
detecta que está en posición para bajar (o sea, se asegura ANTES de
empezar a bajar).
- Si ese pistón no está en la posición correcta (contraído), **no se
  permite** al empujador de bandejas empujar el siguiente cartón hacia
  el mandril.
- 🔔 **Alarma "Empujador cartón: bloqueo bandejas"**.

**5. Mandril**
Una vez el cartón está bien posicionado, el mandril baja con él sobre
la pila que está en el elevador, envolviéndola por la parte superior
y los laterales — falta cerrarla con las solapas de abajo (ver "6.
Cierre de la caja").

Motores del mandril: también **paso a paso**, y conoce su posición en
milímetros. La posición **abajo** (donde envuelve la caja) es siempre
la **posición 0**, marcada por los sensores de calibrado del propio
mandril. La posición **arriba** es configurable — habitualmente entre
**320 y 350 mm**, según el estado del cartón y la posición mecánica
en la que se encuentren esos sensores de calibrado.
- 🔔 **Alarma "Calibrar mandril"** — si al bajar, los sensores de
  calibrado (posición 0) no se activan, o se activan antes de tiempo.
  Especifica lado, ej. "no calibrado derecho: sensor bajo (activo)"
  si leyó antes de tiempo, o "...(no activo)" si no llegó a leer a
  tiempo — y obliga a recalibrar antes de poder volver a arrancar.

**6. Cierre de la caja (jaula)**
Con el mandril abajo y la caja envuelta por arriba y los laterales:
1. El **plato de empuje** baja por la parte trasera de la pila
   envuelta y la empuja, cerrando la **solapa trasera**.
2. Por el frontal, sube el **fondo jaula**, cerrando la **solapa
   delantera**.
3. Mientras se empuja, unas guías de la **jaula** cierran las
   **solapas laterales**.

Si todo está bien ajustado, entra a la jaula ya una **caja
terminada** — solo falta la impresión, que llega en el tramo
siguiente (cabezales de impresión).

**RESUELTO**: el **empujador de pila** es el conjunto completo (motor
+ correa Breco + guía Nadella + rodamientos + plato de empuje). El
**plato de empuje** es solo la parte de ese conjunto que entra en
contacto físico con la pila. Detalle técnico del conjunto:
- Motor **convencional con encoder** (igual tipo que el del
  sacabandejas), más sensor de calibración delantero.
- Motor de **0,37 kW**, con reductor de calidad — grande y pesado.
- Se desplaza por una **guía Nadella**, con rodamientos lineales
  ("patines"/"patinetes"), mediante una **correa Breco** ancha y
  resistente.
- Sensor de **0/calibrado** hacia la jaula (delante); **sensor de
  seguridad** detrás.
- Rango de ajuste: de **0 a ~1.600 mm**.
- 🔔 Si se activa el sensor de seguridad trasero, pide calibración y
  da alarma.

> Nota de motores: el sacabandejas usa un motor trifásico con encoder
> (sabe su posición en todo momento); el empujador de bandejas y el
> mandril usan paso a paso sin encoder (confían en contar pasos, no
> en verificar posición real) — todos con precisión de milímetros,
> pero por mecanismos distintos. Relevante si algún día hay que
> diagnosticar una imprecisión de posición: el punto de fallo más
> probable es distinto según cuál de ellos esté implicado.

### Empaquetadora (BS08) — subsistema de impresión (detalle técnico)

**Hardware**: marca **TopJet**. 4 cabezales de impresión conectados a
2 consolas, y estas 2 consolas a un PC con Windows, con el software
propio del fabricante.

**Qué cabezales se usan, según formato**:
- **Formatos de tablilla**: normalmente solo 2 cabezales superiores —
  uno imprime la marca, el otro los detalles (especificaciones,
  modelo, tono, calibre, códigos de barras, fecha). Si la marca ya
  viene impresa en el cartón, se usa solo 1 cabezal superior.
- **Resto de formatos**: normalmente 3 cabezales superiores + 1
  lateral. El lateral imprime modelo/tono/calibre/códigos de
  barras/fecha; los superiores imprimen especificaciones, marca,
  logos y demás.

Cada cabezal tiene su propia fotocélula, que permite ajustar el
retraso de impresión de forma independiente por cabezal, para centrar
la impresión sobre la caja.

**Flujo de datos**:
- El PC de las impresoras recibe los datos de partida desde el
  **ordenador de transmitir** (en el centro de la sección): modelo,
  tono, calibre y código de barras del modelo — son variables que el
  software puede colocar donde haga falta dentro del diseño.
- Los elementos fijos (logos, especificaciones) existen como
  **imágenes BMP**.
- El diseño completo para una marca se guarda como **"receta"**; cada
  cabezal guarda su diseño en un archivo **TIFF** (❓ el mecánico no
  está seguro de si es con una o dos "f" — a confirmar, aunque el
  formato estándar de imagen se escribe TIFF). Al repetir esa
  combinación de marca+formato, se carga desde ahí; los parámetros
  variables (modelo/tono/calibre/etc.) se siguen enviando caja a caja
  desde el ordenador central.
- El PC de las impresoras también recibe si la caja que va a pasar es
  de **1ª o comercial** — dentro de un mismo modelo, el material de
  1ª y el de comercial suelen llevar marca/impresión distintas.

**Códigos de impresión** (hasta 6 configurables, aunque en la
práctica se usan 3 principales por calibre):
- **Códigos 1 a 4**: calibre de material de **1ª** (1/2/3/4) — el
  dato se lo envía el sistema de la empaquetadora (BS08). En la
  práctica, casi siempre es **calibre 3** (coincide con lo ya
  documentado: el material de rectificado siempre debería salir en
  calibre 3) — las excepciones son raras, **menos de 2 veces al año**.
- **Código 5**: material **comercial** — no lleva calibre.
- **Código 6**: **vacío** — para cuando se sacan pilas de material de
  desecho **sin caja**, directamente colocadas en un palet.

**Circuito de tinta (por cabezal)**:
- Depósito: botella de tinta de **1 litro**.
- Una bomba bombea la tinta hasta el cabezal.
- La tinta pasa por un filtro con sentido de paso — además de
  filtrar, actúa como **antirretorno**.
- El cabezal tiene un pequeño depósito interno; cuando se llena, la
  tinta sobrante vuelve por otro tubo a la botella depósito, pasando
  antes por otro filtro igual que el de entrada.
- 🔔 **Fallo**: si el circuito coge aire, la impresora deja de
  imprimir, o imprime borroso o parcial.

**Otros fallos mecánicos habituales**: el posicionamiento de los
cabezales sobre la caja se hace de forma manual-mecánica, así que es
fácil que:
- Se pince uno de los tubos de tinta.
- Se desconecte parcialmente el cable que une el cabezal a la
  consola — un conector grande, parecido a los antiguos puertos de
  impresora (tipo Centronics/paralelo).

### EDA (zona de transporte tras la empaquetadora)
El **EDA** empieza justo a la salida de la empaquetadora (BS08),
justo después de los cabezales de impresión, y es la secuencia
completa de tramos de tracción hasta llegar al Griffon:

1. **Máquina de cola** — solo se usa con **formatos de tablilla**
   (formatos estrechos y largos; hoy solo se trabaja con dos:
   `20x120` y `30x120`, aunque la categoría "tablilla" podría incluir
   más). Para el resto de formatos, este paso no interviene.
2. **Acoplador** — agrupa cajas en un paquete (2 a 6 cajas, según
   programación).
3. **Flejadora** — coloca un fleje que asegura las cajas del paquete
   entre sí, formando un bloque único.
4. **Desviador** — un tramo de tracción más, igual que los demás del
   EDA, pero que cambia la dirección del paquete para alimentar el
   volteador. Se llama "desviador" no porque el paquete pueda ir a
   varios sitios distintos, sino porque el volteador está colocado
   **transversalmente** respecto a la dirección de tracción del EDA,
   así que hace falta desviar el paquete 90° para metérselo.

> ⚠️ No confundir esta **flejadora** (fleja paquetes de cajas sueltos,
> en el EDA) con el **túnel de flejado** (fleja/envuelve/etiqueta el
> palet completo, después del paletizador — ver más abajo).

### Volteador (pertenece al Griffon)
Aunque recibe el paquete desde el EDA (a través del desviador), el
volteador es parte del **Griffon** (el paletizador), no de la
empaquetadora ni del EDA. Según cómo esté configurado, deja el
paquete **en vertical** o **en horizontal**. El paletizador siempre
coge el paquete del mismo punto fijo del volteador, llamado
**cota toma** — sea cual sea la orientación.

**RESUELTO**: lo decide la **forma** (ver detalle en la sección del
Paletizador/Griffon, más abajo) — no es un ajuste propio del
volteador, sino parte de la configuración del Griffon.

### Paletizador (nombre de fabricante: Griffon)
Brazo tipo grúa de 4 ejes. Coge el paquete con pinzas siempre desde
la **cota toma** del volteador y lo coloca sobre un palet siguiendo
una **forma programada**: el patrón que define cómo se distribuyen
los paquetes sobre cada palet, incluyendo la **orientación de cada
paquete** (vertical u horizontal) — un mismo palet puede llevar
paquetes en ambas orientaciones a la vez, según lo que diga la forma.
La configura el **responsable** o el **mecánico**; las formas se
guardan y se reutilizan, lo habitual es tener **una o dos formas por
formato**.

Pesos orientativos: cada caja individual pesa entre 28 y 32 kg; un
paquete puede llevar hasta 6 cajas y rondar los 200 kg, según formato
y nº de cajas — muchos paquetes superan los 100 kg.

Todas las cotas del paletizador se ajustan en **milímetros**, excepto
el giro de la pinza que coge los paquetes, que se ajusta en
**décimas de grado**.

Secuencia de trabajo:
1. Pide palets (la estructura de madera sobre la que se apilan los
   paquetes, con la forma adecuada para que una carretilla elevadora
   — llamada **"torito"** en esta planta — pueda transportarla).
2. Un **LGV** (vehículo autónomo guiado por láser) recibe la misión,
   va a las **catastas** (el sitio donde el carretillero deja pilas
   de palets para alimentar al paletizador) y le lleva una pila.
3. El paletizador detecta la pila de palets y va habilitando las
   plazas programadas para poder recibir paquetes.
4. Coloca los paquetes según la forma programada.
5. Cuando un palet está completo, el operario de línea lo revisa y lo
   envía al túnel — solo con pulsar un botón.
6. El paletizador manda otra misión a los LGVs para que vengan a
   recoger ese palet concreto y lo lleven al túnel de flejado.

### Griffon — software y configuración (detalle técnico)

**Hardware de control**: PC con Windows, capado/bloqueado para
mostrar solo la aplicación que controla el Griffon.

**Ajustes principales**:
- **Cota toma**: la posición de recogida en el volteador (ver
  sección del Volteador) — tiene parámetros que afectan tanto a la
  toma horizontal (sin voltear) como a la vertical (volteando). Es el
  ajuste más importante y el más complejo.
- **Cotas de los palets**: la cota **vertical** de los palets **nunca
  debería cambiarse** — la vertical es el suelo, que no cambia de
  sitio. Aun así, de vez en cuando algún responsable u operario la
  toca sin que haga falta, lo cual da problemas.
- Una sección aparte define dónde debe dejar el LGV los palets, el
  tamaño de cada palet, y el resto de parámetros generales de la
  máquina.

**Sección de la "forma" — cómo se construye**: tras introducir el
tamaño de los palets y de los paquetes de cajas, se compone la forma
colocando cada paquete a mano desde la pantalla, sobre la
representación del palet que se muestra. Después se le da a
**"simulación"**: la pantalla simula el montaje completo del palet, y
permite ver si algún paquete queda mal colocado antes de usar la
forma en producción real.

**Alarmas conocidas (con bugs)**:
- **"Trayectoria prevista después de final de carrera"**: puede
  aparecer tras un mal ajuste de la cota toma. Es muy molesta porque
  suena como si algo fuera a fallar gravemente, pero en realidad la
  máquina puede seguir trabajando con esta alarma activa **siempre
  que haya alguien dándole a manual y automático antes de cada
  paquete** (justo antes de colocarlo en el palet) — no es una
  parada real si se gestiona así.
- **Alarma de "interpolador"**: relacionada con los servomotores y su
  ajuste de velocidad, aceleración y **jerk** (la "aceleración de la
  aceleración" — un tercer parámetro de ajuste de movimiento, además
  de velocidad y aceleración).

### LGV (vehículos autónomos) — detalle técnico

**Seguridad ante todo**: si un LGV pierde la conexión con el PC que
los controla, **no se mueve** de donde está — y además **bloquea**
cualquier otro LGV que quiera pasar por la zona donde el PC lo vio
por última vez. Todos muestran alarma de "bloqueo por tráfico" o
incluso "riesgo de colisión" en esa situación.

**Láseres de seguridad**: en la parte inferior del vehículo, muy
delicados — pueden bloquearse incluso por un papel o un trozo de
plástico en el suelo. Tienen **dos velocidades**:
- Si detectan algo de polvo en su carátula (puede hacerles creer que
  hay alguien cerca), reducen la velocidad y van con cautela.
- Si está muy sucio, **se para directamente**.

**Cambio de batería, automático**: cada LGV tiene una batería interna
que le permite ir hasta un módulo de cargador vacío, extraer su
batería descargada, y moverse hasta el siguiente cargador con batería
cargada para que se la introduzcan — todo sin intervención humana.

**Cómo reciben misiones**: existe una **cola de misiones** —
conforme se generan van apareciendo en la cola, y conforme los LGV
quedan libres, las van cogiendo. No se mueven libremente por la
fábrica aunque lo parezca: tienen un **circuito programado**.

**Posicionamiento en planta**: bastante preciso — se ubican mediante
un mástil con láser, recibiendo la señal rebotada en decenas de
**reflectores** repartidos por toda la sección.
- 🔔 Si el mástil está doblado o el láser sucio, puede fallar unos
  centímetros en la ubicación, o dar alarma de **"insuficientes
  reflexiones"** o **"fuera de zona de seguridad"**.

**Control manual**: desde el ordenador que da las misiones, se pueden
crear misiones en manual, y cancelar misiones existentes.

### Túnel de flejado
Máquina grande, después del paletizador, que ya trabaja con
**palets completos** (no con paquetes sueltos).

> ⚠️ **No confundir con la flejadora de la zona EDA** (antes del
> paletizador, ver arriba) — esa fleja paquetes de cajas sueltos. El
> túnel de flejado fleja/envuelve/etiqueta el **palet completo** ya
> armado. Son dos máquinas distintas con nombres parecidos.

**1. Centrador**
El palet se deja justo debajo de la flejadora. Un centrador con **2
pistones** grandes mueve y centra el palet — que puede pesar entre
**800 y 1.100 kg**. Todo tiene sensores:
- Detecta que ha cerrado bien porque los sensores de "abierto" dejan
  de leer.
- Si los sensores de "cerrado" llegan al máximo (cierran del todo sin
  encontrar resistencia), sabe que **no hay palet**.

**2. Flejadora**
Tiene una fotocélula en un punto determinado; cuando se acaba el
fleje, esa fotocélula se queda leyendo de forma continua (ya no pasa
material por delante).
- 🔔 **Alarma**: fleje agotado — avisa para que alguien lo reponga.

**3. Filmadora ("bailarina")**
Dos bobinas industriales de film transparente giran a gran velocidad
alrededor del palet. Un brazo pequeño con una poleíta cónica arruga
el film y forma el **cordón**. Las bobinas llevan células de carga
que permiten ajustar la tensión del film, según pasa por unos
rodillos antes de aplicarse.

Esta parte cuelga de un anillo que **solo da alimentación eléctrica**
— el control/maniobra/configuración va **inalámbrico** (WiFi o
Bluetooth, no confirmado cuál exactamente). Cada carro (bobina +
motor del cordón) lleva una antena pequeña de un único alambre.

- Si se acaba uno de los dos rollos de film (o los dos), **la máquina
  no se detiene**: si solo se acaba uno, el otro da el doble de
  vueltas y termina el ciclo igual.
- Al terminar, un mecanismo de varios pistones y barras soldantes
  calienta una resistencia que **pega el film sobre sí mismo** en el
  palet, y otra resistencia lo **corta**.

**4. Encapuchadora**
Una fotocélula mide la altura del palet y corta una bolsa a medida
para enfundarlo. La funda baja y es enganchada por unas palas
situadas en el arco de la máquina; estas bajan al llegar al palet,
continuando mientras desenrollan el plástico recogido. Al ser
elástico, la bolsa se retrae y se ajusta sola sobre el palet.

**5. Etiquetadora**
Coloca la etiqueta con formato, marca, modelo, tono y calibre — es
como la **matrícula del palet**, cada uno tiene la suya propia.
- 🔔 Si la etiquetadora falla por cualquier motivo, **la máquina se
  para**.

**6. Salida — giradores**
Tras la etiquetadora, varios tramos de tracción llevan el palet hasta
unos **giradores**, que cambian su dirección para sacarlo hacia el
parque de acabados.

Al salir, un LGV lo coloca en el parque de acabados, apilando hasta
**4 palets** uno encima de otro (coincide con lo ya documentado sobre
la capacidad del parque).

### Parque de acabados
Almacén temporal de palets terminados, a la espera de que la
siguiente sección (**Cargas**) los mueva a la campa o los cargue en
un camión. No hay prisa: tiene capacidad para 100 filas de 13 palets,
apiladas a 4 alturas (~5.200 palets en total), y Clasificación solo
saca entre 800 y 1.000 palets al día — el buffer dura varios días
aunque Cargas se retrase.

---

## 3. Roles y turnos

- Fábrica 24/7 todo el año excepto vacaciones (cierre de fábrica).
- 3 turnos rotativos: **M** (06-14), **T** (14-22), **N** (22-06).
- Cada turno: 1 responsable + 4-5 operarios + 1 carretillero — todos
  rotativos por letra (A/B/C/D).
- Personal **fijo** de lunes a viernes (con guardia de fin de semana
  rotativa entre ellos): el **mecánico**, el **encargado**, el
  **ayudante**.
- El **responsable** es quien más usa la app: hace las fotos, rellena
  partes e incidencias, asigna operarios a líneas.

### Encargado
Máximo responsable de la sección — es a quien se le piden
explicaciones de todo. Hace los pedidos de consumibles (palets,
cartón, cola, cera, fleje, bobinas de film) y de repuestos. Gestiona
los turnos, recibe las reclamaciones y gestiona al personal.

### Ayudante
Hace lo que le pida el encargado. (Nota tal cual, del mecánico que
documenta esto: el ayudante actual "solo sirve para vigilar" — es un
comentario sobre la persona concreta hoy en el puesto, no una
definición formal del rol.)

### Mecánico
Dos personas: quien documenta esta biblia, y un compañero al que está
formando. Hacen que la sección funcione: mantenimiento preventivo,
solución de averías. Pasan al encargado la lista de repuestos que
necesitan, y sugieren mejoras/modificaciones de máquinas para
aumentar rendimiento o reducir paros/averías. Es el punto de contacto
cuando algo falla — le llama el encargado, el responsable, el
ayudante o directamente el operario, cualquiera con un problema.

### Responsable
El que más usa la app: mete los modelos en las líneas, entrena la
Qualitron, verifica la impresión de las cajas y que el montaje vaya
bien. Recibe instrucciones del encargado o del ayudante.

### Operario
Se ocupa de que la máquina no se quede sin consumibles (cola, cartón,
palets, corcho) y de resolver enganchones/bloqueos de máquina
(quitarlos y volver a arrancarla). Formalmente debería avisar a su
responsable, y este al mecánico si hay un problema mayor — en la
práctica, muchas veces se saltan ese paso y avisan directamente al
mecánico.

### Cadena de aviso de problemas (en la práctica)
- Camino formal: operario → responsable → mecánico.
- Camino real, frecuente: operario → mecánico directamente.
- Si el mecánico está ocupado en otra parte, redirige al operario a
  avisar a su responsable, y es el responsable quien decide qué
  problema se soluciona primero (prioriza entre varios pendientes).

### Carretillero
Es el operario de los túneles (túnel de flejado): cambia el film y
las bolsas/capuchas del túnel. Además: vacía los calderos de
descarte/contenedor de las líneas en los grandes contenedores del
exterior, lleva cartón a las líneas, llena las catastas (ver sección
2), y rearma y limpia los LGVs.

**Alcance de cada rol, de menor a mayor cobertura de líneas**:
operario (1-2 líneas) → responsable (todas las líneas del turno) →
carretillero (suministros y mover cargas con el torito, transversal a
todas las líneas).

---

## 4. Procedimientos operativos

### Cambio de turno (relevo)
El responsable entrante hace el relevo con el saliente: se pone al
tanto de modelos en marcha, averías, incidencias y cosas a vigilar.
Después:
1. Asigna un operario a cada línea.
2. Recorre TODAS las líneas comprobando que: la Qualitron clasifica
   bien, el calibre va bien, la empaquetadora va bien, la impresión
   de la caja es correcta, y que paletiza bien — verificando cada
   línea en la app.

### Cambio de lote
(a un lote también se le llama coloquialmente "modelo", aunque
técnicamente modelo es un concepto más amplio que lote — ver
`01-dominio.md`)

Cuando rectificado avisa de cambio de lote, el responsable:
1. Para la Qualitron (para que no entren piezas del lote siguiente).
2. Espera a que la última pieza llegue al paletizador.
3. Va a los apiladores, hace la foto de la pantalla con la
   estadística, rellena y finaliza el parte.
4. **Resetea la estadística** de los apiladores — paso crítico: si
   se olvida, el siguiente parte arrastra minutos del lote anterior
   (se han visto partes con más de 800 min en un turno de 480).
5. Busca la hoja del nuevo lote, la fotografía y la mete en la app.
6. Va al PC de transmitir: selecciona línea, número de orden,
   calibre y tono, y transmite — esto carga los datos en la
   empaquetadora y el EDA.
7. Ajusta las impresoras a mano (asigna el diseño de cada cabezal).
8. Entrena la Qualitron (ajusta parámetros de calidad) mientras los
   apiladores se van llenando.
9. Cuando considera que ha entrenado suficiente, arranca la
   empaquetadora.
10. Antes de que la primera caja llegue al acoplador, revisa que
    esté bien impresa y hace la foto para la app y el grupo de
    WhatsApp.

### Escalado de incidencias graves
Cadena de mando, de abajo a arriba:

```
operario de línea / carretillero → responsable → encargado → jefe de planta
```

Además de avisar al jefe de planta, el encargado puede avisar
directamente a otros departamentos según el tipo de incidencia:
- **Departamento de prevención**: en caso de accidente.
- **Encargado de mantenimiento** (rol de planta, distinto del
  mecánico de sección): en caso de fallo general que afecta a más que
  esta sección — ej. pérdida de suministro eléctrico o de aire
  comprimido.
- **Departamento de ingeniería**: en caso de fallo informático (ej.
  pérdida de red de internet) — interviene el informático.

> Esta cadena (para incidencias **graves**, con impacto más allá de
> una máquina puntual) es distinta de la cadena de aviso de
> problemas de máquina del día a día (sección 3): las averías
> normales de máquina suelen avisarse directamente al mecánico de
> sección, no siguen esta escala de mando completa.

**RESUELTO** (ver detalle completo en Qualitron, sección 2): la
Qualitron tiene una alarma configurable que para la línea sola (ej.
"5 de las últimas 30 tiradas a descarte"), avisando con las luces en
naranja intermitente. El responsable revisa en pantalla las últimas
piezas (RGB/BW/BW1) para confirmar si el defecto es real, ajusta si
hace falta, y le da a continuar. Además de esto, la Qualitron
requiere supervisión periódica activa del responsable durante todo
el turno, no solo reactiva a la alarma.

**[❓ PENDIENTE]** Procedimientos que aún no están documentados:
- ¿Qué se hace ante un atasco de cartón en la empaquetadora — parada
  de línea, aviso al mecánico, ambas?

---

## 5. Terminología y sinónimos (glosario)

| Término | Significado |
|---|---|
| Caldero / Contenedor / Descarte | Exactamente lo mismo: material no apto para venta. También es el contenedor físico en cada línea donde se acumula — lo vacía el carretillero en los grandes contenedores del exterior |
| Lote / "Modelo" (uso coloquial) | Modelo es el concepto amplio (nombre del diseño); lote es la identidad real de fabricación (`numero_orden`) |
| EDA | Secuencia de tramos de tracción tras la empaquetadora: máquina de cola (solo tablilla) → acoplador → flejadora → desviador |
| Desviador | Tramo de tracción del EDA que gira 90° el paquete para meterlo en el volteador (colocado transversalmente) |
| Formatos de tablilla | Formatos estrechos y largos; hoy solo `20x120` y `30x120`. Usan la máquina de cola del EDA, el resto de formatos no |
| Apiladores / Multigecko | "Apiladores" = los 16 depósitos individuales (8 por lado); "Multigecko" = nombre de la máquina completa que los contiene |
| Rompedor | Tritura las piezas de descarte que salen de los apiladores |
| Vacuostato (❓ término propio, no confirmado como oficial) | Mide si el venturi de una ventosa alcanza el vacío mínimo necesario |
| Empaquetadora (BS08) / Paletizador (Griffon) | Nombres de fabricante — BS08 es la empaquetadora, Griffon es el paletizador (no al revés, corregido tras confusión anterior) |
| Tono | Letra + dígitos (`M10`); en caja/pieza lleva prefijo de fábrica (`5M10`) |
| Calibre | Texto libre, se compara numéricamente (`03` = `3`) |
| Torito | Carretilla elevadora, en el lenguaje de esta planta |
| Plantilla (calibre-planar) | Pieza de aluminio del tamaño exacto de un formato, usada para el procedimiento control→calibrar |
| Jerk (Griffon) | Parámetro de ajuste de movimiento de los servomotores — la "aceleración de la aceleración", además de velocidad y aceleración |
| Bailarina | Nombre habitual de la filmadora del túnel de flejado (dos bobinas de film girando alrededor del palet) |
| Cordón | El arrugado que la filmadora hace al film mediante una poleíta cónica |
| Giradores | Tramo al final del túnel de flejado que cambia la dirección del palet hacia el parque de acabados |
| Sacabandejas | Barra con venturis/ventosas que extrae el cartón del almacén y lo lleva a la cota de depósito |
| Cota de depósito | Punto donde el sacabandejas suelta el cartón sobre las guías |
| Mandril | Baja envolviendo la pila con el cartón (arriba/lateral); posición abajo = 0, arriba configurable (320-350mm habitual). "Mandil" era una errata antigua del software (traducido del italiano) |
| Jaula | Conjunto donde se cierra la caja: plato de empuje (solapa trasera) + fondo jaula (solapa delantera) + guías (solapas laterales) |
| Empujador de pila / Plato de empuje | El empujador de pila es el conjunto completo (motor+correa+guía+rodamientos); el plato de empuje es solo la pieza que toca la pila |
| Silentblock | Pieza elástica de los pistones del mandril que asegura el cartón antes de bajar |
| Guía Nadella / Correa Breco | Marcas de componentes mecánicos del empujador de pila (raíl lineal y correa dentada) |
| TopJet | Marca de las impresoras (4 cabezales, 2 consolas, 1 PC Windows) |
| Ordenador de transmitir | PC en el centro de la sección; envía modelo/tono/calibre/código de barras al PC de las impresoras y a la empaquetadora en cada cambio de lote |
| Receta (impresoras) | Diseño de impresión guardado para una marca+formato; cada cabezal lo guarda como archivo TIFF y se reutiliza al repetir esa combinación |
| LGV | Vehículo autónomo guiado por láser — se posiciona por reflectores en planta, tiene circuito fijo (no libre), cola de misiones, cambio de batería automático, y bloquea la zona si pierde conexión con su PC de control |
| Catastas | Sitio donde el carretillero deja pilas de palets vacíos, para que los LGVs alimenten al paletizador |
| Cota toma | Punto fijo del volteador de donde el paletizador siempre coge el paquete |
| Forma (paletizador) | Patrón programado en el Griffon: cómo se colocan los paquetes sobre un palet, incluida su orientación (vertical/horizontal). La configura responsable o mecánico; 1-2 formas por formato, reutilizables |
| Palet | Estructura de madera para apilar paquetes, transportable por torito/LGV — no confundir con "paquete" (un grupo de cajas) |
| Paquete | Grupo de 2-6 cajas ya acopladas y flejadas, unidad que maneja el paletizador antes de colocarlo en un palet |
| Parque de acabados | Almacén temporal de palets terminados, tras el túnel de flejado |
| Cargas | Sección siguiente a Clasificación — mueve los palets del parque de acabados a campa o camión (fuera del alcance de esta biblia) |

**[❓ PENDIENTE]** Seguro que hay más jerga de uso diario en planta
que no está aquí — cualquier palabra que uséis para referiros a algo
y que un recién llegado no entendería, va en esta tabla.

---

', true, '2026-08-20 21:09:42.621877+00', '2026-08-21 04:22:33.070956+00'),
	('cc8e8131-db1b-4ce9-bc40-0ded97bc58c0', 'get_incidencias_produccion', 'Estás interpretando INCIDENCIAS DE PRODUCCIÓN — paros de máquina,
fallos, falta de material. Cuelgan de un turno + línea (o solo de un
turno si linea_id es null, lo que significa que afecta a todo el
turno en general, no a una línea concreta). Cada incidencia trae
"creador.username" — quién la reportó — y, si tiene línea,
"operario_username" — el operario de esa línea en ese turno; las
incidencias generales (sin línea) no tienen operario. Menciónalos
cuando ayuden a la respuesta, sin forzarlo si no aportan nada. NUNCA relaciones estas
incidencias con la calidad de lo producido en ese mismo turno — son
datos operativos, no de producto. Si hay fotos, muéstralas con
markdown: ![descripción](url). Si el resultado viene con "limitado":
true, avísalo con la cifra de filas_totales antes de resumir nada.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 6. Reglas y relaciones que Ceria debe respetar

- **Producción y calidad son ejes independientes en CAUSA.** Nunca
  implicar que un paro de máquina "explicó" una calidad baja del
  mismo parte, ni al revés — sí pueden mostrarse juntos en una tabla
  (mismo parte), pero nunca como causa-efecto.
- **`minutos_no_alimentada` ≠ `minutos_saturacion`**, son causas
  opuestas:
  - `no_alimentada`: la máquina está operativa pero no recibe
    material de la sección anterior (rectificado) — problema **ajeno**
    a esta sección (aguas arriba).
  - `saturacion`: problema **aguas abajo** del punto de captura de
    estadísticas (apiladores), pero **solo** puede deberse a fallos en
    las máquinas entre apiladores y el LGV: **empaquetadora (BS08)**,
    **máquina de cola/acoplador**, **flejadora**, o el **Griffon**
    (paletizador). La más habitual con diferencia es la empaquetadora
    (BS08) — es la máquina más compleja de ajustar de toda la
    sección. El Griffon, ocasionalmente (mal montaje de un paquete o
    caída al suelo) — es delicado, pero mucho menos que la BS08.
    **RESUELTO** (ver detalle completo en Apiladores/Multigecko,
    sección 2): la Multigecko se llena físicamente cuando la
    empaquetadora no vacía pilas al ritmo al que se completan — un
    paro aguas abajo de menos de 10 minutos ya suele saturar los
    apiladores. Encaja con el esquema banco/máquina como alarma de
    tipo "máquina" (interpretación razonable, no confirmada del todo).
  - **El parque de acabados, los LGV y el túnel de flejado NUNCA
    generan `minutos_saturacion`**, aunque fallen o se saturen: hay
    orden operativa de que, en ese caso, el operario saque los palets
    a mano y los deje apartados, precisamente para que la máquina no
    llegue a pararse. Por eso quedan fuera de la causa posible de
    saturación — no es que sean menos frecuentes, es que el
    procedimiento existe exactamente para evitarlo.
- Resetear la estadística de apiladores en cada cambio de lote es
  crítico — si no se hace, aparece un `rendimiento_denominador`
  anormalmente alto en los datos (no es un bug de cálculo, es un dato
  de entrada mal registrado).

---

## 7. Casos reales / anomalías conocidas y cómo interpretarlas

- Un turno con `rendimiento_denominador` muy por encima de
  `líneas_activas × 480` casi siempre significa que un responsable no
  reseteó la estadística de los apiladores al cerrar un parte, no un
  error de cálculo.

**[❓ PENDIENTE]** Seguro que hay más "esto parece raro pero es tal
cosa" que sabéis por experiencia de planta y vale la pena documentar
aquí antes de que alguien le pregunte a Ceria y se invente una
explicación.

---', true, '2026-08-20 21:09:42.621877+00', '2026-09-10 15:59:22.944602+00'),
	('62412744-0254-46cf-9aac-18e54fcfec52', 'get_produccion_turno', 'Estás interpretando datos de PRODUCCIÓN por turno (tabla agregada
v_produccion_turno). Cada fila es un turno completo (todas sus
líneas juntas). Columnas clave:
- piezas_total / m2_total: cantidad producida (m2_total ya viene
  calculado con la superficie real de cada formato, no lo repitas
  con otra fórmula).
- CATEGORÍAS DE TIEMPO (minutos_plena, minutos_no_alimentada,
  minutos_saturacion, minutos_banco, minutos_maquina) — definiciones
  exactas, nunca inventes otras ni las confundas entre sí:
    · minutos_plena: minutos a pleno rendimiento, produciendo con
      normalidad.
    · minutos_no_alimentada: la máquina está operativa pero NO
      recibe material de la sección anterior. Esto NO es un problema
      de esta sección — el problema está aguas arriba (antes de esta
      máquina). Si el jefe pregunta por qué bajó el rendimiento y ves
      minutos_no_alimentada altos, dilo así: "no es un fallo de esta
      línea, es que no le está llegando material de la sección
      anterior".
    · minutos_saturacion: la sección se para por un problema AGUAS
      ABAJO del punto donde se capturan las estadísticas (que es en
      los apiladores). Este SÍ es un problema imputable a esta
      sección — normalmente es la empaquetadora (más habitual) o el
      paletizador (menos habitual) que no da abasto o falla. Si ves
      minutos_saturacion altos, es una incidencia interna a
      investigar, a diferencia de no_alimentada.
    · minutos_banco: minutos con el banco parado — por alarma en ese
      tramo, o parado manualmente.
    · minutos_maquina: minutos en los que la propia máquina de la que
      se toman las estadísticas está en alarma o parada en manual.
  Nunca digas que "no_alimentada" y "saturacion" son lo mismo o
  intercambiables — no_alimentada = problema ajeno a la sección
  (aguas arriba), saturacion = problema de la sección (aguas abajo,
  empaquetadora/paletizador).
- pct_rendimiento: % de tiempo de máquina en producción real,
  calculado con un suelo mínimo de 480 minutos POR LÍNEA (si una
  línea reportó menos de 480 min, igualmente se divide entre 480,
  no entre lo poco que reportó — esto evita que un turno corto
  parezca artificialmente bueno). Nunca reinterpretes ni recalcules
  este porcentaje, ya viene resuelto.
- rendimiento_numerador / rendimiento_denominador: son los valores
  CRUDOS (sin redondear) que Postgres usó para calcular
  pct_rendimiento, expuestos para poder sumar varios turnos (semana,
  mes) correctamente. IMPORTANTE: una línea puede tener VARIOS partes
  en el mismo turno (parte ≠ línea, una línea agrupa 1 o más partes).
  Su fórmula exacta, por cada línea activa del turno:
    numerador_línea   = SUMA(minutos_plena + minutos_no_alimentada)
                         de TODOS los partes de esa línea en ese turno
    denominador_línea = MÁXIMO(480, SUMA(minutos_total)
                         de TODOS los partes de esa línea en ese turno)
  Y luego se SUMAN esos numeradores_línea y denominadores_línea entre
  todas las líneas activas del turno, para dar rendimiento_numerador
  y rendimiento_denominador del turno completo. Si te preguntan qué
  son estos dos campos, explica esta fórmula tal cual, dejando claro
  que es una SUMA entre partes de la misma línea (nunca digas que es
  "el minutos_total de la línea" como si fuera un valor único — nunca
  inventes otras posibles definiciones ni especules con factores de
  ponderación, minutos de mantenimiento, ni nada que no esté aquí
  escrito).
- AVISO IMPORTANTE sobre el denominador: si rendimiento_denominador
  es claramente mayor que lineas_activas × 480 (por ejemplo, más de
  un 10-15% por encima), la causa más probable NO es un error de
  cálculo — es que algún responsable no reinició la estadística de
  un parte antes de empezar a registrar el turno, y ese parte
  arrastró minutos de un periodo anterior (se han visto partes con
  más de 800 minutos en un turno de 480). Si detectas esto, dilo
  explícitamente en vez de dar el % sin más contexto, y sugiere
  revisar get_partes de ese turno para localizar qué línea/parte
  tiene un minutos_total anormalmente alto. No es un fallo de la
  fórmula, es un dato de entrada a revisar.
- lineas_activas / lotes_distintos / partes_analizados: para dar
  contexto de cuántos datos hay detrás de la cifra.
- responsable_username: quién abrió el turno (uno solo por turno,
  aunque tenga varias líneas); menciónalo si ayuda a la respuesta,
  sin forzarlo si no aporta nada. Puede venir null.
Esta herramienta es PURA PRODUCCIÓN — no tiene ninguna columna de
calidad (1ª/comercial/etc). Si el jefe pregunta por calidad de lo
producido en un turno, dilo explícitamente y sugiere get_partes o
get_calidad_modelo/get_calidad_lote para ese dato.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 6. Reglas y relaciones que Ceria debe respetar

- **Producción y calidad son ejes independientes en CAUSA.** Nunca
  implicar que un paro de máquina "explicó" una calidad baja del
  mismo parte, ni al revés — sí pueden mostrarse juntos en una tabla
  (mismo parte), pero nunca como causa-efecto.
- **`minutos_no_alimentada` ≠ `minutos_saturacion`**, son causas
  opuestas:
  - `no_alimentada`: la máquina está operativa pero no recibe
    material de la sección anterior (rectificado) — problema **ajeno**
    a esta sección (aguas arriba).
  - `saturacion`: problema **aguas abajo** del punto de captura de
    estadísticas (apiladores), pero **solo** puede deberse a fallos en
    las máquinas entre apiladores y el LGV: **empaquetadora (BS08)**,
    **máquina de cola/acoplador**, **flejadora**, o el **Griffon**
    (paletizador). La más habitual con diferencia es la empaquetadora
    (BS08) — es la máquina más compleja de ajustar de toda la
    sección. El Griffon, ocasionalmente (mal montaje de un paquete o
    caída al suelo) — es delicado, pero mucho menos que la BS08.
    **RESUELTO** (ver detalle completo en Apiladores/Multigecko,
    sección 2): la Multigecko se llena físicamente cuando la
    empaquetadora no vacía pilas al ritmo al que se completan — un
    paro aguas abajo de menos de 10 minutos ya suele saturar los
    apiladores. Encaja con el esquema banco/máquina como alarma de
    tipo "máquina" (interpretación razonable, no confirmada del todo).
  - **El parque de acabados, los LGV y el túnel de flejado NUNCA
    generan `minutos_saturacion`**, aunque fallen o se saturen: hay
    orden operativa de que, en ese caso, el operario saque los palets
    a mano y los deje apartados, precisamente para que la máquina no
    llegue a pararse. Por eso quedan fuera de la causa posible de
    saturación — no es que sean menos frecuentes, es que el
    procedimiento existe exactamente para evitarlo.
- Resetear la estadística de apiladores en cada cambio de lote es
  crítico — si no se hace, aparece un `rendimiento_denominador`
  anormalmente alto en los datos (no es un bug de cálculo, es un dato
  de entrada mal registrado).

---

## 7. Casos reales / anomalías conocidas y cómo interpretarlas

- Un turno con `rendimiento_denominador` muy por encima de
  `líneas_activas × 480` casi siempre significa que un responsable no
  reseteó la estadística de los apiladores al cerrar un parte, no un
  error de cálculo.

**[❓ PENDIENTE]** Seguro que hay más "esto parece raro pero es tal
cosa" que sabéis por experiencia de planta y vale la pena documentar
aquí antes de que alguien le pregunte a Ceria y se invente una
explicación.

---', true, '2026-08-20 21:09:42.621877+00', '2026-09-10 15:59:22.944602+00'),
	('5cf35082-5e5a-4550-993b-dee6f1c18551', 'get_calidad_lote', 'Igual que get_calidad_modelo (mismas dos métricas: completa y
oficial, mismo criterio de que eco y contenedor se excluyen de la
oficial), pero por lote/orden en vez de por todo el histórico de un
modelo. Dos modos:
  - CONSULTA CONCRETA (con numero_orden): la calidad acumulada de
    esa orden en todas las líneas/turnos donde se ha producido.
  - RANKING (sin numero_orden): una lista de varios lotes YA
    ordenada por Postgres según pct_1a_oficial (mejor_primero o
    peor_primero, según orden_calidad) — para "¿cuál es el mejor/
    peor lote?" o "compara la calidad entre lotes". El orden viene
    resuelto en los datos: no reordenes tú ni decidas cuál es
    "el mejor" por tu cuenta, simplemente presenta la lista en el
    orden en que llega, indicando cuál es el primero y cuál el
    último.
Si no aparece ningún resultado, dilo claramente — puede ser que el
numero_orden no exista o esté mal escrito, no asumas que la calidad
es "0%".

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).

', true, '2026-08-20 21:09:42.621877+00', '2026-08-21 04:22:33.070956+00'),
	('f63c5d16-2904-48b4-b265-4d98dc6661a1', 'get_calidad_linea', 'Estás interpretando CALIDAD agregada por línea (función
calidad_linea_por_fecha) — una fila por línea, con TODO el rango de
fechas pedido ya sumado (no una fila por turno). Mismo caso de uso
que get_produccion_linea: para comparar dos periodos de la misma
línea, se llama dos veces con rangos distintos y tú comparas los
resultados.
Mismas dos métricas de siempre, muéstralas SIEMPRE juntas:
  - "Calidad completa": pct_1a_completa / pct_comercial_completa /
    pct_eco_completa / pct_contenedor_completa, sobre el TOTAL de
    piezas entradas de la línea en ese rango.
  - "Calidad oficial": pct_1a_oficial / pct_comercial_oficial, SOLO
    1ª y comercial entre sí (eco/contenedor excluidos).
PURA CALIDAD — sin tiempos ni rendimiento, eso es
get_produccion_linea.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).

', true, '2026-09-05 18:00:20.140076+00', '2026-09-05 18:00:20.140076+00'),
	('7b5a1ff2-0bc5-4fe7-afb6-f761764c2075', 'get_partes', 'Estás interpretando el DETALLE de partes individuales — cada fila
es un tramo de producción real (una línea, un turno, un
operario/responsable, un lote). Cada parte trae DOS bloques de
datos:
  1) PRODUCCIÓN: piezas_entradas, minutos_* (tiempos de máquina).
  2) CALIDAD: piezas_1a / piezas_comercial / piezas_eco /
     piezas_contenedor — si calculas porcentajes de calidad de estos
     partes, aplica la misma distinción completa/oficial que en
     get_calidad_modelo (ver ese prompt), nunca solo una de las dos.
Puedes y DEBES combinarlos en la misma tabla o frase cuando ayude a
entender el dato — por ejemplo "lote 1115370: 4.230 piezas, 91%
calidad oficial" en una sola línea es exactamente lo esperado, no un
fallo. Lo único PROHIBIDO es la causalidad: nunca concluyas que un
tiempo de parada "explica" una calidad baja de ese mismo parte, ni
al revés — son ejes independientes en cuanto a CAUSA (diseño del
negocio), no en cuanto a poder mostrarse juntos.
Si la respuesta trae "limitado": true, dilo explícitamente al
principio de tu respuesta con la cifra de filas_totales, antes de
analizar nada — nunca des un resumen que suene a "todos los datos"
cuando en realidad es una muestra parcial.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 6. Reglas y relaciones que Ceria debe respetar

- **Producción y calidad son ejes independientes en CAUSA.** Nunca
  implicar que un paro de máquina "explicó" una calidad baja del
  mismo parte, ni al revés — sí pueden mostrarse juntos en una tabla
  (mismo parte), pero nunca como causa-efecto.
- **`minutos_no_alimentada` ≠ `minutos_saturacion`**, son causas
  opuestas:
  - `no_alimentada`: la máquina está operativa pero no recibe
    material de la sección anterior (rectificado) — problema **ajeno**
    a esta sección (aguas arriba).
  - `saturacion`: problema **aguas abajo** del punto de captura de
    estadísticas (apiladores), pero **solo** puede deberse a fallos en
    las máquinas entre apiladores y el LGV: **empaquetadora (BS08)**,
    **máquina de cola/acoplador**, **flejadora**, o el **Griffon**
    (paletizador). La más habitual con diferencia es la empaquetadora
    (BS08) — es la máquina más compleja de ajustar de toda la
    sección. El Griffon, ocasionalmente (mal montaje de un paquete o
    caída al suelo) — es delicado, pero mucho menos que la BS08.
    **RESUELTO** (ver detalle completo en Apiladores/Multigecko,
    sección 2): la Multigecko se llena físicamente cuando la
    empaquetadora no vacía pilas al ritmo al que se completan — un
    paro aguas abajo de menos de 10 minutos ya suele saturar los
    apiladores. Encaja con el esquema banco/máquina como alarma de
    tipo "máquina" (interpretación razonable, no confirmada del todo).
  - **El parque de acabados, los LGV y el túnel de flejado NUNCA
    generan `minutos_saturacion`**, aunque fallen o se saturen: hay
    orden operativa de que, en ese caso, el operario saque los palets
    a mano y los deje apartados, precisamente para que la máquina no
    llegue a pararse. Por eso quedan fuera de la causa posible de
    saturación — no es que sean menos frecuentes, es que el
    procedimiento existe exactamente para evitarlo.
- Resetear la estadística de apiladores en cada cambio de lote es
  crítico — si no se hace, aparece un `rendimiento_denominador`
  anormalmente alto en los datos (no es un bug de cálculo, es un dato
  de entrada mal registrado).

---

## 7. Casos reales / anomalías conocidas y cómo interpretarlas

- Un turno con `rendimiento_denominador` muy por encima de
  `líneas_activas × 480` casi siempre significa que un responsable no
  reseteó la estadística de los apiladores al cerrar un parte, no un
  error de cálculo.

**[❓ PENDIENTE]** Seguro que hay más "esto parece raro pero es tal
cosa" que sabéis por experiencia de planta y vale la pena documentar
aquí antes de que alguien le pregunte a Ceria y se invente una
explicación.

---


## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).

', true, '2026-08-20 21:09:42.621877+00', '2026-09-04 18:43:25.331211+00'),
	('e5c53faa-6ade-4922-bb36-7c57187d25dc', 'get_calidad_turno', 'Estás interpretando CALIDAD agregada por turno+fecha (vista
v_calidad_turno) — mismas claves (fecha, tipo_turno) que
get_produccion_turno, pensada para responder "¿cómo fue la calidad
de ayer/esta semana/el turno de noche?" en vez de por modelo o lote.
Mismas dos métricas de siempre, muéstralas SIEMPRE juntas:
  - "Calidad completa": pct_1a_completa / pct_comercial_completa /
    pct_eco_completa / pct_contenedor_completa, sobre el TOTAL de
    piezas entradas de ese turno.
  - "Calidad oficial": pct_1a_oficial / pct_comercial_oficial, SOLO
    1ª y comercial recalculadas entre sí (eco/contenedor excluidos).
También trae m² por categoría (m2_entradas, m2_1a, m2_comercial,
m2_eco, m2_contenedor) —úsalos si preguntan por metros cuadrados en
vez de piezas. También trae responsable_username (quién abrió el
turno); menciónalo si ayuda, sin forzarlo. Puede venir null.
Si el jefe pide un resumen del día (producción Y calidad juntas),
usa esta herramienta junto con get_produccion_turno y presenta ambos
bloques de datos en la misma respuesta — pueden mostrarse codo con
codo del mismo turno, lo único prohibido es implicar que uno causó
el otro (mismo criterio que en get_partes). NUNCA incluye tiempos de
máquina ni % de rendimiento — eso es producción pura, ver
get_produccion_turno.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).', true, '2026-09-05 17:21:55.569204+00', '2026-09-10 15:59:22.944602+00'),
	('83fc8db1-722f-49a1-bb3d-dff239e43c13', 'get_incidencias_calidad', 'Estás interpretando INCIDENCIAS DE CALIDAD — defectos detectados en
el producto (grumos, grietas, descuadres, etc.), siempre colgadas de
un parte concreto (por tanto de un modelo/lote/línea/turno
identificables). Cada incidencia trae "creador.username" — quién la
reportó — y, dentro de "parte", "operario.username" — el operario de
ese parte concreto; menciónalos cuando ayude a la respuesta, sin
forzarlo si no aporta nada. NUNCA relaciones estas incidencias con
paros de máquina o problemas operativos de ese turno — son ejes
distintos. Si hay fotos, muéstralas con markdown: ![descripción](url).
Si el resultado viene con "limitado": true, avísalo con la cifra de
filas_totales antes de resumir nada.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).', true, '2026-08-20 21:09:42.621877+00', '2026-09-10 15:59:22.944602+00');


--
-- Data for Name: chat_acceso; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."chat_acceso" ("tipo_chat", "rol", "puede_ver", "puede_escribir") VALUES
	('incidencia_calidad', 'responsable', true, true),
	('incidencia_produccion', 'responsable', true, true),
	('nuevo_lote', 'responsable', true, true),
	('resumen_turno', 'responsable', true, true),
	('resumen_calidad', 'responsable', true, true),
	('general', 'responsable', true, true),
	('incidencia_calidad', 'suplente', true, true),
	('incidencia_produccion', 'suplente', true, true),
	('nuevo_lote', 'suplente', true, true),
	('resumen_turno', 'suplente', true, true),
	('resumen_calidad', 'suplente', true, true),
	('general', 'suplente', true, true),
	('incidencia_calidad', 'operario', true, true),
	('incidencia_produccion', 'operario', true, true),
	('nuevo_lote', 'operario', true, true),
	('resumen_turno', 'operario', true, true),
	('resumen_calidad', 'operario', true, true),
	('general', 'operario', true, true),
	('incidencia_calidad', 'jefe', true, true),
	('incidencia_produccion', 'jefe', true, true),
	('nuevo_lote', 'jefe', true, true),
	('resumen_turno', 'jefe', true, true),
	('resumen_calidad', 'jefe', true, true),
	('general', 'jefe', true, true),
	('incidencia_calidad', 'administrador', true, true),
	('incidencia_produccion', 'administrador', true, true),
	('nuevo_lote', 'administrador', true, true),
	('resumen_turno', 'administrador', true, true),
	('resumen_calidad', 'administrador', true, true),
	('general', 'administrador', true, true),
	('ceria', 'jefe', true, true),
	('ceria', 'administrador', true, true),
	('ceria', 'responsable', true, false),
	('nora', 'jefe', true, false),
	('nora', 'administrador', true, false),
	('nora', 'responsable', true, false),
	('incidencia_calidad', 'produccion', true, false),
	('incidencia_produccion', 'produccion', true, false),
	('ceria', 'produccion', true, false);


--
-- Data for Name: checklist_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."checklist_items" ("id", "nombre", "puntos", "activo") VALUES
	('f9c50a4d-9c3c-4d89-9b59-9bb4c6aec865', 'Limpiar transporte', 1, true),
	('5691d3eb-dcd6-442f-b5e0-8b7d1234d640', 'Limpiar cristales cualitrón', 1, true),
	('5ceb7cde-64a2-4ef1-a9eb-1c416dbd8246', 'Limpiar apiladores', 1, true),
	('637d94a5-93c8-4af9-bcd6-e3a7ae3d1f4c', 'Limpiar bancada línea', 1, true),
	('6c82ed23-0e7e-4e2d-a7a7-5a5220b20fdf', 'Limpiar paletizador', 1, true),
	('63d0e1aa-ea8c-4756-9c8b-8ce39f0fdc4f', 'Limpiar empaquetadora', 1, true);


--
-- Data for Name: configuracion; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."configuracion" ("clave", "valor", "nota") VALUES
	('fecha_inicio_rotacion', '2026-02-16', 'Lunes de arranque de la beta (confirmado 13/08/2026). Toda la rotación de turnos y los ciclos de 28 días de gamificación cuentan desde aquí.'),
	('objetivo_m2_dia', '48000', 'Objetivo diario de m² — marca el 100% de la barra de Producción del ciclo en la pantalla de fábrica.');


--
-- Data for Name: engrase_punto; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."engrase_punto" ("id", "nombre", "orden", "activo") VALUES
	('74f20b63-b34f-432c-9fb4-2c636d634081', 'Rodamientos flejadora', 1, true),
	('92e52816-8ddf-4356-837d-aef54d5dcaf4', 'Rodamientos volteador', 2, true),
	('426f5a1e-d973-47eb-8c43-51eb3d59cb53', 'Cadenas girador', 3, true),
	('f9c3fc33-93e0-4578-b2b4-a2a130947ce1', 'Cadena rodillos EDA', 0, true);


--
-- Data for Name: formato; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."formato" ("id", "nombre", "area_m2") VALUES
	('047339af-1fb4-48c7-9151-2330068d0cd3', '200x1200', 0.24000000000000000000),
	('c0ed428b-152a-49e8-88bb-82cf17146523', '300x1200', 0.36000000000000000000),
	('1c73df04-91a3-48ca-9f59-08e5683632be', '600x1200', 0.72000000000000000000),
	('e6318332-627a-4b71-8aa1-c82526eb68df', '1200x1200', 1.4400000000000000),
	('b36a5167-877e-45a6-94b1-2d410aea3f3a', '300x600', 0.18000000000000000000),
	('62bc43bf-4da6-45bd-acda-902d4e27efb3', '600x600', 0.36000000000000000000),
	('781831e6-54f7-4d7a-88e0-99bd0d9c3e54', '900x900', 0.81000000000000000000);


--
-- Data for Name: linea; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."linea" ("id", "nombre") VALUES
	('1b352ec8-913a-44c2-8c8a-700295809108', 'Línea 1'),
	('cbef60cf-c57b-4fe2-b4ac-83348fa55a12', 'Línea 2'),
	('2ab3d161-dfaa-4d40-a2d5-7e2f6c54ef4a', 'Línea 3'),
	('9d7e6661-b3a4-4a00-9268-079291e86b86', 'Línea 4'),
	('c8a2cce2-d2ba-4364-8f00-1d48834c4e12', 'Línea 5'),
	('caa6bc1a-a995-42b6-9f8d-548aa6e710b9', 'Línea 6');


--
-- Data for Name: logros_definicion; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."logros_definicion" ("id", "nombre", "descripcion", "icono", "condicion_tipo", "condicion_valor", "activo", "rol", "formato_nombre") VALUES
	('015b5a11-8512-468f-b1cb-9a615b6e7b53', 'El Terraformador', 'Acumula 250.000 m² producidos a lo largo de tu carrera', '🌍', 'm2_total', 250000, true, 'operario', NULL),
	('6f759313-611d-40c0-8f93-1f2ca88b9f77', 'Bestia del Ciclo', 'Consigue 600 puntos en un solo ciclo', '⚡', 'bestia_ciclo', 600, true, 'operario', NULL),
	('d1b2799c-60cf-4bf2-ab46-f924961fd459', 'Ciclo Legendario', 'Consigue 1.000 puntos en un solo ciclo', '🔥', 'ciclo_legendario', 1000, true, 'operario', NULL),
	('9cabbbde-e45f-4844-b757-a5fe40e35050', 'Rey de Reyes', 'Termina un ciclo en primera posición del ranking', '👑', 'rey_de_reyes', NULL, true, 'operario', NULL),
	('a7f336ce-4f28-47f7-ad1c-a64060c5e729', 'La Máquina Humana', 'Acumula 100 horas en plena producción', '💪', 'tiempo_plena', 6000, true, 'operario', NULL),
	('873e3804-9056-421a-9847-13aa22785a55', 'Esperando suministro', 'Acumula 100 horas esperando material', '😴', 'tiempo_no_alimentada', 6000, true, 'operario', NULL),
	('d1a31986-652d-43ae-97cd-5d0c52d8b9a2', 'Se te resiste la papiroflexia', 'Acumula 100 horas con saturación', '📦', 'tiempo_saturacion', 6000, true, 'operario', NULL),
	('ee9da1e9-0834-4fab-9f90-9e7149034e0a', '¿Dónde está el mecánico?', 'Acumula 100 horas con máquina parada', '🔧', 'tiempo_maquina', 6000, true, 'operario', NULL),
	('11077c24-fd3c-4af1-b97f-e4259034d268', 'Otro cambio de modelo', 'Acumula 100 horas con banco inhabilitado', '🔄', 'tiempo_banco', 6000, true, 'operario', NULL),
	('7cf9e2ca-976c-4925-a5a1-5cc8c32b6582', 'Montaña de escombros', 'Acumula 100.000 m² de material contenedor', '🗻', 'm2_contenedor', 100000, true, 'operario', NULL),
	('d63a32db-9d1b-45d2-9b36-e960f66b6dfe', 'Demasiado material pulido', 'Acumula 100.000 m² de material comercial', '✨', 'm2_com', 100000, true, 'operario', NULL),
	('5577f637-4a96-4abf-aaa7-5173e4a2bbd3', 'De primerísima calidad', 'Acumula 100.000 m² de material de primera', '🏅', 'm2_std', 100000, true, 'operario', NULL),
	('a9d9d17f-b2d8-4bc7-8c90-149990c36341', 'Rey del 200x1200', '100.000 piezas de formato 200x1200', '🎯', 'piezas_formato', 100000, true, 'operario', '200x1200'),
	('b1d05169-b13b-4bc5-a03f-f9aafa9a62d6', 'Rey del 300x1200', '100.000 piezas de formato 300x1200', '🎯', 'piezas_formato', 100000, true, 'operario', '300x1200'),
	('771ffd01-5ef0-42ff-8557-014010cfe167', 'Rey del 600x1200', '100.000 piezas de formato 600x1200', '🎯', 'piezas_formato', 100000, true, 'operario', '600x1200'),
	('3a245284-01b8-45ad-8256-025e50c981a0', 'Rey del 1200x1200', '100.000 piezas de formato 1200x1200', '🎯', 'piezas_formato', 100000, true, 'operario', '1200x1200'),
	('b5beacfe-052f-49c4-b462-6e3f84ff5666', 'Rey del 300x600', '100.000 piezas de formato 300x600', '🎯', 'piezas_formato', 100000, true, 'operario', '300x600'),
	('5c65f1f4-bf71-45f0-bf6a-bb7864503b7d', 'Rey del 600x600', '100.000 piezas de formato 600x600', '🎯', 'piezas_formato', 100000, true, 'operario', '600x600'),
	('44d52878-b4f8-4800-b789-99b4731530d8', 'Rey del 900x900', '100.000 piezas de formato 900x900', '🎯', 'piezas_formato', 100000, true, 'operario', '900x900'),
	('07a4a696-ec65-4c95-abee-8b9db5f5d369', 'El Relojero', 'Acumula 1.000 horas en plena producción', '⏰', 'minutos_plena', 60000, true, 'responsable', NULL),
	('29074390-b738-46b6-b909-2f2541b5bcbd', 'El Paciente', 'Acumula 1.000 horas esperando material', '😌', 'minutos_no_alimentada', 60000, true, 'responsable', NULL),
	('44607521-6369-46a4-9698-eb2672a3e5ed', 'Sin remedio', 'Acumula 1.000 horas con saturación', '🤷', 'minutos_saturacion', 60000, true, 'responsable', NULL),
	('66c7cbb2-02fa-4b24-9a99-b75bbfadf5c5', 'El paciente del taller', 'Acumula 1.000 horas con banco inhabilitado', '🔄', 'minutos_banco', 60000, true, 'responsable', NULL),
	('e4da9b78-caa0-4b34-8b94-0656bb17afe9', '¿Dónde está el mecánico?', 'Acumula 1.000 horas con máquina parada', '🔧', 'minutos_maquina', 60000, true, 'responsable', NULL),
	('94f45546-f018-449a-9ff8-3fb6c3876ba9', 'El Rey de la Calidad', 'Acumula 2.000.000 m² de material de primera', '🏅', 'm2_std', 2000000, true, 'responsable', NULL),
	('1a425462-e04d-4877-a1f4-408b8bd69767', 'El Magnate Comercial', 'Acumula 150.000 m² de material comercial', '✨', 'm2_com', 150000, true, 'responsable', NULL),
	('330773bf-4110-47bd-9273-c75336fb51a4', 'Destructor', 'Acumula 150.000 m² de material contenedor', '🗻', 'm2_contenedor', 150000, true, 'responsable', NULL),
	('56f8d128-1690-41cd-aa74-3b84e1f7d692', 'El Coloso', 'Acumula 3.000.000 m² a lo largo de tu carrera', '🗿', 'm2_total', 3000000, true, 'responsable', NULL),
	('8e9fdd47-9ffa-4802-bc05-0533378742b0', 'Líder indiscutible', 'Termina un ciclo en primera posición del ranking', '👑', 'lider_indiscutible', NULL, true, 'responsable', NULL),
	('51c6db4e-5405-4eb3-b73a-36b4ee7f850d', 'El Manitas', 'Acumula 900 horas en plena producción en un solo ciclo', '🔧', 'manitas_ciclo', 54000, true, 'responsable', NULL),
	('3a98694a-3386-4268-b92f-0aeeea0cef3d', 'El salvador', 'Produce 400.000 m² en un solo ciclo', '🚑', 'salvador_ciclo', 400000, true, 'responsable', NULL),
	('2b2a7bb9-11c6-4d50-a02f-16a9c0166982', 'Argos', 'Has capturado 1.000 nuevos lotes', '👁️', 'lotes_creados', 1000, true, 'responsable', NULL),
	('4264e990-f2ab-4f98-90e9-e478f66f8f23', 'El detallista', 'Has verificado 1.000 códigos de barras con la app', '🔍', 'verificaciones_codbar', 1000, true, 'responsable', NULL),
	('bbf8a241-0050-4958-9db1-3ff6c51f8996', 'Creador de Héroes', 'Un operario de tu letra ha ganado el ciclo', '🦸', 'creador_de_heroes', NULL, true, 'responsable', NULL),
	('ae8a3d26-d3d6-4229-980c-cf4a49c9f4fe', 'El Equipo A', 'Entre todos tus operarios habéis conseguido más de 3.000 puntos en un ciclo', '🅰️', 'equipo_a', 3000, true, 'responsable', NULL),
	('2164b0b3-e30d-453a-ace7-c922f880e339', 'Bestia del Ciclo', 'Consigue 650 puntos en un solo ciclo', '⚡', 'bestia_ciclo_responsable', 1000, true, 'responsable', NULL),
	('85aa74f1-4ef4-4bc7-867d-ce498ebf62bc', 'Ciclo Legendario', 'Consigue 780 puntos en un solo ciclo', '🔥', 'ciclo_legendario_responsable', 1500, true, 'responsable', NULL);


--
-- Data for Name: niveles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."niveles" ("id", "nombre", "umbral_min", "umbral_max", "color_marco", "estrellas", "efecto_aura", "prompt_base", "prompt_imagen", "orden", "descripcion") VALUES
	('f362deb4-9580-40f0-a9c8-2445a080964c', 'Aprendiz', 0, 499, '#9CA3AF', 1, 'Sin aura visible. Iluminación suave y neutra.', 'Operario en sus primeros turnos. Aprende el ritmo de la línea. Uniforme limpio, postura insegura pero con potencial. Inicio de carrera.', 'OBLIGATORIO Marco simple de metal gris plateado con una estrella gris en la parte superior. El personaje viste uniforme industrial limpio y básico. Postura algo insegura pero con potencial. Iluminación suave. Entorno de fábrica simple al fondo.
Cyberpunk retrofuturista', 1, 'Primeros turnos. Aprendiendo el ritmo de la línea.'),
	('7238d954-9a7d-4c7d-969b-ecd227696c87', 'Operario', 500, 1499, '#22C55E', 2, 'Aura verde leve alrededor del cuerpo, casi imperceptible.', 'Operario que conoce la línea y cumple con regularidad. Uniforme con uso, herramientas visibles, expresión decidida.', 'OBLIGATORIO Marco de metal verde con dos estrellas verdes en la parte superior. Leve brillo verde alrededor del personaje. Uniforme con señales de uso, herramientas básicas visibles. Expresión más decidida. Entorno de fábrica activo al fondo.', 2, 'Conoce la línea. Cumple con regularidad.'),
	('05132bae-e22e-4316-a853-6ba79c042e86', 'Especialista', 1500, 2999, '#3B82F6', 3, 'Aura azul moderada, energía industrial visible en manos y hombros.', 'Especialista que domina los formatos y tiene rendimiento consistente. Postura firme, herramientas avanzadas, sensación de control.', 'OBLIGATORIO Marco de metal azul con tres estrellas azules en la parte superior. Aura azul moderada alrededor del personaje, especialmente en manos y hombros. Uniforme con detalles técnicos, herramientas avanzadas. Postura firme y dominante. Maquinaria compleja al fondo.', 3, 'Domina los formatos. Rendimiento consistente.'),
	('f57411a4-bbcd-469d-b156-e2da2bf3d532', 'Veterano', 3000, 4999, '#A855F7', 4, 'Aura púrpura estable y potente, visible claramente alrededor del cuerpo.', 'Veterano referente del turno con alto rendimiento. Uniforme personalizado, expresión dominante, sensación de experiencia.', 'OBLIGATORIO Marco de metal púrpura con cuatro estrellas púrpuras en la parte superior. Aura púrpura estable y potente alrededor del personaje. Uniforme con marcas de uso y mejoras personalizadas. Expresión segura y dominante. Entorno industrial intenso al fondo.', 4, 'Referente del turno. Alto rendimiento semana a semana.'),
	('b6d42fa9-da79-44db-bf19-30dbbe925ea7', 'Maestro', 5000, 7499, '#EAB308', 5, 'Aura dorada brillante y estable, el entorno responde a su presencia.', 'Maestro entre los mejores de la fábrica. Uniforme con insignias únicas, aura dorada, autoridad técnica absoluta.', 'OBLIGATORIO Marco dorado ornamentado con cinco estrellas doradas en la parte superior. Aura dorada brillante alrededor del personaje. Uniforme mejorado con insignias únicas. Sensación de autoridad técnica. El entorno de fábrica parece responder a su presencia.', 5, 'Entre los mejores de la fábrica.'),
	('8c212bfc-4110-4e1d-80f3-1b8a408f2149', 'Elite', 7500, 10499, '#F59E0B', 6, 'Aura dorada intensa con destellos, presencia imponente que domina el entorno.', 'Elite en la cima del sistema. Uniforme híbrido industrial-tecnológico, aura intensa, dominio absoluto de la línea.', 'OBLIGATORIO Marco dorado avanzado con seis estrellas doradas brillantes en la parte superior y destellos en las esquinas. Aura dorada intensa con destellos alrededor del personaje. Uniforme híbrido industrial-tecnológico avanzado. Presencia imponente. La línea de producción parece optimizada a su alrededor.', 6, 'Cima del sistema. La línea no tiene secretos para este operario.'),
	('6d2633f3-1137-469b-8de9-9c69406e259d', 'Supremo', 10500, 13999, '#EF4444', 7, 'Aura roja y dorada dinámica, efectos de energía visibles constantemente.', 'Supremo con rendimiento fuera de lo normal. Marca el ritmo de toda la línea. Aura energética dinámica, casi mítico.', 'OBLIGATORIO Marco rojo y dorado con siete estrellas en la parte superior, efectos de energía en los bordes. Aura roja y dorada dinámica alrededor del personaje con efectos de energía visibles. Equipo con detalles brillantes. La fábrica parece reaccionar a su ritmo. Sensación casi mítica.', 7, 'Rendimiento fuera de lo normal. Marca el ritmo de toda la línea.'),
	('273ddb19-8b66-4054-a3f5-6d75f79bf31d', 'Titan', 14000, 17999, '#1F2937', 8, 'Aura negra y dorada poderosa que distorsiona ligeramente el entorno cercano.', 'Titan imparable. Produce, resuelve y lidera sin esfuerzo. Presencia dominante, aura que distorsiona el entorno, fuerza inhumana.', 'OBLIGATORIO Marco negro con detalles dorados y ocho estrellas doradas en la parte superior, con efecto de distorsión en los bordes. Aura negra y dorada poderosa alrededor del personaje que distorsiona levemente el entorno. Uniforme reforzado con elementos industriales avanzados. Figura colosal en impacto visual. Sensación de fuerza inhumana.', 8, 'Nivel imparable. Produce, resuelve y lidera sin esfuerzo.'),
	('7ff17821-319f-4bc3-aa32-ddc20a6d6123', 'Leyenda', 18000, NULL, '#FCD34D', 9, 'Aura dorada mítica intensa, el entorno gira en torno a su figura legendaria.', 'Leyenda con nombre propio en la fábrica. Su nivel es referencia para todos. Aura dorada mítica, figura legendaria absoluta.', 'OBLIGATORIO Marco dorado mítico ornamentado con nueve estrellas doradas en la parte superior, rayos de luz emanando de las esquinas y efectos épicos en los bordes. Aura dorada mítica e intensa alrededor del personaje. Diseño casi simbólico y legendario. El entorno de fábrica parece girar en torno a él. Sensación de mito industrial vivo.', 9, 'Nombre propio en la fábrica. Su nivel es referencia para todos.');


--
-- Data for Name: programacion_nota_frase; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."programacion_nota_frase" ("id", "texto", "activa", "orden") VALUES
	('dfdbf871-b65a-46c1-8890-099347f322f5', 'guardar 2 palets y una caja', true, 10),
	('a876fab6-1027-4a46-9025-4907ae8c49c6', 'recordar sacar palet de revisión', true, 20),
	('0a51d071-f797-410f-85a0-b1a78ce99a48', 'cuidado diseño UGL', true, 30);


--
-- Data for Name: puntos_metros; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."puntos_metros" ("id", "m2_min", "m2_max", "puntos") VALUES
	('2a2f4ba7-6330-4e54-b3ea-ef5b6bf16866', 0, 4999, 2),
	('b0004b64-6fa1-47f5-ae14-33e274964ba6', 5000, 6999, 5),
	('54a29e97-f560-4fdf-9fa8-26269b4c96e7', 7000, 8999, 8),
	('29b3c59f-73e4-47b6-b2ba-82e48973dbeb', 9000, 10999, 12),
	('99cf0bb9-1c67-422c-b8d6-1d579ed45d59', 11000, 12999, 16),
	('324e4a36-92ef-4f57-90ac-a05bfbd6d267', 13000, 14999, 21),
	('fdf0193e-97ea-4c49-a190-520c13fa4911', 15000, 16999, 26),
	('f51a0b3f-f83b-4eb7-9a48-62200fc50fbb', 17000, 18999, 32),
	('4f300746-1507-4311-89fe-ac43e964cd8f', 19000, 20999, 38),
	('382931d2-434a-4d90-b528-628fab84c728', 21000, NULL, 45);


--
-- Data for Name: puntos_piezas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."puntos_piezas" ("id", "formato", "min", "max", "puntos") VALUES
	('a62b0258-f1a8-459c-ac18-063aadff5cb3', '200x1200', 6000, 7999, 2),
	('c2b0a143-5afb-4c97-9ab9-1c0c0a49c65a', '200x1200', 8000, 9999, 5),
	('cb24e9ee-778f-4ba8-b57e-447b79648671', '200x1200', 10000, 11999, 9),
	('14cc59db-b5e9-4fa1-9528-38b90f0f0885', '200x1200', 12000, 13999, 12),
	('d6c2ad15-0f5b-47e6-b101-9962cc540e6a', '200x1200', 14000, NULL, 15),
	('54534bc9-d1ac-4d1b-bb6f-3c49563595cf', '300x1200', 4000, 5999, 2),
	('613c63a9-3506-42ee-8b27-bfe5d0694ab8', '300x1200', 6000, 7999, 5),
	('b8df0744-e5f6-45e5-8f5e-fb3f0b2910fa', '300x1200', 8000, 9999, 9),
	('63bfb63c-06f1-4470-9ad3-6d48935cedd3', '300x1200', 10000, 11999, 12),
	('91898147-0a70-4879-9f31-d74b1749966d', '300x1200', 12000, NULL, 15),
	('877f5dfb-cd96-4628-9918-6b0e5c627af2', '600x1200', 2000, 2999, 2),
	('cad47f80-a740-43a3-a581-76452f6fb59e', '600x1200', 3000, 3999, 5),
	('0c28c913-0b13-4b70-97e2-34a1276e11f1', '600x1200', 4000, 4999, 9),
	('53c534c7-ee6b-44f1-a2fe-1334881827d7', '600x1200', 5000, 5999, 12),
	('4ea0b22c-e32e-42e6-8ffa-693e0ff9119b', '600x1200', 6000, NULL, 15),
	('1e6c2b75-3c1b-42d2-ac52-d52c2bf8bb95', '1200x1200', 1000, 1249, 2),
	('35fdf835-bbef-4f91-bf4b-b3679f2fdf59', '1200x1200', 1250, 1749, 5),
	('1632cc53-d2b6-4748-b050-2696a91c531c', '1200x1200', 1750, 1999, 9),
	('f8e62f94-7ec9-4fa8-8d8b-68460440ff2a', '1200x1200', 2000, 2249, 12),
	('bcc46d47-200f-446a-87e1-8bfeffaf4d03', '1200x1200', 2250, NULL, 15),
	('99c8cb32-07e7-4f70-9f90-87f5953d66ba', '300x600', 10000, 13999, 2),
	('253c6a07-9292-403f-a180-bb4312cc05fd', '300x600', 14000, 16999, 5),
	('e9d893ae-8343-44ce-814f-4be6defbab45', '300x600', 17000, 19999, 9),
	('f34f304f-30fa-4556-b6ae-4400fcb4a799', '300x600', 20000, 21999, 12),
	('d7846300-ec65-43a2-8686-141abe9450ac', '300x600', 22000, NULL, 15),
	('56413027-1bb2-44c0-ac1a-1171655b125c', '600x600', 4000, 5999, 2),
	('70b9e121-9401-4877-a709-04a99ef7eca3', '600x600', 6000, 7999, 5),
	('602f2733-4c8f-4bfb-af49-c49374e93bc7', '600x600', 8000, 9999, 9),
	('2c697a5b-5b24-487d-bc72-c403ccbccf62', '600x600', 10000, 11999, 12),
	('07a5f3e5-1044-4787-8d0c-18fd10cd7390', '600x600', 12000, NULL, 15),
	('b9557e11-f20c-4dac-b698-d7362d281fee', '900x900', 1500, 2199, 2),
	('c8fbd157-6872-4e8e-b753-2d44fa96fd67', '900x900', 2200, 2999, 5),
	('d541412b-29cb-48ae-bda2-cc413375c2b0', '900x900', 3000, 3799, 9),
	('dcfdccbf-cc1f-437a-b455-bea79c7f4ea6', '900x900', 3800, 4499, 12),
	('7c37dbb6-a0ab-4c35-9638-254107c4c059', '900x900', 4500, NULL, 15);


--
-- Data for Name: puntos_rendimiento; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."puntos_rendimiento" ("id", "pct_min", "pct_max", "puntos") VALUES
	('891ab51b-fb40-4c80-8672-52ec984640ef', 0.00, 24.99, 1),
	('ce8d37bc-41a7-4824-9922-2f1f34d6f16a', 25.00, 37.49, 2),
	('81ea3288-dffc-48b1-8887-984c21e50e2f', 37.50, 49.99, 5),
	('8029ba22-f41f-48db-a618-6aadebf771c4', 50.00, 62.49, 9),
	('34fdd3a1-1a3d-496c-94ef-769fd1bc7a16', 62.50, 74.99, 12),
	('66eb875e-2f13-4b97-a8ff-786c74d95059', 75.00, 100.00, 15);


--
-- Data for Name: puntos_rendimiento_responsable; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."puntos_rendimiento_responsable" ("id", "pct_min", "pct_max", "puntos") VALUES
	('30f467a9-d490-473e-a906-8362ffd5873d', 91.67, 100.00, 45),
	('c5016d86-b102-414e-ba5c-6f8970bc7a9e', 0.00, 20.82, 2),
	('5d212d10-847a-46b2-aced-af0f5aeabf03', 20.83, 29.16, 5),
	('161178b7-2517-4ce0-b0e0-4697e6acb16d', 29.17, 37.49, 8),
	('f054e25a-926f-44d2-8f1e-19d1d3d452ad', 37.50, 45.82, 12),
	('0189c9fe-279b-4e0d-99bd-69e6a8c88c8d', 45.83, 58.32, 16),
	('d6f9618a-fd35-460f-96f4-db60e0f3b0dc', 58.33, 66.66, 21),
	('f720e9bb-8ed1-47ea-820d-55de1719ea70', 66.67, 74.99, 26),
	('5b74bc85-ce4b-4e5f-a8db-ca721cebe852', 75.00, 83.32, 32),
	('7e0ea8b2-09ac-4ee5-bbe9-5755f023dfb6', 83.33, 91.66, 38);


--
-- PostgreSQL database dump complete
--

-- \unrestrict SNfJryGj7CHJCZ4vdPxvC5FVBmEbbfivk38vR8ceDjPMRILHZjavihekTMh4t7r

RESET ALL;
