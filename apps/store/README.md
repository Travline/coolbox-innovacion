# Tienda provisional

Requiere Node.js 20.19 o posterior y pnpm 10.14.0. Desde este directorio:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test
pnpm preview
```

La interfaz de HU-01 mantiene el intercambio solo en memoria durante la visita; recargar lo borra. El chat envía el mensaje y hasta 20 mensajes anteriores a `POST /api/chat`; muestra las preguntas de aclaración y las respuestas recibidas. Distingue un resultado sin productos de un fallo de conexión o de búsqueda; ante el fallo ofrece reintentar con el mensaje y el historial originales, sin duplicar el mensaje del visitante ni exponer detalles internos. El módulo `src/chat.ts` valida la respuesta y mantiene el historial únicamente en memoria.

Copia `.env.example` a `.env.local` y configura `VITE_API_URL` con el origen de la API, además de la dirección y credencial de lectura del catálogo. Las variables `VITE_` se incluyen en el código del navegador: el token de lectura será público y debe verificarse su alcance antes de publicar. Nunca coloques claves de Google ni credenciales de escritura en la tienda. La API debe tener configurado `STORE_ORIGIN` con el origen de la tienda para permitir la conexión desde el navegador.

Las pruebas del chat usan proveedores y respuestas HTTP simuladas para comprobar contexto, resultados vacíos, fallos repetidos, reintento, respuesta inválida y fallos de red; no necesitan red. La respuesta llega como eventos: las recomendaciones verificadas aparecen sucesivamente, y una interrupción conserva el texto parcial y permite reintentar con el contexto original. Al abrir el chat, el foco pasa al campo de consulta y, al cerrarlo, regresa al botón de apertura. La revisión visual y con tecnologías de asistencia debe hacerse en un navegador.

## Portada y catálogo

La portada usa `@libsql/client/web` para consultar directamente productos, categorías, variantes y fecha de última carga. Copia `.env.example` a `.env.local` o `.env` y configura la URL y el token de **solo lectura**. El token incluido en el frontend es público: antes de publicar, verificar qué tablas y datos permite leer. La API de Google y las credenciales de escritura nunca deben configurarse en la tienda.

El archivo `src/main.tsx` define el objeto `BANNERS`: allí se cambian las URL para `portada`, `franja` y las siete categorías. Un valor vacío conserva el espacio sin imagen; las imágenes usan recorte centrado. Las secciones «Lo último», «Ofertas top» y «Más vendidos» son selecciones ilustrativas y no representan estadísticas reales. Los precios, descuentos e imágenes se obtienen del catálogo cargado; pueden estar desactualizados.

Las categorías principales se identifican por sus IDs del scraper. Si no existe una categoría o no tiene productos en la base, se muestra el estado vacío correspondiente. Las subcategorías se obtienen solo cuando las rutas disponibles permiten reconocerlas. La navegación de categoría consulta páginas de 24 productos. El historial del chat sigue en memoria y se pierde al recargar.

Las pruebas sin red (`pnpm test`) cubren la forma del catálogo, subcategorías, precios ausentes, descuentos, metadatos ausentes y la frontera del chat. La apariencia final en escritorio y móvil y el acceso real a Turso deben verificarse en el navegador antes de considerar la unidad completa.

## Agregar al carrito

El visitante puede elegir una cantidad en el detalle o agregar una unidad desde una tarjeta del asistente. Ambas acciones consultan de nuevo la variante con la credencial de lectura antes de incorporar artículos. Requieren precio conocido y stock positivo y rechazan cambios de precio o stock y cantidades superiores al stock cargado. El stock corresponde a la última importación, no a disponibilidad en tiempo real. El contador y la selección se conservan solo en memoria durante HU-11; al recargar se pierden. No hay pago ni pedidos.

Las pruebas `tests/cart.test.mjs` y `tests/cart-ui.test.mjs` cubren límites, datos cambiados, fallos y acciones desde los dos puntos de entrada sin acceder a la red.

## Carrito

El botón de carrito de la cabecera abre un panel lateral adaptable; se cierra con su botón, con Escape o al pulsar fuera, y devuelve el foco al control de apertura. La selección se guarda en `localStorage` bajo `coolbox-cart-v1`, sin cuentas, pago ni pedidos. Si el navegador bloquea el almacenamiento se muestra un aviso y el carrito sigue funcionando en memoria.

Al recuperar o abrir el panel se consultan nuevamente los SKU de la última carga. El panel indica cambios de precio o stock, productos inexistentes, datos incompletos y errores de consulta; conserva las selecciones para que el visitante pueda reducir cantidades o quitarlas. Ante un fallo de consulta ofrece reintento y no confirma un subtotal basado en precios no verificados. Un stock menor que la cantidad guardada no elimina automáticamente unidades. Las pruebas sin red de `tests/cart-persistence.test.mjs` y `tests/cart-panel.test.mjs` cubren persistencia, fallos, cambios, foco y cierre.

Cuando no hay evidencia o falla la consulta, el chat ofrece la página oficial de canales. Si la API dispone de contactos revisados para el día de la presentación, también muestra enlaces de WhatsApp y correo con su fecha; caducan al cambiar el día en Perú. El reintento de una consulta fallida no mezcla orientación entre intentos. Ver `apps/api/README.md` para el procedimiento de revisión.

Los nombres de productos en las tarjetas de recomendaciones se muestran con un máximo de 45 caracteres, incluidos los puntos suspensivos. El nombre completo permanece disponible para lectores de pantalla y en el detalle.
