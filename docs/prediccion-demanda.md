# Predicción de demanda e inventario

La tienda incluye dos rutas en español. `/admin` muestra los indicadores del modelo activo y `/desarrollador` permite entrenar, comparar y activar una versión. FastAPI comprueba el rol de cada consulta y operación. Cada rol usa una cuenta de demostración configurada en el servidor. La sesión dura una hora y se guarda en una cookie HttpOnly del origen de la tienda.

## Indicadores y decisiones

| Indicador | Cálculo | Uso administrativo |
| --- | --- | --- |
| Unidades previstas | Suma de los próximos 30 días por SKU. El total por categoría cubre solo los SKU de la muestra. | Comparar demanda esperada entre categorías. |
| Ingresos estimados en soles | Unidades previstas × precio del catálogo. Los subtotales identifican SKU sin precio. | Estimar el valor comercial de la demanda. |
| Días de cobertura | Primer día en que la demanda acumulada alcanza el stock, con fracción de día. Si lo supera, se muestra `> 30`. Sin demanda prevista o stock conocido se muestra un guion. | Identificar SKU con inventario ajustado. |
| Riesgo de quiebre | La demanda acumulada durante el plazo de entrega es positiva e iguala o supera el stock de referencia. | Priorizar la revisión de SKU antes de que se agoten. |
| Reposición sugerida | Demanda acumulada durante el plazo de entrega más la cobertura objetivo, menos el stock. El resultado se redondea hacia arriba con mínimo cero. | Estimar cuántas unidades revisar para una compra. |

El administrador puede ajustar el plazo de entrega y la cobertura entre 1 y 15 días cada uno. Los valores iniciales son 7 y 14. Si el stock es desconocido, se omiten la cobertura, el riesgo y la reposición. El stock de referencia pertenece a la versión entrenada. La recomendación supone que no hay compras en tránsito, stock reservado ni pedidos mínimos. La API deja las decisiones de compra al usuario.

## Preparación de datos y evaluación

- Una lectura de Turso obtiene hasta ocho SKU por categoría principal, con una variante por producto. Los productos con varias categorías cuentan una sola vez. La generación usa una semilla por SKU y crea 93 observaciones diarias a partir del 24 de agosto de 2026.
- Con la opción **Comparar stock con Coolbox**, el servicio consulta la API pública de VTEX por slug, espera 400 ms entre solicitudes y limita el tiempo de la comparación. Exige coincidencia de producto, SKU y vendedor. Para cada disminución observada distribuye exactamente esa diferencia en los nueve días del 16 al 24 de noviembre de 2026. Repartirla así es un supuesto del prototipo. La hora real de consulta y la fecha del catálogo quedan en el informe.
- Las caídas pueden incluir ajustes de inventario y otros movimientos. Aumentos, valores faltantes y respuestas inválidas dejan la serie sintética de ese SKU. Si Coolbox no responde, el entrenamiento puede continuar con la serie sintética. Las consultas son de lectura. La preparación de esta muestra no requiere ejecutar el scraper completo ni el loader.
- Se comparan regresión lineal, árbol de decisión y bosque aleatorio contra un promedio móvil de siete días. Los modelos usan día de la semana, valor de hace siete días y promedios anteriores de 7 y 28 días. La prueba reserva del 11 al 24 de noviembre de 2026. Cada paso de la prueba usa predicciones previas cuando le faltan datos, igual que en el pronóstico de 30 días que comienza el 25 de noviembre.
- El informe muestra MAE en unidades por día y SKU (menor es mejor) y R² (puede ser negativo; queda vacío cuando el objetivo es constante). Estas métricas describen la muestra y son sensibles a las caídas imputadas. Tras evaluar, se ajusta de nuevo cada modelo con todo el historial, se calcula el pronóstico y se guarda una versión elegible.

Cada ejecución conserva metadatos y métricas en Turso. El bucket guarda el dataset comprimido con el origen de cada observación, los modelos de scikit-learn y los pronósticos bajo `demand/v1/<id>/`. La vista administrativa carga el pronóstico de la versión activa. Puede recuperar el modelo seleccionado tras un reinicio sin depender del disco de Render. Para futuras ventas reales, sustituir la fuente de demanda por unidades efectivamente vendidas por fecha y SKU, y añadir inventario por almacén y plazos de proveedores.

## Ejecutar en local

Desde `apps/ml`, usar Python 3.14 y copiar `.env.example` a `.env`. Completar las dos cuentas y generar `ML_SESSION_SECRET` según el ejemplo. En desarrollo HTTP, ajustar `ML_COOKIE_SECURE=false`. Mantener `ML_ALLOWED_ORIGINS` con el origen exacto de la tienda.

Para trabajar sin cuentas de Turso ni Supabase, configurar `ML_LOCAL_DIR=.local` y `ML_CATALOG_SNAPSHOT=../scrapper/coolbox_productos.json`. La primera ejecución prepara SQLite y guarda los artefactos en ese directorio. Desmarcar **Comparar stock con Coolbox** para funcionar sin red.

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Desde `apps/store`, configurar `ML_API_URL=http://localhost:8000` y ejecutar `pnpm dev`. Abrir `http://localhost:5173/desarrollador`, iniciar sesión, pulsar **Reentrenar modelos** y activar uno al completarse. Cerrar sesión y abrir `/admin` con la cuenta de administrador.

Para ejecutar el mismo servicio con Docker Compose desde `apps/ml`, usar las variables locales `ML_LOCAL_DIR=.local` y `ML_CATALOG_SNAPSHOT=/srv/catalog.json` antes de ejecutar `docker compose up --build`. El archivo del catálogo se monta para lectura y el modo local usa el volumen `demo_state`. Con ambas variables locales vacías, Compose usa Turso y Supabase.

## Render, Vercel y Supabase

1. Revisar y aplicar `database/004_demand_forecasts.sql` manualmente a la base Turso del catálogo. La migración crea tablas de entrenamiento y modelo activo. Como la credencial del catálogo se incluye en la tienda, esas tablas deben tratarse como legibles públicamente. Solo contienen metadatos de demostración, nunca credenciales o datos personales.
2. Crear un bucket privado en Supabase Storage y copiar el endpoint S3, región y claves S3 de la configuración del proyecto. Configurar `S3_*` en FastAPI. Estas claves tienen alcance de proyecto y se mantienen en servidor. [Autenticación S3 de Supabase](https://supabase.com/docs/guides/storage/s3/authentication).
3. En Render, importar el Blueprint `render.yaml` o crear un **Web Service** Docker con contexto en la raíz, Dockerfile `apps/ml/Dockerfile` y comprobación `/health`. Añadir las variables de FastAPI y establecer `ML_ALLOWED_ORIGINS` con los orígenes HTTPS exactos de la tienda. Este servicio incluye el proceso de entrenamiento, con una instancia y un proceso Uvicorn. `GET /health` se puede consultar desde el cron manual. Las instancias gratuitas pueden suspenderse y tener arranque en frío. [Render Free](https://render.com/docs/free).
4. En el proyecto Vercel de `apps/store`, configurar `ML_API_URL=https://<servicio>.onrender.com` como variable de servidor y volver a desplegar. La función Vercel actúa como proxy para que la cookie permanezca en el dominio de la tienda. El destino se configura también para cada entorno de preview que vaya a usarse. [Funciones con Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite).

Si el servicio de Render se creó manualmente, en **Settings → Build & Deploy** dejar **Root Directory** vacío, usar **Docker Build Context** `.` y **Dockerfile Path** `./apps/ml/Dockerfile`. El contexto debe incluir tanto `apps/ml/` como `database/`. Un log con `transferring context: 2B` y errores de `COPY` para `requirements.txt` y la migración indica que esos archivos quedaron fuera del contexto. Revisar esos campos y confirmar que la rama seleccionada contiene ambos archivos antes de redeplegar. [Configuración de monorepos en Render](https://render.com/docs/monorepo-support#root-relative-settings).

Se admite un entrenamiento pendiente a la vez. Las solicitudes regresan al poner el trabajo en cola. Si Render reinicia el proceso durante el entrenamiento, la reserva vence en hasta cinco minutos desde su última actualización y el trabajo queda **Interrumpido**. Un fallo de entrenamiento o del bucket deja disponible la versión activa previa. Las versiones completadas quedan disponibles en la vista de desarrollo para volver a activarlas. Conservar en el bucket los objetos de las versiones que se quieran reutilizar.

## API y comprobaciones

Los caminos siguientes se sirven bajo `/api/ml` y comparten el origen de la tienda.

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/login`, `/logout` | Mismo origen. El inicio de sesión recibe correo y contraseña. |
| GET | `/session` | Cuenta con sesión válida. |
| GET | `/dashboard?lead_days=7&coverage_days=14` | Administrador. |
| GET | `/runs`, `/runs/{id}` | Desarrollador. |
| POST | `/runs` con `compare_stock` | Desarrollador. |
| POST | `/active` con `run_id` y `model` | Desarrollador. |

Ejecutar `python -m unittest -v test_ml` desde `apps/ml`. Las pruebas usan SQLite y almacenamiento temporal. Revisar en el entorno desplegado el acceso directo a ambas rutas, los roles, un entrenamiento completo, la activación y el pronóstico tras reiniciar Render. Revisar los logs de Render si falla un trabajo. Los metadatos de estado y la marca de consulta de stock aparecen en el panel.

La comprobación local con Docker y un límite de 512 MB entrenó con 48 SKU del catálogo guardado y 4.464 observaciones sintéticas. El bosque aleatorio obtuvo un MAE de 1,28 y un R² de 0,68. Se activó esa versión y se recuperaron sus pronósticos tras reiniciar FastAPI. También pasaron las suites de tienda, API y loader.

En la consulta de solo lectura del 24 de noviembre de 2026 se recuperó stock comparable para 46 de los 48 SKU de Turso. La muestra no tuvo caídas positivas. La migración remota, la subida al bucket de Supabase y las comprobaciones en Vercel y Render quedan para el despliegue con las credenciales del entorno.
