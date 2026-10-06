-- =============================================================
-- Siembra de logros del responsable (sesión 25/08/2026) — solo los
-- que no necesitan ningún condicion_tipo nuevo:
--   - 9 de tramo (sum(columna) sobre historial_ciclo_responsable +
--     ciclo actual en vivo, igual que el operario)
--   - 2 de ciclo por puntos (bestia_ciclo_responsable /
--     ciclo_legendario_responsable — mismo patrón que el operario,
--     nombre de condicion_tipo distinto para no chocar con la
--     tabla de origen)
--   - 1 de ciclo "gana el ranking" (lider_indiscutible — equivalente
--     a rey_de_reyes pero contra v_puntos_responsable_ciclo /
--     historial_ciclo_responsable en vez de las de operario)
--
-- Quedan FUERA de esta siembra (pendientes de condicion_tipo nuevo
-- o de columnas/tablas que aún no existen, ver 07-pendientes.md):
-- Argos, El detallista, El Manitas, El salvador, Creador de Héroes,
-- El Equipo A.
-- =============================================================

insert into logros_definicion (nombre, descripcion, rol, condicion_tipo, condicion_valor, icono, formato_nombre, activo) values
('El Relojero',              'Acumula 1.000 horas en plena producción',                 'responsable', 'minutos_plena',        60000,   '⏰', null, true),
('El Paciente',               'Acumula 1.000 horas esperando material',                  'responsable', 'minutos_no_alimentada',60000,   '😌', null, true),
('Sin remedio',               'Acumula 1.000 horas con saturación',                      'responsable', 'minutos_saturacion',   60000,   '🤷', null, true),
('El paciente del taller',    'Acumula 1.000 horas con banco inhabilitado',              'responsable', 'minutos_banco',       60000,   '🔄', null, true),
('¿Dónde está el mecánico?',  'Acumula 1.000 horas con máquina parada',                  'responsable', 'minutos_maquina',     60000,   '🔧', null, true),
('El Rey de la Calidad',      'Acumula 2.000.000 m² de material de primera',             'responsable', 'm2_std',              2000000, '🏅', null, true),
('El Magnate Comercial',      'Acumula 150.000 m² de material comercial',                'responsable', 'm2_com',              150000,  '✨', null, true),
('Destructor',                'Acumula 150.000 m² de material contenedor',               'responsable', 'm2_contenedor',       150000,  '🗻', null, true),
('El Coloso',                 'Acumula 3.000.000 m² a lo largo de tu carrera',           'responsable', 'm2_total',            3000000, '🗿', null, true),
('Bestia del Ciclo',          'Consigue 650 puntos en un solo ciclo',                    'responsable', 'bestia_ciclo_responsable',     650, '⚡', null, true),
('Ciclo Legendario',          'Consigue 780 puntos en un solo ciclo',                    'responsable', 'ciclo_legendario_responsable', 780, '🔥', null, true),
('Líder indiscutible',        'Termina un ciclo en primera posición del ranking',        'responsable', 'lider_indiscutible',  null,    '👑', null, true);

-- Comprobación rápida: deben salir 12 filas nuevas.
select condicion_tipo, count(*) from logros_definicion where rol = 'responsable' group by 1 order by 1;
