# Captura de datos: capa Bronce

Se descargan dos archivos oficiales originales. INEGI aporta el INPC mensual nacional: un índice, no precios en pesos. CONEVAL aporta el valor mensual por persona de la canasta alimentaria y de la canasta alimentaria más la no alimentaria, por ámbito urbano y rural. No son precios por tienda ni cifras exclusivas de Colima.

La serie de CONEVAL contiene **399 meses de enero de 1992 a marzo de 2025**. Es histórica, no actual. CONEVAL calculó la serie usando datos de INEGI; no son fuentes estadísticamente independientes. INEGI publica posteriormente las líneas de pobreza. Para analizar precios recientes habrá que integrar y verificar esa continuidad; esta captura no lo hace.

## Archivos y uso

- `datos/bronce/coneval/lineas_pobreza.zip`: archivo original. Descomprímelo y abre el XLSX; en la primera hoja, las columnas G y H muestran el costo mensual por persona de la canasta alimentaria en pesos, rural y urbana. Las columnas J y K incluyen además la canasta no alimentaria.
- `datos/bronce/inegi/inpc_mensual.zip`: archivo original con CSV, diccionario y metadatos; contiene 285 meses entre enero de 2003 y septiembre de 2026.
- `datos/bronce/manifiesto.json`: fecha UTC, fuente, resultado, huella SHA-256 y cobertura comprobada.
- `scripts/captura.py`: descarga y comprueba estructura y al menos 36 meses con datos. Pruebas: `python -m unittest discover -s tests`.
- `.github/workflows/captura-bronce.yml`: flujo manual y programado el día 12 de cada mes a las 12:23 UTC (06:23 en Colima). Los artefactos de Actions se conservan 90 días.

Para ejecutar en tu computadora, desde la raíz instala las dependencias con `python -m pip install -r requirements.txt` y ejecuta `python scripts/captura.py`. En GitHub abre Actions → Captura de fuentes oficiales → ejecución → Artifacts y descarga los resultados antes de que venzan. Conserva los ZIP originales antes de generar archivos limpios.

**Automatización pendiente:** GitHub ejecuta los horarios desde la rama predeterminada. Subir solo `trabajo-e0` no activa la programación, y el flujo manual requiere que el archivo exista en la rama predeterminada. Hay que integrarlo y comprobar una ejecución real; la prueba local no demuestra que Actions esté funcionando.

## Ética y uso

La captura hace dos solicitudes mensuales sin evadir controles. Los [términos de CONEVAL](https://www.coneval.org.mx/Paginas/Pie/terminos-uso-libre.aspx) permiten copiar y adaptar su información conservando metadatos, atribuyendo y sin sugerir respaldo institucional. Su [robots.txt](https://www.coneval.org.mx/robots.txt), consultado el 8 de noviembre de 2026, no restringe la ruta del ZIP utilizada. Los [términos del INEGI](https://www.inegi.org.mx/contenidos/inegi/doc/terminos_info.pdf) exigen atribución, conservar metadatos y señalar transformaciones. Robots no sustituye la licencia; se revisarán nuevamente las condiciones antes de cambiar ruta o frecuencia.
