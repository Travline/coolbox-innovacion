# Gestor de planes y agentes

Este documento coordina la planificación y la futura implementación de las [historias y capacidades](historias-usuario.md). No lanza agentes por sí mismo: un coordinador deberá seguir estas instrucciones cuando el responsable solicite implementar el conjunto. Hasta entonces, solo se preparan planes.

## Registro

La tabla sigue el orden recomendado de planificación. Las dependencias son requisitos de implementación; los elementos sin relación de dependencia pueden ejecutarse en paralelo si sus cambios son compatibles. Un guion indica que no hay dependencia, responsable o resultado registrado.

| Elemento | Plan | Dependencias | Planificación | Implementación | Responsable | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| HU-01 | [Acceder al asistente](planes/HU-01.md) | — | Planificado | Pendiente | — | — |
| HAB-01 | [Recuperación de productos](planes/HAB-01.md) | — | Planificado | Pendiente | — | — |
| HU-02 | [Recomendar productos](planes/HU-02.md) | HU-01, HAB-01 | Planificado | Pendiente | — | — |
| HU-03 | [Aclarar la necesidad](planes/HU-03.md) | HU-02 | Planificado | Pendiente | — | — |
| HU-04 | [Entender el resultado de la búsqueda](planes/HU-04.md) | HU-02 | Planificado | Pendiente | — | — |
| HU-05 | [Ver la respuesta progresivamente](planes/HU-05.md) | HU-02, HU-04 | Planificado | Pendiente | — | — |
| HU-06 | [Explorar recomendaciones](planes/HU-06.md) | HU-02 | Planificado | Pendiente | — | — |
| HU-07 | [Inicio y catálogo](planes/HU-07-HU-08.md) | HU-01 | Planificado | Pendiente | — | — |
| HU-08 | [Inicio y catálogo](planes/HU-07-HU-08.md) | HU-07 (interna a la unidad) | Planificado | Pendiente | — | — |
| HU-09 | [Buscar y filtrar productos](planes/HU-09.md) | HU-08 | Planificado | Pendiente | — | — |
| HU-10 | [Consultar el detalle de un producto](planes/HU-10.md) | HU-08 | Planificado | Pendiente | — | — |
| HU-11 | [Agregar productos al carrito](planes/HU-11.md) | HU-06, HU-10 | Planificado | Pendiente | — | — |
| HU-12 | [Administrar y conservar el carrito](planes/HU-12.md) | HU-11 | Planificado | Pendiente | — | — |
| HAB-02 | [Preparar el acceso y la actualización de datos](planes/HAB-02.md) | — | Planificado | Pendiente | — | — |
| HAB-03 | [Preparar la ejecución y el despliegue](planes/HAB-03.md) | HU-05, HU-12, HAB-02 | Planificado | Pendiente | — | — |
| HU-13 | [Preparar fuentes oficiales](planes/HU-13.md) | HAB-02 | Planificado | Pendiente | — | — |
| HU-14 | [Consultar información de servicio](planes/HU-14.md) | HU-05, HU-13 | Planificado | Pendiente | — | — |
| HU-15 | [Orientar cuando falta evidencia](planes/HU-15.md) | HU-14 | Planificado | Pendiente | — | — |

HU-07 y HU-08 comparten un único plan y una sola unidad de implementación. Para iniciarla basta con completar su dependencia externa HU-01; la dependencia de HU-08 respecto de HU-07 se resuelve dentro de la unidad y no bloquea su inicio. El coordinador registra ambas filas y las completa juntas tras validar los criterios de las dos historias.

## Elaboración de planes

1. Planificar los elementos uno a uno con el responsable, siguiendo el orden de la tabla; consultar las decisiones de producto, referencias visuales y bibliotecas relevantes que correspondan.
2. Guardar el plan acordado en `docs/planes/<ID>.md`, enlazarlo en la tabla y cambiar su planificación a **Planificado**. No marcarlo planificado mientras haya decisiones imprescindibles sin resolver.
3. Mantener en cada plan: objetivo y alcance; dependencias; cambios y contratos o interfaces; archivos propios y compartidos; validación y criterios de aceptación; documentación afectada; supuestos y decisiones acordadas. Registrar límites y bloqueos conocidos cuando correspondan.
4. Si un plan descubre una dependencia o un conflicto nuevo, actualizar la historia y este registro de forma coherente y comprobar que no se creen ciclos. Conservar los identificadores estables.
5. Revisar [información y preparativos del responsable](dependencias-responsable.md) para el elemento; registrar nuevas preguntas o acciones que solo el responsable pueda resolver, su etapa y estado. Enlazar decisiones existentes en lugar de volver a pedirlas y no incluir secretos.

## Coordinación de implementación

Cuando el responsable solicite implementar el conjunto, el coordinador deberá leer las instrucciones vigentes del repositorio, las historias, este gestor y los planes aprobados. La tabla no constituye autorización para iniciar la implementación anticipadamente. Antes de ejecutar suites de pruebas existentes, consultar una vez al responsable al iniciar la ejecución completa; registrar el alcance de la autorización y cualquier limitación.

1. Comprobar que todos los elementos solicitados tengan plan y que sus dependencias estén resueltas o previstas. Una decisión imprescindible sin resolver bloquea el elemento afectado y sus dependientes, no el trabajo independiente.
2. Identificar los elementos listos: plan aprobado, dependencias completadas y verificadas, y ausencia de conflicto de archivos o interfaces. La prioridad y el orden de la tabla orientan la selección entre trabajos listos; no convierten elementos independientes en dependencias.
3. Asignar a cada agente disponible un plan concreto, sus criterios y la propiedad de sus archivos. Registrar responsable y estado **En curso** antes de comenzar. El coordinador conserva la edición e integración de archivos compartidos; si no puede garantizar límites compatibles, serializar los trabajos afectados. Respetar la disponibilidad y los límites reales de agentes del entorno; si no es posible delegar, ejecutar secuencialmente.
4. Revisar el resultado de cada agente, integrar sus cambios y comprobar sus criterios y contratos antes de marcarlo **Completado**. Solo entonces desbloquear sus dependientes. El coordinador actualiza el registro, evitando ediciones simultáneas del gestor.
5. Registrar **Bloqueado** o **Fallido**, causa y validación pendiente cuando corresponda. No presentar un trabajo parcial como terminado; continuar otros elementos listos cuando sea posible.
6. Al finalizar cada plan o cambio sustancial, actualizar la documentación afectada. Ejecutar builds al final del plan o del objetivo, salvo que uno anterior sea necesario para resolver un problema concreto. Realizar la validación integrada final y registrar resultados y límites.

**Estados de planificación:** Pendiente, En curso, Planificado, Bloqueado. **Estados de implementación:** Pendiente, En curso, Bloqueado, Fallido, Completado. El campo Resultado debe enlazar la evidencia pertinente o describir brevemente el resultado, la validación y los pendientes; el coordinador mantiene el detalle necesario sin incluir secretos.

La coordinación está sujeta a las instrucciones y permisos vigentes durante la ejecución. La cantidad de agentes y las opciones de aislamiento dependen del entorno; este documento no crea una automatización ni garantiza concurrencia.
