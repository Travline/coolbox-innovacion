# Visión y alcance

## Objetivo

Reproducir la apariencia y los recorridos principales de Coolbox para que la atención se centre en un asistente virtual de compra. El chatbot debe entender necesidades expresadas en español, recomendar productos reales del catálogo y resolver dudas de servicio con información verificable. Se pedirán capturas de escritorio y móvil cuando se necesiten para conseguir fidelidad visual.

## Alcance acordado

- Inicio inspirado fielmente en la tienda, búsqueda textual con categorías y filtros básicos, y detalle de producto.
- Carrito persistido en el navegador: agregar, quitar y modificar cantidades. No habrá checkout, pagos, pedidos ni tabla de carritos.
- Chat con texto progresivo y tarjetas de recomendaciones; el usuario decide si agrega un producto mediante su botón.
- Información de precio, stock y servicio sujeta a la última actualización; mostrar cuándo se actualizó el catálogo.
- Sin cuentas, sesiones, identificadores de visitante ni cookies de identificación. El historial del chat dura la visita y permanece en memoria.

## Calidad de información

Los hechos de productos y servicio deben proceder de datos recuperados, no de afirmaciones plausibles del modelo. Si falta evidencia, el asistente lo indicará y ofrecerá canales de atención oficiales verificados. El catálogo no se consulta en tiempo real en Coolbox: sus precios y existencias pueden cambiar entre cargas.

Los textos oficiales de servicio se incorporarán en una etapa posterior. El responsable indicó que todavía no dispone de documentos; se identificaron fuentes públicas oficiales en [asistente.md](asistente.md). Las necesidades y su orden sugerido se recogen en [historias de usuario](historias-usuario.md); cada historia se planificará antes de implementarse.
