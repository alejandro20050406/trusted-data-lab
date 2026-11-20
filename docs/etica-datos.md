# Declaración de ética y legalidad — E2

Revisión: 20 de noviembre de 2026. Finalidad académica: estudiar insumos odontológicos y explorar la distribución de consultorios mapeados. El mapa no prueba disponibilidad de servicios, calidad, demanda ni ubicación exacta de todos los establecimientos.

## Fuentes, términos y robots

| Fuente | Uso y condiciones | robots.txt |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright), consulta mediante Overpass | Datos bajo [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Atribuir «© OpenStreetMap contributors», enlazar la licencia y revisar la obligación de compartir bases derivadas al distribuirlas. El mapa no usa teselas. Usar las instancias públicas moderadamente; no tratarlas como backend de producción. | El 20/11/2026 `https://overpass.openstreetmap.fr/robots.txt` respondió 404: no se encontró archivo, no es una autorización contractual. El capturador revisa de nuevo y detiene la captura ante errores distintos de 404 o una prohibición. |
| [Catálogo ISSSTE](https://www.issste.gob.mx/datosabiertos/catalogoinsumos.csv) | Fuente institucional de datos abiertos; conservar procedencia. No se ha verificado una licencia específica aplicable al archivo: antes de redistribuirlo fuera de este contexto debe comprobarse la licencia y condiciones vigentes. | El 20/11/2026 [robots.txt](https://www.issste.gob.mx/robots.txt) respondió 200; las reglas `User-agent: *` no excluyen `/datosabiertos/catalogoinsumos.csv`. El capturador existente verifica antes de descargar. |
| Imdent, Tu Universo Dental y Dentalink Market | Páginas comerciales públicas, utilizadas para observación académica de precios; su publicidad no implica licencia abierta para redistribuir íntegramente las páginas. Revisar términos de cada proveedor y pedir autorización cuando corresponda. No reutilizar imágenes o textos sin derechos. | Los capturadores existentes consultan el robots.txt de cada dominio antes de cada captura y rechazan respuestas que no confirmen permiso; conservan URL y hash en el manifiesto. Los términos y reglas pueden cambiar. |

`robots.txt` expresa preferencias de rastreo, no sustituye la licencia, los términos de servicio ni la legislación aplicable. La disponibilidad de una página no constituye por sí sola permiso para cualquier reutilización. Las capturas comerciales y los artefactos requieren control de acceso y retención limitada según derechos y necesidades del proyecto.

## Privacidad, sesgos y límites

La consulta OSM solicita únicamente identidad de nodo y coordenadas (`out skel`); no descarga etiquetas, nombres, direcciones, teléfonos, cuentas ni metadatos de colaboradores. No se recolectan pacientes, usuarios ni datos de redes sociales. La ubicación de un consultorio puede coincidir con un domicilio; el mapa debe utilizarse para análisis territorial, no para perfilar personas. Si se detecta información personal o sensible, retirarla y evaluar el incidente antes de publicar.

OSM depende de aportaciones voluntarias y no es un censo: hay omisiones, errores, antigüedad variable y disparidad espacial. La consulta solo incluye nodos `amenity=dentist`, no polígonos ni otros tipos de establecimiento, y su rectángulo no es un límite municipal. No comparar densidades ni inferir acceso sin denominadores, fuentes complementarias y validación de cobertura. Los precios observados dependen de tiendas y fechas seleccionadas y no representan el mercado completo; las correspondencias ISSSTE requieren revisión humana y no transfieren precios.

## Responsabilidad y trazabilidad

Cada lote se conserva con fecha UTC, consulta, URL y SHA-256; Oro referencia archivo Bronce e identificador de origen. Se comprueba el hash antes de procesar. Conservar juntos los manifiestos y archivos de Bronce, así como las referencias de correspondencia revisadas: sin ellos no puede auditarse la transformación. Los artefactos de Actions caducan; archivarlos de manera duradera cuando se requiera auditoría posterior. Revisar licencias y riesgos antes de compartir datos derivados.
