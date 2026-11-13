# Plan HAB-03: preparar la ejecución y el despliegue

## Objetivo y alcance

Dejar la tienda y la API listas para que el responsable pueda desplegarlas manualmente y presentar el recorrido completo. La tienda se preparará para Vercel Hobby; la API se preparará para Vercel y tendrá Docker como alternativa.

**Dependencias:** HU-05, HU-12 y HAB-02. Los criterios están en [historias de usuario](../historias-usuario.md#hab-03--ejecutar-y-desplegar-el-prototipo).

## Implementación e interfaces

- Preparar proyectos independientes de Vercel para `apps/store/` y `apps/api/`, con instalación y build propios mediante pnpm. Configurar el fallback de React Router para rutas internas y una entrada Express compatible con Vercel y con ejecución local.
- Preparar Dockerfile y Docker Compose para la API como alternativa, con configuración mediante variables de entorno, puerto configurable y cierre ordenado. Mantener el loader como proceso separado.
- Documentar en `.env.example` y en la guía de operación las variables necesarias para cada aplicación, cuáles son públicas y cuáles deben configurarse como secretos. Configurar CORS para los orígenes reales de la tienda.
- Documentar paso a paso la creación y configuración manual de los proyectos, builds, variables, despliegue, comprobación y recuperación. Incluir las condiciones para elegir la alternativa Docker si la API o el modelo no funcionan adecuadamente en Vercel.
- Verificar que el modelo de consulta conserve la configuración de embeddings de HAB-01 y documentar cómo se obtiene o empaqueta para cada entorno, sin depender de la caché del equipo del loader.
- Mantener pendientes los nombres de proyectos, direcciones y credenciales hasta que estén disponibles; ver [DR-05](../dependencias-responsable.md#dr-05--entorno-de-demostración-y-despliegue).

## Archivos e integración

- **Propiedad del implementador:** configuración de ejecución y despliegue de `apps/store/` y `apps/api/`, junto con los archivos de Docker necesarios.
- **Compartidos:** manifiestos y puntos de entrada de ambas aplicaciones, documentación de operación y `docs/gestor-agentes.md`; el coordinador integra sus cambios y evita ediciones simultáneas.
- **Interfaz de operación:** comandos y configuración para ejecución local, Vercel y Docker; el responsable realiza el despliegue manual.

## Validación y aceptación

- Al finalizar, ejecutar los builds y comprobar localmente el artefacto compilado, las rutas internas, la configuración faltante y la conexión entre tienda y API.
- Probar la imagen Docker con la configuración necesaria y comprobar arranque, carga del modelo, consultas y cierre. Verificar que los registros no expongan secretos ni conversaciones.
- Tras el despliegue manual, comprobar navegación directa, acceso de solo lectura, recomendaciones y streaming de extremo a extremo, incluidos fallos y desconexiones. Registrar tiempos, límites observados y cualquier bloqueo del entorno.
- Consultar antes de ejecutar suites existentes conforme a `AGENTS.md`. Si aún no hay proyectos o credenciales disponibles, entregar la preparación y registrar la validación desplegada como pendiente; no marcarla como realizada.

## Decisiones y supuestos

- El responsable realizará el despliegue manual; esta capacidad prepara archivos e instrucciones y acompaña la verificación cuando el entorno esté disponible.
- La API usará Vercel solo si las pruebas de modelo, recursos y streaming resultan satisfactorias en la cuenta; de lo contrario se utilizará la alternativa Docker disponible.
- Este documento es un plan; la configuración y sus comprobaciones aún no se han realizado.
