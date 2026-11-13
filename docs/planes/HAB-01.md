# Plan HAB-01: recuperación de productos para el asistente

## Objetivo y alcance

Crear la base de la API y funciones internas de lectura para buscar productos reales por texto, atributos y similitud, y obtener un producto por identificador. HU-02 conectará estas funciones con el modelo conversacional. Esta capacidad no expone rutas públicas de búsqueda ni implementa el chat.

**Dependencias:** ninguna. **Historia que habilita:** HU-02. Los criterios están en [historias de usuario](../historias-usuario.md#hab-01--recuperación-de-productos-para-el-asistente).

## Implementación

- Crear `apps/api/` con Express, TypeScript, pnpm y lockfile propio, sin workspaces. Usar Zod, `@libsql/client` y Transformers.js; configurar compilación y ejecución del JavaScript emitido sin depender de aliases que fallen en runtime.
- Ofrecer funciones internas validadas para búsqueda por texto y atributos, búsqueda semántica y consulta por ID. Devolver datos estructurados de productos, categorías y SKU necesarios para justificar recomendaciones, sin exponer SQL arbitrario ni operaciones de escritura.
- Aplicar los filtros de precio y stock al **mismo SKU** y devolver la variante que satisface los criterios. Preservar los valores desconocidos como tales y distinguir resultados vacíos de errores de acceso o inferencia.
- Generar embeddings en la API con `Xenova/multilingual-e5-small`, revisión `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, precisión `fp32`, pooling medio y normalización L2, usando el prefijo `query:` y vectores de 384 dimensiones. Reutilizar el modelo dentro del proceso. Mantener la compatibilidad con el preprocesamiento y los vectores del loader.
- Combinar recuperación estructurada y semántica según la consulta, aplicar los filtros obligatorios y evitar completar resultados con candidatos sin pertinencia suficiente. Calibrar y documentar el criterio de relevancia mediante la evaluación acordada, sin asumir que una puntuación de similitud garantiza pertinencia.
- Configurar acceso de solo lectura a Turso mediante variables de entorno; validar la configuración, sanear errores y evitar registrar credenciales o conversaciones. La API y la inferencia deben poder ejecutarse localmente y tener una vía de despliegue con Docker; comprobar la viabilidad en Vercel antes de seleccionarlo para producción.
- Actualizar la documentación de arquitectura, configuración, decisiones y operación, incluyendo las instrucciones para reproducir la evaluación y las limitaciones observadas.

## Archivos e interfaces

- **Propiedad del implementador:** aplicación nueva bajo `apps/api/` y su documentación específica.
- **Compartidos:** `README.md`, documentación transversal y `docs/gestor-agentes.md`; el coordinador integra sus cambios y evita ediciones simultáneas.
- **Interfaz para HU-02:** funciones internas con argumentos validados para búsquedas y consulta por identificador, resultados estructurados y errores diferenciados. HU-02 adaptará estas funciones a sus herramientas del modelo; el contrato de conversación y las rutas HTTP se definirán en ese plan.

## Validación y aceptación

- Preparar casos reproducibles sin red para validar entradas, búsqueda estructurada, filtros combinados sobre un mismo SKU, recuperación por ID, ausencia de resultados y propagación diferenciada de errores.
- Verificar dimensión, normalización y configuración del vector de consulta frente a los parámetros del loader. Comprobar que las consultas y herramientas no permitan escrituras ni SQL proporcionado por el usuario.
- Evaluar una muestra de necesidades en español contra el catálogo real con credenciales de solo lectura: incluir consultas por tipo de producto, marca, presupuesto y casos sin coincidencia pertinente. Registrar casos, resultados, criterio de pertinencia y limitaciones sin guardar secretos.
- Compilar al finalizar y ejecutar el artefacto generado. Verificar arranque y carga del modelo en el entorno elegido; comprobar tiempos y recursos de Vercel antes de depender de él. Consultar antes de ejecutar suites existentes conforme a `AGENTS.md` y registrar lo verificado y las limitaciones.

## Decisiones y supuestos

- Los productos y embeddings ya están cargados, según lo informado; la evaluación real requiere acceso de lectura a esa instancia.
- La generación del vector se ejecutará dentro de la API. Docker será la alternativa si las pruebas muestran que Vercel no resulta viable. Según la [documentación de Transformers.js](https://huggingface.co/docs/transformers.js/pipelines), se pueden fijar revisión y precisión del modelo; las [funciones grandes de Vercel](https://vercel.com/changelog/vercel-functions-can-now-be-up-to-5-gb-in-package-size) requieren Fluid Compute y están en beta.
- HU-02 definirá la integración con el modelo de Google y los contratos de conversación; HAB-01 no incorpora documentos de servicio ni modifica el catálogo.
- Este documento es un plan; la API y sus comandos aún no existen. No incorporar bibliotecas adicionales relevantes sin consultar al responsable.
