# Divisor (Trac. pilas / Divisor / Escuadrador)

## Datos de formato

### Número de cajas por pila
Número de cajas a formar por cada pila que llega de la línea de selección.
Según el código de la pila se puede realizar un número diferente de divisiones.

### Divisor — Altura pila [mm]
Valor configurado por el usuario para control sobre la altura de la pila presente en el divisor.
Si se configura el valor a 0, el control no se realiza.

### Divisor — Tolerancia altura pila [mm]
Tolerancia sobre la altura de la pila.
Si la pila que lee el divisor difiere del valor de ALTURA PILA de una cantidad mayor a la tolerancia, se genera la alarma de "ERROR LECTURA PILA".

### Divisor — Lectura altura pila [mm] (solo lectura)
Valor detectado por la fotocélula del divisor durante la lectura de la pila.
Se utiliza para configurar el valor "ALTURA PILA".

### Otros campos de formato observados en pantalla (Trac. pilas)
*(Nota: campos vistos en la captura de pantalla; no todos tienen descripción textual capturada del manual.)*
- Distancia FT cinta / divisor [mm]
- INTEREJE WRAP [mm]
- START PLANTIL. [mm]
- Punto espera empujador libre [mm]
- Escuadrador lateral — Habilitado (Sí/No)
- Escuadrador frontal — Habilitado (Sí/No)
- Divisor — Habilitado (Sí/No)
- Divisor — Habilita escuadr. con mordazas (Sí/No)
- Divisor — Intereje FT / mordaza [mm]
- Divisor — Offset posición recogida [mm]
- Divisor — Posición espera [mm]
- Divisor — Offset calibr. [mm]

---

## Dinámica

### Tracción de pilas — Velocidad [mm/s]
Velocidad máxima de transporte pilas.

### Tracción de pilas — Aceleración [mm/s^2]
Aceleración/desaceleración de la tracción de transporte: el parámetro configura el valor de la variación de velocidad en la unidad de tiempo durante las conmutaciones entre las velocidades mínima y máxima.
Cuando este valor aumenta, las variaciones de velocidad son menos rápidas.

### Divisor — Velocidad en vacío [step/s]
Velocidad de movimiento del divisor sin ninguna placa a bordo.

### Divisor — Velocidad lleno [step/s]
Velocidad de movimiento del divisor con baldosas a bordo.

### Divisor — Aceleración
Aceleración/desaceleración del divisor: el parámetro selecciona la variación de velocidad en la unidad de tiempo durante las conmutaciones entre las velocidades start y de movimiento.
Cuando este valor aumenta, las variaciones de velocidad son más rápidas.

---

## Tiempos

### Divisor — Retardo cierre [ms]
Tiempo de retardo entre la activación del mando de cierre y el inicio de un movimiento de subida o bajada.
Las mordazas del divisor de pilas poseen un solo sensor que detecta la condición de abierto de las mordazas.
La condición de cerrado de las mordazas depende de la activación del mando de cierre y del término del tiempo de retardo configurado en este parámetro.

### Escuadrador lateral — Tiempo de escuadrado [ms]
Tiempo de activación del lado de presión del escuadrador.

### Escuadrador frontal — Retardo de escuadrado [ms]
Tiempo de espera entre la activación del lado de referencia y la activación del lado de presión.

### Escuadrador frontal — Tiempo de escuadrado [ms]
Tiempo de activación del lado de presión del escuadrador.
