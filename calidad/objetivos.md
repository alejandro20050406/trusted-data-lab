# Objetivos de calidad — observatorio de insumos médicos

Metas propuestas para medir cuando se implementen los controles; no se afirma que estén alcanzadas:

1. **Disponibilidad:** al menos 95 % de ejecuciones programadas exitosas por periodo de seguimiento. Denominador: ejecuciones programadas; numerador: las que completan correctamente las fuentes previstas para esa ejecución.
2. **Completitud:** al menos 95 % de registros capturados con campos obligatorios completos. Denominador: registros capturados evaluables; los campos se definirán por fuente. Para precios: fecha, producto, fuente y precio; para establecimientos: fecha de captura, nombre, fuente y ubicación disponible según el esquema acordado.
3. **Duplicados:** menos de 2 % de registros duplicados después de la validación. Denominador: registros posteriores a la validación; definir claves por fuente y observación, sin confundir precios del mismo producto en fechas diferentes con duplicados.

Como controles complementarios, conservar URL, fecha y evidencia original; comprobar precios positivos y finitos; comparar marca, variante y presentación equivalentes; indicar faltantes y no asumir que envío o impuestos desconocidos son cero. Documentar cobertura y número de observaciones antes de cualquier pronóstico.

