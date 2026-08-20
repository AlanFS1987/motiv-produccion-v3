-- =============================================================
-- 0001 — Extensiones y configuración global
-- Ref. spec: 06-integraciones.md (8), 07-arquitectura.md (9.1)
-- =============================================================

create extension if not exists pg_trgm;   -- búsqueda por similitud (resolución modelo/marca)
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- pg_cron está disponible en Supabase (se habilita desde el panel:
-- Database > Extensions), pero no en todos los entornos locales de
-- test — se intenta sin romper el resto del despliegue si falta.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron no disponible en este entorno — habilitarlo '
               'manualmente en Supabase antes de programar cerrar-ciclo '
               '(13.7). El resto del esquema no depende de esta extensión.';
end $$;

-- -------------------------------------------------------------
-- Tabla de configuración: valores que en otro sistema serían
-- constantes de código, aquí viven en BD para poder ajustarlos
-- sin desplegar (ej. la fecha de arranque de la rotación).
-- -------------------------------------------------------------
create table configuracion (
  clave  text primary key,
  valor  text not null,
  nota   text
);

-- Fecha de referencia (lunes) desde la que arranca la rotación de
-- turnos y el ciclo de gamificación — 04-rol-administrador.md 6.2.
-- AJUSTAR este valor en el momento real del lanzamiento de v3.
insert into configuracion (clave, valor, nota) values
  ('fecha_inicio_rotacion', '2026-01-05',
   'Lunes de arranque de v3. Ajustar antes de ir a producción — '
   'todo el cálculo de rotación de turnos y ciclos de gamificación '
   'depende de esta fecha (05-modelo-de-datos.md 7.8, 08-pendientes.md).');
