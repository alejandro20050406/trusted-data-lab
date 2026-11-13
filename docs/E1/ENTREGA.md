# Entrega E1 — Puerta de calidad y procesamiento

**Proyecto:** Trusted Data Lab, piloto odontológico. **Integrantes:** Adrián y Ángel. **Corte:** 12 de noviembre de 2026 (hora de Colima).

## Ejecución reproducible

Desde la raíz del repositorio, con Python 3.12 o superior:

```bash
python -m venv .venv
# Activar el entorno: Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements-e1.txt
python -m unittest discover -s tests
python -m src.e1
```

Cada ejecución crea un directorio nuevo `datos/e1/<UTC>/` con `plata.csv`, `oro_exploratorio.csv`, `cuarentena.json`, `correspondencias.csv` y `resumen.json`. Se puede indicar `--bronce`, `--catalogo`, `--referencias` y `--salida`; esta última no debe existir. `--catalogo` recibe la ruta del manifiesto ISSSTE, no del CSV. Los resultados no se versionan automáticamente. El workflow `E1 calidad y capas` ejecuta pruebas y pipeline al cambiar entradas, referencias o código y manualmente. El workflow de captura también ejecuta E1 después de capturar, incluso ante un fallo parcial de captura, y conserva Bronce y salidas por 90 días. Cada corrida procesa las capturas versionadas y la nueva captura de esa corrida; no acumula automáticamente artefactos anteriores.

## Integración y controles

Se leen todos los manifiestos de `datos/bronce/odontologia`, se verifica SHA-256 y se extrae el `Product` JSON-LD de cada página. `Offer.price` numérico se convierte a flotante y la moneda a mayúsculas. Se exige un solo producto, una oferta individual, MXN, precio finito positivo hasta 1 000 000, URL HTTPS, fecha con zona horaria, nombre y trazabilidad. Pandera valida estrictamente el esquema antes de Plata. Una oferta agregada con mínimo y máximo no es un precio individual; se envía a cuarentena. Si la estructura cambia, la extracción falla de forma conservadora. Cada rechazo conserva el registro o la entrada del manifiesto y el motivo; los originales siguen en Bronce. Un manifiesto ilegible detiene la ejecución, en vez de producir una salida incompleta.

Las capturas sucesivas son observaciones distintas, no duplicados que deban eliminarse. El catálogo ISSSTE es otra fuente, en Windows-1252 y sin precio. La tabla de correspondencias descrita abajo relaciona candidatos sin atribuir precios o disponibilidad al catálogo. Las fuentes comerciales tampoco han sido verificadas como presentaciones y variantes equivalentes; Oro no debe emplearse para comparar proveedores ni para decisiones de compra. El límite superior es una regla técnica, no una referencia de precio clínicamente válida.

## Correspondencias con el catálogo ISSSTE

La tabla mantenida en [`datos/referencias/correspondencias_issste.csv`](../../datos/referencias/correspondencias_issste.csv) contiene las hipótesis explícitas. Para cada producto extraído, el pipeline busca una referencia que coincida **exactamente** en fuente, URL y nombre JSON-LD; no usa similitud de texto ni acepta coincidencias automáticamente. Antes de generar la tabla comprueba el SHA-256 del catálogo contra su manifiesto, lo lee en Windows-1252 y trata la clave como texto. Si el archivo falta, el hash no coincide o una clave referenciada no existe o está duplicada, la ejecución falla. El catálogo contiene al menos una clave duplicada no utilizada por estas referencias; no se presupone unicidad global. Si cambia el nombre, fuente o URL, la salida lo marca `sin_candidato` hasta actualizar y revisar la referencia. Un fallo de extracción permanece en cuarentena y no produce candidato.

La salida `correspondencias.csv` contiene una fila por captura y referencia aplicable: fuente, URL, producto, fecha, archivo y SHA-256 dental; `apta_plata` indica el resultado de la puerta; clave, descripción, unidad y SHA-256 del catálogo; estado, tipo de relación, coincidencias, diferencias, evidencia, revisor y fecha. Una captura sin referencia recibe una fila `sin_candidato`. Si hay varias referencias explícitas aplicables se genera una fila por cada una. La tabla no contiene precios y **no modifica Plata, Oro ni la cuarentena**; una fila con `apta_plata=no` solo documenta un candidato y no autoriza usar su precio.

En el corte actual hay tres referencias para la clave **5006810001**: dos ofertas de resina Filtek y una jeringa Dentalink. Están marcadas `pendiente` / `candidato_parcial`: el ISSSTE describe un **kit** de varias jeringas y otros componentes, no una pieza individual. En Dentalink el tono A2B no se ha demostrado equivalente al A2 del kit; para Tu Universo Dental tampoco se han confirmado peso y variante. Con dos capturas por fuente se generan seis filas, cuatro aptas para Plata y dos no aptas; ninguna correspondencia está aprobada. Las coincidencias y diferencias son indicios documentados, no un dictamen clínico o comercial.

### Procedimiento de revisión

1. Abrir la descripción de la clave ISSSTE y la página original indicada; comprobar fecha y disponibilidad de la evidencia. Comparar tipo, características, marca cuando aplique, variante, peso, cantidad y contenido de la presentación. Un GTIN verificable puede ayudar si ambas fuentes lo publican, pero no se debe inventar.
2. Editar la fila de referencias con las coincidencias, diferencias y evidencia concreta. La identidad de la oferta debe conservar fuente, URL y nombre exactos; la clave ISSSTE se conserva como texto. Agregar otra fila si hay más de una clave candidata.
3. Solo tras una revisión humana, cambiar `estado_revision` a `revisada`, seleccionar `tipo_relacion` entre `exacta`, `compatible_parcial` o `descartada`, registrar el nombre del revisor y `fecha_revision` en formato `AAAA-MM-DD`, y copiar los hashes `sha256` dental y `sha256_catalogo_issste` de la fila revisada a `sha256_producto_revisado` y `sha256_catalogo_revisado` en la referencia. Un estado `pendiente` requiere `candidato_parcial` y campos de revisión y hashes vacíos. Si cambia cualquiera de los archivos, la salida rebaja esa revisión a `pendiente_revalidacion` / `candidato_parcial`; exige nueva revisión. El programa comprueba estos campos, pero no puede verificar que el revisor o la evidencia sean auténticos.
4. Ejecutar nuevamente pruebas y pipeline, inspeccionar `correspondencias.csv` y conservar la evidencia de la decisión. Una relación parcial o descartada no permite comparar precios. Incluso una relación marcada exacta exige comprobar presentación y condiciones antes de cualquier análisis comercial; el pipeline no realiza esa comparación.

Los archivos originales deben conservar sus bytes. El CSV ISSSTE se guardó con los bytes correspondientes a su manifiesto; `.gitattributes` evita que Git convierta sus finales de línea. Esta corrección restaura la representación de Bronce al hash registrado, sin alterar su contenido de origen.

## Tratamiento estadístico

- **Faltantes:** `resumen.json` cuantifica nulos de los candidatos extraídos antes de la puerta. En la ejecución de referencia hay 2 precios ausentes de 6 observaciones: ambos proceden de ofertas agregadas Dentalink. Su ausencia depende de la estructura observada de la fuente, compatible con MAR condicional a la fuente; MCAR no está justificado y MNAR no puede descartarse ni probarse con estos datos. No se puede identificar el mecanismo de manera concluyente. Se rechazan precios ausentes en lugar de imputarlos, pues crearían una cotización inexistente. No hay otra variable numérica opcional observada que permita una imputación defendible; la imputación queda pendiente de contar con una variable y datos adecuados. No se imputan identificadores, fechas, moneda ni producto.
- **Atípicos y ruido:** IQR con límites Q1 − 1.5 IQR y Q3 + 1.5 IQR solo se calcula con al menos 8 registros y IQR positivo; en otro caso se deja sin determinar. Las marcas conservan el valor original y requieren revisión; no se recortan ni eliminan precios automáticamente. No se afirma que una observación atípica sea errónea.
- **Escalado:** Min-Max `(x-min)/(max-min)` y Z-Score `(x-media)/desviación poblacional`, calculados sobre el lote válido; si el denominador es cero se deja nulo. Son exploratorios y dependen del lote, no parámetros entrenados para predicción.
- **Discretización y jerarquía:** bandas en MXN (0–500, >500–1000 y >1000); jerarquía temática salud > odontología > resina dental del piloto. Los límites son descriptivos arbitrarios, no categorías comerciales validadas.
- **Reducción:** Oro proyecta variables analíticas y conserva fuente, fecha y hash para volver a Plata; omite URL, ruta, nombre y moneda fija. Se incluyen solo las observaciones que superaron la puerta, sin borrar Bronce ni cuarentena. No se agregan precios de productos cuya equivalencia no se ha verificado. Con tan pocos datos el muestreo o agregar por proveedor no sería representativo.

## Resultado de referencia y límites

Con las dos capturas versionadas: **6 entradas, 4 válidas y 2 en cuarentena**; ambas son ofertas agregadas sin precio individual. Las cuatro observaciones proceden de dos fuentes en dos fechas de captura, no son cuatro productos independientes. La muestra no permite inferir tendencias, establecer precios de mercado ni pronosticar. El pipeline no prueba que haya entrega en Colima, inventario o autorización para reutilizar datos. Revisar condiciones de uso de las fuentes antes de publicar los datos. El tag `e1` debe apuntar al commit final verificado.
