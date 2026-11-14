# Ejecución y despliegue manual

La tienda y la API son proyectos independientes; no hay workspaces. La imagen Docker se comprobó localmente; Vercel no se ha probado en una cuenta concreta. El responsable realiza todo despliegue manual. El loader se ejecuta por separado y nunca necesita la clave de Google.

## Variables y ejecución local

Copia `apps/store/.env.example` y `apps/api/.env.example` a `.env` en sus respectivos directorios y configura los valores allí o en el gestor de variables del proveedor. No envíes secretos por mensajes ni los agregues a Git.

- Tienda: `VITE_API_URL` es el origen público de la API. `VITE_TURSO_DATABASE_URL` y `VITE_TURSO_AUTH_TOKEN` permiten leer el catálogo desde el navegador y **son públicos** al incluirse en el bundle. Todos los datos accesibles al token, incluidas las tablas de servicio, deben considerarse públicos. Comprueba su alcance efectivo antes de publicar; nunca uses escritura.
- API: `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` son la conexión de **solo lectura** del servidor; `GOOGLE_GENERATIVE_AI_API_KEY` es secreta y `GOOGLE_MODEL` es opcional. `STORE_ORIGIN` es una lista de orígenes exactos separados por comas, sin rutas ni comodines; configúrala con los orígenes de la tienda. `PORT` controla el puerto local. `MODEL_CACHE_DIR` es opcional y debe ser una carpeta escribible. Los datos públicos opcionales `CONTACTS_PRESENTATION_DATE`, `CONTACTS_CHECKED_AT`, `CONTACTS_WHATSAPP` y `CONTACTS_EMAIL` se configuran solo después de revisar los canales para la presentación; sigue las instrucciones de `.env.example` y de la API.
- Si `STORE_ORIGIN` no se define, se autorizan `localhost` y `127.0.0.1` en los puertos 5173 y 4173 para desarrollo; en producción configura solo orígenes reales. Cualquier origen de red local adicional debe añadirse explícitamente. El navegador de un teléfono interpreta `localhost` como el teléfono, no como el ordenador que ejecuta la API.

Con Node.js 20.19 o posterior y pnpm 10.14.0, instala con `pnpm install --frozen-lockfile` en cada directorio y ejecuta `pnpm build`. Desde `apps/api/`, inicia con `node --env-file=.env dist/index.js`; desde `apps/store/`, usa `pnpm dev` o `pnpm preview`. La API responde a `GET /health`. Ante variables de base ausentes, el proceso local termina con mensaje controlado; no registra secretos ni conversaciones. En Vercel se exporta la aplicación sin abrir un puerto. En Node, SIGINT y SIGTERM cierran el servidor y el cliente de base; tras diez segundos se cierran conexiones pendientes.

El modelo de consultas es `Xenova/multilingual-e5-small`, revisión `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, fp32, CPU, pooling medio, normalización L2, 384 dimensiones y prefijo `query:`. No depende de la caché del equipo del loader. La primera consulta descarga el modelo si no existe en la caché; requiere conectividad y espacio. En local la caché predeterminada es `apps/api/.cache`; en Vercel se usa `/tmp/coolbox-model-cache`, temporal y por instancia. `MODEL_CACHE_DIR` permite cambiarla. En Docker se utiliza el volumen `model-cache`. La caché no contiene credenciales ni se agrega a Git.

## Vercel: dos proyectos

1. Crea manualmente dos proyectos enlazados al repositorio, con directorios raíz `apps/api` y `apps/store`. Selecciona una versión Node 22 compatible y pnpm 10.14.0. Cada `vercel.json` declara instalación congelada y build propios; en la tienda la salida es `dist`.
2. En el proyecto API configura las variables privadas anteriores y `STORE_ORIGIN` con los orígenes exactos de la tienda. Su entrada `index.mjs` exporta Express desde `dist/index.js` después del build; los imports emitidos usan rutas relativas `.js`. No uses ni publiques el token de escritura del loader.
3. En el proyecto tienda configura los tres valores `VITE_` para cada entorno. La configuración incluye el fallback de React Router para `/producto/:path*`; los recursos estáticos no pasan por ese fallback. Si se añaden otras rutas internas, actualiza el rewrite.
4. Despliega manualmente API y tienda. Tras un cambio de `VITE_`, vuelve a compilar la tienda: Vite incrusta esas variables en el bundle. Configura orígenes finales/preview en la API según corresponda.
5. Abre directamente una URL de detalle y verifica navegación, lectura del catálogo, CORS y `GET /health`. Con cuota autorizada, prueba el chat y comprueba que los eventos SSE lleguen progresivamente, incluida una desconexión y su reintento. Comprueba errores de configuración y conexión sin mostrar secretos en logs. Las respuestas de servicio deben citar fuentes vigentes y revisadas.

[Express en Vercel](https://vercel.com/docs/frameworks/backend/express) documenta la exportación de la aplicación y el streaming; revisa también los [límites de duración](https://vercel.com/docs/functions/configuring-functions/duration) de tu plan. El tamaño, tiempo de arranque, descarga del modelo, memoria y streaming deben medirse en la cuenta elegida: no se ha demostrado que el modelo quepa ni funcione dentro del presupuesto o duración de Vercel Hobby. Si falla o resulta demasiado lento, usa Docker en un equipo apropiado. No se ha desplegado ni medido en Vercel.

## Alternativa Docker para la API

Desde `apps/api/`, después de configurar `.env` local con las variables de servidor:

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 api
docker compose down
```

La imagen compila TypeScript con pnpm y usa Node 22 con dependencias de producción. Compose carga `.env` en ejecución, sin copiarlo a la imagen; `.dockerignore` excluye además caché local y dependencias locales. La aplicación escucha en el puerto 3001 interno; `COOLBOX_API_HOST_PORT` permite elegir otro puerto del host en la invocación de Compose. `MODEL_CACHE_DIR` apunta al volumen persistente `model-cache`, que se conserva con `docker compose down` para reutilizar el modelo; no ejecutes `down -v` si quieres conservarlo. El proceso ejecuta como usuario sin privilegios y atiende SIGTERM con un margen de diez segundos. Cierra la API con `docker compose down`; el loader sigue siendo un proceso manual separado.

Antes de presentar, confirma `GET /health`, consulta de catálogo, tamaño y carga inicial del modelo, respuesta progresiva, desconexión, CORS y cierre ordenado. No publiques una dirección que Vercel no pueda alcanzar, ni uses una URL de `localhost` en el frontend para visitantes externos. La imagen se construyó localmente; se verificaron arranque, `/health`, cierre y una inferencia de 384 dimensiones con la caché montada. Quedan pendientes la descarga inicial del modelo en un volumen nuevo y la prueba integrada de streaming dentro del contenedor.

## Recuperación

Si falla la configuración, corrige las variables en el entorno correspondiente y vuelve a construir únicamente donde el cambio se incorpore al bundle de Vite. Si el modelo no puede descargar, revisa conectividad y espacio de la carpeta de caché; si el problema persiste, usa una caché escribible o la alternativa Docker. Si Vercel interrumpe el streaming o supera sus recursos, conserva la tienda en Vercel y usa la API Docker accesible por HTTPS. La actualización de productos y recuperación de cargas parciales se describe en [loader](../../docs/loader.md#actualizaciones-y-recuperación).
