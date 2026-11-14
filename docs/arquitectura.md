# Arquitectura prevista

## Componentes y límites

| Componente | Responsabilidad | Estado |
| --- | --- | --- |
| `apps/scrapper/` | Obtener y normalizar productos de las categorías objetivo en JSON. | Implementado. |
| Tienda React | Catálogo, detalle, búsqueda, carrito local e interfaz del chat. | Inicio, catálogo, filtros, detalle, carrito local y chat implementados. |
| API Express + TypeScript | Orquestar el asistente, sus herramientas y acceso de servidor a Turso. | Recuperación y chat implementados; recuperación, streaming y respuestas de servicio implementados; relevancia calibrada en muestra limitada. |
| `apps/loader/` | Leer el JSON, generar embeddings locales y cargar productos en Turso/libSQL. | Implementado; requiere aplicar migraciones y configurar credenciales. |
| `database/` | Conservar migraciones versionadas de Turso/libSQL. | SQL 001 y 002 para catálogo; 003 de servicio aplicada en Turso. |
| Turso/libSQL | Productos, documentos de servicio y vectores. | Productos y embeddings de catálogo, cinco fuentes de servicio y 18 fragmentos cargados y comprobados. |

Cada aplicación tiene su propio manifiesto, lockfile y pipeline de pnpm; no usar pnpm workspaces ni Turborepo. React Router, Tailwind, Zustand, Zod y AI SDK forman parte del stack acordado; proponer y consultar nuevas dependencias relevantes antes de seleccionarlas.

## Flujos

1. Scraper → JSON → loader con modelo local → productos y vectores en Turso.
2. Navegador → cliente Turso basado en `fetch` → catálogo público; el carrito queda en `localStorage`.
3. Navegador → API Express → modelo de Google mediante AI SDK → herramientas de lectura en Turso → respuesta en streaming y recomendaciones estructuradas.
4. Textos oficiales revisados → ingesta de documentos y vectores → búsqueda de información de servicio.

La clave de Google y las credenciales de escritura permanecen en servidor o en el entorno del loader. La credencial de catálogo del navegador es visible: todos los datos accesibles con ella deben considerarse públicos, incluidos documentos y vectores si comparte acceso a sus tablas. Una credencial de solo lectura no garantiza aislamiento por tabla; verificar el alcance real de Turso antes de cargar información no pública. No guardar datos privados en esa base accesible públicamente.

## API y organización

Usar módulos por dominio con separación clara entre entrada HTTP, lógica de aplicación y acceso a datos, evitando capas vacías. Validar entradas y argumentos de herramientas con Zod. Centralizar la política de errores y logging; el middleware HTTP traduce errores sin ser el único lugar que los gestiona. Utilizar una clase común que extienda `Error`, con código y carácter operativo, diferenciando errores previstos de fallos inesperados. Evitar exponer trazas y secretos al cliente; registrar contexto útil sin volcar conversaciones o credenciales por defecto. Basarse en [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices), adaptado al prototipo.

Usar aliases de rutas en TypeScript solo con una estrategia que también los resuelva en el JavaScript generado y en ambos entornos de despliegue. Definir módulo, extensiones de importación `.js`, compilador o empaquetador al implementar; verificar ejecución real del artefacto compilado, no solo resolución de tipos.
