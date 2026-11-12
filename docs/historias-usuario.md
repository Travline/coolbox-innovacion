# Historias de usuario

Estas historias describen el prototipo para una demostración académica. Se planificará cada una antes de implementarla; los criterios indican el resultado esperado, no una solución técnica completa. La numeración es estable y las historias se agrupan por objetivo. Una dependencia indica que debe completarse antes de la historia que la menciona.

**Prioridad:** alta para el primer recorrido de recomendaciones y sus elementos imprescindibles; media para completar la experiencia de tienda y carrito; baja para la segunda etapa de información de servicio. La prioridad expresa el orden acordado, no resta importancia a la calidad de la información.

**Punto de partida:** el responsable informó que los productos de Coolbox y sus embeddings ya están cargados. El scraper y el loader existen; la tienda, la API y el asistente aún están pendientes. Los documentos de servicio todavía no están cargados.

**Orden sugerido:** HU-01 → HAB-01 → HU-02 → HU-03 → HU-04 → HU-05 → HU-06 → HU-07 → HU-08 → HU-09 → HU-10 → HU-11 → HU-12 → HAB-02 → HAB-03 → HU-13 → HU-14 → HU-15. Las historias sin dependencia entre sí pueden reorganizarse al planificarlas.

## Primer recorrido: recomendaciones

### HU-01 — Acceder al asistente

Como visitante, quiero abrir el asistente y escribir una consulta en español para expresar lo que necesito comprar.

- **Prioridad:** alta. **Dependencias:** ninguna.
- La interfaz permite escribir y enviar una consulta, y presenta el intercambio de forma legible en escritorio y móvil.
- La conversación se mantiene durante la visita y no se guarda como historial persistente ni se asigna un identificador de visitante.
- El visitante puede distinguir cuándo se está procesando su consulta y cuándo no se ha podido completar.

### HU-02 — Recomendar productos del catálogo

Como visitante, quiero recibir recomendaciones relacionadas con mi necesidad para encontrar productos adecuados.

- **Prioridad:** alta. **Dependencias:** HU-01, HAB-01.
- Ante necesidades representativas en español, el asistente recupera productos del catálogo y recomienda productos existentes y pertinentes.
- Cada recomendación explica brevemente su relación con la necesidad usando atributos recuperados, sin inventar características, precio o stock.
- Si la información disponible no permite recomendar con fundamento, el asistente lo indica en lugar de presentar una recomendación inventada.
- El primer recorrido puede demostrarse mediante una interfaz mínima, sin esperar a completar la tienda o el carrito.

### HU-03 — Aclarar la necesidad

Como visitante, quiero que el asistente me pida los datos necesarios cuando mi consulta sea ambigua para obtener recomendaciones más útiles.

- **Prioridad:** alta. **Dependencias:** HU-02.
- Ante una necesidad demasiado amplia, el asistente puede preguntar por una preferencia relevante, como presupuesto o uso.
- La respuesta del visitante se incorpora al contexto de la conversación y permite continuar la búsqueda.
- El asistente no afirma que una preferencia no proporcionada sea un requisito del visitante.

### HU-04 — Entender el resultado de la búsqueda

Como visitante, quiero saber si no hay resultados o si ocurrió un fallo para decidir cómo continuar.

- **Prioridad:** alta. **Dependencias:** HU-02.
- Una búsqueda completada sin resultados se comunica como tal y ofrece una forma de reformular la necesidad.
- Un fallo de búsqueda o de conexión se comunica como error, sin presentarlo como ausencia de productos; se ofrece reintentar.
- Si se interrumpe una respuesta en curso, la interfaz indica que quedó incompleta y permite volver a intentarlo.

### HU-05 — Ver la respuesta progresivamente

Como visitante, quiero ver la respuesta mientras se genera para seguir la conversación sin esperar al texto completo.

- **Prioridad:** alta. **Dependencias:** HU-02, HU-04.
- El texto aparece progresivamente y se distingue una respuesta en curso de una finalizada.
- Al finalizar o interrumpirse la transmisión, la interfaz refleja el estado correspondiente sin perder la posibilidad de continuar.

### HU-06 — Explorar recomendaciones

Como visitante, quiero ver tarjetas de productos recomendados para comparar opciones y reconocer sus datos principales.

- **Prioridad:** alta. **Dependencias:** HU-02.
- Las tarjetas muestran imagen, nombre, precio y motivo breve basado en datos recuperados; los datos ausentes se indican como no disponibles.
- Los controles accesibles permiten recorrer un producto a la vez en escritorio y móvil.
- Las tarjetas se vinculan con productos identificados mediante datos estructurados y validados, no mediante identificadores extraídos de texto libre.

## Tienda y carrito

### HU-07 — Navegar por la tienda

Como visitante, quiero acceder al catálogo y al asistente desde un inicio reconocible para explorar la tienda.

- **Prioridad:** media. **Dependencias:** HU-01.
- El inicio ofrece acceso visible al catálogo y al asistente en escritorio y móvil.
- La presentación y los recorridos se basan en referencias de Coolbox acordadas durante la planificación visual.

### HU-08 — Consultar el catálogo

Como visitante, quiero explorar productos y categorías para conocer las opciones disponibles.

- **Prioridad:** media. **Dependencias:** HU-07.
- El catálogo muestra productos reales con sus datos principales disponibles y permite navegar por categorías.
- La interfaz distingue carga, error y ausencia de productos, y ofrece reintento ante un fallo.
- Se muestra la fecha de la última carga completa disponible y se indica que precio y stock pueden haber cambiado; si no existe fecha, se informa su ausencia.

### HU-09 — Buscar y filtrar productos

Como visitante, quiero buscar por texto y filtrar productos para reducir el catálogo a opciones relevantes.

- **Prioridad:** media. **Dependencias:** HU-08.
- Puedo buscar por texto y acotar los resultados por categoría y, cuando los datos lo permitan, por marca y precio.
- Los resultados reflejan los criterios aplicados y puedo modificarlos o quitarlos.
- Si no hay resultados o la consulta falla, se comunica el estado correspondiente y se ofrece una forma de continuar.

### HU-10 — Consultar el detalle de un producto

Como visitante, quiero abrir el detalle de un producto para evaluar sus características antes de elegirlo.

- **Prioridad:** media. **Dependencias:** HU-08.
- El detalle muestra imagen, nombre, precio, disponibilidad, descripción y especificaciones reales disponibles; los datos faltantes se indican como no disponibles.
- Puedo abrir el detalle interno desde el catálogo y desde una tarjeta del asistente cuando esta esté disponible.
- Un producto inexistente o un fallo de consulta muestra un estado comprensible y permite volver a navegar o reintentar según corresponda.

### HU-11 — Agregar productos al carrito

Como visitante, quiero agregar un producto disponible desde la tienda o una recomendación para reunir mis opciones.

- **Prioridad:** media. **Dependencias:** HU-06, HU-10.
- Puedo agregar productos desde su detalle y desde las tarjetas del asistente, con confirmación visible del resultado.
- Los productos sin stock o sin precio no se pueden agregar; ambos puntos de entrada aplican los mismos límites de disponibilidad y cantidad.
- El asistente no modifica el carrito directamente: la incorporación ocurre mediante una acción del visitante.

### HU-12 — Administrar y conservar el carrito

Como visitante, quiero revisar mi carrito, cambiar cantidades y quitar productos para mantener mi selección durante futuras visitas al navegador.

- **Prioridad:** media. **Dependencias:** HU-11.
- El carrito muestra los productos agregados y permite cambiar cantidades y quitar artículos, respetando los límites aplicables.
- La selección se guarda en el navegador y se recupera al recargar; si el almacenamiento local falla, se informa al visitante.
- Se comunica cuando un producto guardado ya no está disponible o sus datos han cambiado al consultarlos de nuevo.
- No se ofrece checkout, pago ni creación de pedidos.

## Información de servicio: segunda etapa

### HU-13 — Preparar fuentes oficiales

Como responsable del catálogo, quiero incorporar y actualizar información oficial de servicio para que el asistente pueda responder con fuentes verificables.

- **Prioridad:** baja. **Dependencias:** HAB-02.
- Se dispone de un procedimiento documentado para verificar vigencia, preparar e incorporar textos oficiales con título, URL y fecha de consulta.
- El contenido y sus embeddings se pueden actualizar conservando la trazabilidad de la fuente y la compatibilidad con el modelo de consultas.
- El procedimiento contempla documentos ausentes o contradictorios y las diferencias entre políticas de Coolbox y vendedores Marketplace.

### HU-14 — Consultar información de servicio

Como visitante, quiero preguntar sobre garantías, cambios y otras políticas para entender la información oficial aplicable.

- **Prioridad:** baja. **Dependencias:** HU-05, HU-13.
- El asistente recupera información de fuentes incorporadas y responde en español con respaldo identificable en esas fuentes.
- Si faltan datos, las fuentes están desactualizadas o son contradictorias, explica la limitación sin convertirla en una afirmación categórica.
- Cuando corresponda, diferencia las condiciones del vendedor Marketplace de las de productos propios.

### HU-15 — Recibir orientación cuando falta evidencia

Como visitante, quiero conocer los canales oficiales de atención cuando el asistente no pueda responder con evidencia suficiente para continuar mi consulta.

- **Prioridad:** baja. **Dependencias:** HU-14.
- Ante información insuficiente, el asistente reconoce que no puede responder y ofrece canales oficiales cuya vigencia haya sido verificada.
- Si no puede verificarlos, lo indica y no inventa datos de contacto.
- Un fallo de consulta se distingue de la falta de información disponible.

## Capacidades y operación que habilitan las historias

Estas tareas técnicas tienen resultados verificables y dependencias explícitas. No sustituyen la planificación de cada historia ni implican que ya exista una interfaz pública o un contrato de API.

### HAB-01 — Recuperación de productos para el asistente

Como equipo del prototipo, queremos consultar el catálogo cargado por atributos y similitud para respaldar recomendaciones en productos reales.

- **Prioridad:** alta. **Dependencias:** ninguna.
- El asistente dispone de operaciones de lectura delimitadas y con parámetros validados para buscar productos y recuperar su información; no puede ejecutar SQL arbitrario ni escribir en Turso.
- La recuperación combina información estructurada y semántica según la consulta y se evalúa con necesidades representativas en español.
- Los embeddings de consulta usan el mismo modelo, revisión, precisión, pooling, normalización y preprocesamiento compatibles con los vectores cargados, con el prefijo de consulta correspondiente.
- La clave del modelo y las credenciales de escritura no se exponen al navegador; los errores no revelan secretos.

### HAB-02 — Preparar el acceso y la actualización de datos

Como responsable del prototipo, quiero mantener accesibles y actualizados los datos necesarios para que la demostración use información identificable y recuperable.

- **Prioridad:** media. **Dependencias:** ninguna.
- Se documenta cómo configurar el acceso de lectura de las aplicaciones y actualizar el catálogo con el scraper y el loader existentes.
- Se conserva la fecha de la última carga completa y se explica que un fallo puede dejar cambios parciales visibles; una extracción incompleta no se presenta como catálogo completo.
- Antes de publicar, se verifica el alcance efectivo de la credencial pública de lectura y se consideran públicos todos los datos a los que permita acceder.
- La configuración evita exponer credenciales de escritura o la clave de Google; se documentan los pasos de recuperación ante un fallo de carga.

### HAB-03 — Ejecutar y desplegar el prototipo

Como responsable de la demostración, quiero ejecutar y desplegar la tienda y el asistente para presentar el recorrido completo.

- **Prioridad:** media. **Dependencias:** HU-05, HU-12, HAB-02.
- La documentación explica configuración, ejecución y despliegue de las aplicaciones y sus variables sin incluir secretos.
- En el entorno elegido funcionan la navegación directa a páginas internas, el acceso al catálogo y la respuesta progresiva del asistente.
- Se comprueban errores de configuración y conexión sin exponer secretos o conversaciones en los registros por defecto.

## Límites y decisiones posteriores

- No se contemplan cuentas, sesiones, identificadores de visitante, cookies de identificación, pagos ni pedidos. El carrito vive en el navegador y el chat permanece en memoria durante la visita.
- El catálogo refleja la última carga y no consulta precio ni stock en tiempo real. Los productos ausentes de una carga se conservan según el comportamiento actual del loader.
- El modelo de Google, el despliegue de embeddings de consulta, el cliente Turso, los componentes de tarjetas y los contratos concretos se decidirán al planificar las historias afectadas. Las bibliotecas adicionales relevantes se consultarán antes de seleccionarlas.
- La fidelidad visual se concretará con capturas de escritorio y móvil durante la planificación correspondiente. Las fuentes de servicio se verificarán antes de incorporarlas.
