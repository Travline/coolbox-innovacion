# Guía para probar el sistema Coolbox y reunir evidencias para el informe

El recorrido prueba la tienda, el asistente de compras y servicio, y los paneles de predicción de demanda. Guarda las capturas con los nombres sugeridos para que después sea fácil ubicarlas en el informe.

## Antes de empezar

- Tienda: https://coolbox-innovacion-front.vercel.app
- API del asistente: https://coolbox-innovacion.vercel.app
- API de predicción: https://coolbox-model.onrender.com
- Panel de desarrollador: https://coolbox-innovacion-front.vercel.app/desarrollador
- Panel de administrador: https://coolbox-innovacion-front.vercel.app/admin

Pide al responsable del despliegue las URL y las credenciales de desarrollador y administrador. Usa una ventana privada para empezar con el carrito vacío y sin sesiones abiertas. Evita incluir contraseñas, tokens o claves en las capturas.

Si quieres comprobar que los servicios arrancaron, abre https://coolbox-innovacion.vercel.app/health y https://coolbox-model.onrender.com/health. Ambos deberían responder {"status":"ok"}. La prueba completa de las conexiones viene después, al usar el asistente y entrenar un modelo.

## 1. Tienda, catálogo y carrito

1. Entra a https://coolbox-innovacion-front.vercel.app. Comprueba que se muestran las categorías, los productos y la fecha de la última carga del catálogo. Guarda 01-portada.png.
2. Busca audífonos y aplica un filtro de marca o de precio. Comprueba que los resultados respetan el filtro. Toma una captura que muestre el filtro y los productos. Guarda 02-catalogo-filtrado.png.
3. Abre un producto con stock. Revisa su precio, disponibilidad y descripción. Si tiene variantes, selecciona otra y comprueba que el detalle se actualiza. Recarga la página para verificar que el enlace directo funciona. Guarda 03-detalle-producto.png.
4. Agrega el producto al carrito. Cambia la cantidad si el stock lo permite, recarga la página y vuelve a abrir el carrito. El producto y la cantidad deben conservarse. Guarda 04-carrito-persistente.png y luego retira el artículo. El recorrido de compra de este prototipo termina en el carrito.

## 2. Asistente de compras y servicio

1. Abre el chat y escribe: «Busco audífonos Bluetooth por menos de S/ 200». Comprueba que la respuesta aparece progresivamente. Si aparecen recomendaciones, revisa que respeten el presupuesto y que al abrir una tarjeta llegues al detalle del mismo producto. Guarda 05-asistente-recomendacion.png con la consulta y la tarjeta visibles. Si no hay resultados, prueba un presupuesto mayor y registra cuál usaste.
2. En una conversación nueva, escribe: «Necesito algo para trabajar». Si el asistente pide más información, responde: «Una laptop para ofimática». Comprueba que la respuesta toma en cuenta la aclaración. Guarda 06-asistente-aclaracion.png si logras capturar ambos turnos.
3. Pregunta: «¿Cómo funciona la garantía de un producto vendido directamente por Coolbox?». Si hay una respuesta con fuentes, abre uno de los enlaces y comprueba que respalda lo que dice el asistente. Guarda 07-asistente-fuentes.png con la respuesta, el enlace y la fecha de revisión visibles.

## 3. Entrenamiento y selección del modelo

1. Abre https://coolbox-innovacion-front.vercel.app/desarrollador e inicia sesión con la cuenta de desarrollador.
2. Deja marcada Comparar stock con Coolbox y pulsa Reentrenar modelos. Guarda 08-entrenamiento-en-progreso.png cuando veas el trabajo en cola o en ejecución.
3. Al completarse, revisa el período de prueba, la procedencia de los datos y la tabla con promedio móvil, regresión lineal, árbol de decisión y bosque aleatorio. Guarda 09-comparacion-modelos.png con el MAE y el R² de cada uno. Si el informe indica que todo el historial es sintético, registra ese resultado tal como aparece.
4. Para la demostración, elige el modelo con menor MAE y pulsa Activar. El MAE representa el error absoluto medio en unidades por SKU y día. Guarda 10-modelo-activo.png y anota el nombre del modelo, su MAE y su R². Las métricas corresponden a datos de demostración.

## 4. Panel administrativo e indicadores

1. Antes de cerrar la sesión de desarrollador, abre https://coolbox-innovacion-front.vercel.app/admin. Debe aparecer un mensaje indicando que esa cuenta no tiene acceso. Guarda 11-acceso-por-rol.png.
2. Cierra sesión e ingresa a /admin con la cuenta de administrador. Comprueba que aparece el modelo que acabas de activar. Guarda 12-panel-administrativo.png con los indicadores y el pronóstico por categoría.
3. Selecciona una categoría. Busca un SKU con stock conocido y anota su riesgo de quiebre y reposición sugerida. Con el mismo SKU y la misma categoría, cambia el plazo de entrega de 7 a 15 días y pulsa Actualizar indicadores. Guarda 13-reposicion-antes.png y 14-reposicion-despues.png. El plazo puede cambiar el riesgo o la reposición según el stock y la demanda del SKU. El pronóstico de unidades a 30 días debe mantenerse.
4. Con la sesión de administrador, abre /desarrollador y verifica que el acceso esté bloqueado. Luego cierra sesión y recarga /admin. Debe volver a mostrar el formulario de ingreso.
5. Si el responsable puede reiniciar FastAPI en un entorno de prueba, vuelve a entrar a /admin después del reinicio y comprueba que el mismo modelo sigue activo sin reentrenar. Guarda 15-modelo-tras-reinicio.png. Si no se hizo el reinicio, registra este punto como no probado.

## Cómo entregar las evidencias

Para cada prueba, anota qué hiciste, qué ocurrió y qué captura lo demuestra. Marca el resultado como Correcto, Falló o No probado. Si algo falla, conserva la captura del mensaje y anota la ruta y el paso en que ocurrió.

Ejemplo de pie de figura:

> Figura 9. Comparación de modelos de demanda. El panel de desarrollador muestra el MAE y el R² de los modelos evaluados sobre el mismo período de prueba. Los resultados corresponden a datos de demostración.
