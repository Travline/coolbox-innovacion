# Operación y despliegue

## Configuración

La tienda y la API incluyen ejemplos de configuración y preparación de despliegue; los valores reales deben mantenerse fuera del repositorio:

| Valor | Consumidor | Tratamiento |
| --- | --- | --- |
| URL de Turso y token de solo lectura | Navegador | Públicos; todos los datos accesibles se consideran públicos. |
| URL y credencial de lectura de Turso | API | Variables del servidor, con acceso mínimo necesario. |
| URL y credencial de escritura de Turso | Loader y migraciones | Solo entorno de ejecución autorizado; nunca en el bundle web. |
| Clave de Google AI Studio | API | Secreta, solo en el servidor. |
| URL de la API | Tienda | Configuración pública para cada entorno. |
| Modelo y configuración de embeddings | Loader y generación de consultas | Deben coincidir con los vectores y el índice activos. |

Los nombres de variables figuran en los archivos `.env.example` de cada aplicación. No imprimir credenciales ni registrar por defecto el contenido de conversaciones. Aplicar las migraciones de forma controlada antes de usar un esquema nuevo y preservar una vía de recuperación de los datos.

## Acceso al catálogo y actualización manual

Separar la credencial de escritura del loader de las credenciales de lectura de la tienda y la API. Configurar las variables de cada aplicación en su entorno local o en el gestor de secretos del entorno correspondiente; copiar el `.env.example` de cada aplicación a su `.env` local y sustituir allí los valores de ejemplo. El loader usa `apps/loader/.env`, descrito en [Loader](loader.md#configuración-y-ejecución). No introducir tokens en el repositorio ni en mensajes. Una variable incorporada al bundle del navegador es pública, aunque su nombre sugiera lo contrario.

Antes de publicar una credencial de lectura en el navegador, comprobar que puede leer lo necesario y que una escritura realmente se rechaza. El responsable autorizó una comprobación controlada mediante una fila temporal sin relaciones en la instancia actual, con eliminación posterior; para futuros ensayos se recomienda una base de prueba separada. Enumerar también las tablas y datos que permite leer: todo lo accesible con esa credencial debe considerarse público, incluidos documentos y metadatos. No asumir que «solo lectura» significa acceso solo al catálogo. No realizar otras pruebas de escritura en la instancia cargada. Si el proveedor no permite limitar suficientemente el alcance, no publicar esa credencial hasta resolverlo.

Para la actualización, seguir el procedimiento y las consultas de [Loader](loader.md#actualizaciones-y-recuperación): ejecutar el scraper desde `apps/scrapper/`, confirmar su terminación correcta y solo entonces cargar el JSON con el loader. El JSON anterior se conserva si falla la extracción: su mera existencia no demuestra que la extracción recién intentada haya terminado. Mantener la demora entre páginas y no alimentar el loader con una extracción incompleta. Tras la carga, revisar la salida, recuentos y fecha de última importación completa.

La carga no es una publicación atómica: cada producto se confirma por separado. Un fallo puede dejar cambios parciales visibles aun cuando la fecha siga indicando la última carga completa; esa fecha por sí sola no descarta cambios parciales. Corregir el problema y volver a cargar el archivo completo válido, verificar el resultado y contrastar los recuentos. Los productos ausentes del archivo permanecen en la base. El procedimiento detallado y sus límites están en [datos e ingesta](datos-ingesta.md#pipeline-de-productos).

### Comprobaciones de acceso realizadas

Con la configuración autorizada por el responsable ([DR-07](dependencias-responsable.md#dr-07--base-y-credenciales-de-prueba)) se comprobaron lectura, rechazo de escritura y eliminación de la fila temporal. La lectura de la instancia existente permitió contar 7.887 productos. El fallo parcial y la recuperación se reprodujeron con datos sintéticos en libSQL en memoria; la credencial de la tienda rechazó la escritura y puede leer products, categories, product_categories, skus, catalog_metadata y service_documents. La fila temporal se eliminó y se confirmó su ausencia. También se comprobó la lectura de las nuevas tablas `service_sources` y `service_chunks`; sus contenidos son públicos. La integración desplegada de ambas aplicaciones sigue pendiente.

## Vercel y alternativa Docker

Desplegar la tienda en Vercel y prever también Express en Vercel. Configurar cada proyecto con su directorio raíz, instalación pnpm y build propios. Las rutas de React Router necesitan una regla de fallback a la entrada de la SPA, sin interceptar recursos estáticos; la tienda incluye `vercel.json` para la ruta de detalle. Configurar CORS y la URL pública de API según los orígenes reales.

Express se ejecuta como una función de Vercel; admite streaming, pero la duración máxima de la función incluye el tiempo de espera de la respuesta. Revisar límites actuales por plan y `maxDuration`, y verificar streaming de extremo a extremo. Usar una entrada compatible con Vercel y una forma de iniciar el servidor local sin escuchar un puerto al importar la aplicación en ese entorno. Ver [Express en Vercel](https://vercel.com/docs/frameworks/backend/express) y [duración de funciones](https://vercel.com/docs/functions/configuring-functions/duration).

Si la duración o el entorno de funciones no resulta adecuado, usar el Dockerfile y Docker Compose preparados para ejecutar la API como servicio independiente, manteniendo el frontend en Vercel. Exponer el puerto configurado, inyectar secretos en ejecución, permitir cierre ordenado y mantener la imagen final sin dependencias innecesarias. Los archivos están en `apps/api/`. El loader de embeddings local se ejecutará por separado; no asumir que un modelo grande cabe en una función ni en la imagen de la API.

## Verificación tras el despliegue

Comprobar navegación directa a una ruta interna desplegada, conexión de solo lectura, streaming completo y desconexiones, tiempo de respuesta, variables faltantes y ejecución del JavaScript compilado con aliases resueltos. Revisar métricas de fallos y duración sin registrar datos sensibles. Las pruebas automatizadas no son obligatorias; consultar antes de ejecutar suites existentes y documentar las comprobaciones realizadas.

## Ejecución preparada y verificada

La tienda y la API tienen instalación y build propios. La guía de variables, Vercel y Docker está en [DEPLOYMENT.md](../apps/api/DEPLOYMENT.md). Se construyó la imagen Docker local, se comprobó `/health`, cierre y generación de un vector de 384 dimensiones con el modelo dentro del contenedor. El flujo HTTP local de servicio recuperó fragmentos reales sin Google. La navegación, recursos y streaming tras el despliegue Vercel siguen pendientes; el responsable realiza el despliegue manual.
