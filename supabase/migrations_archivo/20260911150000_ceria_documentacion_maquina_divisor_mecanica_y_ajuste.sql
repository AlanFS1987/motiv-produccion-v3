-- Borrador — Divisor (BS08): fallos mecánicos y procedimiento de
-- ajuste desde cero. Para revisión antes de aplicar.
-- Origen: sesión de test de diagnóstico (11/09/2026), explicación
-- directa del mecánico.
--
-- Contenido:
--   1) Dos piezas nuevas: tornillos de anclaje, rodamientos de guías
--      verticales — con sus pruebas rápidas de comprobación.
--   2) Criterio para distinguir fallo mecánico (grave, errático, sin
--      dirección consistente) de fallo de parámetro (sutil, con
--      dirección consistente) — revisar mecánica ANTES de tocar
--      parámetros.
--   3) Actualización de "Mordaza vulcanizada" con el desgaste de la
--      goma (causa que divida arriba) y su sustitución.
--   4) Procedimiento completo de ajuste desde cero, en 5 pasos
--      ordenados (mecánica → sensores de calibrado → fotocélula →
--      intereje → offset final).

insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.divisor.pieza.tornillos_anclaje', 'BS08', 'Divisor', 'pieza',
 'Tornillos de anclaje del divisor',
 'Fijan la estructura completa del divisor a la máquina. Si se '
 'parten, la estructura queda con juego excesivo. Ver prueba de '
 'comprobación: "bs08.divisor.mantenimiento.prueba_juego_anclaje".'),

('bs08.divisor.pieza.rodamientos_guias_verticales', 'BS08', 'Divisor', 'pieza',
 'Rodamientos de las guías verticales',
 'Se desplazan por las guías verticales del divisor, dando '
 'integridad mecánica y solidez al desplazamiento de la mordaza. Si '
 'están desgastados o desajustados, la pala vulcanizada bambolea al '
 'moverla con las manos. Ver prueba de comprobación: '
 '"bs08.divisor.mantenimiento.prueba_balanceo_pala".'),

('bs08.divisor.pieza.mordaza_vulcanizada', 'BS08', 'Divisor', 'pieza',
 'Mordaza vulcanizada',
 'Una a cada lado, sujeta a un pistón grande guiado. Es la parte que '
 'mide (fotocélula) y ejecuta físicamente el corte/división de la '
 'pila. Desgaste: el vulcanizado es de un tipo muy duro, tarda en '
 'deteriorarse, pero se desgasta por la parte de abajo con cada '
 'división. Si está muy desgastada, el divisor realiza la división '
 'MÁS ARRIBA de lo que toca, porque la parte que falta es '
 'precisamente la de abajo. Un mal ajuste que fuerce la pila contra '
 'las cadenas tras cada división acelera este desgaste (la máquina '
 'sigue funcionando con normalidad mientras tanto, solo se desgasta '
 'algo más rápido). Sustitución: sencilla, basta con quitar los '
 'tornillos que sujetan la pala vulcanizada al divisor y montar una '
 'nueva.'),

('bs08.divisor.mantenimiento.prueba_juego_anclaje', 'BS08', 'Divisor', 'mantenimiento',
 'Prueba: juego en el anclaje del divisor',
 'Se coge la estructura del divisor por arriba y se tira hacia '
 'atrás. Debe tener muy poco juego. Si el juego es excesivo, indica '
 'que los tornillos de anclaje del divisor a la máquina están '
 'partidos.'),

('bs08.divisor.mantenimiento.prueba_balanceo_pala', 'BS08', 'Divisor', 'mantenimiento',
 'Prueba: balanceo de la pala vulcanizada',
 'Se coge la propia pala vulcanizada, con una mano en cada extremo, '
 'y se intenta balancear. Si bambolea, indica que los rodamientos de '
 'las guías verticales están desgastados o desajustados.'),

('bs08.divisor.mantenimiento.criterio_mecanico_vs_parametro', 'BS08', 'Divisor', 'mantenimiento',
 'Criterio: fallo mecánico vs. fallo de parámetro',
 'Los dos fallos mecánicos más habituales (tornillos de anclaje '
 'partidos, rodamientos de guías verticales desgastados) provocan un '
 'fallo prácticamente constante y con errores aleatorios: puede '
 'escaparse una pieza, dividir muy arriba o muy abajo, sin ninguna '
 'dirección consistente. Un fallo de parámetro (Offset posición '
 'recogida o Intereje FT/mordaza mal ajustados) es, en cambio, '
 'habitualmente sutil y fino, y consistente en su dirección (siempre '
 'sobra, o siempre falta pieza) — salvo casos extremos de '
 'manipulación directa del parámetro. La diferencia más práctica: el '
 'fallo mecánico es mucho más grave y visible, afecta de forma '
 'continuada a muchas más divisiones; el de parámetro es más '
 'discreto. Por eso conviene revisar la integridad mecánica (pruebas '
 'de juego y balanceo) ANTES de ajustar ningún parámetro.'),

('bs08.divisor.mantenimiento.ajuste_cero_01_mecanica', 'BS08', 'Divisor', 'mantenimiento',
 'Ajuste desde cero — 1. Verificar integridad mecánica',
 'Antes de tocar ningún parámetro: prueba de tirar de la estructura '
 'hacia atrás (tornillos de anclaje) y prueba de balanceo de la pala '
 'vulcanizada (rodamientos de guías verticales). Solo se continúa '
 'con el resto del ajuste si ambas pruebas salen bien.'),

('bs08.divisor.mantenimiento.ajuste_cero_02_sensores_calibrado', 'BS08', 'Divisor', 'mantenimiento',
 'Ajuste desde cero — 2. Sensores de calibrado (ambos lados)',
 'Con la mecánica verificada, se colocan los sensores inductivos de '
 'calibrado a ojo, más o menos a la misma altura en ambos lados. Se '
 'ejecuta un calibrado: los dos lados bajan a buscar su sensor y '
 'toman esa cota como 0. En manual, se cierran las mordazas y se '
 'observa visualmente la altura a la que quedan sobre las cadenas de '
 'tracción de la empaquetadora — debe estar entre 1 y 2 mm por '
 'encima de las cadenas (máximo 3 mm). Esta es la altura a la que el '
 'divisor suelta la pila entre división y división; si suelta '
 'demasiado alto hace ruido, golpea, y puede llegar a romper piezas. '
 'Si los dos lados no coinciden dentro de ese margen, se reajusta la '
 'posición física de los sensores y se repite el calibrado, hasta '
 'que ambos lados queden exactamente igual.'),

('bs08.divisor.mantenimiento.ajuste_cero_03_fotocelula', 'BS08', 'Divisor', 'mantenimiento',
 'Ajuste desde cero — 3. Alineación de la fotocélula',
 'Con el calibrado de ambos lados ya correcto, se comprueba que la '
 'fotocélula emisor/receptor está bien encarada y que el receptor '
 'recibe señal. Si no lo está, se encara físicamente.'),

('bs08.divisor.mantenimiento.ajuste_cero_04_intereje', 'BS08', 'Divisor', 'mantenimiento',
 'Ajuste desde cero — 4. Verificación del Intereje FT/mordaza',
 'Se deja entrar una pila, se deja que la máquina la mida (sin '
 'dividir), y se compara con el metro real — ver '
 '"bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza". Se '
 'corrige el intereje (aumentando o reduciendo según corresponda) '
 'hasta que la altura medida por la máquina coincida con la medida '
 'real.'),

('bs08.divisor.mantenimiento.ajuste_cero_05_offset_final', 'BS08', 'Divisor', 'mantenimiento',
 'Ajuste desde cero — 5. Corrección final con Offset posición recogida',
 'Una vez la máquina mide correctamente la pila (paso 4), se observa '
 'a qué altura está haciendo las divisiones y, si hace falta, se '
 'corrige HACIA ABAJO con el Offset posición recogida (nunca hacia '
 'arriba, el parámetro no lo permite). En un ajuste completamente '
 'nuevo casi siempre hace falta esta corrección: durante el '
 'calibrado (paso 2) se dejó hasta 3 mm de margen entre la mordaza '
 'cerrada y las cadenas, para evitar el golpe al soltar la pila. Ese '
 'margen de hasta 3 mm se suma efectivamente a la altura de la pila '
 'en el cálculo, aunque el intereje ya esté midiendo bien — por eso, '
 'en un ajuste desde cero, suele hacer falta bajar la división hasta '
 '3 mm con este offset, incluso sin que nadie lo haya tocado antes.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
