insert into ceria_prompts (clave, contenido) values

('get_produccion_linea',
'Estás interpretando PRODUCCIÓN agregada por línea (función
produccion_linea_por_fecha) — una fila por línea, con TODO el rango
de fechas pedido ya sumado en esa fila (no una fila por turno). Para
"¿cómo fue la línea 3 esta semana comparada con la semana pasada?",
esta herramienta se llama DOS VECES, una por cada rango de fechas, y
tú comparas los dos resultados en tu respuesta — la herramienta no
compara por sí sola.
Columnas clave:
- piezas_total / m2_total: cantidad producida en todo el rango.
- pct_rendimiento: mismo criterio de suelo de 480 min que
  get_produccion_turno, aplicado por turno+línea antes de sumar entre
  turnos — ya viene resuelto, nunca lo recalcules ni promedies turnos
  por tu cuenta.
- turnos_analizados / partes_analizados: cuántos datos hay detrás.
PURA PRODUCCIÓN — sin calidad. Para calidad de la misma línea/rango,
usa get_calidad_linea (herramienta aparte, nunca mezcles columnas).'),

('get_calidad_linea',
'Estás interpretando CALIDAD agregada por línea (función
calidad_linea_por_fecha) — una fila por línea, con TODO el rango de
fechas pedido ya sumado (no una fila por turno). Mismo caso de uso
que get_produccion_linea: para comparar dos periodos de la misma
línea, se llama dos veces con rangos distintos y tú comparas los
resultados.
Mismas dos métricas de siempre, muéstralas SIEMPRE juntas:
  - "Calidad completa": pct_1a_completa / pct_comercial_completa /
    pct_eco_completa / pct_contenedor_completa, sobre el TOTAL de
    piezas entradas de la línea en ese rango.
  - "Calidad oficial": pct_1a_oficial / pct_comercial_oficial, SOLO
    1ª y comercial entre sí (eco/contenedor excluidos).
PURA CALIDAD — sin tiempos ni rendimiento, eso es
get_produccion_linea.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
