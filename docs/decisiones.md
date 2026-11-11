# Decisiones abiertas

Las siguientes elecciones se resolverán al planificar la implementación; no representan dependencias instaladas ni contratos ya existentes.

| Decisión | Evaluación pendiente |
| --- | --- |
| Despliegue de embeddings | Se eligió `intfloat/multilingual-e5-small` (384 dimensiones). El loader usa Transformers.js con Xenova/multilingual-e5-small, revisión 761b726dd34fb83930e26aab4e9ac3899aa1fa78, fp32. Definir dónde generar el vector de consulta de la API sin depender del equipo del loader. Evaluar la recuperación en español con el catálogo real. |
| Modelo de Google AI Studio | Comparar opciones vigentes por calidad en español, herramientas, streaming, latencia, límites y costo; elegir con el responsable. |
| MCP-UI o React | Comparar compatibilidad con AI SDK, complejidad, accesibilidad y necesidad real frente a componentes React con resultados estructurados; consultar antes de incorporar una dependencia. |
| Cliente Turso | Comparar `@libsql/client/web` para libSQL remoto con `@tursodatabase/serverless` basado en `fetch` para Turso Database; verificar motor, compatibilidad de índice vectorial y credenciales antes de elegir. Ver [referencia oficial](https://docs.turso.tech/sdk/ts/reference). |
| Modelo y búsqueda | Definir esquema, dimensión y métrica compatibles con el modelo, índice, fragmentación de documentos, filtros semánticos y manejo de productos ausentes. |
| Herramientas de desarrollo | Proponer y consultar bibliotecas adicionales relevantes, por ejemplo logging o componentes; mantener pnpm y evitar workspaces y Turborepo. |
| Runtime y compilación | Fijar versiones Node/pnpm, estructura de aplicaciones, aliases, módulos y resolución del JavaScript emitido en Vercel y Docker. |
| Referencia visual | Solicitar capturas de escritorio y móvil al preparar la réplica. |
| Fuentes de servicio | Las páginas oficiales iniciales están en [asistente.md](asistente.md); verificar vigencia y definir cómo cargar y actualizar sus textos y vectores. |

También queda pendiente el contrato exacto de streaming y tarjetas, las rutas HTTP y la configuración concreta de despliegue. No asumir que las opciones futuras están disponibles en el repositorio actual.
