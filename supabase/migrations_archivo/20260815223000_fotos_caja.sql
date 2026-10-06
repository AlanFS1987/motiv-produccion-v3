-- Columna para guardar la(s) foto(s) de verificacion de caja.
-- Sesion 15/08 tarde.
-- Mismo patron que incidencia_calidad.fotos: array de texto, admite
-- 1 foto (formatos pequenos) o 2 (formatos grandes, superior+lateral).

alter table parte
  add column if not exists fotos_caja text[];