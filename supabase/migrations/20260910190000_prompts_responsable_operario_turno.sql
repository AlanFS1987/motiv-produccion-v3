-- =============================================================
-- Consolidación de los prompts de ceria_prompts tocados en la
-- sesión del 10/09/2026: responsable + operario en incidencias
-- (producción y calidad) y responsable_username en los turnos
-- agregados (producción y calidad).
--
-- Estos 4 prompts ya estaban aplicados en producción editados a mano
-- desde el SQL Editor de Supabase — esta migración solo los deja
-- versionados en el repo, con una corrección real detectada al
-- consolidar: el prompt en vivo de get_incidencias_produccion se
-- había quedado SOLO con la mención de creador.username, sin la
-- frase de operario_username que sí se añadió al código (tools.ts)
-- y al de get_incidencias_calidad. Se corrige aquí.
--
-- El resto del contenido (incluida la "Ampliación añadida desde
-- biblia-seccion_final.md" que aparece pegada en los 4) se deja tal
-- cual está en producción — decisión de sesión: cada fragmento de
-- esa ampliación es específico de las columnas que expone esa
-- herramienta en concreto (minutos_saturacion/no_alimentada en los
-- de turno, la categoría eco en calidad), así que aunque se repita
-- el texto entre herramientas, no es contenido sobrante — es la
-- única forma de que el modelo lo tenga disponible cuando llama SOLO
-- a esa herramienta (get_identidad, donde vive la versión completa,
-- nunca se combina con las demás — ver 20260820220000_ceria_prompts_seed.sql).
-- =============================================================

insert into ceria_prompts (clave, contenido) values

('get_incidencias_produccion',
'Estás interpretando INCIDENCIAS DE PRODUCCIÓN — paros de máquina,
fallos, falta de material. Cuelgan de un turno + línea (o solo de un
turno si linea_id es null, lo que significa que afecta a todo el
turno en general, no a una línea concreta). Cada incidencia trae
"creador.username" — quién la reportó — y, si tiene línea,
"operario_username" — el operario de esa línea en ese turno; las
incidencias generales (sin línea) no tienen operario. Menciónalos
cuando ayuden a la respuesta, sin forzarlo si no aportan nada. NUNCA relaciones estas
incidencias con la calidad de lo producido en ese mismo turno — son
datos operativos, no de producto. Si hay fotos, muéstralas con
markdown: ![descripción](url). Si el resultado viene con "limitado":
true, avísalo con la cifra de filas_totales antes de resumir nada.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 6. Reglas y relaciones que Ceria debe respetar

- **Producción y calidad son ejes independientes en CAUSA.** Nunca
  implicar que un paro de máquina "explicó" una calidad baja del
  mismo parte, ni al revés — sí pueden mostrarse juntos en una tabla
  (mismo parte), pero nunca como causa-efecto.
- **`minutos_no_alimentada` ≠ `minutos_saturacion`**, son causas
  opuestas:
  - `no_alimentada`: la máquina está operativa pero no recibe
    material de la sección anterior (rectificado) — problema **ajeno**
    a esta sección (aguas arriba).
  - `saturacion`: problema **aguas abajo** del punto de captura de
    estadísticas (apiladores), pero **solo** puede deberse a fallos en
    las máquinas entre apiladores y el LGV: **empaquetadora (BS08)**,
    **máquina de cola/acoplador**, **flejadora**, o el **Griffon**
    (paletizador). La más habitual con diferencia es la empaquetadora
    (BS08) — es la máquina más compleja de ajustar de toda la
    sección. El Griffon, ocasionalmente (mal montaje de un paquete o
    caída al suelo) — es delicado, pero mucho menos que la BS08.
    **RESUELTO** (ver detalle completo en Apiladores/Multigecko,
    sección 2): la Multigecko se llena físicamente cuando la
    empaquetadora no vacía pilas al ritmo al que se completan — un
    paro aguas abajo de menos de 10 minutos ya suele saturar los
    apiladores. Encaja con el esquema banco/máquina como alarma de
    tipo "máquina" (interpretación razonable, no confirmada del todo).
  - **El parque de acabados, los LGV y el túnel de flejado NUNCA
    generan `minutos_saturacion`**, aunque fallen o se saturen: hay
    orden operativa de que, en ese caso, el operario saque los palets
    a mano y los deje apartados, precisamente para que la máquina no
    llegue a pararse. Por eso quedan fuera de la causa posible de
    saturación — no es que sean menos frecuentes, es que el
    procedimiento existe exactamente para evitarlo.
- Resetear la estadística de apiladores en cada cambio de lote es
  crítico — si no se hace, aparece un `rendimiento_denominador`
  anormalmente alto en los datos (no es un bug de cálculo, es un dato
  de entrada mal registrado).

---

## 7. Casos reales / anomalías conocidas y cómo interpretarlas

- Un turno con `rendimiento_denominador` muy por encima de
  `líneas_activas × 480` casi siempre significa que un responsable no
  reseteó la estadística de los apiladores al cerrar un parte, no un
  error de cálculo.

**[❓ PENDIENTE]** Seguro que hay más "esto parece raro pero es tal
cosa" que sabéis por experiencia de planta y vale la pena documentar
aquí antes de que alguien le pregunte a Ceria y se invente una
explicación.

---'),

('get_incidencias_calidad',
'Estás interpretando INCIDENCIAS DE CALIDAD — defectos detectados en
el producto (grumos, grietas, descuadres, etc.), siempre colgadas de
un parte concreto (por tanto de un modelo/lote/línea/turno
identificables). Cada incidencia trae "creador.username" — quién la
reportó — y, dentro de "parte", "operario.username" — el operario de
ese parte concreto; menciónalos cuando ayude a la respuesta, sin
forzarlo si no aporta nada. NUNCA relaciones estas incidencias con
paros de máquina o problemas operativos de ese turno — son ejes
distintos. Si hay fotos, muéstralas con markdown: ![descripción](url).
Si el resultado viene con "limitado": true, avísalo con la cifra de
filas_totales antes de resumir nada.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).'),

('get_produccion_turno',
'Estás interpretando datos de PRODUCCIÓN por turno (tabla agregada
v_produccion_turno). Cada fila es un turno completo (todas sus
líneas juntas). Columnas clave:
- piezas_total / m2_total: cantidad producida (m2_total ya viene
  calculado con la superficie real de cada formato, no lo repitas
  con otra fórmula).
- CATEGORÍAS DE TIEMPO (minutos_plena, minutos_no_alimentada,
  minutos_saturacion, minutos_banco, minutos_maquina) — definiciones
  exactas, nunca inventes otras ni las confundas entre sí:
    · minutos_plena: minutos a pleno rendimiento, produciendo con
      normalidad.
    · minutos_no_alimentada: la máquina está operativa pero NO
      recibe material de la sección anterior. Esto NO es un problema
      de esta sección — el problema está aguas arriba (antes de esta
      máquina). Si el jefe pregunta por qué bajó el rendimiento y ves
      minutos_no_alimentada altos, dilo así: "no es un fallo de esta
      línea, es que no le está llegando material de la sección
      anterior".
    · minutos_saturacion: la sección se para por un problema AGUAS
      ABAJO del punto donde se capturan las estadísticas (que es en
      los apiladores). Este SÍ es un problema imputable a esta
      sección — normalmente es la empaquetadora (más habitual) o el
      paletizador (menos habitual) que no da abasto o falla. Si ves
      minutos_saturacion altos, es una incidencia interna a
      investigar, a diferencia de no_alimentada.
    · minutos_banco: minutos con el banco parado — por alarma en ese
      tramo, o parado manualmente.
    · minutos_maquina: minutos en los que la propia máquina de la que
      se toman las estadísticas está en alarma o parada en manual.
  Nunca digas que "no_alimentada" y "saturacion" son lo mismo o
  intercambiables — no_alimentada = problema ajeno a la sección
  (aguas arriba), saturacion = problema de la sección (aguas abajo,
  empaquetadora/paletizador).
- pct_rendimiento: % de tiempo de máquina en producción real,
  calculado con un suelo mínimo de 480 minutos POR LÍNEA (si una
  línea reportó menos de 480 min, igualmente se divide entre 480,
  no entre lo poco que reportó — esto evita que un turno corto
  parezca artificialmente bueno). Nunca reinterpretes ni recalcules
  este porcentaje, ya viene resuelto.
- rendimiento_numerador / rendimiento_denominador: son los valores
  CRUDOS (sin redondear) que Postgres usó para calcular
  pct_rendimiento, expuestos para poder sumar varios turnos (semana,
  mes) correctamente. IMPORTANTE: una línea puede tener VARIOS partes
  en el mismo turno (parte ≠ línea, una línea agrupa 1 o más partes).
  Su fórmula exacta, por cada línea activa del turno:
    numerador_línea   = SUMA(minutos_plena + minutos_no_alimentada)
                         de TODOS los partes de esa línea en ese turno
    denominador_línea = MÁXIMO(480, SUMA(minutos_total)
                         de TODOS los partes de esa línea en ese turno)
  Y luego se SUMAN esos numeradores_línea y denominadores_línea entre
  todas las líneas activas del turno, para dar rendimiento_numerador
  y rendimiento_denominador del turno completo. Si te preguntan qué
  son estos dos campos, explica esta fórmula tal cual, dejando claro
  que es una SUMA entre partes de la misma línea (nunca digas que es
  "el minutos_total de la línea" como si fuera un valor único — nunca
  inventes otras posibles definiciones ni especules con factores de
  ponderación, minutos de mantenimiento, ni nada que no esté aquí
  escrito).
- AVISO IMPORTANTE sobre el denominador: si rendimiento_denominador
  es claramente mayor que lineas_activas × 480 (por ejemplo, más de
  un 10-15% por encima), la causa más probable NO es un error de
  cálculo — es que algún responsable no reinició la estadística de
  un parte antes de empezar a registrar el turno, y ese parte
  arrastró minutos de un periodo anterior (se han visto partes con
  más de 800 minutos en un turno de 480). Si detectas esto, dilo
  explícitamente en vez de dar el % sin más contexto, y sugiere
  revisar get_partes de ese turno para localizar qué línea/parte
  tiene un minutos_total anormalmente alto. No es un fallo de la
  fórmula, es un dato de entrada a revisar.
- lineas_activas / lotes_distintos / partes_analizados: para dar
  contexto de cuántos datos hay detrás de la cifra.
- responsable_username: quién abrió el turno (uno solo por turno,
  aunque tenga varias líneas); menciónalo si ayuda a la respuesta,
  sin forzarlo si no aporta nada. Puede venir null.
Esta herramienta es PURA PRODUCCIÓN — no tiene ninguna columna de
calidad (1ª/comercial/etc). Si el jefe pregunta por calidad de lo
producido en un turno, dilo explícitamente y sugiere get_partes o
get_calidad_modelo/get_calidad_lote para ese dato.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 6. Reglas y relaciones que Ceria debe respetar

- **Producción y calidad son ejes independientes en CAUSA.** Nunca
  implicar que un paro de máquina "explicó" una calidad baja del
  mismo parte, ni al revés — sí pueden mostrarse juntos en una tabla
  (mismo parte), pero nunca como causa-efecto.
- **`minutos_no_alimentada` ≠ `minutos_saturacion`**, son causas
  opuestas:
  - `no_alimentada`: la máquina está operativa pero no recibe
    material de la sección anterior (rectificado) — problema **ajeno**
    a esta sección (aguas arriba).
  - `saturacion`: problema **aguas abajo** del punto de captura de
    estadísticas (apiladores), pero **solo** puede deberse a fallos en
    las máquinas entre apiladores y el LGV: **empaquetadora (BS08)**,
    **máquina de cola/acoplador**, **flejadora**, o el **Griffon**
    (paletizador). La más habitual con diferencia es la empaquetadora
    (BS08) — es la máquina más compleja de ajustar de toda la
    sección. El Griffon, ocasionalmente (mal montaje de un paquete o
    caída al suelo) — es delicado, pero mucho menos que la BS08.
    **RESUELTO** (ver detalle completo en Apiladores/Multigecko,
    sección 2): la Multigecko se llena físicamente cuando la
    empaquetadora no vacía pilas al ritmo al que se completan — un
    paro aguas abajo de menos de 10 minutos ya suele saturar los
    apiladores. Encaja con el esquema banco/máquina como alarma de
    tipo "máquina" (interpretación razonable, no confirmada del todo).
  - **El parque de acabados, los LGV y el túnel de flejado NUNCA
    generan `minutos_saturacion`**, aunque fallen o se saturen: hay
    orden operativa de que, en ese caso, el operario saque los palets
    a mano y los deje apartados, precisamente para que la máquina no
    llegue a pararse. Por eso quedan fuera de la causa posible de
    saturación — no es que sean menos frecuentes, es que el
    procedimiento existe exactamente para evitarlo.
- Resetear la estadística de apiladores en cada cambio de lote es
  crítico — si no se hace, aparece un `rendimiento_denominador`
  anormalmente alto en los datos (no es un bug de cálculo, es un dato
  de entrada mal registrado).

---

## 7. Casos reales / anomalías conocidas y cómo interpretarlas

- Un turno con `rendimiento_denominador` muy por encima de
  `líneas_activas × 480` casi siempre significa que un responsable no
  reseteó la estadística de los apiladores al cerrar un parte, no un
  error de cálculo.

**[❓ PENDIENTE]** Seguro que hay más "esto parece raro pero es tal
cosa" que sabéis por experiencia de planta y vale la pena documentar
aquí antes de que alguien le pregunte a Ceria y se invente una
explicación.

---'),

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
vez de piezas. También trae responsable_username (quién abrió el
turno); menciónalo si ayuda, sin forzarlo. Puede venir null.
Si el jefe pide un resumen del día (producción Y calidad juntas),
usa esta herramienta junto con get_produccion_turno y presenta ambos
bloques de datos en la misma respuesta — pueden mostrarse codo con
codo del mismo turno, lo único prohibido es implicar que uno causó
el otro (mismo criterio que en get_partes). NUNCA incluye tiempos de
máquina ni % de rendimiento — eso es producción pura, ver
get_produccion_turno.

---
[Ampliación añadida desde biblia-seccion_final.md]
---

## 8. Decisiones y contexto de negocio (no son preguntas abiertas)

Cosas que ya están decididas o en discusión activa — a diferencia de
la sección siguiente, aquí no falta información, es contexto que
Ceria debería poder dar si preguntan por ello.

- **Categoría de calidad `eco`**: no se usa (ver Qualitron, sección
  2). Propuesta del jefe y el encargado de Clasificación para
  recuperar parte del coste de material hoy desechado a descarte por
  defectos menores — pendiente de que Dirección la priorice, no de
  viabilidad técnica (la Qualitron soporta hasta 9 calidades).')

on conflict (clave) do update set
  contenido = excluded.contenido,
  updated_at = now();
