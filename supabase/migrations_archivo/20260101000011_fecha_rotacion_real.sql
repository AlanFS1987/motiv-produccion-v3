-- =============================================================
-- 0011 — Fecha real de inicio de rotación de turnos / ciclo
-- Sustituye el valor provisional de 0001 por la fecha real
-- confirmada por el cliente: 31/08/2026 (lunes, verificado).
-- =============================================================

update configuracion
set valor = '2026-08-31',
    nota  = 'Lunes de arranque de la beta (confirmado 13/08/2026). '
            'Toda la rotación de turnos y los ciclos de 28 días de '
            'gamificación cuentan desde aquí.'
where clave = 'fecha_inicio_rotacion';
