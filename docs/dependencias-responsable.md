# Información y preparativos del responsable

Este documento reúne lo que el equipo necesita que el responsable explique, decida o prepare para planificar e implementar el prototipo. No es una lista de tareas de programación: el equipo debe investigar y proponer las soluciones técnicas que pueda resolver por su cuenta.

Puedes responder cada punto aquí, indicando una referencia o la disponibilidad del recurso. **No escribas claves, tokens ni otros secretos en este archivo, en el chat ni en el repositorio.** Para credenciales, indica solo si están disponibles y dónde se configurarán de forma segura cuando se necesiten.

**Etapas:** «Planificación» significa que la respuesta hace falta para completar el plan indicado. «Implementación y validación» significa que se necesitará para desarrollar o comprobar el comportamiento, pero no necesariamente para empezar a planificar. Un recurso pendiente de validación real no impide por sí solo avanzar con trabajo independiente o pruebas simuladas; sus consecuencias se registran en el gestor.

**Estados:** Pendiente, Disponible, Resuelto o No aplica. Actualizar la respuesta y el estado al acordar una decisión; enlazar la documentación que contenga sus detalles sin duplicarla.

## Solicitudes conocidas

### DR-01 — Referencias visuales de Coolbox

- **Relacionado con:** HU-07 y planificación visual posterior.
- **Necesario en:** planificación de la fidelidad visual; HU-01 tiene una interfaz provisional que no requiere estas referencias.
- **Te pedimos:** proporcionar referencias de escritorio de los recorridos y pantallas de Coolbox que quieres reproducir.
- **Para qué:** acordar la apariencia y los recorridos sin inventar una referencia visual.
- **Estado:** Disponible.
- **Respuesta o referencia:** Las cuatro capturas de escritorio están enlazadas en el [plan conjunto de HU-07 y HU-08](planes/HU-07-HU-08.md#archivos-e-integración). El responsable eligió adaptar el diseño a móvil sin aportar capturas móviles.

### DR-02 — Acceso de lectura al catálogo

- **Relacionado con:** HAB-01, HU-02 y posteriormente HU-08 a HU-10.
- **Necesario en:** implementación y validación con el catálogo real; la evaluación de HAB-01 requiere lectura de la instancia cargada.
- **Te pedimos:** confirmar que la dirección de la base Turso y una credencial de solo lectura estarán disponibles en el entorno de ejecución; indicar quién puede configurar el acceso. Antes de publicar la tienda, facilitar la comprobación del alcance real de la credencial accesible desde el navegador.
- **Para qué:** consultar y evaluar los productos y embeddings cargados, y determinar qué datos son públicos por el alcance de lectura.
- **Estado:** Pendiente de confirmar disponibilidad y alcance.
- **Respuesta o referencia:** La carga de productos y embeddings fue informada por el responsable; la instancia no ha sido inspeccionada en esta revisión. La dirección puede indicarse si no contiene credenciales; el token debe configurarse de forma segura.

### DR-03 — Acceso a Google AI Studio

- **Relacionado con:** HU-02 y las historias posteriores del asistente.
- **Necesario en:** implementación y validación con el modelo real.
- **Te pedimos:** confirmar que habrá una clave de Gemini API configurada de forma segura en la API y que la cuenta tiene acceso y cuota para `gemini-3.5-flash-lite`. Indicar cualquier límite de uso o presupuesto que debamos respetar.
- **Para qué:** verificar las recomendaciones con el modelo acordado. Si el modelo no está disponible, se registrará el bloqueo antes de elegir otro.
- **Estado:** Pendiente de confirmar disponibilidad, cuota y límites.
- **Respuesta o referencia:** Por completar. No escribir la clave; HU-02 prevé `.env.example` sin secretos.

### DR-04 — Fuentes de información de servicio

- **Relacionado con:** HU-13 a HU-15.
- **Necesario en:** planificación y validación de la etapa de servicio.
- **Te pedimos:** comunicar cualquier documento oficial o instrucción adicional que deba incorporarse y facilitar la revisión de las fuentes antes de cada presentación.
- **Para qué:** acordar el material que se verificará y cargará antes de que el asistente responda sobre servicio.
- **Estado:** Pendiente de revisión para la carga y cada presentación.
- **Respuesta o referencia:** Se acordó comenzar con las cinco páginas de [asistente.md](asistente.md#fuentes-oficiales-iniciales), preparar sus textos manualmente y revisar su vigencia antes de cada presentación; ver [plan HU-13](planes/HU-13.md).

### DR-05 — Entorno de demostración y despliegue

- **Relacionado con:** HAB-03 y validación de despliegue de HAB-01 y HU-05.
- **Necesario en:** planificación del despliegue y validación en el entorno elegido.
- **Te pedimos:** indicar los proyectos concretos, los recursos y el presupuesto disponibles. Facilitar las direcciones públicas de tienda y API cuando existan y configurar sus credenciales de forma segura.
- **Para qué:** comprobar acceso, configuración, arranque del modelo y streaming en el entorno real sin asumir capacidades del plan contratado.
- **Estado:** Pendiente.
- **Respuesta o referencia:** El responsable indicó que usará Vercel Hobby personal, que Docker está disponible como alternativa para la API y que realizará el despliegue manualmente. Los proyectos, direcciones y límites concretos siguen pendientes; ver [plan HAB-03](planes/HAB-03.md).

### DR-06 — Autorización para ejecutar suites existentes

- **Relacionado con:** la implementación conjunta de HU y HAB.
- **Necesario en:** inicio de la ejecución completa, antes de ejecutar suites existentes.
- **Te pedimos:** decidir en ese momento si autorizas ejecutar las suites existentes; el coordinador registrará el alcance y cualquier limitación.
- **Para qué:** cumplir las instrucciones de `AGENTS.md`. El marcador `pnpm test` del scraper actualmente falla porque no hay suite configurada.
- **Estado:** Pendiente de consultar al iniciar la implementación.
- **Respuesta o referencia:** No se ha autorizado todavía; ver [gestor de agentes](gestor-agentes.md#coordinación-de-implementación).

### DR-07 — Base y credenciales de prueba

- **Relacionado con:** HAB-02.
- **Necesario en:** implementación y validación de acceso y recuperación.
- **Te pedimos:** confirmar la disponibilidad de una base Turso de prueba separada y de credenciales de lectura y escritura apropiadas, e indicar quién podrá configurarlas de forma segura.
- **Para qué:** comprobar permisos y simular una carga fallida y su recuperación sin alterar la instancia cargada. La revisión de esa instancia se hará solo en lectura.
- **Estado:** Pendiente de confirmar disponibilidad.
- **Respuesta o referencia:** Por completar. No escribir tokens ni credenciales en este documento.

## Direcciones, endpoints y secretos

La **dirección de un servicio externo**, como la URL de Turso o la URL donde se despliegue la API, identifica un recurso que el responsable puede necesitar configurar o confirmar. Las credenciales se colocan únicamente en el entorno seguro correspondiente, nunca en este documento. La URL de la tienda y la URL pública de la API pueden compartirse cuando existan, si no contienen credenciales.

Una **ruta interna**, como `POST /api/chat`, es parte del diseño de la aplicación: el equipo la propone y documenta en el plan correspondiente. No necesitas definirla salvo que tengas una restricción o integración externa que obligue a usar un contrato concreto. Los archivos `.env.example` documentarán nombres y valores de ejemplo, sin secretos reales.

## Plantilla para nuevas solicitudes

Copiar esta plantilla al descubrir una necesidad que solo el responsable puede resolver. Si una decisión ya está documentada, enlazarla en lugar de volver a pedirla.

```markdown
### DR-XX — Título breve

- **Relacionado con:** HU-XX o HAB-XX.
- **Necesario en:** planificación / implementación y validación.
- **Te pedimos:** pregunta o acción concreta que solo tú puedes resolver.
- **Para qué:** decisión o comprobación que habilita y qué queda bloqueado si falta.
- **Estado:** Pendiente / Disponible / Resuelto / No aplica.
- **Respuesta o referencia:** Por completar; sin contraseñas ni tokens.
```

Por ejemplo, **DR-01** usa la plantilla para pedir capturas antes de planificar la fidelidad visual. Al responder, basta con indicar la ubicación de las capturas y cambiar el estado a Disponible; el equipo analizará su contenido durante esa planificación.
