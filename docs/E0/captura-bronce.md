# Máquina de captura Bronce: piloto odontológico

La captura restaurada emplea las mismas tres páginas y fuentes del piloto original:

1. **Imdent — Depósito Dental Q Narvarte:** [resina Filtek Z350 XT](https://imdent.com/stores/deposito-dental-q-narvarte/products/resina-filtek-z350-xt-4-gr-3m). El depósito se encuentra en Ciudad de México; no se debe presentar como proveedor local.
2. **Tu Universo Dental, Colima:** [resina dental 3M Filtek](https://www.tuuniversodental.com.mx/resina-dental-3m-filtek).
3. **Dentalink Market México:** [jeringa de resina Z-350 XT A2B](https://dentalinkmarket.com/mx/productos/31069-jeringa-de-resina-z-350-xt-color-a2b-4g). Registrar por separado la plataforma y el vendedor efectivo.

El 12 de noviembre de 2026 la ejecución local capturó las tres páginas correctamente en `datos/bronce/odontologia/20261113T022451023084Z/`. Cada archivo conserva el HTML original; el manifiesto registra fuente, URL, fecha UTC, resultado, tamaño, SHA-256 y huella de robots.txt. Una respuesta correcta de las tres fuentes no demuestra que las variantes o presentaciones sean equivalentes, ni existencia o entrega en Colima. El 11 de noviembre de 2026 hubo también una [ejecución manual correcta en GitHub](https://github.com/alejandro20050406/trusted-data-lab/actions/runs/43077854266).

## Ejecución y automatización

Desde la raíz del proyecto: `python scripts/captura_dental.py`. Para ejecutar las pruebas: `python -m unittest discover -s tests`. El extractor revisa robots.txt antes de cada página, limita el tamaño, no sigue redirecciones y registra fallos sin inventar precios.

`.github/workflows/captura-bronce.yml` está configurado para ejecutarse diariamente a las 12:23 UTC y manualmente. Guarda los datos como artefactos durante 90 días, por lo que deben conservarse antes de que caduquen. La ejecución programada aún no se ha observado; el archivo debe estar en la rama predeterminada para que funcione. El flujo no acumula automáticamente los artefactos.

Antes de reutilizar o publicar contenido de los proveedores deben revisarse sus términos y permisos; robots.txt por sí solo no concede licencia. Las páginas y condiciones pueden cambiar. La captura del ISSSTE permanece como antecedente separado, no como fuente de esta máquina.

## Alcance y pendientes

Las páginas son una muestra odontológica, no una cobertura del mercado médico general. No existe todavía una capa Plata que homologue productos ni una capa Oro de indicadores. Verificar marca, variante, presentación, envío y vendedor real antes de comparar precios. De acuerdo con la indicación compartida del profesor, E0 no requiere 36 periodos; los datos actuales tampoco bastan por sí solos para un pronóstico robusto.
