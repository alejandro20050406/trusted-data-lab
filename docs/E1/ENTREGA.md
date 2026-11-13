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

Cada ejecución crea un directorio nuevo `datos/e1/<UTC>/` con `plata.csv`, `oro_exploratorio.csv`, `cuarentena.json` y `resumen.json`. Se puede indicar `--bronce` y `--salida`; esta última no debe existir. Los resultados no se versionan automáticamente. El workflow `E1 calidad y capas` ejecuta pruebas y pipeline al cambiar entradas o código y manualmente. El workflow de captura también ejecuta E1 después de capturar, incluso ante un fallo parcial de captura, y conserva Bronce y salidas por 90 días. Las ejecuciones remotas de esta versión todavía deben verificarse. Cada corrida procesa las capturas versionadas y la nueva captura de esa corrida; no acumula automáticamente artefactos anteriores.

## Integración y controles

Se leen todos los manifiestos de `datos/bronce/odontologia`, se verifica SHA-256 y se extrae el `Product` JSON-LD de cada página. `Offer.price` numérico se convierte a flotante y la moneda a mayúsculas. Se exige un solo producto, una oferta individual, MXN, precio finito positivo hasta 1 000 000, URL HTTPS, fecha con zona horaria, nombre y trazabilidad. Pandera valida estrictamente el esquema antes de Plata. Una oferta agregada con mínimo y máximo no es un precio individual; se envía a cuarentena. Si la estructura cambia, la extracción falla de forma conservadora. Cada rechazo conserva el registro o la entrada del manifiesto y el motivo; los originales siguen en Bronce. Un manifiesto ilegible detiene la ejecución, en vez de producir una salida incompleta.

Las capturas sucesivas son observaciones distintas, no duplicados que deban eliminarse. El catálogo ISSSTE es otra fuente, en Windows-1252, sin precio ni clave de correspondencia demostrada con los productos comerciales. No se une por coincidencia superficial ni se atribuyen precios o disponibilidad al catálogo. Las fuentes comerciales tampoco han sido verificadas como presentaciones y variantes equivalentes; Oro no debe emplearse para comparar proveedores ni para decisiones de compra. El límite superior es una regla técnica configurable, no una referencia de precio clínicamente válida.

## Tratamiento estadístico

- **Faltantes:** `resumen.json` cuantifica nulos de los candidatos extraídos antes de la puerta. En la ejecución de referencia hay 2 precios ausentes de 6 observaciones: ambos proceden de ofertas agregadas Dentalink. Su ausencia depende de la estructura observada de la fuente, compatible con MAR condicional a la fuente; MCAR no está justificado y MNAR no puede descartarse ni probarse con estos datos. No se puede identificar el mecanismo de manera concluyente. Se rechazan precios ausentes en lugar de imputarlos, pues crearían una cotización inexistente. No hay otra variable numérica opcional observada que permita una imputación defendible; la imputación queda pendiente de contar con una variable y datos adecuados. No se imputan identificadores, fechas, moneda ni producto.
- **Atípicos y ruido:** IQR con límites Q1 − 1.5 IQR y Q3 + 1.5 IQR solo se calcula con al menos 8 registros y IQR positivo; en otro caso se deja sin determinar. Las marcas conservan el valor original y requieren revisión; no se recortan ni eliminan precios automáticamente. No se afirma que una observación atípica sea errónea.
- **Escalado:** Min-Max `(x-min)/(max-min)` y Z-Score `(x-media)/desviación poblacional`, calculados sobre el lote válido; si el denominador es cero se deja nulo. Son exploratorios y dependen del lote, no parámetros entrenados para predicción.
- **Discretización y jerarquía:** bandas en MXN (0–500, >500–1000 y >1000); jerarquía temática salud > odontología > resina dental del piloto. Los límites son descriptivos arbitrarios, no categorías comerciales validadas.
- **Reducción:** Oro proyecta variables analíticas y conserva fuente, fecha y hash para volver a Plata; omite URL, ruta, nombre y moneda fija. Se incluyen solo las observaciones que superaron la puerta, sin borrar Bronce ni cuarentena. No se agregan precios de productos cuya equivalencia no se ha verificado. Con tan pocos datos el muestreo o agregar por proveedor no sería representativo.

## Resultado de referencia y límites

Con las dos capturas versionadas: **6 entradas, 4 válidas y 2 en cuarentena**; ambas son ofertas agregadas sin precio individual. Las cuatro observaciones proceden de dos fuentes en dos fechas de captura, no son cuatro productos independientes. La muestra no permite inferir tendencias, establecer precios de mercado ni pronosticar. El pipeline no prueba que haya entrega en Colima, inventario o autorización para reutilizar datos. Revisar condiciones de uso de las fuentes antes de publicar los datos. El tag `e1` debe apuntar al commit final verificado.
