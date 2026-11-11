# Tienda y carrito

## Experiencia prevista

La tienda debe reproducir con la mayor fidelidad posible el inicio de Coolbox, sus recorridos y su presentación en escritorio y móvil. Pedir capturas de referencia durante la planificación visual. Utilizar React, React Router, Tailwind y Zustand; la organización detallada de componentes y las rutas concretas se definirán al implementar.

- **Inicio:** estructura visual basada en las referencias y acceso al catálogo y al asistente.
- **Búsqueda:** búsqueda textual, categorías y filtros básicos, incluidos marca y precio cuando los datos lo permitan. Mostrar estados de carga, error y ausencia de resultados.
- **Detalle:** imagen, nombre, precio, disponibilidad, descripción y especificaciones reales disponibles. La navegación desde la tarjeta del asistente abre esta página interna.
- **Carrito:** agregar, quitar y modificar cantidades; almacenar en `localStorage` y recuperarlo al recargar. No hay compra, pago ni persistencia de carritos en Turso.

Mostrar productos sin stock o sin precio con su estado correspondiente y deshabilitar su incorporación al carrito. El catálogo se actualiza manualmente: mostrar la última actualización disponible e indicar que precio y stock pueden haber cambiado. Si un dato no existe, mostrarlo como no disponible.

## Acceso al catálogo

El navegador consultará Turso con un cliente basado en `fetch` y una credencial de solo lectura. El token incluido en el frontend es público, no un secreto: los usuarios pueden ejecutar consultas permitidas por esa credencial fuera de la interfaz. Verificar su alcance efectivo antes de publicar, limitarlo cuando el servicio lo permita y considerar públicos todos los datos que alcance. Una interfaz que solo muestre productos no impide leer otras tablas accesibles.

Mantener la clave de Google y el token de escritura fuera del frontend. La tienda consulta la API solo para el asistente; no existe una API de catálogo en el alcance actual. Usar un manejo razonable de errores de red y datos antiguos, sin asumir que almacenamiento local o imágenes externas estarán siempre disponibles.
