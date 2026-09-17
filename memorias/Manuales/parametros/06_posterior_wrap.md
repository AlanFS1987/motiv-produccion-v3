# 9.6) Posterior Wrap

## 9.6.1) Elementos

Contiene las representaciones gráficas de todos los elementos posteriores wrap que se han programado precedentemente en la diapositiva de configuración. Para acceder a esta programación presione el TAB N.º 3 "Configuración".

Presionando en cada área gráfica se accede a las páginas de cada uno de los elementos posteriores wrap programados. El número de estas áreas y el elemento al que conducen dependen del tipo de configuración programada.

### Los principales elementos son:
1. Enlace (se puede repetir hasta 6 veces).
2. Interfaz códigos.
3. Paletizador.

> **Nota de la instalación real:** en nuestra máquina hay 4 tramos de enlace, por lo que la pestaña/página de "Enlace" se repite 4 veces (Enlace 1, Enlace 2, Enlace 3, Enlace 4).

### Timeout ft enlaces [x0,01s]
Tiempo máximo de excitación de todas las fotocélulas presentes después del wrap.
Si una fotocélula se queda tapada por un tiempo superior al configurado en este parámetro, se genera la alarma de TIMEOUT FT ELEMENTOS POSTERIORES WRAP.
Configurando a cero el valor se excluye el control de las fotocélulas.

---

## 9.6.1.1) Enlace

Presionando resalta el pulsador y se abre la página del elemento del tramo posterior wrap. El número de pulsadores presentes depende del tipo de configuración programada.

### Tiempo mínimo [x0,01s]
Tiempo mínimo de recorrido de la caja en el enlace.

### Tiempo máximo [x0,01s]
Tiempo máximo de recorrido de la caja en el enlace.
Si la caja no transita dentro de este tiempo por la fotocélula de salida del enlace se borra de la lista cajas del enlace.

### Tiempo medio [x0,01s]
Tiempo medio de recorrido de la caja en el enlace.
Es el tiempo que se utiliza para poder parar las cajas cuando los elementos en tramo posterior del mismo están saturados.

### Volteador anterior
Configurar si anteriormente se encuentra el elemento volteador.

### Caja única
Configura el tipo de gestión del enlace.
- **SÍ**: en el enlace puede haber solo una caja.
- **NO**: en el enlace puede haber más de una caja.

### Zona saturación en salida
Este parámetro configura la posición de parada por la fotocélula de salida cuando el elemento que sigue está parado o saturado.

### Ft salida libre
Se utiliza solamente con CAJA ÚNICA configurado en SÍ.
Configura el tipo de gestión del enlace.
- **SÍ**: la caja se mantiene en el enlace hasta que se activa la ft de salida enlace.
- **NO**: la caja en el enlace desaparece del enlace en el frente positivo de la ft de salida del enlace.

### Tiempo medido [x0,01s] (solo lectura)
Tiempo medido de recorrido de la caja en el enlace.
Utilícelo para configurar los tiempos de recorrido (mínimo, medio, máximo).

### Cajas presentes (solo lectura)
Número de cajas presentes en el enlace.

### Códigos cajas (solo lectura)
Los códigos que actualmente se encuentran en el enlace.
El valor 99 indica que la caja no está presente.

### Código de la última caja (solo lectura)
Último código de caja salida del enlace.

### Habilitación (solo lectura)
Estado del enlace.
- **NO**: El elemento no habilita anteriormente.
- **SÍ**: El elemento habilita anteriormente.

### Saturación (solo lectura)
Estado del enlace.
- **NO**: El elemento puede recibir otras cajas en entrada.
- **SÍ**: El elemento no puede recibir otras cajas en entrada.

---

## 9.6.1.2) Interfaz códigos

Presionando resalta el pulsador y se abre la página del elemento del tramo posterior wrap. El número de pulsadores presentes depende del tipo de configuración programada.

### Habilitar envío de la próxima caja
Posibilidad de transmitir el código de la próxima caja en el frente negativo del strobe según el siguiente plazo:

```
Strobe    |<- 80ms ->|<-40ms->|
          |<-40 ms->|         |<-40 ms->|
Bit 1/4   | Código caja       |Código caja siguiente
```

Para utilizar sólo con impresoras predispuestas para este tipo de funcionamiento.

### Próxima caja (solo lectura)
Código próxima caja que se debe imprimir.

### Caja en salida (solo lectura)
Código caja en salida de elemento.

### Código de la última caja (solo lectura)
Último código de caja salida del elemento.

### Habilitación (solo lectura)
Estado del elemento.
- **NO**: El elemento no habilita anteriormente.
- **SÍ**: El elemento habilita anteriormente.

### Saturación (solo lectura)
Estado del elemento.
- **NO**: El elemento puede recibir otras cajas en entrada.
- **SÍ**: El elemento no puede recibir otras cajas en entrada.

---

*(Pendiente: Paletizador y resto de pestañas de Posterior Wrap — Estado wrap tramo posterior, Configuración, Programación inverter, Impresoras.)*
