# Relatoría de etapa E2

Se seleccionó OpenStreetMap por su cobertura abierta y su relación con el contexto odontológico. Se diseñó una consulta acotada de nodos que evita etiquetas y metadatos personales, con verificación de robots y hash del lote. GeoPandas transforma los puntos a UTM 13N y genera una visualización atribuida, sin usar teselas de terceros.

Se amplió el linaje de inventario Oro con ruta Bronce e identificador interno, y se incorporó la lista de contribuyentes a cada métrica agregada. Se documentaron licencias, restricciones, sesgos, privacidad y límites de retención. Las pruebas automatizadas comprueban la generación y la detección de cambios en Bronce.

Durante la ejecución del 20 de noviembre de 2026 la primera instancia de Overpass no respondió dentro del plazo. Una instancia alternativa, `overpass.openstreetmap.fr`, permitió capturar cinco nodos reales y generar el mapa; se verificó el SHA-256 del lote y se conservaron Bronce y Oro en el repositorio. La cobertura es limitada y la disponibilidad de la instancia no está garantizada.
