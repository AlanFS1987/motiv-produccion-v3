# Alarmas BS08 — lote 2 (sesión 16/09/2026)

Alarmas capturadas de las fotos del manual en este chat y preparadas
para `ceria_documentacion_maquina` (migración
`20260916190000_ceria_documentacion_maquina_alarmas_lote_02.sql`).

**Formato de cada alarma:** nombre tal como aparece en el manual +
significado y solución juntos.

## Notas y decisiones de esta tanda

- Las alarmas de **Printosh** (anomalía cilindro / nivel de tinta) se
  descartaron: esa submáquina no está instalada.
- Las 6 alarmas de **Giracajas** (tramo posterior wrap) se
  descartaron: ese mecanismo tampoco está instalado.
- **Tracción pilas wrap: Pila código 0** y **Target lejano** no se
  incluyeron: venían marcadas "No presente" (no aplican a esta
  máquina).
- Los avisos genéricos "ALARMA XXX DESCONOCIDA/DESCONOCIDO" que
  cierran cada tabla del manual no se incluyeron (son el mensaje de
  fallback, no una alarma real).
- **Starter** solo traía "*** Previsto ***" en la foto — sin
  contenido real, no se incluyó.
- Las alarmas de **"ALARMAS BANDEJA"** del manual hablan todas del
  mandril (motor, sensores, flejes) — se mapearon a la submáquina ya
  existente **Mandril**, no a una submáquina "Bandeja" nueva.
- **Sacabandejas, Escuadrador, Empujador de bandejas y Mandril** ya
  tenían filas previas en la base de datos — no se cruzaron estas
  alarmas nuevas una a una contra ese contenido, podría haber solape.
- **Empujador: Elevador fuera de posición / no calibrado** — sin
  confirmar si es el mismo "Elevador" ya documentado aparte o uno
  distinto propio del Empujador.
- **Empujador: Anomalía hotmelt** duplica literalmente el texto de
  "Hotmelt: Anomalía cola caliente" — es la misma alarma física,
  aparece en dos secciones del manual.
- "Bandeja: No calibrado derecho sensor atrás activo" y "...
  izquierdo sensor alto activo" aparecen agrupadas con el mismo
  contenido en el manual (posible errata cruzando "atrás" con
  "alto") — transcritas tal cual.

---

## Jaula

### Jaula: Mc jaula cerrada
El sensor del cilindro jaula cerrada no se ha excitado con el cilindro jaula inactivo. **Solución:** comprobar el funcionamiento de los cilindros de la jaula y del correspondiente sensor.

### Jaula: T.O. salida pila
La pila presente dentro de la jaula no salió en el tiempo máximo previsto. **Solución:** comprobar el posible atasco de la pila, el funcionamiento del motor, el funcionamiento de la fotocélula a la salida de la jaula y el tiempo máximo previsto programado en la diapositiva de la jaula.

### Fondo jaula: Mc fondo jaula atrás
El sensor de fondo jaula atrás no está activo con el mando del cilindro fondo jaula atrás activo y el mando del cilindro fondo jaula corto atrás activo. **Solución:** comprobar el funcionamiento del sensor y del cilindro fondo jaula.

### Fondo jaula: Mc fondo jaula adelante
El sensor de fondo jaula adelante no está activo con el mando del cilindro fondo jaula adelante activo y el mando del cilindro fondo jaula corto atrás activo. **Solución:** comprobar el funcionamiento del sensor y de los cilindros fondo jaula.

### Fondo jaula: Mc fondo jaula alto
El sensor de cilindro jaula alto no está activo con el mando del cilindro fondo jaula subida activo. **Solución:** comprobar el funcionamiento del sensor y del cilindro fondo jaula.

### Fondo jaula: Mc fondo jaula bajo
El sensor de cilindro jaula bajo no está activo con el mando del cilindro fondo jaula bajada activo. **Solución:** comprobar el funcionamiento del sensor y del cilindro fondo jaula.

---

## Hotmelt

### Hotmelt: Anomalía cola caliente
La máquina que suministra la cola en caliente presenta una anomalía. **Solución:** comprobar el estado de la máquina de la cola en caliente.

---

## Sacabandejas

### Sacabandejas: Recogida fallida
La fotocélula de bandeja a bordo no se ha excitado después de la recogida de una bandeja. **Solución:** comprobar la efectiva falta de recogida de la bandeja, la presencia de bandejas en el almacén de recogida, el funcionamiento de las ventosas de recogida y de la fotocélula de bandeja a bordo.

### Sacabandejas: No calibrado
Hay que calibrar el motor de la traslación del sacabandejas. **Solución:** realizar la calibración del sacabandeja.

### Sacabandejas: Ventosas no calibradas
El motor de la rotación ventosas del sacabandejas se ha bloqueado en su movimiento. **Solución:** controlar el sensor de restablecimiento de las ventosas del sacabandejas y extraer los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del sacabandeja.

### Sacabandejas: T.O. hacia recogida
Durante una operación de recogida, el sacabandejas no ha alcanzado el almacén en el tiempo máximo previsto. **Solución:** comprobar el posible atasco del sacabandejas, el funcionamiento del motor, del codificador y las cuotas programadas para los almacenes de bandejas.

### Sacabandejas: T.O. hacia depósito
Durante una operación de depósito, el sacabandejas no ha alcanzado la cuota de depósito en el tiempo máximo previsto. **Solución:** comprobar el posible atasco del sacabandejas, el funcionamiento del motor, del codificador y las cuotas programadas para el depósito del recipiente.

### Sacabandejas: Anomalía inverter
El inverter presenta una anomalía. **Solución:** comprobar que el inversor y el motor conectado a él funcionen correctamente.

### Sacabandejas: Anomalía comunicación inverter
Error de comunicaciones con inversor. **Solución:** comprobar el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.

### Sacabandejas: Tiempo límite comunicación inverter
Timeout de comunicaciones con inverter. **Solución:** comprobar el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación de los inverters como se muestra en el esquema eléctrico del panel.

---

## Quad 01 / 02 / 03

### Quad 01: Quad fault
### Quad 02: Quad fault
### Quad 03: Quad fault
Uno de los accionamientos presenta una anomalía. **Solución:** controlar el tipo de anomalía en la diapositiva MONITOR QUAD; controlar el funcionamiento correcto del accionamiento en anomalía y de los motores conectados a este.

---

## Regulaciones

### Regulaciones: Mc máximo abierto
Durante la ejecución del cambio de formato se ha alcanzado el final de carrera en la cuota máxima de apertura. **Solución, controlar:** que la cuota del formato no sea mayor que el formato máximo soportado por la máquina; que el sensor de final de carrera esté situado de la manera correcta.

### Regulaciones: Mc máximo cerrado
Durante la ejecución del cambio de formato se ha alcanzado el final de carrera en la cuota máxima de cierre. **Solución, controlar:** que la cuota de formato no sea menor que el formato mínimo soportado por la máquina; que el sensor de final de carrera esté situado de la manera correcta.

### Regulaciones: Máquina no vacía
La máquina no está completamente vacía. **Solución:** comprobar que no haya pilas presentes en tracción pilas wrap, divisor, empujador y jaula.

### Regulaciones: Falta cotas preset
En la diapositiva de las regulaciones se deben configurar las cuotas detectadas durante la fase de instalación/regulación de la máquina. **Solución:** introducir la cuota en el caso de que se conozca, o llevar la máquina a la condición necesaria para detectar la cuota, realizar la detección e introducir la cuota detectada.

### Regulaciones: Faltan calibraciones
No todos los elementos interesados durante la fase de regulación automática se han calibrado. **Solución:** comprobar cada uno de los elementos y, si el led de calibración parpadea, realizar la calibración; esta operación solo es necesaria si el elemento seleccionado está realmente instalado en la máquina.

### Regulaciones: Plato empujador no alto
Antes de empezar el cambio de formato automático, la máquina lleva algunos elementos que podrían crear interferencias mecánicas fuera del radio de acción y activar esta alarma. Indica que el plato empujador no se detecta en la posición alta deseada. **Solución, comprobar:** si el elemento se encuentra en la posición deseada; que el sensor de posición esté activo; que las cuotas correspondan a la efectiva posición del elemento.

### Regulaciones: Empujador no atrás
Igual que la anterior, pero para el empujador no detectado en la posición atrás deseada.

### Regulaciones: Jaula no alta
Igual que la anterior, pero para la jaula no detectada en la posición alta deseada.

### Regulaciones: Fondo jaula no alto
Igual que la anterior, pero para el fondo de la jaula no detectado en la posición alta deseada.

### Regulaciones: Fondo jaula no adelante
Igual que la anterior, pero para el fondo de la jaula no detectado en la posición adelante deseada.

---

## Avisos

### Avisos: Regulaciones no en el formato
Uno o más motores de regulación no están en la posición correcta para el formato en curso. **Solución:** realizar el cambio de formato con los mandos generales.

---

## Dispositivos de seguridad

### Dispositivos de seguridad: restablezca los botones fungiformes de emergencia
Se presionó el botón fungiforme rojo de la zona wrap. **Solución:** para volver a poner en marcha el wrap y el wrap del tramo posterior, restablezca el botón fungiforme presionado y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.

### Dispositivos de seguridad: Restablezca barrera derecha / izquierda / barreras
Una barrera de la zona wrap está intervenida bloqueando el wrap. **Solución:** controle el estado de las barreras fotoeléctricas, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.

### Dispositivos de seguridad: Restablezca el pulsador de parada del wrap
Se presionó el botón fungiforme de la zona wrap. **Solución:** para volver a poner en marcha el wrap, restablezca el botón fungiforme presionado y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.

### Dispositivos de seguridad: Bloqueos wrap posterior
Las barreras fotoeléctricas de la zona del wrap posterior fueron intervenidas y bloquean el wrap posterior. **Solución:** compruebe el estado de las fotocélulas, restablezca la marcha del tramo posterior del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.

### Dispositivos de seguridad: Anomalía barrera derecha / izquierda
Tras el control efectuado en el funcionamiento de las barreras del wrap, se detectó una anomalía que bloquea el wrap. **Solución:** controle el estado de las barreras fotoeléctricas, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.

### Dispositivos de seguridad: Anomalía de los botones fungiformes wrap
El control realizado en el funcionamiento de los botones fungiformes de emergencia detectó una anomalía que bloquea el wrap. **Solución:** controle los botones fungiformes de emergencia del wrap, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.

### Dispositivos de seguridad: Anomalía tg wrap
Tras el control efectuado en el funcionamiento de los telerruptores de potencia del wrap, se detectó una anomalía que bloquea el wrap. **Solución:** controle el funcionamiento de los telerruptores de potencia del wrap, restablezca la marcha del wrap y reajuste la alarma con la diapositiva ALARMAS ACTIVAS.

### Dispositivos de seguridad: Módulo k100/k101/k102/k110 en anomalía
Anomalía en el módulo de seguridad correspondiente. **Solución:** compruebe el estado del módulo dentro del panel. Para reconfigurar la alarma hay que apagar y volver a encender la máquina. Si la alarma se presenta frecuentemente, compruebe el estado de las conexiones del módulo y eventualmente sustituya el módulo.

### Dispositivos de seguridad: Emergencia en línea
Emergencia en la línea activa que bloquea la puesta en marcha en el wrap. **Solución:** controle el estado de las emergencias en la línea.

---

## Empujador (distinto de "Empujador de bandejas")

### Empujador: Obstáculo empuje
Durante el avance del empujador faltó la habilitación al avance. **Solución, controle:** posición fleje grande, posición fleje pequeño, posición flejes superiores, posición fondo jaula; cuota programada en la diapositiva SACACARTÓN-START CICLO EMPUJADOR y posición del sacacartón; cuota programada en la diapositiva EMPUJADOR-TEST OBSTÁCULO y posición del empujador; cuota diapositiva EMPUJADOR-BAJADA GUÍA CARTONES, posición depósitos cartones y funcionamiento de los sensores relativos.

### Empujador: Anomalía mc plato bajo
El sensor de plato de empuje bajo no está activo con el cilindro en reposo. **Solución:** comprobar el funcionamiento del cilindro y del sensor de plato bajo.

### Empujador: Anomalía mc plato alto
El sensor de plato de empuje alto no está activo con el cilindro activo. **Solución:** comprobar el funcionamiento del cilindro y del sensor de plato alto.

### Empujador: Elevador fuera de posición
El motor del elevador se ha bloqueado en su movimiento. **Solución:** comprobar el sensor del elevador y quitar los eventuales obstáculos que hayan bloqueado el motor; realizar la calibración del elevador. *(Sin confirmar si es el mismo "Elevador" documentado aparte.)*

### Empujador: Elevador no calibrado
Mismo texto que "Elevador fuera de posición".

### Empujador: Falta plantilla
Al inicio del empuje de una pila hacia la jaula, al menos una de las dos fotocélulas de presencia cartón no está activa. **Solución, controle:** presencia del cartón delante de la jaula; funcionamiento de las dos fotocélulas de presencia cartón.

### Empujador: T.O. empuje
El empujador no ha alcanzado la posición de fin del empuje en el tiempo máximo previsto durante el empuje de una pila hacia la jaula. **Solución:** comprobar el posible atascamiento del empujador, el funcionamiento del codificador y del motor.

### Empujador: T.O. retorno
El empujador no ha alcanzado la posición atrás programada o el sensor de final de carrera atrás en el tiempo máximo previsto durante el retorno en espera. **Solución:** comprobar el posible atascamiento del empujador, el funcionamiento del codificador, el funcionamiento del sensor empujador atrás y del motor.

### Empujador: Cola plantilla seca
Al inicio del empuje de una pila hacia la jaula ha pasado el tiempo configurado para el secado de la cola. **Solución:** comprobar el valor del tiempo configurado para el secado de la cola y quitar el cartón presente delante de la jaula.

### Empujador: Tipo cartón
El cartón presente delante de la jaula no ha sido recogido del almacén correcto. **Solución:** quitar el cartón delante de la jaula.

### Empujador: Anomalía reloj jaula
El sensor de clock de la jaula no ha detectado la entrada de una caja en la jaula. **Solución:** comprobar el funcionamiento del sensor clock jaula y la posición del clock de la jaula.

### Empujador: Anomalía hotmelt
La máquina que suministra la cola en caliente presenta una anomalía. **Solución:** comprobar el estado de la máquina de la cola en caliente. *(Misma alarma física que "Hotmelt: Anomalía cola caliente".)*

### Empujador: No calibrado
El motor del empujador requiere una calibración. **Solución:** realizar la calibración del empujador.

### Empujador: Anomalía inverter
El inverter presenta una anomalía. **Solución:** comprobar que el inversor y el motor conectado a él funcionen correctamente.

### Empujador: Anomalía comunicación inverter
Error de comunicaciones con inversor. **Solución:** comprobar el funcionamiento correcto de los inverters, la conexión correcta del cable de comunicación hacia los inverters y la configuración de los parámetros de comunicación como se muestra en el esquema eléctrico del panel.

### Empujador: Tiempo límite comunicación inverter
Timeout de comunicaciones con inverter. Misma solución que la anterior.

---

## Empujador de bandejas

### Empujador de bandejas: Obstáculo empuje
Durante el avance del empujador de bandejas faltó la habilitación al avance. El avance se realiza solo si el mandril está parado en la posición alta. **Solución:** comprobar la posición del mandril.

### Empujador de bandejas: No calibrado
El motor se ha bloqueado o ha alcanzado el final de carrera adelante en su movimiento. **Solución:** comprobar el sensor de atrás, el sensor de adelante, la cuota en la diapositiva EMPUJADOR BANDEJA-CUOTA FIN DEL EMPUJE, y quitar los posibles obstáculos; realizar la calibración del empujador de bandejas.

### Empujador de bandejas: Anomalía mc guía abierto
El sensor abierto de la guía del empujador bandeja no se excita con el cilindro de apertura de la guía activo. **Solución:** comprobar el funcionamiento del sensor y de los cilindros del empujador de bandejas.

### Empujador de bandejas: Anomalía mc guía cerrado
Análogo, con el cilindro de cierre de la guía.

### Empujador de bandejas: Sin calibrar derecha/izquierda mc on
El motor necesita un calibrado: el sensor de calibración todavía está activado. **Solución, compruebe:** posibles obstáculos que bloquean el motor; el sensor de calibración. **Para restablecer:** wrap en modo manual; reconocer la alarma en ALARMAS ACTIVADAS; quitar el cartón o material que bloqueó el motor; restablecer barreras/botones fungiformes si es necesario; restablecer marcha del wrap si no se activa; calibrar el motor; restablecer la alarma; restablecer el wrap en modo automático.

### Empujador de bandejas: Sin calibrar derecha/izquierda mc off
El sensor de calibración no está activado, aunque la posición del motor debería activarlo. Mismo procedimiento de restablecimiento que "mc on".

### Empujador de bandejas: Sin calibrar derecha/izquierda mc adelante
El movimiento del motor ha activado el sensor de adelante, que nunca debe alcanzar. Mismo procedimiento de restablecimiento.

---

## Escuadrador

### Escuadrador: Anomalía mc dcha/izq lateral
El sensor del cilindro correspondiente del escuadrador lateral no está excitado con el cilindro en reposo. **Solución:** comprobar el funcionamiento del cilindro y del relativo sensor.

### Escuadrador: Anomalía mc dcho/izq frontal
Igual, para el escuadrador frontal.

### Escuadrador: Anomalía mc dcho/izq trasero
Igual, para el escuadrador posterior.

---

## Tracción pilas wrap

### Tracción pilas wrap: Pila desconocida
La fotocélula presente en la zona de entrada tracción pilas está activada pero ninguna pila debe estar presente. **Solución, compruebe:** que la fotocélula funcione; eventuales pilas presentes en la posición incorrecta. **Para restablecer:** wrap en modo manual; reconocer la alarma; quitar las pilas presentes en tracción; restablecer la alarma; restablecer barreras/botones fungiformes si es necesario; restablecer marcha del wrap; restablecer modo automático.

### Tracción pilas wrap: T.O. tránsito pila
La pila de paso desde tracción línea hasta tracción wrap ha oscurecido la fotocélula presente en la zona de entrada tracción pilas durante un tiempo mayor al esperado. **Solución, compruebe:** que la fotocélula funcione; eventuales atascos de la pila en la zona fotocélula. Mismo procedimiento de restablecimiento que la alarma anterior.

---

## Tramo posterior wrap

### Tramo posterior wrap: configuración incorrecta
Se ha detectado un error en los datos de configuración de la parte posterior del wrap. **Solución:** controle que los datos correspondientes estén programados correctamente consultando los esquemas eléctricos.

### Tramo posterior wrap: anomalía inverter
Los inverters del tramo posterior del wrap presentan anomalías. **Solución:** compruebe el funcionamiento correcto de los inverters y del motor conectado.

### Tramo posterior wrap: error comunicación inverter
Error de comunicaciones con inversor. **Solución:** compruebe el funcionamiento correcto de los inverters, la conexión del cable de comunicación y la configuración de los parámetros según el esquema eléctrico del panel.

### Tramo posterior wrap: anomalía térmicas
Una protección magnetotérmica ha intervenido en la parte posterior del wrap.

### Tramo posterior wrap: código cero
Una caja llega a una fotocélula de tramo posterior en un tiempo no previsto por la ventana temporal configurada en el elemento ENLACE, y se le asignó código 0. **Solución:** controle si la caja queda bloqueada en los enlaces, si el motor y la fotocélula funcionan, y verifique el tiempo programado en el elemento ENLACE.

### Tramo posterior wrap: timeout fotocélula
Durante el pasaje de una caja en los enlaces de la parte posterior, una fotocélula permanece excitada por encima del tiempo máximo previsto. **Solución:** controle si la caja queda bloqueada, si el motor y la fotocélula funcionan, y verifique el tiempo programado en TIMEOUT FT ENLACES (diapositiva TRAMO POSTERIOR WRAP).

### Posterior wrap: timeout de comunicación inverters
Timeout de comunicaciones con inverter. Misma solución que "error comunicación inverter".

---

## Bandeja (mapeado a la submáquina "Mandril")

### Bandeja: No calibrado
El motor del mandril se ha bloqueado o no ha alcanzado el final de carrera bajo en su movimiento. **Solución:** comprobar el sensor de alto, el sensor de bajo, la cuota en MANDRIL-POSICIÓN BAJO, y quitar obstáculos. Realizar la calibración del mandril.

### Bandeja: Anomalía mc abierto
Los sensores de fleje anterior abierto no se excitan con el cilindro de apertura de los flejes anteriores del mandril activo. **Solución:** comprobar sensores y cilindros de los flejes anteriores.

### Bandeja: Anomalía mc cerrado
Los sensores de fleje anterior cerrado no se excitan con el cilindro de apertura en reposo. Misma solución.

### Bandeja: Obstáculo movimiento
Durante el movimiento del mandril faltó la habilitación. **Solución:** comprobar anomalías del empujador bandeja o del fondo jaula, la posición del empujador bandeja y la cuota de obstáculo en EMPUJADOR BANDEJA.

### Bandeja: Aplastamiento
Durante la bajada, el sensor de achatamiento del mandril se ha desexcitado. **Solución:** comprobar el sensor de achatamiento y la cuota POSICIÓN BAJO en MANDRIL.

### Bandeja: Tipo cartón
La bandeja presente en el mandril no ha sido recogida del almacén deseado. **Solución:** quitar la bandeja del mandril.

### Bandeja: Faltan bandejas
Al inicio de la bajada, la fotocélula de presencia bandeja en el mandril no está activa. **Solución:** comprobar presencia de la bandeja y el funcionamiento de la fotocélula.

### Bandeja: Anomalía mc bloqueo bandejas
Los sensores de bloqueo bandeja abierta no se excitan con el cilindro de apertura activo. **Solución:** comprobar sensores y cilindros del bloqueo bandeja.

### Bandeja: T.O. bajada
Durante una bajada, el mandril no ha alcanzado la cuota de bajo en el tiempo máximo previsto. **Solución:** comprobar atasco, motor, codificador y cuota programada de bajo.

### Bandeja: T.O. subida
Durante una subida, el mandril no ha alcanzado el sensor de alto en el tiempo máximo previsto. **Solución:** comprobar atasco, motor y sensor de alto.

### Bandeja: No calibrado derecho sensor atrás activo / izquierdo sensor alto activo
El motor necesita un calibrado: el sensor de calibración todavía está activado. **Solución, compruebe:** obstáculos; sensor de calibración. Mismo procedimiento de restablecimiento estándar (wrap manual → reconocer alarma → quitar obstáculo → restablecer barreras si hace falta → restablecer marcha → calibrar motor → restablecer alarma → modo automático). *(Nombres tal cual figuran en el manual, posible errata cruzando "atrás"/"alto".)*

### Bandeja: No calibrado derecho/izquierdo sensor alto no activo
El sensor de calibración no está activado, aunque la posición del motor debería activarlo. Mismo procedimiento de restablecimiento.

### Bandeja: No calibrado derecho/izquierdo sensor bajo activo
El movimiento del motor debería dejar libre el sensor de bajo, que todavía está activado. Mismo procedimiento de restablecimiento.

### Bandeja: No calibrado derecho_sensor / izquierdo_sensor bajo no activo
El sensor de bajo no está activado, aunque la posición del motor debería activarlo. Mismo procedimiento de restablecimiento.

---

## Wrap generales

### Wrap: Térmicas wrap
Una protección magnetotérmica ha intervenido en la parte wrap.

### Wrap: Anomalía alimentación aire comprimido
El presostato que detecta la presión del aire comprimido en la entrada de la máquina detectó una disminución por debajo del umbral configurado. **Solución:** comprobar la presión en la entrada de la máquina y la conexión del tubo de aire comprimido.

---

## Wrap no plantilla

### Wrap: Faltan cartones / Wrap: Faltan bandejas
El nivel de los cartones en los almacenes de cartones es bajo. **Solución:** agregar cartones en los almacenes.
