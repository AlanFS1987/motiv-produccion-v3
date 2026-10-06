-- =============================================================
-- Informes por periodo: DIARIO (turnos M+T+N de un día) y SEMANAL
-- (lunes M -> domingo N). Sesión 20/09/2026.
--
-- Encargo del encargado de clasificación: además del parte de cada
-- turno, un parte del día y un parte de la semana, con la misma
-- información a otra granularidad (una fila por línea con el
-- acumulado, más una tabla por lote). Ver pdf-informe-periodo.ts.
--
-- Esta tabla guarda UNA fila por informe generado:
--   - evita duplicados (unique tipo + desde): pedir dos veces el mismo
--     informe reutiliza el PDF ya generado en vez de crear otro;
--   - guarda la URL del PDF (Cloudinary) y un `resumen` compacto con
--     el que se compone el aviso de Telegram sin recalcular nada;
--   - da el histórico para poder listarlos más adelante en la app.
--
-- `desde` / `hasta` son FECHAS DE TURNO (el turno N de la fecha D
-- termina a las 06:00 del día D+1, ver 01-dominio.md). Diario:
-- desde = hasta = D. Semanal: desde = lunes, hasta = domingo.
--
-- RLS activada SIN políticas a propósito: solo la escribe y la lee la
-- Edge Function generar-informe-periodo con service_role (que salta
-- RLS). Cuando se muestren en la app habrá que añadir una política de
-- SELECT para los roles que deban verlos.
-- =============================================================

create table if not exists informe_periodo (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('diario', 'semanal')),
  desde        date not null,
  hasta        date not null,
  pdf_url      text,
  resumen      jsonb,
  generado_at  timestamptz,
  enviado_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint informe_periodo_rango check (hasta >= desde),
  constraint informe_periodo_unico unique (tipo, desde)
);

comment on table informe_periodo is
  'Un informe PDF por periodo (diario o semanal) generado por la Edge '
  'Function generar-informe-periodo. desde/hasta son fechas de turno '
  '(el turno N de la fecha D acaba a las 06:00 de D+1). Único por '
  '(tipo, desde).';
comment on column informe_periodo.pdf_url is
  'URL pública (Cloudinary) del PDF. NULL solo si la fila existe pero la '
  'generación falló a medias.';
comment on column informe_periodo.resumen is
  'Totales compactos (m² por calidad, turnos registrados/esperados, '
  'faltantes, nº de lotes e incidencias) para componer el aviso sin '
  'recalcular el informe.';
comment on column informe_periodo.enviado_at is
  'Cuándo se envió el aviso a Telegram con el enlace al PDF. NULL = '
  'generado pero no enviado (o el envío falló).';

alter table informe_periodo enable row level security;
