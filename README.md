# Trusted Data Lab — Observatorio de Abastecimiento Inteligente para Consultorios de Colima

Proyecto académico orientado al abastecimiento de insumos médicos y dentales para consultorios del estado de Colima. La máquina de captura usa el piloto odontológico de Imdent, Tu Universo Dental y Dentalink Market.

La captura diaria programada (`.github/workflows/captura-bronce.yml`) corre desde el 12 de noviembre de 2026. Visita tres páginas de producto (Imdent, Tu Universo Dental y Dentalink Market) y los catálogos completos de cuatro tiendas de Imdent. Cada ejecución versiona sus capturas en `datos/bronce/odontologia/` y `datos/bronce/imd_catalogo/`, así que la historia se acumula en el repositorio y un clon limpio reproduce Plata y Oro con todas las fechas capturadas. Las capturas del 13 al 26 de noviembre se recuperaron de los artefactos de Actions y se verificaron contra el SHA-256 de su manifiesto. Las capturas parciales del 17 y 19 de noviembre (Imdent respondió 502/504) se conservan como evidencia de esas fallas. No existe todavía un comparador funcional.

- [Propuesta y entrevista](docs/E0/propuesta.md)
- [Captura y limitaciones](docs/E0/captura-bronce.md)
- [Estado de la entrega](docs/E0/ENTREGA.md)
- [Objetivos de calidad](calidad/objetivos.md)

La arquitectura utiliza Bronce (datos originales), Plata (validación y homologación) y Oro (inventario y conteos).

La [entrega E1](docs/E1/ENTREGA.md) incorpora un pipeline reproducible hasta Plata y Oro, validación Pandera, cuarentena y estimaciones exploratorias separadas. Las variantes y condiciones aún no se han comprobado como equivalentes. La [relatoría](docs/relatoria-E1.md) describe resultados y pendientes.

La captura ampliada de cuatro tiendas mexicanas de Imdent se ejecuta con `python -m scripts.captura_imdent`; después, `python -m src.e1` procesa los archivos descargados. Véanse el alcance, la cuarentena y las limitaciones en la ficha E1.
