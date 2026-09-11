-- Borrador — Divisor (BS08). Para revisión antes de aplicar como migración.
-- Fuentes: bs08-subsistema-carton.md (no aplica, el Divisor no está ahí)
--          bs08-pantalla-trac-pilas.md (parámetros, dinámica, tiempos, detalle técnico)

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

-- ── PROCESO (una fila por paso, según lo decidido) ──────────────
('bs08.divisor.proceso.01_llegada_parada', 'BS08', 'Divisor', 'proceso',
 '1. Llegada y parada de la pila',
 'La pila completa entra por la tracción warp y para en el divisor. '
 'La "Distancia FT cinta/divisor" es la distancia entre la fotocélula '
 'de salida de los apiladores y el punto donde debe pararse la pila '
 'para poder dividirla.'),

('bs08.divisor.proceso.02_medicion_corte', 'BS08', 'Divisor', 'proceso',
 '2. Medición y corte',
 'Cuando la pila para, el divisor (que espera arriba) baja y mide la '
 'pila antes de dividirla. Estructura: un motor a cada lado de la '
 'pila, cada uno con una mordaza vulcanizada sujeta a un pistón '
 'grande, guiado y fuerte. El motor sube y baja este conjunto '
 'mediante motor + eje + polea dentada, que actúa sobre una '
 'cremallera. Sobre las mordazas hay una fotocélula (emisor en un '
 'lado, receptor en el otro) que mide la altura de la pila — el '
 '"Intereje FT/mordaza" es la altura de esa fotocélula respecto a la '
 'parte baja de la mordaza. Los dos motores son independientes pero '
 'trabajan sincronizados. Calibrado: hay un sensor de calibrado/'
 'posición cero a cada lado; el "Offset calibr." es la parte del '
 'sensor inductivo que queda cubierta, dejando la mordaza a ras de '
 'la tracción de pilas o 1-2 mm por encima (habitual entre 4 y 8 mm, '
 'nunca puede ser 0, a diferencia de otros offsets de la máquina).'),

('bs08.divisor.proceso.03_posicion_espera', 'BS08', 'Divisor', 'proceso',
 '3. Posición de espera entre pilas',
 '"Posición espera" es la altura a la que esperan las mordazas una '
 'nueva pila que llega de los apiladores — tiene que ser superior a '
 'la altura de la pila. Secuencia: llega la pila → las mordazas bajan '
 '→ en el momento en que la fotocélula emisor/receptor (sobre las '
 'propias mordazas) se corta por la pila, ahí se determina su altura '
 '→ a partir de esa altura medida se calcula a qué cota hay que '
 'dividir.'),

('bs08.divisor.proceso.04_escuadrado_mordazas', 'BS08', 'Divisor', 'proceso',
 '4. Escuadrado con mordazas (casi sin uso real)',
 'No son dos mecanismos distintos: ambas formas de escuadrar usan las '
 'mismas mordazas del divisor, solo cambia a qué altura actúan. '
 '"Habilita escuadr. con mordazas": tras medir, las mordazas cierran '
 'del todo a la altura de la división para escuadrar, abren, y '
 'vuelven a cerrar para efectuar el corte. "Escuadra pila": si está '
 'activado, tras medir la pila las mismas mordazas bajan hasta abajo '
 'del todo (a la altura de las cadenas, la posición de calibrado) y '
 'cierran y abren ahí para escuadrar la pila completa, no solo a la '
 'altura de un corte. En la práctica: el escuadrado con mordazas '
 'nunca se usa; el de pila completa solo se usa cuando la pila llega '
 'muy torcida, y aun así muchas veces el mecanismo no tiene fuerza '
 'suficiente para moverla.'),

-- ── PARÁMETRO (incluye lo "constructivo", marcado en el propio texto) ─
('bs08.divisor.parametro.distancia_ft_cinta_divisor', 'BS08', 'Divisor', 'parametro',
 'Distancia FT cinta/divisor',
 'Distancia entre la fotocélula de salida de los apiladores y el '
 'punto donde debe pararse la pila para poder dividirla. Valor '
 'capturado el 09/09/2026: 1212 mm. Se reajusta por formato.'),

('bs08.divisor.parametro.intereje_ft_mordaza', 'BS08', 'Divisor', 'parametro',
 'Intereje FT/mordaza',
 'Altura de la fotocélula de medición (sobre las mordazas) respecto '
 'a la parte baja de la mordaza — es la fotocélula que mide la altura '
 'de la pila para calcular las divisiones. Valor capturado: 68 mm. '
 'Se reajusta por formato.'),

('bs08.divisor.parametro.offset_posicion_recogida', 'BS08', 'Divisor', 'parametro',
 'Offset posición recogida',
 'Corrige la posición calculada para la división, permitiendo '
 'realizarla solo más abajo de la calculada — a más valor, más abajo. '
 'No admite valores negativos (no se puede corregir hacia arriba). '
 'Rango habitual: 0 a 3 mm. Valor capturado: 1 mm. Se reajusta por '
 'formato.'),

('bs08.divisor.parametro.posicion_espera', 'BS08', 'Divisor', 'parametro',
 'Posición espera',
 'Altura a la que esperan las mordazas una nueva pila que llega de '
 'los apiladores — debe ser superior a la altura de la pila. Valor '
 'capturado: 50 mm. Se reajusta por formato.'),

('bs08.divisor.parametro.offset_calibracion', 'BS08', 'Divisor', 'parametro',
 'Offset calibr.',
 'La parte del sensor inductivo de calibrado que queda cubierta, '
 'dejando la mordaza a ras de la tracción de pilas o 1-2 mm por '
 'encima. Habitualmente entre 4 y 8 mm. Nunca puede ser 0 (a '
 'diferencia de otros offsets de la máquina). Ajustable mecánicamente '
 'moviendo la posición física del sensor. Valor capturado: 8 mm.'),

('bs08.divisor.parametro.numero_ciclos_calibracion', 'BS08', 'Divisor', 'parametro',
 'Número de ciclos de calibración',
 'Valor capturado: 1. Se reajusta por formato.'),

('bs08.divisor.parametro.division_sin_fotocelula', 'BS08', 'Divisor', 'parametro',
 'División de la pila sin fotocélula',
 'Booleano. Capturado en "No". Si está en "No", el campo "Cuota de '
 'división de la pila" queda en gris/inactivo.'),

('bs08.divisor.parametro.cuota_division_pila', 'BS08', 'Divisor', 'parametro',
 'Cuota de división de la pila',
 'Valor capturado: 14 (campo inactivo por estar "División de la pila '
 'sin fotocélula" en No).'),

('bs08.divisor.parametro.habilitado', 'BS08', 'Divisor', 'parametro',
 'Habilitado',
 'Capturado en "Sí". Dato constructivo: si el divisor está montado '
 'físicamente en esta máquina, no se reajusta por formato.'),

('bs08.divisor.parametro.habilita_escuadr_mordazas', 'BS08', 'Divisor', 'parametro',
 'Habilita escuadr. con mordazas',
 'Booleano, capturado en "No" en esta línea. En la práctica este modo '
 'de escuadrado nunca se usa (ver tipo=proceso, paso 4).'),

('bs08.divisor.parametro.escuadra_pila', 'BS08', 'Divisor', 'parametro',
 'Escuadra pila',
 'Booleano, capturado en "No" en esta línea. Solo se usaría cuando la '
 'pila llega muy torcida (ver tipo=proceso, paso 4).'),

('bs08.divisor.parametro.reductor_i50', 'BS08', 'Divisor', 'parametro',
 'Reductor I50',
 'Dato constructivo (no se reajusta por formato, solo cambia si se '
 'sustituye físicamente la pieza): el divisor monta de serie un '
 'reductor I30; existe la opción de montar en su lugar un reductor '
 'I50 más grande/con otra relación. Capturado en "No" (monta I30). Es '
 'el único dato constructivo de la pantalla "Máquina" que se toca en '
 'la práctica, si algún día se cambia esa pieza.'),

-- ── DINÁMICA / TIEMPOS (siguen siendo "parametro": velocidades,
--    aceleraciones y tiempos, todos reajustables por formato) ────
('bs08.divisor.parametro.velocidad_vacio', 'BS08', 'Divisor', 'parametro',
 'Velocid. vacío',
 'Valor capturado: 3000 step/s. Motores paso a paso, sin encoder. '
 'Configuración habitual de referencia: 5000 subida/5000 bajada/5 '
 'aceleración — el valor capturado el 09/09 (3000/3000/3) confirma '
 'que estos valores sí varían por formato.'),

('bs08.divisor.parametro.velocidad_llenado', 'BS08', 'Divisor', 'parametro',
 'Veloc. llenado',
 'Valor capturado: 3000 step/s.'),

('bs08.divisor.parametro.aceleracion', 'BS08', 'Divisor', 'parametro',
 'Aceleración (dinámica)',
 'Valor capturado: 3.'),

('bs08.divisor.parametro.tiempo_cierre', 'BS08', 'Divisor', 'parametro',
 'Tiempo de cierre',
 'Valor capturado: 1400 ms.'),

('bs08.divisor.parametro.tempo_ganasce_aperte', 'BS08', 'Divisor', 'parametro',
 '_Tempo ganasce aperte',
 'Término en italiano sin traducir en el software: "tiempo mordazas '
 'abiertas". Valor capturado: 150 ms.'),

('bs08.divisor.parametro.tempo_chiusura_squadratura', 'BS08', 'Divisor', 'parametro',
 '_Tempo chiusura per squadratura',
 'Término en italiano sin traducir en el software: "tiempo cierre '
 'para escuadrado". Valor capturado: 5 ms.'),

-- ── SENSOR ───────────────────────────────────────────────────────
('bs08.divisor.sensor.fotocelula_medicion_altura', 'BS08', 'Divisor', 'sensor',
 'Fotocélula de medición de altura',
 'Emisor en un lado, receptor en el otro, montada sobre las mordazas '
 'vulcanizadas. Mide la altura de la pila para poder calcular las '
 'divisiones — el "Intereje FT/mordaza" es la altura de esta '
 'fotocélula respecto a la parte baja de la mordaza.'),

('bs08.divisor.sensor.inductivo_calibrado', 'BS08', 'Divisor', 'sensor',
 'Sensor inductivo de calibrado',
 'Uno a cada lado, en la parte baja. Sensor de calibrado/posición '
 'cero — el "Offset calibr." define cuánto queda cubierto para dejar '
 'la mordaza a ras de la tracción de pilas o 1-2 mm por encima. '
 'Ajustable mecánicamente moviendo la posición física del sensor.'),

('bs08.divisor.sensor.fotocelula_salida_apiladores', 'BS08', 'Divisor', 'sensor',
 'Fotocélula de salida de apiladores',
 'No está físicamente en el divisor, pero es la referencia de la '
 '"Distancia FT cinta/divisor": mide desde aquí hasta el punto donde '
 'debe pararse la pila.'),

-- ── ACTUADOR ─────────────────────────────────────────────────────
('bs08.divisor.actuador.motor_paso_a_paso', 'BS08', 'Divisor', 'actuador',
 'Motor paso a paso (x2, uno por lado)',
 'Sin encoder, precisión de milímetros (a diferencia de motores '
 'convencionales como el del sacabandejas o el empujador de pila). '
 'Independientes pero sincronizados entre sí. Sube y baja el conjunto '
 'de mordaza mediante motor + eje + polea dentada, actuando sobre una '
 'cremallera.'),

('bs08.divisor.actuador.pision_mordaza', 'BS08', 'Divisor', 'actuador',
 'Pistón de la mordaza',
 'Pistón grande, guiado y fuerte, al que va sujeta la mordaza '
 'vulcanizada de cada lado.'),

-- ── PIEZA ────────────────────────────────────────────────────────
('bs08.divisor.pieza.mordaza_vulcanizada', 'BS08', 'Divisor', 'pieza',
 'Mordaza vulcanizada',
 'Una a cada lado, sujeta a un pistón grande guiado. Es la parte que '
 'mide (fotocélula) y ejecuta físicamente el corte/división de la '
 'pila.'),

('bs08.divisor.pieza.cremallera', 'BS08', 'Divisor', 'pieza',
 'Cremallera',
 'Recibe el movimiento del motor a través del eje y la polea dentada '
 'para subir/bajar el conjunto de la mordaza.'),

('bs08.divisor.pieza.eje_polea_dentada', 'BS08', 'Divisor', 'pieza',
 'Eje y polea dentada',
 'Transmiten el movimiento del motor a la cremallera.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();