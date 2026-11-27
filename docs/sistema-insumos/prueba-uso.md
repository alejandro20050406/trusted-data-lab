# Prueba de uso con la clienta (D-15, módulo de Adrián)

Se hace junto con la sesión de Angel (A-15), con **pacientes ficticios** mientras no esté aprobado `datos-pacientes.md`.

## Mediciones automáticas previas (Playwright, 360 px y 1280 px)

| Tarea | Meta del plan | Medido en prueba automática |
|---|---|---|
| Marcar cita como atendida | 1 toque | 1 toque |
| Reagendar una cita | ≤ 3 toques | 3 toques (Reagendar, elegir día, Guardar) |
| Escanear y guardar una hoja | 3 toques | 3 toques (Escanear, disparar, usar foto) con el tipo ya elegido |
| Registrar bracket caído sin foto | 2 toques | 2 toques (Registrar bracket caído, diente) |
| Registrar bracket caído con foto | 3 toques | 3 toques (diente, Agregar foto, disparar/usar) |
| Marcar esterilización o recolección | 1 toque | 1 toque desde el aviso o la tarea |

Todos los botones de las pantallas nuevas miden al menos 44 × 44 px y no hay desplazamiento horizontal a 360 px.

## Sesión con la clienta (pendiente)

| Tarea | Toques | Tiempo | ¿Sin ayuda? | Comentarios |
|---|---|---|---|---|
| Registrar una cita reagendada | | | | |
| Escanear un documento | | | | |
| Registrar un bracket caído | | | | |
| Marcar una esterilización | | | | |
| Instalar la app en su celular | | | | |
| Revisar la gráfica de precios | | | | |
| Revisar el reporte de colores de ligas | | | | |

## Decisiones que se deben tomar en la sesión

- Umbral de la insignia "Reagenda seguido" (provisional: 3 veces, variable `UMBRAL_REAGENDA`).
- Periodicidad de la esterilización y si se registra por pieza, paquete o ciclo de autoclave (D-10).
- Si usa número de manifiesto del recolector de residuos (el campo ya existe y es opcional).
- Días de cobertura de la compra sugerida de ligas (provisional: 30).
