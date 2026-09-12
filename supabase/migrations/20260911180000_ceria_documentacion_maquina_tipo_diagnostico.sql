-- Borrador — Nuevo tipo 'diagnostico'. Para revisión antes de aplicar.
-- Origen: propuesta del mecánico (11/09/2026) — árboles de preguntas
-- para llegar de un síntoma vago a la causa y solución, apoyándose
-- en las filas de parametro/alarma/mantenimiento ya existentes.
--
-- OJO: el nombre real de la constraint CHECK sobre "tipo" no está
-- confirmado desde aquí (se asume el nombre por defecto de Postgres,
-- <tabla>_<columna>_check). Verificar el nombre real antes de
-- aplicar esta migración, o ajustarlo si no coincide.

alter table ceria_documentacion_maquina
  drop constraint if exists ceria_documentacion_maquina_tipo_check;

alter table ceria_documentacion_maquina
  add constraint ceria_documentacion_maquina_tipo_check
  check (tipo in (
    'proceso', 'parametro', 'sensor', 'actuador', 'pieza', 'alarma',
    'mantenimiento', 'configuracion_inicial', 'diagnostico'
  ));

-- Primer caso: el árbol completo que ya cerramos para "divide mal".
insert into ceria_documentacion_maquina (clave, maquina, submaquina, tipo, nombre, contenido) values

('bs08.divisor.diagnostico.divide_mal', 'BS08', 'Divisor', 'diagnostico',
 'Síntoma vago: "divide mal" / "corta mal" / "se le escapa una pieza" / "sobra o falta pieza en la caja"',
 'Paso 0 — descartar mecánica antes que parámetro: si el fallo es '
 'errático (a veces sobra, a veces falta, sin patrón claro, y/o va '
 'acompañado de piezas rotas o ruido), sospechar fallo mecánico, no '
 'paramétrico — ver "bs08.divisor.mantenimiento.criterio_mecanico_'
 'vs_parametro" y las pruebas de juego/balanceo. Solo seguir con lo '
 'siguiente si el fallo tiene una dirección CONSISTENTE (siempre '
 'sobra, o siempre falta pieza). Pregunta clave: la pila que compone '
 'una caja con piezas de más, ¿es siempre (o casi siempre) la '
 'ÚLTIMA división del ciclo, o puede ser cualquier división sin '
 'relación con ser la última? → Si es la ÚLTIMA división: divide '
 'demasiado abajo → revisar "Intereje FT/mordaza" (ver '
 '"bs08.divisor.mantenimiento.verificacion_intereje_ft_mordaza"). → '
 'Si puede ser CUALQUIERA (no ligado a ser la última): divide '
 'demasiado arriba → revisar "Offset posición recogida" (subir '
 'dentro de 0-3 mm). Si hace falta subir el offset por encima de 3 '
 'mm para que cuadre, la causa real ya no es el offset en sí, sino '
 'que el "Intereje FT/mordaza" está por ENCIMA de lo que debería — '
 'revisar igualmente con el mismo procedimiento de verificación.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
