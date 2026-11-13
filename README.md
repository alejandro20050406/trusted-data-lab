# Trusted Data Lab — Observatorio de Abastecimiento Inteligente para Consultorios de Colima

Proyecto académico orientado al abastecimiento de insumos médicos y dentales para consultorios del estado de Colima. La máquina de captura usa el piloto odontológico de Imdent, Tu Universo Dental y Dentalink Market.

El 12 de noviembre de 2026 una ejecución local capturó las tres páginas y guardó los originales y un manifiesto en Bronce. Una ejecución manual de GitHub Actions capturó las tres fuentes el 11 de noviembre usando Ubuntu 24.04; la ejecución diaria programada aún no se ha observado. No existe todavía un comparador funcional.

- [Propuesta y entrevista](docs/E0/propuesta.md)
- [Captura y limitaciones](docs/E0/captura-bronce.md)
- [Estado de la entrega](docs/E0/ENTREGA.md)
- [Objetivos de calidad](calidad/objetivos.md)

La arquitectura prevista es Bronce (datos originales), Plata (validación y homologación) y Oro (comparaciones).

La [entrega E1](docs/E1/ENTREGA.md) incorpora un pipeline reproducible hasta Plata, validación Pandera y cuarentena. Las variantes y condiciones aún no se han comprobado como equivalentes. La [relatoría](docs/relatoria-E1.md) describe resultados y pendientes.

La captura ampliada de cuatro tiendas mexicanas de Imdent se ejecuta con `python -m scripts.captura_imdent`; después, `python -m src.e1` procesa los archivos descargados. Véanse el alcance, la cuarentena y las limitaciones en la ficha E1.
