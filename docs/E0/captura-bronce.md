# Plan de captura: precios odontológicos

**Captura inicial implementada.** `scripts/captura_dental.py` guarda tres páginas públicas originales y un manifiesto por ejecución en `datos/bronce/odontologia/`. El 11 de noviembre de 2026 se obtuvo una captura local exitosa por fuente.

## Fuentes y viabilidad

Se trabajará con tres fuentes web de precios públicos: [Imdent](https://imdent.com/stores/deposito-dental-q-narvarte?view=list), [Tu Universo Dental Colima](https://www.tuuniversodental.com.mx/) y [Dentalink Market México](https://dentalinkmarket.com/mx/precios/255-ivoclar-tetric-n-ceram-universal). Tu Universo Dental muestra precios en sus categorías y fichas. Imdent y Dentalink presentan ofertas de proveedores; conservar plataforma y vendedor por separado para detectar ofertas repetidas.

Realizar primero una prueba piloto de tres productos idénticos entre al menos dos proveedores, verificando marca, variante y presentación. Registrar URL, titular, acceso, formato, condiciones de uso, restricciones de robots, frecuencia permitida y fecha de revisión. Una página pública no implica automáticamente autorización para extracción o reutilización. No se han confirmado descargas estructuradas, permisos de automatización ni un historial de 36 periodos de precios para las tres fuentes. Si el acceso automático no es viable, ajustar el alcance con los docentes.

## Capas propuestas

1. **Bronce:** conservar respuesta original por fuente y fecha, sin sobrescribir capturas anteriores; registrar URL, fecha UTC, identificador, resultado y huella SHA-256.
2. **Plata:** extraer nombre, marca, variante, presentación, cantidad, unidad, precio en MXN, proveedor, ubicación, enlace, fecha, disponibilidad, promoción y condiciones conocidas. Validar precio positivo y finito, fecha válida, unidad y cantidad positivas; registrar rechazados y duplicados. Mantener valores originales y no inventar faltantes.
3. **Oro:** relacionar ofertas solo cuando producto, marca, variante y presentación sean equivalentes. Calcular precio por pieza, gramo o mililitro cuando proceda y estadísticas por producto y proveedor. Mantener por separado envío e impuestos desconocidos; nunca asumir que son cero. Etiquetar localidad del proveedor y destino; no confundir disponibilidad nacional con existencia local.

## Ejecución y limitaciones

El extractor solicita una página por fuente y comprueba robots.txt antes de cada consulta; no accede a cuentas ni evade restricciones. El 11 de noviembre de 2026 las rutas seleccionadas estaban permitidas por robots.txt. Los términos y condiciones de reutilización siguen sujetos a revisión; el robots.txt por sí solo no concede una licencia. Solo se almacenan respuestas públicas originales y metadatos; se verificará el uso permitido antes de republicar su contenido.

Ejecutar desde la raíz: `python scripts/captura_dental.py`; ejecutar pruebas: `python -m unittest discover -s tests`. Cada ejecución crea una carpeta con instante UTC, tres HTML y un manifiesto con fuente, URL, fecha, resultado, tamaño y SHA-256. Un fallo produce estado de error y código de salida distinto de cero; no se crean datos de precios inexistentes.

El flujo de GitHub Actions está configurado para ejecutarse diariamente a las 12:23 UTC (06:23 en Colima) y manualmente, ejecutar pruebas y guardar el resultado como artefacto por 90 días. Cada ejecución genera un artefacto independiente, no acumula automáticamente los anteriores. Descargar y conservar los artefactos antes de su vencimiento. Para que la programación funcione debe existir en la rama predeterminada y comprobarse una ejecución real; la prueba local no demuestra que Actions esté funcionando.

**Verificación del 11 de noviembre de 2026:** el flujo se publicó en la rama predeterminada y se ejecutó manualmente en GitHub. Tu Universo Dental y Dentalink respondieron, pero Imdent falló por un error de conexión TLS desde el servidor de GitHub, por lo que la ejecución quedó en estado fallido. El artefacto conserva las dos respuestas y el manifiesto del fallo. La captura local previa sí obtuvo las tres páginas. Se debe resolver el acceso a Imdent sin desactivar la verificación de seguridad; la programación diaria aún no ha sido observada.

La captura inicial equivale a **un periodo observado**, no a 36. Alcanzar 36 observaciones diarias requiere 35 días adicionales después de la primera, siempre que todas las ejecuciones tengan éxito. La página de Imdent no identifica el tono y la de Tu Universo Dental contiene variantes; Dentalink muestra A2B sin existencia. Los precios de las tres páginas no deben tratarse todavía como una comparación de variantes idénticas. No hay capa Plata ni tablero.

