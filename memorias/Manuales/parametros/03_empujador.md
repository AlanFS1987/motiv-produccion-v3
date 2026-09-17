# 9.3) Empujador

## 9.3.1) Datos de formato

### Empujador

**Offset calibración [mm]**
Posición en mm, más allá del final de carrera delantero de final de empuje, que el empujador debe alcanzar durante un empuje en jaula.

**Posición atrás [mm]**
Posición de espera pila: distancia en mm desde el final de carrera adelante de final de empuje.
Si al valor configurado corresponde una posición más allá del punto del final de carrera del empujador atrás, el empujador se detiene en el final de carrera y no en el valor configurado.

**Fondo de jaula inerte [mm]**
Distancia en mm desde final de carrera delantero en donde, durante operación de empuje hacia jaula de una pila, se desactiva el mando de salida al cilindro puesto debajo de la jaula.

**Bajada elevador [mm]**
Distancia en mm desde final de carrera delantero donde durante operación de empuje hacia la jaula de una caja, se activa el mando de bajada del elevador.

**Bajada elevador para pilas [mm]**
Distancia en mm desde final de carrera delantero donde, durante una operación de empuje hacia la jaula de una pila, se activa el mando de bajada del elevador.

**Bajada fondo de jaula [mm]**
Configura la cota en mm a la que, durante el empuje en jaula de la caja, se ordena la bajada del fondo jaula.

**Subida del mandril [mm]**
Configura la cota en mm a la que, durante el empuje en jaula de la caja, se ordena la subida del mandril.

**Movimiento jaula trapecio [mm]**
Dato válido solo si está presente la tracción de la jaula motorizada.
- **NO**: el movimiento de la jaula durante la entrada de una pila sigue el movimiento del empujador.
- **SÍ**: el movimiento de la jaula durante la entrada de una pila es un movimiento constante igual al formato de la pila.

**Start tracción jaula [mm]**
Dato válido solo si está presente la tracción de la jaula motorizada.
Distancia en mm desde el final de carrera adelante donde durante una operación de empuje hacia la jaula de una caja, empieza el movimiento de la tracción jaula.

**Start tracción jaula para pilas [mm]**
Dato válido solo si está presente la tracción de la jaula motorizada.
Distancia en mm desde el final de carrera adelante donde, durante una operación de empuje hacia la jaula de una pila, con una pila presente en la jaula, empieza el movimiento de la tracción jaula.

**Stop tracción jaula [mm]**
Dato válido solo si está presente la tracción de la jaula motorizada.
Dato válido solo si MOV. JAULA TRAPECIO = NO.
Distancia en mm desde el final de carrera adelante donde durante una operación de empuje hacia la jaula de una caja, termina el movimiento de la tracción jaula.

**Stop tracción jaula para pilas [mm]**
Dato válido solo si está presente la tracción de la jaula motorizada.
Dato válido solo si MOV. JAULA TRAPECIO = NO.
Distancia en mm desde el final de carrera adelante donde durante una operación de empuje hacia la jaula de una pila y con una pila presente en la jaula, termina el movimiento de la tracción jaula.

### Elevador

**Offset calibración [1/10°]**
Desplazamiento realizado por el motor durante la calibración para cubrir completamente el sensor de reset del eje.
El motor del elevador tiene un movimiento circular, por esto su desplazamiento se representa en grados.

---

## 9.3.2) Dinámica

### Empujador

**Velocidad máxima [Hz]**
Velocidad máxima (Hz) de movimiento del empujador en retorno.

**Velocidad empuje [Hz]**
Velocidad (Hz) de movimiento del empujador durante empuje de pila en jaula.

**Velocidad mínima [Hz]**
Velocidad mínima (Hz) de movimiento del empujador.
El empujador termina los movimientos de retorno en espera y de empuje a esta velocidad.

**Aceleración**
Aceleración/deceleración del empujador: el parámetro selecciona la variación de velocidad en la unidad de tiempo durante las conmutaciones entre las velocidades mínima y máxima/empuje.
Cuando este valor aumenta, las variaciones de velocidad son más rápidas.

### Elevador

**Velocidad subida [step/s]**
Velocidad de movimiento del elevador durante el movimiento de subida.

**Velocidad bajada [step/s]**
Velocidad de movimiento del elevador durante el movimiento de bajada.

**Aceleración**
Aceleración/desaceleración del elevador: el parámetro selecciona la variación de velocidad en la unidad de tiempo durante las conmutaciones entre las velocidades start y de movimiento.
Cuando este valor aumenta, las variaciones de velocidad son más rápidas.

---

## 9.3.3) Tiempos

### Empujador

**Frecuencia de las pilas [ms]**
Tiempo mínimo de espera entre el inicio de un empuje de una pila y el inicio del empuje sucesivo.
Si al inicio de un empuje de una pila hacia la jaula no ha transcurrido un tiempo igual al valor configurado en este parámetro, el empujador espera el término del tiempo antes de empezar el empuje.
Si se configura este parámetro a 0, el empujador empieza el empuje apenas posible.

---

*(Con esto se da por terminada la sección del Empujador.)*
