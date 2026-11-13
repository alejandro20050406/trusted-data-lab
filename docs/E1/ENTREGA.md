# Entrega E1 — Limpieza, integración y calidad de datos

**Proyecto:** Trusted Data Lab — Observatorio de Abastecimiento Inteligente.
**Integrantes:** Adrián y Ángel.
**Ámbito:** captura pública de ofertas comerciales dentales y catálogo institucional ISSSTE.

## Objetivo y alcance

El flujo conserva capturas originales en Bronce, valida cada fuente antes de Plata y genera vistas reducidas e indicadores en Oro. Las ofertas comerciales y las claves ISSSTE tienen granos diferentes: una es una oferta de una tienda en una fecha; la otra, una entrada institucional por clave y nivel de atención. Una coincidencia de nombre no demuestra que sean el mismo producto ni autoriza transferirle un precio.

## Reproducción

En PowerShell, desde la raíz del proyecto y con Python 3.12 o superior:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-e1.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests
.\.venv\Scripts\python.exe -m scripts.captura_imdent
.\.venv\Scripts\python.exe -m src.e1
```

Si `.venv` ya existe e incluye las dependencias, no es necesario volver a crearlo. La captura requiere internet y crea carpetas nuevas en `datos/bronce/imd_catalogo/`; el pipeline procesa las capturas locales presentes, sin volver a descargar. Para una sola tienda, usar `python -m scripts.captura_imdent --tienda deposito-dental-q-narvarte`. `--imd-bronce`, `--bronce`, `--catalogo`, `--referencias` y `--salida` permiten seleccionar entradas y salida; esta última no debe existir.

Cada corrida crea `datos/e1/<UTC>/`, sin modificar capturas anteriores. Los resultados CSV usan UTF-8 con BOM para abrirse en Excel:

| Archivo | Contenido |
| --- | --- |
| `plata.csv` | Ofertas con precio observado que pasaron Pandera y variables de limpieza. |
| `cuarentena.json` | Ofertas o páginas rechazadas con razón y referencia a Bronce. |
| `plata_issste.csv` | Entradas institucionales validadas, sin precios comerciales. |
| `cuarentena_issste.json` | Filas institucionales rechazadas con número de línea y motivo. |
| `diagnostico_faltantes.csv` | Faltantes de precio por fuente, tienda y categoría antes de la puerta. |
| `estimaciones_cuarentena.csv` | Estimaciones exploratorias de faltantes; **no son cotizaciones**. |
| `validacion_imputacion.csv` | Prueba con precios observados ocultados, estimación y error. |
| `correspondencias.csv` | Referencias ISSSTE y su estado de revisión. |
| `oro_inventario.csv` | Última oferta válida por URL y registros ISSSTE en esquema común, con tipo explícito. |
| `oro_metricas.csv` | Conteos de registros y precios observados por tipo y categoría. |
| `oro_reduccion.json` | Recuento de entrada y salida y regla de reducción. |
| `resumen.json` | Cobertura, calidad, validación de imputación y recuentos de ambas capas. |

## Fuentes y captura

Las páginas dentales individuales se procesan desde `datos/bronce/odontologia/`. Las cuatro tiendas mexicanas configuradas de Imdent se recorren por páginas, con revisión de `robots.txt`, una pausa de 1.5 segundos y un límite de 100 páginas por tienda. Se comparan las tarjetas recuperadas con el total anunciado. Cada página se conserva con URL, fecha y SHA-256 en un manifiesto; si falla o cambia la estructura, se registra la captura parcial. No se asegura cobertura de otras tiendas ni de todos los productos mundiales de Imdent.

La solicitud HTTPS conserva la verificación de certificados y reintenta hasta tres veces errores transitorios con pausas de 2, 4 y 8 segundos. No reintenta rechazos 403 o 429. La [ejecución anterior verificada](https://github.com/alejandro20050406/trusted-data-lab/actions/runs/43369393421) capturó las cuatro tiendas en GitHub. Fallos futuros se registran; los archivos locales ignorados por Git no se trasladan automáticamente a Actions. Los artefactos de Actions duran 90 días. El ZIP versionado `capas-e1.zip` es una instantánea, no una actualización automática; revisar su resumen y fecha.

En Dentalink, la ficha HTML puede publicar un precio individual además de un `AggregateOffer` con rango. Solo se recupera el precio de la tarjeta principal si coinciden el título y la moneda MXN y se identifican un vendedor y un importe únicos. La captura de referencia indica $1,199 para Depósito Dental Molar y **sin stock**. No se toman como ese precio los importes de ofertas alternativas ni los extremos del rango. Si la estructura resulta ambigua, el registro permanece en cuarentena. Se conserva la página original y se registran vendedor y disponibilidad; el precio observado no garantiza existencia o entrega.

## Puerta de calidad y resolución de conflictos

Pandera valida estrictamente los campos, tipos, URL HTTPS, moneda MXN, fecha con zona horaria, trazabilidad y precio finito mayor que cero y no superior a 1,000,000 antes de Plata comercial. El límite superior es técnico, no un precio de referencia. Imdent se interpreta únicamente si existe un precio actual no tachado y único en MXN. Los registros sin precio, con moneda no identificada, estructura ambigua o repetidos en una misma captura se preservan en cuarentena; no se transforman en precios observados.

ISSSTE se lee en Windows-1252, verifica el hash original y se valida con un esquema propio de Pandera. La clave se mantiene como texto y el grano es **clave + nivel de atención**: una misma clave con niveles distintos se conserva en filas diferentes. Los conflictos de clave y nivel duplicados se envían a cuarentena. Cuatro claves de la captura aparecen en notación científica; se rechazan sin inventar los dígitos originales. El valor `0` de indicaciones se conserva tal como llega: no se interpreta como indicación clínica ni se imputa.

La tabla [correspondencias de referencia](../../datos/referencias/correspondencias_issste.csv) mantiene candidatos con fuente, URL, producto, clave, coincidencias, diferencias y evidencia. Solo una decisión humana `revisada` y `exacta`, con nombre, fecha y hashes de ambas fuentes vigentes, se incorpora como `clave_issste_verificada` a la oferta en Oro. Si cambia un hash, la decisión requiere revalidación. Si una oferta acumula claves exactas incompatibles, Oro marca `conflicto_correspondencias` y no elige ninguna. Ninguna de las correspondencias iniciales es exacta aprobada: el kit ISSSTE 5006810001 no se equipara automáticamente a una jeringa individual.

La unión en Oro homologa nombres y tipos al esquema común y marca `tipo_registro`; las filas ISSSTE dejan el precio vacío porque la fuente no lo publica. No se asigna un precio comercial a una clave institucional por semejanza textual. Se preservan por separado los originales, la cuarentena y toda la historia de Plata.

## Faltantes e imputación

`diagnostico_faltantes.csv` compara tasas de precio ausente entre fuentes, tiendas y categorías. La ausencia depende de lo que cada fuente publica, del formato de oferta y de la disponibilidad; MCAR no está demostrado, MAR es una hipótesis condicionada a variables observadas y MNAR no se puede descartar. Los datos observados no permiten determinar el mecanismo de manera concluyente.

Para estudiar la imputación se prioriza la última observación válida **anterior de la misma URL y nombre**, si tiene una antigüedad de hasta siete días. La estimación conserva fecha y hash de la observación utilizada y no se interpreta como precio actual publicado. Si no existe historial suficiente, se calcula la **mediana de precios observados** de productos de la misma tienda, categoría textual y fecha UTC, usando al menos 10 URL distintas. Solo se estiman candidatos Imdent sin precio; si no hay referencia apropiada permanecen sin estimación. El importe calculado, método, tamaño de referencia, evidencia y bandera `es_imputado` se guardan en `estimaciones_cuarentena.csv`; el registro original **sigue en cuarentena**, no entra a Plata ni a Oro como cotización. Los grupos por categoría no garantizan equivalencia de marca, contenido o presentación.

La validación histórica compara cada observación con la anterior de la misma ficha, exclusivamente hacia atrás y dentro de siete días. Para la mediana, se oculta de forma determinista 20 % de URL por grupo y se estiman usando solo el 80 % restante, con al menos 10 URL de entrenamiento. Los errores de ambos métodos se guardan **por separado** en `validacion_imputacion.csv` y `resumen.json`. Para la mediana, con menos de 5 casos de validación el diagnóstico es `evidencia_insuficiente`; con MAPE mayor a 30 % se marca `error_alto`. Este umbral es una alarma descriptiva, no una garantía.

En la ejecución local de referencia se generaron **14 estimaciones por mediana**: 8 con evidencia insuficiente y 6 con error alto. Los 128 precios ocultados de esa prueba dieron un MAPE aproximado de **137.6 %**. La validación histórica comparó 2,088 pares y obtuvo 0 % de error en estas capturas cercanas, sin que hubiera un faltante apto para ese método; dos capturas sin cambio de precio no prueban precisión futura. Las estimaciones son exploratorias y no deben utilizarse para decisiones de compra.

## Atípicos, escalado, discretización y reducción

- Las categorías textuales conservadoras reconocen guantes, gasas, cubrebocas, resinas, adhesivos, desinfección, fresas rotatorias, limas, cementos, ionómeros, material de impresión, instrumental, higiene preventiva, jeringas y agujas, y anestesia; el resto queda `sin_clasificar`. La jerarquía es `salud > insumos > categoría`; es una regla heurística, no clasificación clínica validada.
- Min-Max y Z-Score de grupo usan ofertas de la misma tienda, categoría y fecha UTC con al menos 10 URL distintas. Se registran en `precio_minmax_grupo` y `precio_zscore_grupo`; si no hay variación se dejan vacíos. Los grupos no garantizan presentaciones equivalentes y las escalas son exploratorias.
- IQR se calcula con al menos 20 URL distintas y rango intercuartílico positivo en esos mismos grupos. `atipico_iqr_grupo` marca límites de 1.5 IQR. `precio_suavizado_exploratorio` limita al intervalo IQR para análisis; `precio` conserva siempre el valor publicado. Una marca no prueba que el dato sea incorrecto y requiere revisión.
- `banda_precio_mxn` discretiza en hasta 500, más de 500 hasta 1,000 y más de 1,000 MXN; son límites descriptivos arbitrarios.
- Oro selecciona la última observación válida por URL comercial y conserva los registros ISSSTE por clave y nivel. `oro_reduccion.json` compara cantidades de entrada y salida. La reducción no borra las observaciones históricas de Plata ni agrupa precios de artículos no equivalentes.

## Evidencia y límites

En la ejecución local `20261113T055623405929Z`, realizada con dos juegos de capturas de cuatro tiendas y el piloto previo, se procesaron **4,356 observaciones comerciales: 4,178 válidas y 178 en cuarentena**. El catálogo ISSSTE aportó **1,579 filas válidas y 4 rechazadas**; Oro integró **3,667 filas**. Las cifras dependen de las capturas presentes: las filas no son productos independientes y los resultados remotos pueden diferir. El pipeline no prueba inventario, entrega en Colima, equivalencia de productos ni autorización para reutilizar contenido. Revisar condiciones de uso antes de publicar.

La entrega requiere el tag `e1` apuntando al commit final verificado. El formulario oficial todavía no existe según la información proporcionada; registrar el enlace cuando esté disponible.
