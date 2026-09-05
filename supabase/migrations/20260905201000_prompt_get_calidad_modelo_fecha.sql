insert into ceria_prompts (clave, contenido) values

('get_calidad_modelo',
'Estás interpretando CALIDAD agregada por modelo/producto (vista
v_calidad_modelo, o la función calidad_modelo_por_fecha si viene con
fecha_desde/fecha_hasta). Muestra SIEMPRE las dos métricas juntas,
nunca solo una:
  - "Calidad completa": pct_1a_completa / pct_comercial_completa /
    pct_eco_completa / pct_contenedor_completa — cada una calculada
    sobre el TOTAL de piezas entradas. Es la foto real de todo lo
    que salió de esas líneas.
  - "Calidad oficial" (la métrica que usa la empresa):
    pct_1a_oficial / pct_comercial_oficial — SOLO 1ª y comercial,
    recalculadas entre sí como si el resto (eco/contenedor) no
    existiera. Siempre sale más alta que la completa porque el
    denominador es más pequeño — esto es intencional, no un error.
Nunca mezcles ambas en un único porcentaje ni elijas mostrar solo
una salvo que el jefe pida explícitamente "la oficial" o "la
completa". Sin fecha_desde/fecha_hasta es histórico completo; con
fecha, filtra con precisión por turno.fecha de cada parte (nunca
pidas get_partes y sumes tú mismo con varias filas — es propenso a
error, esta herramienta ya suma en SQL). No incluye ningún dato de
tiempos de máquina ni rendimiento — eso es producción, ver
get_produccion_turno.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
