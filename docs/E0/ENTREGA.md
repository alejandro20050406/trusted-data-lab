# Ficha de entrega técnica — E0

**Proyecto:** Trusted Data Lab — Observatorio de precios de productos de la canasta básica en México  
**Repositorio:** `alejandro20050406/trusted-data-lab`  
**Rama revisada:** `main`  
**Fecha de revisión:** 8 de noviembre de 2026  
**Alcance:** estado de los archivos y la configuración presentes en el repositorio al momento de preparar esta ficha.

## 1. Resumen técnico

El repositorio contiene una propuesta de observatorio de precios, datos oficiales descargados en formato original, un extractor Python para actualizar dos fuentes, validaciones básicas de estructura y cobertura, una configuración de GitHub Actions y registros iniciales del sistema de calidad PSP.

La capa Bronce conserva archivos fuente sin transformarlos para análisis. La serie de CONEVAL corresponde al valor mensual por persona de la canasta alimentaria y cubre 399 periodos, de enero de 1992 a marzo de 2025. La fuente de INEGI corresponde al INPC mensual nacional y cubre 285 periodos, de enero de 2003 a septiembre de 2026. Son indicadores diferentes y relacionados: la propuesta documenta que CONEVAL utiliza el INPC. Ninguno de estos archivos representa por sí solo precios semanales de tiendas ni una serie específica de Colima.

## 2. Componentes entregados

| Componente | Ubicación | Descripción |
|---|---|---|
| Propuesta del observatorio | `docs/E0/propuesta.md` | Define sector, región, pregunta, cliente potencial, preguntas analíticas y fuentes. Incluye tres entrevistas simuladas, identificadas explícitamente como tales. |
| Documentación de captura | `docs/E0/captura-bronce.md` | Explica las fuentes, cobertura, uso de los archivos, ejecución local y límites actuales de la captura. |
| Extractor | `scripts/captura.py` | Descarga los ZIP oficiales de INEGI y CONEVAL, valida el contenido y conserva los archivos originales. |
| Automatización | `.github/workflows/captura-bronce.yml` | Configura ejecuciones manuales y una programación mensual. Ejecuta pruebas, captura las fuentes y publica un artefacto de Actions con retención de 90 días. |
| Pruebas automatizadas | `tests/test_captura.py` | Incluye cinco casos para validar cobertura mínima, periodos distintos y estructuras ZIP/XLSX. El flujo está configurado para ejecutarlos. |
| Datos y manifiesto | `datos/bronce/` | Contiene archivos originales, materiales descargados y `manifiesto.json` con fuente, huella SHA-256, fecha de consulta y cobertura detectada. |
| Registros PSP y objetivos | `calidad/` | Incluye registros de tiempo y defectos para Ángel y Adrián, además de objetivos iniciales de calidad. Los archivos de Adrián contienen por ahora solo encabezados. |

## 3. Diseño de la captura Bronce

El extractor descarga dos recursos con solicitudes HTTP identificadas como una investigación académica. Comprueba que cada archivo sea un ZIP válido, valida columnas o estructura esperada y requiere al menos 36 periodos mensuales con datos. Para CONEVAL verifica fechas y valores positivos de las columnas urbano y rural; para INEGI revisa los campos de fecha, valor y periodicidad mensual.

Si una fuente se descarga y valida, el extractor reemplaza el ZIP de destino y agrega al manifiesto el tamaño, la huella SHA-256, la hora UTC y el primer y último periodo. Si ocurre un error, lo registra en el manifiesto y devuelve un código de salida fallido. El flujo de GitHub Actions ejecuta pruebas antes de la captura y publica el directorio de Bronce como artefacto de la ejecución, con retención de 90 días.

La programación configurada es el día 12 de cada mes a las 12:23 UTC (06:23 en Colima, UTC−6 en la fecha de esta ficha). GitHub Actions toma sus ejecuciones programadas desde la rama predeterminada; la documentación del repositorio indica que se debe comprobar una ejecución real para confirmar que la programación quedó activa.

## 4. Calidad y trazabilidad

En `calidad/objetivos.md` se proponen tres objetivos:

1. Revisar antes del análisis que los precios sean numéricos y mayores que cero, y registrar los casos que requieran revisión.
2. Conservar la fuente y la fecha de captura para el 100 % de los conjuntos capturados.
3. Reunir al menos 36 periodos para la serie histórica; si la fuente no ofrece esa cobertura, registrar la cantidad disponible y documentar la limitación.

`tiempo-adrian.csv` y `defectos-adrian.csv` están creados con sus encabezados, sin entradas inventadas. Los registros deben completarse a medida que Adrián realice actividades o encuentre defectos. El extractor y el manifiesto aportan trazabilidad técnica de las capturas, mientras que los CSV PSP documentan el trabajo individual.

## 5. Alcance y limitaciones registradas

- Las tres entrevistas de `propuesta.md` son simuladas. No satisfacen la validación con un actor real ni el requisito de una entrevista de campo de al menos 15 minutos. Se necesitan entrevistas reales con consentimiento, fecha, duración y aprendizajes.
- Las fuentes descargadas ofrecen referencias mensuales nacionales o urbano/rurales; no proporcionan los precios semanales por comercio y ciudad que requieren plenamente las preguntas de pronóstico y comparación. Es necesario buscar y validar datos adicionales o ajustar el alcance analítico.
- El manifiesto constata que los archivos de las dos fuentes superan los 36 periodos, pero los periodos no son equivalentes a observaciones de productos individuales.
- La configuración del flujo está versionada, pero esta revisión de archivos no constituye evidencia de una ejecución exitosa en GitHub Actions. Se debe confirmar una ejecución y conservar su resultado.
- Los artefactos de Actions caducan después de 90 días; la documentación recomienda descargarlos y conservarlos antes de su vencimiento.

## 6. Verificación pendiente antes de presentar E0

1. Realizar y documentar al menos una entrevista real de 15 minutos con un actor del sector económico, reemplazando o complementando las simulaciones con consentimiento y aprendizajes reales.
2. Confirmar en GitHub Actions que el flujo se ejecuta y genera el artefacto esperado; registrar el enlace o identificador de ejecución.
3. Revisar que las fuentes y el alcance permitan responder las preguntas analíticas planteadas, o documentar los ajustes necesarios.
4. Completar los registros PSP con el trabajo y los defectos reales de cada integrante.
5. Revisar el contenido del directorio Bronce antes de la entrega; actualmente contiene un archivo temporal de Excel con prefijo `~$` dentro de los datos descargados de CONEVAL.

## 7. Archivos principales

- `README.md`
- `docs/E0/propuesta.md`
- `docs/E0/captura-bronce.md`
- `.github/workflows/captura-bronce.yml`
- `scripts/captura.py`
- `tests/test_captura.py`
- `datos/bronce/manifiesto.json`
- `calidad/objetivos.md`
- `calidad/tiempo-adrian.csv`
- `calidad/defectos-adrian.csv`
