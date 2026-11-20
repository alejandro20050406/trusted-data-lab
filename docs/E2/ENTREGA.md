# Entrega E2

## Alcance

Fuente especializada: OpenStreetMap, nodos `amenity=dentist` en el rectángulo 19.20–19.30° N y 103.78–103.66° O, consultados mediante Overpass. GeoPandas proyecta a UTM 13N y genera un mapa estático con atribución. Es una muestra de objetos mapeados, no un censo municipal. Véase [ética y legalidad](../etica-datos.md).

## Reproducción

```bash
python -m pip install -r requirements-e2.txt
python -m unittest discover -s tests
python -m src.geoespacial_e2 --capturar datos/bronce/osm/lote --salida datos/e2/mapa
python -m src.geoespacial_e2 --manifiesto datos/bronce/osm/lote/manifiesto.json --salida datos/e2/reproducido
python -m src.e1 --salida salida-e1
```

Los destinos deben ser nuevos. La captura requiere conectividad y disponibilidad de Overpass. Guarde juntos `osm.json` y `manifiesto.json`; la salida contiene `oro_dentistas_osm.csv` y `mapa_dentistas_osm.png`. Si la captura falla no se crean datos ficticios ni se publica una salida parcial.

## Linaje

`oro_inventario.csv` conserva `archivo_bronce`, `registro_origen`, `fecha_utc`, `sha256` y URL. El identificador comercial es la URL o el identificador de tarjeta; para ISSSTE es el número de registro CSV (`linea`). Las métricas llevan `linaje`, una lista JSON de los registros que contribuyen a cada grupo. El oro OSM referencia el archivo original y el ID `node/<id>`. Las correspondencias revisadas se guardan en `correspondencias.csv` y sus referencias de entrada también deben conservarse. El hash detecta alteraciones, no demuestra por sí solo autenticidad o permanencia del archivo.

## Estado de verificación

Las pruebas automatizadas ejercitan el linaje y el rechazo de alteraciones. La captura en vivo del 20/11/2026 no pudo completarse: la instancia elegida agotó el tiempo de espera. Por ello queda pendiente generar y conservar el lote Bronce real y el mapa correspondiente antes de considerar E2 plenamente validada.
