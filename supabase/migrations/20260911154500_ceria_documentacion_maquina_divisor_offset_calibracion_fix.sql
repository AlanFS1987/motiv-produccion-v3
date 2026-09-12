-- Borrador — Divisor (BS08): corrección de Offset calibr.
-- Para revisión antes de aplicar.
-- Origen: aclaración del mecánico (11/09/2026) — la posición física
-- del sensor de calibrado, ajustada mecánicamente en el chasis, ES
-- el cero de la máquina. No son dos conceptos distintos.

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.divisor.parametro.offset_calibracion', 'BS08', 'Divisor', 'parametro',
 'Offset calibr.',
 'La parte del sensor inductivo de calibrado que queda cubierta, '
 'dejando la mordaza a ras de la tracción de pilas o 1-2 mm por '
 'encima. Habitualmente entre 4 y 8 mm. Nunca puede ser 0 (a '
 'diferencia de otros offsets de la máquina). El sensor se ajusta '
 'moviéndolo físicamente arriba o abajo en el chasis del divisor — '
 'no hay distinción entre "posición del sensor" y "cero de la '
 'máquina": son la misma cosa. Donde el mecánico decida colocar el '
 'sensor mecánicamente, eso es exactamente lo que la máquina toma '
 'como cero al calibrar. Valor capturado: 8 mm. El mecánico deja '
 'deliberadamente el sensor entre 1 y 3 mm por encima de las '
 'cadenas: al soltar la pila entre división y división, evita que '
 'las mordazas la fuercen contra las cadenas (si quedara más alto, '
 'soltaría la pila desde demasiado alto, con golpe y riesgo de '
 'romper piezas). Relación con "Offset posición recogida": como el '
 'cero elegido para el sensor queda, a propósito, entre 1 y 3 mm '
 'por encima de las cadenas reales, cualquier división calculada '
 'desde ese cero queda ese mismo margen por encima de lo que '
 'tocaría — por eso, en un ajuste desde cero, casi siempre hay que '
 'aplicar el Offset posición recogida para compensar precisamente '
 'ese margen.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
