-- =============================================================
-- Siembra de los 19 logros del operario en logros_definicion,
-- adaptados de la tabla real de v2 (CSV subido en sesión 23/08/2026)
-- al vocabulario de condicion_tipo que espera el motor de v3
-- (frontend/src/lib/logros.ts):
--
--   - 'puntos_ciclo' (v2, Bestia del Ciclo) → 'bestia_ciclo'
--   - 'ganar_ciclo'  (v2, Rey de Reyes)     → 'rey_de_reyes'
--   - 'Turno Legendario' (v2, puntos_turno) → SUSTITUIDO por
--     'Ciclo Legendario' (condicion_tipo='ciclo_legendario',
--     condicion_valor=1000) — decisión de sesión: 1.000 puntos en un
--     solo ciclo, no 48 puntos en un solo turno.
--   - El resto (m2_total, tiempo_*, m2_contenedor/com/std,
--     piezas_formato ×7) ya coincide tal cual con v2.
--
-- No se preservan los ids enteros de v2 (1-19) — logros_definicion
-- de v3 usa uuid con default, se dejan generar solos.
-- =============================================================

insert into logros_definicion (nombre, descripcion, rol, condicion_tipo, condicion_valor, icono, formato_nombre, activo) values
('El Terraformador',            'Acumula 250.000 m² producidos a lo largo de tu carrera', 'operario', 'm2_total',            250000, '🌍', null,        true),
('Bestia del Ciclo',            'Consigue 600 puntos en un solo ciclo',                    'operario', 'bestia_ciclo',        600,    '⚡', null,        true),
('Ciclo Legendario',            'Consigue 1.000 puntos en un solo ciclo',                  'operario', 'ciclo_legendario',    1000,   '🔥', null,        true),
('Rey de Reyes',                'Termina un ciclo en primera posición del ranking',        'operario', 'rey_de_reyes',        null,   '👑', null,        true),
('La Máquina Humana',           'Acumula 100 horas en plena producción',                   'operario', 'tiempo_plena',        6000,   '💪', null,        true),
('Esperando suministro',        'Acumula 100 horas esperando material',                    'operario', 'tiempo_no_alimentada',6000,   '😴', null,        true),
('Se te resiste la papiroflexia','Acumula 100 horas con saturación',                       'operario', 'tiempo_saturacion',   6000,   '📦', null,        true),
('¿Dónde está el mecánico?',    'Acumula 100 horas con máquina parada',                    'operario', 'tiempo_maquina',      6000,   '🔧', null,        true),
('Otro cambio de modelo',       'Acumula 100 horas con banco inhabilitado',                'operario', 'tiempo_banco',        6000,   '🔄', null,        true),
('Montaña de escombros',        'Acumula 100.000 m² de material contenedor',               'operario', 'm2_contenedor',       100000, '🗻', null,        true),
('Demasiado material pulido',   'Acumula 100.000 m² de material comercial',                'operario', 'm2_com',              100000, '✨', null,        true),
('De primerísima calidad',      'Acumula 100.000 m² de material de primera',               'operario', 'm2_std',              100000, '🏅', null,        true),
('Rey del 200x1200',            '100.000 piezas de formato 200x1200',                      'operario', 'piezas_formato',      100000, '🎯', '200x1200',  true),
('Rey del 300x1200',            '100.000 piezas de formato 300x1200',                      'operario', 'piezas_formato',      100000, '🎯', '300x1200',  true),
('Rey del 600x1200',            '100.000 piezas de formato 600x1200',                      'operario', 'piezas_formato',      100000, '🎯', '600x1200',  true),
('Rey del 1200x1200',           '100.000 piezas de formato 1200x1200',                     'operario', 'piezas_formato',      100000, '🎯', '1200x1200', true),
('Rey del 300x600',             '100.000 piezas de formato 300x600',                       'operario', 'piezas_formato',      100000, '🎯', '300x600',   true),
('Rey del 600x600',             '100.000 piezas de formato 600x600',                       'operario', 'piezas_formato',      100000, '🎯', '600x600',   true),
('Rey del 900x900',             '100.000 piezas de formato 900x900',                       'operario', 'piezas_formato',      100000, '🎯', '900x900',   true);

-- Comprobación rápida: deben salir 19 filas, 7 de ellas 'piezas_formato'.
select condicion_tipo, count(*) from logros_definicion group by condicion_tipo order by 1;
select count(*) as total from logros_definicion;
