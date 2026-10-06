-- Borrado de tablas de backup/staging previas al squash de migraciones.
-- Respaldo (esquema y datos) en privado/backups/squash/bak_tablas_20261006.sql
drop table if exists public.bak_20261004_lote;
drop table if exists public.bak_20261004_parte;
drop table if exists public.bak_20261004_producto;
drop table if exists public.bak_20261004_modelo;
drop table if exists public.bak_20261004b_lote;
drop table if exists public.bak_20261004b_parte;
drop table if exists public.bak_20261004b_producto;
drop table if exists public.bak_20261004b_modelo;
drop table if exists public.bak_20261004b_marca;
drop table if exists public.bak_20261004c_lote;
drop table if exists public.programacion_orden_bak_20261002;
drop table if exists public.programacion_orden_historico_bak_20261002;
drop table if exists public.stg_migracion_operario_v2;
