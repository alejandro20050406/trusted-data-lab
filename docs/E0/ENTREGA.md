# Entrega E0 — Observatorio de Abastecimiento Inteligente para Consultorios de Colima

**Integrantes:** Adrián y Ángel. **Repositorio:** [trusted-data-lab](https://github.com/alejandro20050406/trusted-data-lab).

La [propuesta](propuesta.md) plantea el abastecimiento para consultorios médicos y dentales, una entrevista simulada con la dentista Amaranta, preguntas E1, E2 y E3 y un plan de fuentes. La simulación no sustituye una entrevista de campo real.

## Máquina de captura

- El piloto odontológico captura las fuentes originales: Imdent, Tu Universo Dental y Dentalink Market. El 12 de noviembre de 2026 se verificó localmente una captura correcta de las tres páginas.
- Ejecutar `python scripts/captura_dental.py` desde la raíz del proyecto. Las pruebas se ejecutan con `python -m unittest discover -s tests`.
- El flujo `.github/workflows/captura-bronce.yml` está configurado para ejecución diaria y manual. Una ejecución manual en GitHub funcionó el 11 de noviembre de 2026; todavía no se ha observado una ejecución programada.
- La captura institucional previa del ISSSTE se conserva como antecedente separado. DENUE y las fuentes de precios para otras especialidades siguen pendientes. Ver [plan de captura](captura-bronce.md).
- Según la indicación compartida del profesor, no se requieren 36 periodos para E0. No se afirma que exista historial suficiente para pronosticar.

Los registros PSP deben reflejar actividades y defectos reales. Las [metas de calidad](../../calidad/objetivos.md) están propuestas y todavía no se han medido. Bronce conserva originales; Plata y Oro aún no están implementadas.
