# 9.4) Bandeja

## 9.4.1) Datos de formato

### Sacabandejas: Bandeja para código pila

**Almacén derecho**
Selecciona los códigos pilas que se pueden recoger en el almacén derecho.
Si no se indica un código pila en ningún almacén, el sacabandejas no recoge ninguna bandeja y las pilas no se empaquetan.

**Almacén izquierdo**
Selecciona los códigos pilas que se pueden recoger en el almacén izquierdo.
Si no se indica un código pila en ningún almacén, el sacabandejas no recoge ninguna bandeja y las pilas no se empaquetan.

### Sacabandejas

**Offset calibración traslación [mm]**
Desplazamiento realizado por el motor durante la calibración para cubrir completamente el sensor de reset del eje.

**Offset calibración rotación [1/10°]**
Desplazamiento realizado por el motor durante la calibración para cubrir completamente el sensor de reset del eje.
El motor de la rotación de las ventosas tiene un movimiento circular, por esto su desplazamiento se representa en grados.

**Distancia entre almacenes [mm]**
Distancia en mm entre almacén de bandejas dcho. y almacén bandejas izq.

**Distancia inicio rotación [mm]**
Cota en [mm] desde posición de recogida bandejas a la cual el eje de las ventosas inicia la rotación para alcanzar la posición de desenganche cartón.

**Cuota depósito almacén derecho [mm]**
Configura la cuota de depósito del cartón.
Los valores se expresan en mm y se refieren al final de carrera en el almacén derecho.

**Distancia eje rotación ventosas/vértice bandeja [mm]**
Distancia en mm que hay entre el eje rotación de las ventosas del sacabandejas y el vértice superior de la plantilla apoyada en almacén de bandejas.

**Tolerancia posición [mm]**
Cuota en [mm] dentro de la que el sacabandejas se considera en posición correcta.

**Ángulo almacén izquierdo [1/10°]**
Posición en [1/10°] de ventosas en posición de recogida del almacén izquierdo.

**Cuota depósito almacén izquierdo [mm]**
Configura la cuota de depósito del cartón.
Los valores se expresan en mm y se refieren al final de carrera en el almacén derecho.

### Empujador bandejas

**Puntos cola (1, 2)**
Estos 2 parámetros seleccionan las posiciones en el cartón en las que aplicar la cola.
Los valores configurados en estos 2 campos son:
- Retardo entre la excitación de la fotocélula inyectores de cola y la activación del mando de los inyectores de cola.

**Offset calibración [mm]**
Desplazamiento realizado por el motor durante la calibración para cubrir completamente el sensor de reset del eje.

**Cota espera [mm]**
Posición de espera empuje: distancia en mm desde final de carrera atrás.

**Cuota final empuje [mm]**
Posición de final de empuje del cartón: distancia en mm desde el final de carrera atrás.
⚠️ ATENCIÓN: no hay que configurar la cuota por encima del punto del final de carrera del empujador de bandeja adelante. Cuando el empujador de bandeja alcanza el final de carrera adelante se genera una alarma.

**Cuota obstáculo bandeja [mm]**
Cota máxima en [mm] a la que el empujador del recipiente puede llegar sin estorbar el mandril.

**Cuota salida apoyo central [mm]**
Distancia en mm desde el final de carrera atrás en el que durante el empuje del cartón hacia el mandril se da el mando de salida al cilindro de apoyo central para sostener el cartón.
Este dato funciona solo con formatos mayores de 600 mm.

### Mandril

**Posición alta [mm]**
Configura la cuota, en mm, de parada del mandril arriba.
La cuota 0 corresponde a la posición mandril bajo.

**Descenso Plato Empuje [mm]**
Configura la cota en mm a la que, durante la bajada del mandril se ordena la bajada del plato empuje del empujador.

**Subida del fondo de jaula [mm]**
Configura la cota en mm a la que, durante la bajada del mandril se ordena la subida del fondo jaula.

**Anticipación empujador recipiente [mm]**
Configura la cuota en mm, a la que, durante la subida del mandril se anticipa el mando de empuje del empujador de recipientes.
Configuración en el valor posición alta para empezar el empuje cuando el mandril llega a la posición alta.

**Offset calibración [mm]**
Desplazamiento realizado por el motor durante la calibración para cubrir completamente el sensor de reset del eje.

---

## 9.4.2) Dinámica

### Sacabandejas

**Velocidad traslación [Hz]**
Velocidad en Hz de movimiento del sacabandejas.

**Velocidad mínima [Hz]**
Velocidad (Hz), inicial y final, del movimiento del sacabandejas.

### Empujador bandejas

**Velocidad empuje [step/s]**
Velocidad de movimiento del empujador de bandejas durante el empuje del cartón hacia el mandril alto.

**Velocidad retorno [step/s]**
Velocidad máxima de movimiento del empujador de bandejas en retorno.

**Aceleración**
Aceleración/desaceleración del empujador bandeja: el parámetro selecciona la variación de velocidad en la unidad de tiempo durante las conmutaciones entre las velocidades mínima y máxima/empuje.
Cuando este valor aumenta, las variaciones de velocidad son más rápidas.

### Mandril: Motor a paso

**Velocidad subida [step/s]**
Velocidad de movimiento del mandril durante movimiento de subida.

**Velocidad bajada [step/s]**
Velocidad de movimiento del elevador durante el movimiento de bajada.
*(Nota: el texto del manual dice "elevador", posiblemente por error tipográfico, ya que la sección corresponde al Mandril.)*

**Aceleración**
Aceleración/desaceleración del mandril: el parámetro selecciona la variación de velocidad en la unidad de tiempo durante las conmutaciones entre las velocidades start y de movimiento.
Cuando este valor aumenta, las variaciones de velocidad son más rápidas.

---

## 9.4.3) Tiempos

### Sacabandejas

**Tiempo de enganche [ms]**
Tiempo de activación del mando de vacío de las ventosas de recogida cartones.

**Tiempo de desenganche [ms]**
Retardo entre la desexcitación del mando de aspiración de las ventosas de recogida y la activación del motor del empujador cartón.

### Empujador bandejas

**Rociado de la cola [ms]**
Tiempo de activación del mando a los inyectores de la cola.

**Secado de la cola [ms]**
Tiempo de retardo máximo entre la ejecución del primer rociado de la cola y el uso del cartón.
Si a partir de la ejecución del primer rociado, el cartón no se utiliza en el tiempo configurado en este parámetro, el empujador genera la alarma COLA PLANTILLA SECA.
Si se configura 0, no se genera ninguna alarma.

---

*(Con esto se da por terminada la sección de Bandeja.)*
