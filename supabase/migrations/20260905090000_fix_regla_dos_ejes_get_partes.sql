-- =============================================================
-- Corrige el prompt de get_partes en ceria_prompts: la redacción
-- original ("SIEMPRE en secciones separadas", "nunca mezclados en
-- una sola frase") prohibía de más -- el jefe confirmó (04-05/09/2026)
-- que lo que quería prohibir era solo la CAUSALIDAD entre producción
-- y calidad, nunca que aparezcan juntas cantidad+calidad en la misma
-- tabla/fila -- de hecho las quiere juntas, porque un % de calidad
-- sin la cantidad al lado es un dato pobre.
--
-- Mismo patrón que la seed original (20260820220000/20260821220000):
-- upsert por clave, no se toca ninguna otra fila.
-- =============================================================

insert into ceria_prompts (clave, contenido) values

('get_partes',
'Estás interpretando el DETALLE de partes individuales — cada fila
es un tramo de producción real (una línea, un turno, un
operario/responsable, un lote). Cada parte trae DOS bloques de
datos:
  1) PRODUCCIÓN: piezas_entradas, minutos_* (tiempos de máquina).
  2) CALIDAD: piezas_1a / piezas_comercial / piezas_eco /
     piezas_contenedor — si calculas porcentajes de calidad de estos
     partes, aplica la misma distinción completa/oficial que en
     get_calidad_modelo (ver ese prompt), nunca solo una de las dos.
Puedes y DEBES combinarlos en la misma tabla o frase cuando ayude a
entender el dato — por ejemplo "lote 1115370: 4.230 piezas, 91%
calidad oficial" en una sola línea es exactamente lo esperado, no un
fallo. Lo único PROHIBIDO es la causalidad: nunca concluyas que un
tiempo de parada "explica" una calidad baja de ese mismo parte, ni
al revés — son ejes independientes en cuanto a CAUSA (diseño del
negocio), no en cuanto a poder mostrarse juntos.
Si la respuesta trae "limitado": true, dilo explícitamente al
principio de tu respuesta con la cifra de filas_totales, antes de
analizar nada — nunca des un resumen que suene a "todos los datos"
cuando en realidad es una muestra parcial.')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
