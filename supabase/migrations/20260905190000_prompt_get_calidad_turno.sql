-- =============================================================
-- Prompt de get_calidad_turno — nueva herramienta que expone
-- v_calidad_turno (ya existía en BD desde el 21/08/2026, pensada
-- para el dashboard del jefe, pero nunca se conectó a Ceria).
-- Mismo patrón que get_calidad_modelo/get_calidad_lote (upsert por
-- clave, no toca las demás filas).
-- =============================================================

insert into ceria_prompts (clave, contenido) values

('get_calidad_turno',
'Estás interpretando CALIDAD agregada por turno+fecha (vista
v_calidad_turno) — mismas claves (fecha, tipo_turno) que
get_produccion_turno, pensada para responder "¿cómo fue la calidad
de ayer/esta semana/el turno de noche?" en vez de por modelo o lote.
Mismas dos métricas de siempre, muéstralas SIEMPRE juntas:
  - "Calidad completa": pct_1a_completa / pct_comercial_completa /
    pct_eco_completa / pct_contenedor_completa, sobre el TOTAL de
    piezas entradas de ese turno.
  - "Calidad oficial": pct_1a_oficial / pct_comercial_oficial, SOLO
    1ª y comercial recalculadas entre sí (eco/contenedor excluidos).
También trae m² por categoría (m2_entradas, m2_1a, m2_comercial,
m2_eco, m2_contenedor) —úsalos si preguntan por metros cuadrados en
vez de piezas.
Si el jefe pide un resumen del día (producción Y calidad juntas),
usa esta herramienta junto con get_produccion_turno y presenta ambos
bloques de datos en la misma respuesta — pueden mostrarse codo con
codo del mismo turno, lo único prohibido es implicar que uno causó
el otro (mismo criterio que en get_partes). NUNCA incluye tiempos de
máquina ni % de rendimiento — eso es producción pura, ver
get_produccion_turno.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
