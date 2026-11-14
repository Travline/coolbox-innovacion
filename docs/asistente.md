# Asistente de productos y servicio

## Estado de implementación

La tienda envía el chat en memoria a `POST /api/chat`. La API utiliza el modelo configurado y una herramienta de búsqueda de solo lectura; valida los identificadores y atributos seleccionados y construye el texto visible con datos recuperados. Cuando no hay evidencia suficiente devuelve un aviso; ante un fallo ofrece reintentar sin duplicar la consulta. Puede solicitar una aclaración y utiliza el historial de la visita. Las consultas de servicio aún no tienen fuentes incorporadas. Pasaron las pruebas simuladas y una única consulta real autorizada devolvió tres laptops. El streaming y las tarjetas están implementados y probados con proveedores simulados; una segunda consulta real autorizada emitió actividad, mensaje y finalización. Las recomendaciones sucesivas con el modelo real y el despliegue siguen pendientes. CORS de la vista previa local se comprobó mediante una solicitud OPTIONS sin usar el modelo. Ver [API](../apps/api/README.md).

## Comportamiento previsto

El asistente conversa en español, identifica la necesidad del usuario y consulta información real antes de recomendar o responder sobre el servicio. Puede pedir aclaraciones cuando mejoren la búsqueda. Si no encuentra evidencia suficiente, explica que no puede responder y ofrece correo y WhatsApp de atención oficiales; no completa vacíos con datos plausibles. Diferenciar un fallo de búsqueda de una búsqueda sin resultados y comunicar ambos con claridad.

La conversación dura la visita y vive en memoria del cliente; no se guarda en Turso ni se asigna un identificador persistente. Las respuestas se transmiten progresivamente. Gestionar fallos y desconexiones sin presentar una respuesta interrumpida como completa.

## Interpretación de necesidades

Para recomendaciones, el modelo interpreta el mensaje y el historial y llama a la herramienta de búsqueda con una necesidad resumida, una o dos consultas breves de productos y supuestos separados. Por ejemplo, una falla del cable entre monitor y computadora puede traducirse en «cable de video para monitor» y «cable HDMI», indicando que HDMI no está confirmado. Cada consulta se busca por texto y vector con el mismo modelo y preprocesamiento del catálogo; los productos duplicados se combinan y se conservan los filtros explícitos del visitante. La herramienta mantiene el límite de tres búsquedas por turno.

Las tarjetas muestran los supuestos como tales y piden comprobar la compatibilidad; también se conserva esa advertencia en el historial durante la visita. Si el mensaje actual indica HDMI, DisplayPort, VGA o DVI, se descartan candidatos que no mencionen ninguno de los conectores indicados en sus datos recuperados. Esto no garantiza que el cable o adaptador sea compatible con los puertos reales. El asistente sigue verificando IDs y atributos antes de recomendar, distingue fallos de búsquedas vacías y mantiene las consultas de servicio separadas. La interpretación y la pertinencia siguen dependiendo del modelo y deben evaluarse con ejemplos reales antes de asumir que son infalibles.

## Herramientas y recuperación

La API usa AI SDK y el modelo Google configurado; el modelo inicial acordado es `gemini-3.5-flash-lite`. Las herramientas deberán exponer operaciones delimitadas de lectura, con parámetros validados, para buscar productos por texto y atributos, recuperar productos por identificador y consultar similitud de productos y documentos de servicio. Combinar resultados estructurados y semánticos según la consulta. No otorgar al modelo SQL arbitrario ni capacidad de escribir en Turso.

Las recomendaciones y sus motivos deben estar respaldados por atributos recuperados. El vector de consulta debe utilizar el mismo modelo y preprocesamiento que los vectores almacenados; se eligió `intfloat/multilingual-e5-small` y la API genera el vector de consulta en su proceso, con el mismo modelo y configuración que el loader. Documentos ausentes, desactualizados o contradictorios no deben convertirse en afirmaciones categóricas. En particular, las políticas del vendedor Marketplace pueden diferir de las de productos propios.

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
