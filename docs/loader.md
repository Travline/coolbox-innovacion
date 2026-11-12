# Loader de productos

## Función y estado

`apps/loader/` importa el catálogo generado por el scraper en la base Turso/libSQL. Valida la entrada completa, genera embeddings locales, actualiza productos y sincroniza sus categorías y SKU. Según el responsable, el catálogo y sus embeddings ya están cargados. No importa documentos de servicio ni genera embeddings para las consultas del chatbot. Al preparar una base nueva se debe crear la base y aplicar `database/001_initial.sql` y después `database/002_embedding_hash.sql`; el loader no aplica migraciones.

## Configuración y ejecución

Se requiere Node.js 20.19 o posterior y pnpm 10.14.0. Crear `apps/loader/.env` a partir de `.env.example`, con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (token con escritura). Nunca incluir el archivo real en Git ni compartir el token. Desde `apps/loader/`:

```sh
pnpm install --frozen-lockfile
pnpm load
```

El script usa `node --env-file=.env main.js`; Node carga el archivo sin dependencia dotenv y las variables del entorno tienen prioridad. El JSON de entrada es `apps/scrapper/coolbox_productos.json`, resuelto respecto al módulo. La primera ejecución descarga el modelo a `apps/loader/.cache/`; se necesita conexión y espacio local. Las inferencias posteriores se ejecutan en CPU.

## Datos y embeddings

El loader exige un arreglo no vacío con IDs de productos y SKU únicos, categorías consistentes, especificaciones, imágenes, precios y stock válidos y una fecha de extracción común. El contrato completo es el JSON descrito en [datos e ingesta](datos-ingesta.md). La validación se realiza antes de escribir.

Se utiliza `Xenova/multilingual-e5-small` en precisión completa (`fp32`), revisión `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, con pooling medio y normalización L2. Los vectores tienen 384 dimensiones. El texto comienza con `passage:` y contiene nombre, marca, categorías ordenadas, especificaciones ordenadas y descripción, en ese orden; el tokenizador trunca la entrada al límite del modelo, 512 tokens. La huella SHA-256 incluye texto, modelo y versión de preprocesamiento. Un vector existente se reutiliza solo cuando la huella, el modelo y la versión coinciden. El modelo de consultas futuro deberá usar el mismo modelo, revisión, precisión y normalización, con el prefijo `query:`; evaluar el despliegue del modelo y la calidad de recuperación en español por separado.

## Actualizaciones y recuperación

Cada producto se guarda con su conjunto actual de categorías y SKU en un lote transaccional. Las variantes y relaciones ausentes de un producto presente se eliminan; los productos que no figuren en el archivo se conservan. Las categorías compartidas se actualizan. Se presupone un único loader activo.

El loader informa el avance cada 10 productos. Un fallo muestra el número e ID del producto, la etapa y la causa disponible, ocultando la URL y el token configurados; detiene la ejecución con código distinto de cero: las transacciones ya confirmadas quedan visibles y las restantes no se aplican. `catalog_metadata.last_successful_import_at` solo cambia al terminar todo el catálogo, por lo que una carga parcial puede convivir con la fecha de la última carga completa. Corregir la causa y repetir `pnpm load`; los vectores válidos se reutilizan. Las condiciones y costos de futuras cargas dependen de la instancia.

## Comprobación en Turso

Tras aplicar ambas migraciones y configurar `.env`, ejecutar `pnpm load` y revisar el total informado. Consultar en Turso la cantidad de `products`, `skus` y `catalog_metadata`, así como productos con `embedding IS NULL`. Repetir la carga sin cambiar el JSON y comprobar que los embeddings se reutilizan. Hacer la comprobación inicial en una base de pruebas si no se desea alterar un catálogo existente.
