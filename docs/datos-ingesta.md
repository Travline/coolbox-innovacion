# Datos, scraper e ingesta

## Estado actual

`apps/scrapper/main.js` consulta siete categorías objetivo mediante la API de productos de Coolbox, en lotes de 50 y con una pausa de 400 ms entre lotes completos. Extrae identificadores, nombre, marca, categoría objetivo, precio, precio de lista, stock, indicador digital, enlace, imagen y descripción. Ante un error deja de procesar esa categoría y continúa; el JSON resultante puede ser parcial. `product_res.json` muestra además especificaciones, categorías, imágenes y otros campos disponibles que aún no se conservan. No existe loader ni migración.

## Modelo previsto

- **Producto:** identidad estable de origen, SKU, nombre, marca, categorías, descripción, especificaciones relevantes, imágenes, enlaces, precio, stock, fecha de actualización y vector. Los atributos reales disponibles deben prevalecer sobre texto generado.
- **Documento de servicio:** texto plano, título, fuente oficial, fecha de consulta o actualización y vector; permitir fragmentos si los documentos son extensos. Las fuentes y el proceso de fragmentación definitivos quedan pendientes.
- Normalizar categorías u otros datos repetidos cuando aporte claridad, sin convertirlo en un objetivo independiente. Crear migraciones ordenadas y versionadas en `database/` e incluir un índice vectorial de productos compatible con la versión de Turso elegida.
- Elegir modelo, dimensión, métrica y formato de vectores conjuntamente. Tanto documentos indexados como consultas deben usar el mismo modelo, versión, preprocesamiento y dimensión; si se cambian, regenerar vectores y reconstruir el índice. Mantener estos metadatos para detectar incompatibilidades.

## Pipeline de productos previsto

1. Ejecutar el scraper manualmente para las categorías objetivo; conservar datos suficientes para detalle y recomendaciones, incluidas especificaciones del ejemplo cuando estén disponibles.
2. Detectar errores y resultados parciales antes de reemplazar una carga válida; documentar el estado de la extracción y deduplicar por identidad estable, incluso si un producto aparece en varias categorías.
3. El loader lee el JSON, prepara texto representativo en español —nombre, marca, categoría, descripción y especificaciones útiles— y genera vectores con un modelo multilingüe local. No insertar claves ni información inventada en ese texto.
4. Validar registros y vectores y hacer una carga repetible que actualice productos existentes. Registrar errores y recuentos, sin presentar una carga parcial como completa. Definir política para productos ausentes antes de implementar borrados.
5. Actualizar la fecha del catálogo solo tras una carga válida. Conservar precios, stock e imágenes como datos importados, no como disponibilidad en tiempo real.

## Documentos de servicio

La implementación de carga es posterior. El responsable indicó que todavía no dispone de documentos; utilizar las fuentes públicas oficiales identificadas en [asistente.md](asistente.md). Preparar texto plano fiel a la fuente, con título, URL y fecha de consulta; generar vectores con el modelo seleccionado y persistirlos en Turso. El procedimiento concreto de inserción y actualización se documentará cuando se implemente el loader; no existe todavía un comando funcional. Explicar cómo añadir fuentes, verificar vigencia y volver a indexarlas sin perder trazabilidad. Nunca inventar condiciones o datos de contacto.

## Recuperación

El agente combinará consultas estructuradas (por ejemplo, nombre, marca, categoría, precio y stock) y similitud semántica según la consulta. El índice de productos acelerará candidatos semánticos; validar filtros, calidad y cantidad de resultados en la implementación. La estrategia exacta de fragmentación e indexación de documentos queda pendiente. La documentación oficial de [búsqueda vectorial de Turso](https://docs.turso.tech/features/ai-and-embeddings) debe revisarse al elegir versión y sintaxis.
