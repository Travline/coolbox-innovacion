# API en preparación

Requiere Node.js 20.19 o posterior y pnpm 10.14.0. Copia `.env.example` a `.env` en este directorio y configura allí la URL y el token de **solo lectura**. No uses el token de escritura del loader. Configura también `GOOGLE_GENERATIVE_AI_API_KEY` y opcionalmente `GOOGLE_MODEL` en ese archivo; la clave permanece en la API. `STORE_ORIGIN` admite una lista explícita de orígenes separados por comas para CORS. Si no se define, se permiten `localhost` y `127.0.0.1` en los puertos 5173 y 4173; si se define, sustituye esos valores por la lista configurada. Incluye el origen exacto de la tienda (esquema, host y puerto), sin rutas ni comodines, y reinicia la API tras cambiar la configuración. En producción configura solo los orígenes reales.

```sh
pnpm install --frozen-lockfile
pnpm build
node --env-file=.env dist/index.js
```

La API ofrece `GET /health` y `POST /api/chat`; todavía no expone rutas públicas de catálogo. `src/catalog.ts` contiene operaciones internas de lectura, con parámetros validados y filtros de precio y stock sobre la misma variante. El modelo `Xenova/multilingual-e5-small`, revisión `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, utiliza fp32, pooling medio y normalización L2, con prefijo `query:`. Se descarga a `.cache/` cuando se necesita; no se incluye en Git. No registres credenciales ni conversaciones.

## Evaluación de recuperación

```sh
pnpm build
pnpm test                     # libSQL en memoria, sin red ni credenciales
pnpm evaluate:catalog         # SELECT en la base configurada; requiere modelo descargado
```

En la evaluación del catálogo real se tomaron los primeros tres resultados y se consideraron pertinentes si el nombre identificaba el tipo solicitado y si la marca, el precio y el stock coincidían con los filtros. «laptop» devolvió tres laptops; con marca Acer devolvió tres Acer; con precio máximo S/ 3000 y stock positivo devolvió tres opciones entre S/ 1099 y S/ 2901; «audífonos» Sony con máximo S/ 500 y stock devolvió tres Sony entre S/ 109 y S/ 149. Una marca inexistente no devolvió resultados. Estas observaciones son una muestra puntual del catálogo y no garantizan pertinencia general ni disponibilidad actual.

En la primera prueba, «máquina de teletransportación interestelar» devolvió cámaras y telescopios pese a que la mejor distancia coseno era 0.1534. Se redujo el máximo de distancia de 0.20 a **0.145**, y esa consulta dejó de devolver candidatos. Para «equipo para escuchar música», las dos primeras distancias correspondieron a equipos de sonido (0.1328 y 0.1352) y las siguientes a instrumentos (desde 0.1387); se limitó también la diferencia con el mejor candidato a 0.004. La búsqueda exacta por nombre o marca sigue ordenada antes de candidatos semánticos. Los umbrales son heurísticos calibrados solo sobre esta muestra; pueden omitir productos pertinentes y admitir otros que no cumplan requisitos como inalámbrico frente a alámbrico. Una similitud alta no verifica atributos: la futura integración debe contrastar cada recomendación con datos recuperados y abstenerse si no hay evidencia suficiente.

El modelo y la consulta vectorial se comprobaron localmente; quedan pendientes una evaluación más amplia de pertinencia y la medición de recursos y latencia en Vercel. Los scripts de instalación nativos de algunas dependencias pueden requerir aprobación del gestor de paquetes; comprobar que el motor de inferencia arranque en el entorno de ejecución.

## Contrato del chat en streaming

`POST /api/chat` recibe JSON `{ "message": "...", "history": [{ "role": "user", "text": "..." }] }`. El historial admite hasta 20 mensajes de rol `user` o `assistant` y permanece en la visita del navegador. Una entrada inválida responde HTTP 400. La respuesta válida usa `text/event-stream`: cada evento es una línea `data:` con JSON, seguida de una línea vacía.

- `activity`: la consulta está en curso.
- `recommendation`: `text` y `recommendation` contienen una selección validada contra los productos y atributos recuperados.
- `message`: aclaración o aviso de servicio completo; `no_results`: búsqueda sin productos respaldados y sugerencia para reformular.
- `error`: fallo controlado. `done`: finalización explícita. Un cierre o error antes de `done` deja incompleto el contenido ya recibido.

El modelo llama a `recommendProduct` por cada selección terminada; la API valida su esquema, producto y evidencia antes de emitirla. Las afirmaciones parciales del modelo nunca se transmiten. Las aclaraciones y avisos se emiten completos; no se espera a que el resto de recomendaciones termine para mostrar una selección validada. La desconexión cancela el trabajo del modelo cuando el proveedor lo permite. Los errores no contienen detalles internos y no se registran consultas ni credenciales.

La API utiliza AI SDK con Google y el modelo configurado; limita la búsqueda del modelo a tres llamadas con argumentos validados. La respuesta estructurada solo selecciona IDs y evidencia de nombre, marca o categoría recuperados: la API contrasta cada selección y construye el texto visible desde el catálogo. Descarta IDs y atributos no comprobados. Ante una necesidad vaga el modelo elige una de tres preguntas predefinidas (tipo, uso o presupuesto); las alternativas se presentan como preguntas, no como preferencias asumidas. La misma pregunta no se repite en el turno inmediatamente siguiente; puede volver a hacerse si cambia el tema. Si el visitante no sabe o rechaza una preferencia y el modelo insiste en preguntar, se busca con la necesidad anterior sin introducir filtros nuevos, pero no se recomienda ningún candidato sin una selección validada; se comunica que no hay fundamento suficiente. Los filtros estructurados que no aparecen en los mensajes del visitante se descartan; la interpretación de correcciones, cambios de tema y pertinencia del texto aún depende del modelo y requiere revisión manual. Una necesidad de servicio recibe una indicación de que aún no hay información verificable. La selección del modelo y la relevancia siguen sujetas a error; no se afirman características que no se hayan recuperado.

Se han ejecutado pruebas simuladas sin red; la única prueba real de chat autorizada por el responsable para HU-02 devolvió recomendaciones. Las nuevas aclaraciones no se han evaluado con el modelo real por las restricciones de cuota. La transmisión de eventos se verifica con proveedores simulados; la compatibilidad y latencia del streaming con el modelo real y el entorno de despliegue siguen pendientes. Las tarjetas completas se implementarán en una historia posterior.

## Interpretación previa a la búsqueda

La herramienta `searchProducts` recibe una necesidad resumida, hasta dos consultas breves, supuestos y filtros opcionales; cada consulta utiliza recuperación textual y semántica y los productos se deduplican. Los filtros siguen contrastándose con los mensajes del visitante y el máximo global es de tres búsquedas por turno. Los supuestos se transmiten junto a las recomendaciones y se muestran como tales; el cliente conserva la advertencia en el historial. Cuando se infiere HDMI, DisplayPort, VGA o DVI en un cable sin confirmación del visitante, se agrega una advertencia aunque el modelo no la declare. Un conector explícito en el mensaje actual debe aparecer en los datos recuperados del producto; no se garantiza la compatibilidad completa. La interpretación se ejecuta mediante una llamada de herramienta del modelo existente y no requiere una llamada adicional separada ni cambios en los vectores almacenados.

La cobertura automatizada de interpretación y transmisión funciona sin Google ni Turso (`pnpm test` después de `pnpm build`). La calidad de las palabras clave y de los supuestos debe evaluarse manualmente con el modelo real y catálogo cuando el responsable autorice consumo adicional; las pruebas simuladas no demuestran cómo interpretará Gemini un caso concreto.

## Fuentes de servicio (HU-14)

La API detecta consultas de garantía, cambios, canales y términos, solicita el vendedor cuando es necesario y consulta fragmentos del índice `service_chunks_embedding_idx` con el mismo modelo de embeddings y prefijo `query:`. No genera condiciones de servicio mediante texto libre del modelo. Ante ausencia de vendedor o evidencia lo comunica; un fallo de recuperación se transmite como error. Cada respuesta con fuentes incluye una advertencia de que la fecha conocida no confirma vigencia actual y que las políticas pueden diferir. Los documentos se revisan antes de cada presentación; una consulta semántica no demuestra por sí sola pertinencia ni detecta todas las contradicciones.

En SSE, después de `activity`, la respuesta emite un `message` con esa limitación y uno o más `service_source` con `source: {sourceId, chunkOrder, title, url, checkedAt, heading, applicability, content}` íntegros, seguido de `done`. Solo se aceptan URLs HTTPS oficiales, fechas válidas no futuras, ámbitos compatibles y fuentes que corresponden a la consulta. Un error termina con `error`, sin `done`. El cliente debe conservar y enlazar cada fuente recibida, distinguir interrupciones y no interpretar texto parcial de un modelo como evidencia. La selección usa umbral coseno provisional 0.25 y filtros por tema y vendedor; hay que evaluar la pertinencia con la instancia real y ampliar los casos antes de depender de ella.

Para evaluar consultas representativas en español sin usar Google ni escribir en la base, compilar y ejecutar `node --env-file=.env scripts/evaluate-service.mjs`. La salida incluye solo identificadores, encabezados, ámbitos y fechas de fuentes; si falla, no muestra credenciales.

## Contactos cuando falta evidencia

La API emite un evento SSE `guidance` al no encontrar evidencia suficiente y antes de un evento `error` si falla la consulta. El error sigue siendo error y permite reintentar; la orientación nunca envía mensajes ni inicia comunicaciones. Por defecto solo se ofrece la página oficial de canales: `https://www.coolbox.pe/canales-de-atencion`.

Para mostrar WhatsApp y correo, revisar sus valores directamente en esa página antes de cada presentación. Configurar localmente en `.env` de la API `CONTACTS_CHECKED_AT` y `CONTACTS_PRESENTATION_DATE` con la fecha de la revisión y la presentación en formato `AAAA-MM-DD`, y `CONTACTS_WHATSAPP` (dígitos internacionales, sin `+`) y `CONTACTS_EMAIL` con los valores verificados. Solo se muestran contactos válidos si ambas fechas corresponden al día actual en Perú; al comenzar el día siguiente caducan automáticamente. Las variables son datos públicos, no credenciales. Si el servicio de datos falla, estos valores siguen disponibles desde la configuración de la API; si también falla la API, la tienda ofrece solo el enlace a la página oficial. La revisión debe repetirse antes de cada presentación y no se asignan fechas o contactos mediante el modelo.
