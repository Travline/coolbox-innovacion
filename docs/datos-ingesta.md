# Datos, scraper e ingesta

## Estado actual

`apps/scrapper/main.js` consulta siete categorías objetivo en lotes de hasta 50 y espera 400 ms entre páginas. Valida la cabecera `resources` y el total de cada categoría y reintenta hasta dos veces los errores temporales; si una respuesta o rango es inconsistente, termina con error y conserva el catálogo anterior. Solo tras completar todas las categorías reemplaza el JSON mediante un archivo temporal. La integridad depende de la información y estabilidad de paginación proporcionadas por el servicio de origen.

`coolbox_productos.json` es un arreglo de productos deduplicados por `productId`. Cada registro contiene `name`, `brand`, `reference`, `slug`, `sourceUrl`, `descriptionHtml`, `descriptionText`, `specifications`, `categories`, `skus` y `extractedAt` (UTC). Los valores desconocidos son `null`. `specifications` conserva los nombres listados en `allSpecifications` y sus arreglos de valores. Cada categoría contiene `id`, `name` y `path` (opcional); el scraper agrega también las categorías objetivo. Al encontrar un producto más de una vez, combina categorías y SKU por ID y conserva la primera versión de otros campos.

Cada SKU contiene `skuId`, `name`, `reference`, `ean`, `images` ordenadas (`url`, `alt`), `seller` (`id`, `name`) o `null`, `price`, `listPrice` y `stock`. Se elige el vendedor predeterminado, o el primero si no hay uno marcado; sin dato disponible precio o stock son `null`. No se suman existencias entre vendedores. El HTML original no está sanitizado: se debe sanitizar antes de mostrarlo. `descriptionText` se obtiene con `html-to-text` y es apropiado para preparar texto de búsqueda.

`database/001_initial.sql` define productos, categorías, su relación, SKU, documentos de servicio y fecha de última carga completa. Incluye columna vectorial de producto y documento de 384 dimensiones e índice vectorial de productos. El responsable informó que los productos y sus embeddings ya están cargados en Turso; esa instancia no se ha inspeccionado en esta revisión. Habilitar claves foráneas en cada conexión. El loader está implementado en `apps/loader/`; ver [su documentación](loader.md). La migración `002_embedding_hash.sql` añade la huella que permite reutilizar vectores.

## Modelo previsto

- **Producto:** identidad estable de origen, SKU, nombre, marca, categorías, descripción, especificaciones relevantes, imágenes, enlaces, precio, stock, fecha de actualización y vector. Los atributos reales disponibles deben prevalecer sobre texto generado.
- **Documento de servicio:** texto plano, título, fuente oficial, fecha de consulta o actualización y vector; permitir fragmentos si los documentos son extensos. Las fuentes y el proceso de fragmentación definitivos quedan pendientes.
- Normalizar categorías u otros datos repetidos cuando aporte claridad, sin convertirlo en un objetivo independiente. Crear migraciones ordenadas y versionadas en `database/` e incluir un índice vectorial de productos compatible con la versión de Turso elegida.
- El modelo elegido es `intfloat/multilingual-e5-small`, con 384 dimensiones y distancia coseno. Tanto documentos indexados como consultas deben usar el mismo modelo, versión, preprocesamiento y dimensión; si se cambian, regenerar vectores y reconstruir el índice. Mantener estos metadatos para detectar incompatibilidades.

## Pipeline de productos

1. Ejecutar el scraper manualmente para las categorías objetivo; conservar datos suficientes para detalle y recomendaciones, incluidas especificaciones del ejemplo cuando estén disponibles.
2. Detectar errores y resultados parciales antes de reemplazar una carga válida; documentar el estado de la extracción y deduplicar por identidad estable, incluso si un producto aparece en varias categorías.
3. El loader lee el JSON, prepara texto representativo en español —nombre, marca, categoría, descripción y especificaciones útiles— y generará vectores localmente con `intfloat/multilingual-e5-small`. Usar `passage: ` para texto indexado y `query: ` para consultas; el modelo trunca a 512 tokens, por lo que el loader debe priorizar y limitar el texto. La inferencia del loader está implementada; la generación del vector de consulta queda pendiente. No insertar claves ni información inventada en ese texto.
4. Validar registros y vectores y hacer una carga repetible que actualice productos existentes. Registrar errores y recuentos, sin presentar una carga parcial como completa. Los productos ausentes del archivo se conservan; los SKU y relaciones ausentes de un producto presente se eliminan.
5. Actualizar la fecha del catálogo solo tras una carga válida. Conservar precios, stock e imágenes como datos importados, no como disponibilidad en tiempo real.

## Documentos de servicio

La implementación de carga es posterior. El responsable indicó que todavía no dispone de documentos; utilizar las fuentes públicas oficiales identificadas en [asistente.md](asistente.md). Preparar texto plano fiel a la fuente, con título, URL y fecha de consulta; generar vectores con el modelo seleccionado y persistirlos en Turso. El procedimiento concreto de inserción y actualización de documentos se documentará cuando se implemente esa funcionalidad; no existe todavía un comando para cargar documentos. Explicar cómo añadir fuentes, verificar vigencia y volver a indexarlas sin perder trazabilidad. Nunca inventar condiciones o datos de contacto.

## Recuperación

El agente combinará consultas estructuradas (por ejemplo, nombre, marca, categoría, precio y stock) y similitud semántica según la consulta. El índice de productos acelerará candidatos semánticos; validar filtros, calidad y cantidad de resultados en la implementación. La estrategia exacta de fragmentación e indexación de documentos queda pendiente. La documentación oficial de [búsqueda vectorial de Turso](https://docs.turso.tech/features/ai-and-embeddings) debe revisarse al elegir versión y sintaxis.
