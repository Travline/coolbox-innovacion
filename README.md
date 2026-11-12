# Coolbox con asistente IA

Prototipo de una tienda que reproduce la experiencia visual de Coolbox y añade un asistente que recomienda productos y responde consultas de servicio con información verificable. El nombre es provisional.

## Estado actual

Existe `apps/scrapper/`, un scraper en JavaScript que consulta categorías de Coolbox y genera un JSON, y migraciones SQL en `database/`. El loader de productos y embeddings está implementado en `apps/loader/`. Según lo informado por el responsable, los productos y sus embeddings ya se cargaron en Turso; la tienda, la API y el chatbot descritos en `docs/` son objetivos futuros. Las migraciones deben aplicarse manualmente antes de cargar en una base nueva.

## Ejecutar el scraper existente

Se necesita Node.js 20.19 o posterior y pnpm; el paquete declara pnpm 10.14.0. Desde `apps/scrapper/`:

```sh
pnpm install --frozen-lockfile
node list-categories.js
node main.js
```

El primer script consulta las categorías; el segundo requiere acceso de red y reemplaza `coolbox_productos.json` en el directorio actual solo si todas las categorías terminan correctamente. Una respuesta incompleta o un error conserva el archivo anterior. `pnpm test` es un marcador que falla: todavía no hay suite de pruebas.

## Documentación

- [Visión y alcance](docs/vision.md): producto y límites del prototipo.
- [Historias de usuario](docs/historias-usuario.md): necesidades, criterios de aceptación y orden sugerido.
- [Arquitectura](docs/arquitectura.md): componentes, límites y flujos.
- [Datos e ingesta](docs/datos-ingesta.md): scraper, loader, migraciones y búsqueda vectorial.
- [Loader](docs/loader.md): configuración, embeddings y carga repetible.
- [Tienda](docs/tienda.md): navegación, catálogo y carrito.
- [Asistente](docs/asistente.md): recuperación, respuestas y tarjetas.
- [Operación y despliegue](docs/operacion.md): configuración, Vercel y alternativa Docker.
- [Decisiones pendientes](docs/decisiones.md): elecciones para planificaciones posteriores.

Las instrucciones de colaboración están en [AGENTS.md](AGENTS.md).
