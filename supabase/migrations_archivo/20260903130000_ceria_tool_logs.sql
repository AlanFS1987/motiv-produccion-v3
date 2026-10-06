-- =============================================================
-- ceria_tool_logs — registro de cada llamada a herramienta dentro
-- de una pregunta de Ceria. Una fila por herramienta ejecutada (una
-- pregunta puede disparar varias en paralelo, fase 2 de index.ts).
--
-- Objetivo: poder responder luego "¿qué herramienta se usa más?",
-- "¿cuánto tarda Ceria de media?", "¿alguna herramienta falla más
-- de lo normal?" sin tener que rastrear logs de la Edge Function.
-- =============================================================

create table if not exists ceria_tool_logs (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references ceria_conversaciones(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  herramienta     text not null,          -- nombre de la tool (get_partes, get_calidad_lote...)
  args            jsonb,                  -- argumentos con los que se llamó, para depurar

  filas           integer,                -- filas devueltas
  filas_totales   integer,                -- filas reales antes de truncar (si limitado=true)
  limitado        boolean default false,

  duracion_ms     integer,                -- tiempo de ejecución de ESTA herramienta (query a Postgres)
  error           text,                   -- mensaje si executeTool lanzó excepción, null si OK

  created_at      timestamptz not null default now()
);

-- Índices para las consultas típicas: por herramienta (ranking de uso),
-- por fecha (tendencia), por conversación (depurar un caso concreto)
create index if not exists idx_ceria_tool_logs_herramienta on ceria_tool_logs(herramienta);
create index if not exists idx_ceria_tool_logs_created_at on ceria_tool_logs(created_at);
create index if not exists idx_ceria_tool_logs_conversacion on ceria_tool_logs(conversacion_id);

-- RLS: mismo criterio que ceria_conversaciones/ceria_mensajes — cada
-- usuario (jefe/admin) ve solo sus propios logs; el admin además
-- puede ver todos para poder auditar el uso global.
alter table ceria_tool_logs enable row level security;

create policy "usuarios ven sus propios logs de ceria"
  on ceria_tool_logs for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from usuario u
      where u.id = auth.uid() and u.rol = 'administrador'
    )
  );

-- Solo la Edge Function (service_role) inserta — nunca el cliente directo
create policy "solo service_role inserta logs de ceria"
  on ceria_tool_logs for insert
  with check (false);  -- bloqueado para anon/authenticated; service_role bypassa RLS

comment on table ceria_tool_logs is
  'Una fila por herramienta ejecutada en cada pregunta a Ceria. '
  'Permite analizar uso (qué tool se llama más), rendimiento '
  '(duracion_ms) y fiabilidad (columna error) sin depender de los '
  'logs de la Edge Function en el dashboard de Supabase, que rotan '
  'y no son consultables con SQL.';


-- =============================================================
-- Vista de ranking de uso, para consultarla rápido o para que la
-- use el propio Ceria si algún día se le pregunta "¿qué herramienta
-- usas más?" (herramienta de mecanismo tipo get_identidad).
-- =============================================================
create or replace view v_ceria_uso_herramientas as
select
  herramienta,
  count(*)                                          as veces_usada,
  round(avg(duracion_ms))                           as duracion_media_ms,
  round(avg(filas))                                 as filas_media,
  count(*) filter (where error is not null)         as errores,
  max(created_at)                                   as ultimo_uso
from ceria_tool_logs
group by herramienta
order by veces_usada desc;

comment on view v_ceria_uso_herramientas is
  'Ranking de uso de herramientas de Ceria: frecuencia, duración '
  'media, filas media devueltas, y conteo de errores. Útil para '
  'decidir qué optimizar o qué herramienta ya no se usa.';