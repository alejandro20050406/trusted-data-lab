# Operación de la captura automática

La captura programada comprueba cada fuente y reintenta las pendientes después de 1, 5 y 15 minutos. Las tiendas que ya terminaron no se vuelven a descargar durante la misma ejecución. Solo las capturas completas se copian a Bronce; si alguna fuente sigue fallando, la ejecución termina en error y no genera Plata ni Oro.

El artefacto `intentos-captura` conserva los manifiestos y archivos de todos los intentos, incluidos los fallidos. Los artefactos de GitHub caducan a los 90 días: deben archivarse en almacenamiento duradero para conservar el historial. Cada ejecución procesa lo incluido en el repositorio y la captura actual, no descarga automáticamente capturas anteriores.

Los reintentos no pueden garantizar la disponibilidad de los proveedores ni reconstruir precios que no se observaron durante una interrupción. El cron es una hora objetivo y GitHub puede iniciar ejecuciones más tarde; revisar Actions y el estado de cada fuente ante retrasos o fallos.
