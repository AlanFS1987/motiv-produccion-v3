# 9) Datos de configuración

Mediante el correspondiente pulsador situado en la barra del menú principal se accede a la barra del menú de configuración.

## Secciones del menú de configuración
1. **Configuración**: Al presionar se abre un menú que permite configurar los datos necesarios que se pueden programar.
2. **Máquina**: Esta sección contiene los datos constructivos de la máquina.
3. **Tracción pilas**: Esta sección contiene los datos de formato, la dinámica y los tiempos de funcionamiento de la tracción de pilas, divisor y del escuadrador.
4. **Empujador**: Esta sección contiene los datos de formato, la dinámica y los tiempos de funcionamiento del empujador y elevador.
5. **Bandeja**: Esta sección contiene los datos de formato, la dinámica y los tiempos de funcionamiento del sacabandejas, empujador de bandejas y mandril.
6. **Jaula**: Esta sección contiene los datos de formato y los tiempos de funcionamiento de la jaula.
7. **Posterior wrap**: Esta sección permite programar y configurar los elementos del posterior wrap.

## Reglas generales de las páginas de configuración
- Cada página de configuración está subdividida (cuando es necesario) en varias secciones.
- Cuando una sección está habilitada, el mensaje se pone de color naranja.
- Presionando el pulsador "Mandos Manuales" se abre la diapositiva del mando manual.
- Los datos que se pueden programar están dentro de casillas de color blanco.
- Los datos solo de lectura están dentro de casillas de color amarillo.
- Cuando se programa un dato sin las autorizaciones necesarias (contraseña de nivel adecuada), el sistema solicita en automático la introducción de la contraseña necesaria para realizar la operación requerida.
- La estructura general de las páginas de configuración es parecida a la de las páginas de los mandos manuales; se puede pasar de una página a otra mediante las flechas o volver al menú principal presionando X.

## Patrón común a todas las submáquinas
Cada elemento mecánico (Divisor, Empujador, Bandeja, Jaula, Enlace...) organiza sus parámetros en tres bloques recurrentes:
- **Datos de formato**: cotas y posiciones en mm (o similares), asociadas al formato de producto.
- **Dinámica**: velocidades y aceleraciones de los motores.
- **Tiempos**: retardos y temporizaciones en ms.

Casi todos los ejes motorizados comparten además el parámetro **Offset calibración**: desplazamiento realizado por el motor durante la calibración para cubrir completamente el sensor de reset del eje (en [mm] para ejes lineales, en [1/10°] para ejes de movimiento circular/rotativo).
