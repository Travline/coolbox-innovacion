# Plan HAB-02: preparar el acceso y la actualización de datos

## Objetivo y alcance

Documentar y comprobar el acceso al catálogo y su actualización manual, conservando el scraper y el loader actuales. El responsable autorizó comprobar permisos mediante una fila temporal sin relaciones en la instancia actual, eliminándola después. La recuperación ante fallos se comprobó con datos sintéticos en libSQL en memoria, sin modificar el catálogo real.

**Dependencias:** ninguna para preparar el procedimiento. La comprobación integrada de tienda y API requiere que esas aplicaciones estén disponibles. **Capacidades que habilita:** HU-13 y HAB-03. Los criterios están en [historias de usuario](../historias-usuario.md#hab-02--preparar-el-acceso-y-la-actualización-de-datos).

## Implementación e interfaces

- Documentar la configuración de las credenciales de lectura de tienda y API, separadas de la credencial de escritura del loader. Antes de publicar, comprobar el alcance efectivo del token público y considerar públicos todos los datos a los que permita acceder.
- Documentar el proceso manual completo: ejecutar el scraper, comprobar que terminó correctamente, ejecutar el loader, revisar recuentos y fecha de última carga completa, y confirmar la actualización. Conservar la demora del scraper y no cargar una extracción incompleta.
- Explicar que el loader confirma productos por separado: una ejecución fallida puede dejar cambios parciales visibles mientras la fecha sigue mostrando la última carga completa. Usar el resultado y los registros de ejecución para identificar un fallo; la fecha por sí sola no demuestra que la base no tenga cambios parciales.
- Documentar la recuperación: corregir la causa y repetir la carga completa con el archivo válido, verificando su resultado. Explicar que los productos ausentes del archivo se conservan y que las relaciones y SKU ausentes de productos presentes se sustituyen.
- Mantener el modelo y la configuración de embeddings existentes. No introducir automatización programada, migraciones ni publicación atómica del catálogo.
- Actualizar la documentación de operación y de dependencias del responsable con los recursos y comprobaciones necesarios, sin registrar secretos.

## Archivos e integración

- **Propiedad del implementador:** procedimiento de acceso, actualización y recuperación en la documentación de operación, datos y loader.
- **Compartidos:** configuración y documentación de tienda y API, `docs/dependencias-responsable.md` y `docs/gestor-agentes.md`; el coordinador integra sus cambios y evita ediciones simultáneas.
- **Interfaz de operación:** comandos manuales existentes del scraper y loader; credenciales configuradas en sus entornos correspondientes, sin rutas HTTP nuevas ni cambios de esquema.

## Validación y aceptación

- Comprobar lectura con la credencial prevista y rechazo de escrituras, y contrastar las tablas accesibles. El responsable autorizó una comprobación controlada con una fila temporal en la instancia actual; verificar su eliminación.
- Con datos de prueba y un fallo controlado, verificar que la carga incompleta no actualice la fecha de última carga completa, documentar los cambios parciales observables y comprobar la recuperación mediante una nueva ejecución completa.
- Revisar la instancia cargada solo en lectura cuando se disponga de acceso. Verificar las configuraciones de tienda y API cuando estén implementadas; registrar cualquier comprobación pendiente.
- Consultar antes de ejecutar suites existentes conforme a `AGENTS.md` y registrar los resultados y sus limitaciones.

## Decisiones y supuestos

- Las actualizaciones seguirán siendo manuales y se acepta el comportamiento actual de cargas parciales; el procedimiento no promete detectar una interrupción basándose únicamente en la fecha del catálogo.
- El responsable eligió no crear una base Turso de prueba y autorizó la prueba temporal indicada; ver [DR-07](../dependencias-responsable.md#dr-07--base-y-credenciales-de-prueba).
- Este documento es un plan; sus comprobaciones aún no se han realizado.
