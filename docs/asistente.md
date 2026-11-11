# Asistente de productos y servicio

## Comportamiento

El asistente conversa en español, identifica la necesidad del usuario y consulta información real antes de recomendar o responder sobre el servicio. Puede pedir aclaraciones cuando mejoren la búsqueda. Si no encuentra evidencia suficiente, explica que no puede responder y ofrece correo y WhatsApp de atención oficiales; no completa vacíos con datos plausibles. Diferenciar un fallo de búsqueda de una búsqueda sin resultados y comunicar ambos con claridad.

La conversación dura la visita y vive en memoria del cliente; no se guarda en Turso ni se asigna un identificador persistente. Las respuestas se transmiten progresivamente. Gestionar fallos y desconexiones sin presentar una respuesta interrumpida como completa.

## Herramientas y recuperación

La API usa AI SDK y un modelo de Google AI Studio aún por seleccionar. Las herramientas deberán exponer operaciones delimitadas de lectura, con parámetros validados, para buscar productos por texto y atributos, recuperar productos por identificador y consultar similitud de productos y documentos de servicio. Combinar resultados estructurados y semánticos según la consulta. No otorgar al modelo SQL arbitrario ni capacidad de escribir en Turso.

Las recomendaciones y sus motivos deben estar respaldados por atributos recuperados. El vector de consulta debe utilizar el mismo modelo y preprocesamiento que los vectores almacenados; se eligió `intfloat/multilingual-e5-small` y queda pendiente el lugar donde se generará ese vector en el entorno de ejecución. Documentos ausentes, desactualizados o contradictorios no deben convertirse en afirmaciones categóricas. En particular, las políticas del vendedor Marketplace pueden diferir de las de productos propios.

## Tarjetas de recomendaciones

Presentar las recomendaciones en una burbuja especial con controles accesibles para recorrer un producto a la vez. Cada tarjeta muestra imagen, nombre truncable, precio, motivo breve basado en los datos y botones para agregar al carrito y abrir el detalle interno. El botón de carrito respeta la disponibilidad y los mismos límites que el resto de la tienda; el agente no modifica el carrito directamente. Usar resultados estructurados validados y datos de catálogo para mostrar tarjetas, evitando interpretar texto libre como identificadores confiables.

MCP-UI frente a componentes React propios es una decisión pendiente. AI SDK permite herramientas y streaming; consultar su [documentación oficial](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) al implementar la versión seleccionada.

## Fuentes oficiales iniciales

Identificadas el 10 de noviembre de 2026; son referencias para una ingesta futura, no documentos ya cargados en la base. Comprobar su vigencia antes de usarlas:

- [Canales de atención](https://www.coolbox.pe/canales-de-atencion): WhatsApp **966 032 014** y correo **servicioalcliente@rashperu.com**. La página también informa horarios y teléfono.
- [Cambios y devoluciones](https://www.coolbox.pe/cambios-y-devoluciones): condiciones y excepciones aplicables.
- [Certificado de garantía](https://www.coolbox.pe/certificado-de-garantia): condiciones de garantía.
- [Términos y condiciones](https://www.coolbox.pe/terminos-y-condiciones): compra, precios, entrega y Marketplace.
- [Postventa Marketplace](https://www.coolbox.pe/postventa-marketplace): procedimientos para productos de vendedores asociados.

Estas páginas pueden cambiar o contener condiciones diferentes según el producto y vendedor. Registrar URL y fecha en cada documento y preservar el contexto antes de responder. Si los canales dejan de poder verificarse, no inventar reemplazos.
