# BfS ODL

## Qué hace

Lleva a Gladys la **tasa de dosis gamma ambiental** medida por las sondas de la **red ODL** de la Oficina Federal
alemana de Protección Radiológica (Bundesamt für Strahlenschutz, BfS): unas 1700 sondas en toda Alemania, un valor
por hora. La integración lee el servicio de datos abiertos de la BfS, los mismos datos que el mapa
[ODL-Info](https://odlinfo.bfs.de), sin cuenta ni clave.

Para cada sonda seguida obtiene la tasa de dosis, sus partes cósmica y terrestre, la hora y el estado de la medición,
un widget de panel con la curva de 24 horas y disparadores de escena cuando la tasa supera un umbral de alerta.

**Esta integración no es un sistema de alerta oficial**: en caso de emergencia, siga las instrucciones de las
autoridades. Los niveles naturales varían: la lluvia arrastra al suelo los descendientes del radón y puede añadir
hasta 0,1 µSv/h durante unas horas. La integración no está afiliada a la BfS. Datos: Bundesamt für Strahlenschutz
(BfS), gratuitos, con la fuente citada.

La misma integración para Francia: [Téléray](https://github.com/guim31/gladys-teleray) (red de la ASNR).

## Requisitos

- Gladys 5.3.0 o posterior.
- Acceso a Internet desde Gladys.
- La ubicación de su casa (Ajustes → Casas), para seguir automáticamente la sonda más cercana.

## Configuración

1. Instale la integración: Integraciones → Instalar desde GitHub, dirección `https://github.com/guim31/gladys-odl`.
2. **Sondas**: déjelo vacío para seguir la sonda más cercana a su casa, o escriba hasta 5 identificadores de sonda
   (9 cifras), nombres o códigos postales separados por comas (p. ej. `091620001, 80637, Feldberg`). Un código postal
   da su sonda en servicio situada más abajo. Dos botones ayudan: **Buscar las sondas alrededor de una casa** lista
   las más cercanas con su identificador y su distancia, **Buscar sondas** las de un código postal (o sus primeras
   cifras) o cuyo nombre contiene un texto.
3. **Umbral de alerta**: la tasa que activa «Tasa de dosis por encima del umbral», 0,3 µSv/h por defecto (vea
   Escenas).
4. **Idioma**: idioma de los nombres de las funciones (fijados al añadir un dispositivo) y de los textos.
5. Abra la pestaña **Descubrimiento** y añada la sonda.

## Dispositivos

Un dispositivo por sonda, con su nombre (p. ej. `München-Neuhausen (ODL)`):

| Función                 | Qué es                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Tasa de dosis (µSv/h)   | tasa de dosis gamma ambiental de la última hora, en microsieverts por hora                               |
| Parte cósmica (µSv/h)   | la parte de la radiación cósmica, estimada por la BfS (crece con la altitud)                             |
| Parte terrestre (µSv/h) | el resto: radiación del suelo y del aire (radón), la parte que varía                                     |
| Hora de la medición     | fin de la hora de medición (la BfS la publica de 60 a 90 minutos después)                                |
| Estado de la sonda      | Medición comprobada, Aún no comprobada, Sonda en pruebas, Sonda fuera de servicio, Sin medición reciente |

Gladys no tiene unidad de radiación: la unidad está en el nombre de las funciones. Una medición de más de 4 horas no
se publica como actual (el estado indica entonces «Sin medición reciente»). Una sonda fuera de servicio no publica
ningún valor.

## Widget

**Tasa de dosis ODL**: la tasa y sus partes cósmica y terrestre en mosaicos (la tasa se pone en rojo al llegar al
umbral de alerta), la curva de las últimas 24 horas, y la hora, el estado, el umbral y la fuente. Ajustes: la sonda
(vacío: la primera añadida) y dos interruptores para ocultar la curva o las líneas de debajo.

## Escenas

- Disparador **Tasa de dosis por encima del umbral**: la tasa horaria de una sonda en servicio alcanza el umbral de
  alerta de la configuración, comprobada o aún no (mejor una alerta rápida que una tardía). Se activa una vez, al
  superarlo; el umbral sigue superado hasta que la tasa baja 0,02 µSv/h por debajo. Nunca en la primera lectura de
  una sonda, ni para una sonda en pruebas. Variables: nombre de la sonda, tasa de dosis, umbral, fin de la hora de
  medición.
- Disparador **Tasa de dosis de nuevo normal**: tras una superación, la tasa vuelve a estar al menos 0,02 µSv/h por
  debajo del umbral.
- Acción **Obtener la tasa de dosis de una sonda**: los últimos valores y una frase lista (`summary`) para una
  notificación; `status` vale `checked`, `not_checked`, `test_operation`, `defective` o `no_recent`.

El umbral por defecto, **0,3 µSv/h**, es prudente: en Alemania, los niveles naturales están entre 0,05 y 0,18 µSv/h
(mediana de unos 0,11), hasta unos 0,25 µSv/h en la cima de una montaña, y una lluvia fuerte puede añadir hasta
0,1 µSv/h durante unas horas. Por lo tanto, 0,3 µSv/h rara vez se alcanza sin una causa real; 0,2 µSv/h se activará
con la lluvia en algunas sondas. Los dispositivos también dan sus valores a las condiciones de escena habituales, para
un umbral propio.

## Ejemplos de escenas

- Avisarme cuando la tasa sea alta: disparador «Tasa de dosis por encima del umbral», luego «Obtener la tasa de dosis
  de una sonda» y una notificación con su resumen.
- Un informe semanal: una escena programada, «Obtener la tasa de dosis de una sonda», y luego un mensaje con el
  resumen.

## Solución de problemas

- **«Ninguna sonda»**: indique la ubicación de una casa (Ajustes → Casas) o escriba una sonda en la configuración.
- **«Sondas desconocidas»**: no se encontró el identificador, el nombre o el código postal; use los botones de
  búsqueda y copie el identificador.
- **«La BfS no responde»**: las mediciones se vuelven a leer cada 20 minutos.
- **«Sin medición reciente»**: la sonda no ha publicado nada desde hace 4 horas (mantenimiento, transmisión). Los
  valores vuelven con su siguiente medición.
- **«Sonda fuera de servicio»**: la BfS marca la sonda como averiada; elija una vecina hasta que la reparen.

## Límites

- Un valor por hora, publicado de 60 a 90 minutos después de su hora: la integración lee cada 20 minutos (una
  petición para todas las sondas seguidas) y la lista de sondas una vez al día.
- 5 sondas como máximo.
- Las partes cósmica y terrestre son estimaciones de la BfS; algunas sondas no las proporcionan.
- Las mediciones de Safecast no están incluidas (una posible continuación).
- Los nombres de las funciones de un dispositivo se fijan al añadirlo; cambiar el idioma después no los renombra.
