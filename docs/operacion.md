# Operación y despliegue

## Configuración prevista

No hay aplicaciones web ni archivos de despliegue implementados todavía. Al construirlas, documentar y validar su configuración sin incluir secretos en el repositorio:

| Valor | Consumidor | Tratamiento |
| --- | --- | --- |
| URL de Turso y token de solo lectura | Navegador | Públicos; todos los datos accesibles se consideran públicos. |
| URL y credencial de lectura de Turso | API | Variables del servidor, con acceso mínimo necesario. |
| URL y credencial de escritura de Turso | Loader y migraciones | Solo entorno de ejecución autorizado; nunca en el bundle web. |
| Clave de Google AI Studio | API | Secreta, solo en el servidor. |
| URL de la API | Tienda | Configuración pública para cada entorno. |
| Modelo y configuración de embeddings | Loader y generación de consultas | Deben coincidir con los vectores y el índice activos. |

Los nombres concretos de variables y ejemplos `.env` se definirán con las aplicaciones. No imprimir credenciales ni registrar por defecto el contenido de conversaciones. Aplicar las migraciones de forma controlada antes de usar un esquema nuevo y preservar una vía de recuperación de los datos.

## Vercel y alternativa Docker

Desplegar la tienda en Vercel y prever también Express en Vercel. Configurar cada proyecto con su directorio raíz, instalación pnpm y build propios. Las rutas de React Router necesitan una regla de fallback a la entrada de la SPA, sin interceptar recursos estáticos; agregar `vercel.json` si hace falta al crear la aplicación. Configurar CORS y la URL pública de API según los orígenes reales.

Express se ejecuta como una función de Vercel; admite streaming, pero la duración máxima de la función incluye el tiempo de espera de la respuesta. Revisar límites actuales por plan y `maxDuration`, y verificar streaming de extremo a extremo. Usar una entrada compatible con Vercel y una forma de iniciar el servidor local sin escuchar un puerto al importar la aplicación en ese entorno. Ver [Express en Vercel](https://vercel.com/docs/frameworks/backend/express) y [duración de funciones](https://vercel.com/docs/functions/configuring-functions/duration).

Si la duración o el entorno de funciones no resulta adecuado, prever un Dockerfile y Docker Compose para ejecutar la API como servicio independiente, manteniendo el frontend en Vercel. Exponer el puerto configurado, inyectar secretos en ejecución, permitir cierre ordenado y mantener la imagen final sin dependencias innecesarias. No se incluyen aún esos archivos. El loader de embeddings local se ejecutará por separado; no asumir que un modelo grande cabe en una función ni en la imagen de la API.

## Verificación futura

Al implementar, comprobar navegación directa a una ruta interna desplegada, conexión de solo lectura, streaming completo y desconexiones, tiempo de respuesta, variables faltantes y ejecución del JavaScript compilado con aliases resueltos. Revisar métricas de fallos y duración sin registrar datos sensibles. Las pruebas automatizadas no son obligatorias; consultar antes de ejecutar suites existentes y documentar las comprobaciones realizadas.
