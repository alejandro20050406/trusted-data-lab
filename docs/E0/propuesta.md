# Observatorio de Abastecimiento Inteligente para Consultorios de Colima

**Estado:** propuesta E0; entrevista y captura piloto de fuentes odontológicas. La ampliación a insumos médicos generales está en planeación.

## Ficha del observatorio

- **Sector:** comercio y distribución de insumos para consultorios de salud.
- **Región:** estado de Colima, especialmente Colima, Villa de Álvarez, Manzanillo y Tecomán.
- **Clientes potenciales:** consultorios médicos y dentales privados pequeños y medianos que compran insumos recurrentemente.
- **Alcance:** insumos médicos de distintas especialidades, incluidos los odontológicos. La canasta y sus proveedores deberán seleccionarse y validarse; no todas las especialidades consumen los mismos productos.

Los consultorios adquieren productos recurrentemente y pueden depender de varios proveedores, con información dispersa sobre precios y disponibilidad. Esto puede dificultar la planeación y provocar compras urgentes o mayor trabajo administrativo. Son hipótesis que requieren validación con profesionales de distintas especialidades.

**Pregunta detonadora:** ¿Cómo puede un sistema basado en datos ayudar a los consultorios de Colima a mejorar el abastecimiento de insumos, reduciendo costos y riesgo de desabasto sin comprometer la calidad de los productos?

El proyecto se orienta a un posible proveedor de insumos que combine información comercial y apoyo a la planeación. No recomienda productos para uso clínico ni garantiza precios, disponibilidad, calidad o entregas.

## Entrevista: dentista Amaranta López

1. **¿Qué productos o insumos necesita comprar con mayor frecuencia para operar su consultorio?**  
   **Amaranta:** Guantes, cubrebocas, gasas y desinfectantes; también materiales dentales como resinas y adhesivos. Las cantidades dependen de los tratamientos y del inventario disponible.

2. **¿Cómo selecciona actualmente a sus proveedores y qué factores considera más importantes: precio, calidad, disponibilidad o tiempo de entrega?**  
   **Amaranta:** Compararía catálogos y consultaría a proveedores conocidos. Primero revisaría que el producto sea adecuado y confiable; después consideraría precio, disponibilidad, entrega y costos adicionales.

3. **¿Ha tenido problemas de desabasto o ha tenido que realizar compras de emergencia? ¿Qué consecuencias tuvo?**  
   **Amaranta:** Podría ocurrir que un insumo se termine antes de lo esperado y haya que buscarlo de urgencia. Eso implicaría tiempo para localizarlo y quizá pagar más o cambiar la fecha de una actividad; habría que preguntarle a la persona real si le ha sucedido.

4. **¿Qué dificultades encuentra actualmente al comparar precios y productos entre diferentes proveedores?**  
   **Amaranta:** Las presentaciones pueden traer cantidades distintas y algunos precios no aclaran envío o disponibilidad. Compararía marca, contenido y precio por unidad, además de la fecha de consulta.

5. **¿Le resultaría útil un proveedor que, además de venderle productos, analizara su consumo y le ayudara a anticipar cuándo necesita realizar un nuevo pedido? ¿Por qué?**  
   **Amaranta:** Sí podría ser útil para planear pedidos y reducir urgencias, siempre que permita revisar las recomendaciones y considere cambios en la demanda, tiempos de entrega y productos apropiados para el consultorio.

**Hipótesis para validar:** comparar presentaciones y costos completos puede consumir tiempo; la disponibilidad y la confianza pueden importar tanto como el precio; y prever pedidos podría aportar valor.

## Preguntas analíticas

- **E1 — Pronóstico:** ¿Cómo evolucionan los precios de una canasta de insumos médicos de consumo frecuente y cuál podría ser su comportamiento futuro? Registrar fecha, producto, marca, presentación, precio y proveedor; explorar un índice o precio agregado después de definir una canasta comparable. Se requiere suficiente historial y evaluación antes de emitir pronósticos.
- **E2 — Experimento:** ¿Qué estrategia comercial genera mayor intención de solicitar una cotización entre consultorios de Colima? Propuesta factorial: mensaje de ahorro frente a prevención de desabasto y contacto digital frente a personal. Medir solicitudes de cotización, tasa de respuesta e interés en otra conversación, con protocolo y participantes voluntarios. El experimento no se ha realizado.
- **E3 — Análisis multivariado:** ¿Existen diferencias en las características y concentración del mercado potencial entre las principales zonas urbanas de Colima? Explorar municipio, especialidad, ubicación y número de establecimientos, y distancia estimada a zonas de distribución cuando pueda calcularse. La unidad de análisis y la suficiencia de datos se definirán antes de comparar grupos.

## Plan de recopilación de datos

**Fuente A — INEGI / DENUE, propuesta:** identificar establecimientos de salud mediante la fuente oficial, API o descarga disponible. Variables previstas: nombre del establecimiento, actividad económica, municipio, ubicación y coordenadas. Revisar cobertura, fecha y condiciones antes de la captura. La integración aún no está implementada.

**Fuente B — catálogos públicos de insumos médicos, por definir:** seleccionar proveedores con productos y precios públicos y verificar URL, cobertura, marca, presentación, precio, fecha, condiciones de uso, robots.txt, frecuencia aceptable y posibilidades de entrega. Existe una captura del catálogo nacional de insumos del ISSSTE; no proporciona precios ni disponibilidad en Colima. La fuente comercial mexicana de precios sigue por definir. La captura dental existente es un piloto limitado a odontología; no representa por sí sola el mercado médico general. Véase [plan de captura](captura-bronce.md).

No se recopilarán datos de pacientes ni información sensible. Antes de automatizar o reutilizar datos se revisarán los términos aplicables y robots.txt; se limitarán solicitudes y no se evadirán controles de seguridad o acceso. El acceso público o una ruta permitida en robots.txt no constituyen por sí solos una licencia de reutilización.

## Calidad y ejecución

Se proponen metas de al menos 95 % de ejecuciones programadas exitosas, al menos 95 % de registros con campos obligatorios completos y menos de 2 % de duplicados después de validar. Los denominadores y campos aplicables se detallan en [objetivos de calidad](../../calidad/objetivos.md); todavía no se han medido. Cada integrante registrará sus tiempos y defectos reales en los archivos PSP existentes.
