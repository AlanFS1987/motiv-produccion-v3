insert into logros_definicion (nombre, descripcion, rol, condicion_tipo, condicion_valor, icono, formato_nombre, activo) values
('Argos',              'Has capturado 1.000 nuevos lotes',                            'responsable', 'lotes_creados',        1000, '👁️', null, true),
('El detallista',      'Has verificado 1.000 códigos de barras con la app',           'responsable', 'verificaciones_codbar',1000, '🔍', null, true),
('Creador de Héroes',  'Un operario de tu letra ha ganado el ciclo',                  'responsable', 'creador_de_heroes',    null, '🦸', null, true),
('El Equipo A',        'Entre todos tus operarios habéis conseguido más de 3.000 puntos en un ciclo', 'responsable', 'equipo_a', 3000, '🅰️', null, true);

-- Comprobación: 19 filas responsable en total.
select condicion_tipo, count(*) from logros_definicion where rol = 'responsable' group by 1 order by 1;
select count(*) as total from logros_definicion where rol = 'responsable';
