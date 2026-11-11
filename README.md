# Coolbox con asistente IA

Prototipo de una tienda que reproduce la experiencia visual de Coolbox y añade un asistente que recomienda productos y responde consultas de servicio con información verificable. El nombre es provisional.

## Estado actual

Solo existe `apps/scrapper/`, un scraper en JavaScript que consulta categorías de Coolbox y genera un JSON. La tienda, la API, Turso, el loader, las migraciones y el chatbot descritos en `docs/` son objetivos futuros, no funcionalidades disponibles.

## Ejecutar el scraper existente

Se necesita Node.js reciente con `fetch` y detección de módulos ES, y pnpm; el paquete declara pnpm 10.14.0. Desde `apps/scrapper/`:

```sh
pnpm install --frozen-lockfile
node list-categories.js
node main.js
```

El primer script consulta las categorías; el segundo sobrescribe `coolbox_productos.json` en el directorio actual y requiere acceso de red. El scraper actual extrae campos básicos y puede guardar resultados parciales si una categoría falla. `pnpm test` es un marcador que falla: todavía no hay suite de pruebas.

## Documentación

- [Visión y alcance](docs/vision.md): producto y límites del prototipo.
- [Arquitectura](docs/arquitectura.md): componentes, límites y flujos.
- [Datos e ingesta](docs/datos-ingesta.md): scraper, loader, migraciones y búsqueda vectorial.
- [Tienda](docs/tienda.md): navegación, catálogo y carrito.
- [Asistente](docs/asistente.md): recuperación, respuestas y tarjetas.
- [Operación y despliegue](docs/operacion.md): configuración, Vercel y alternativa Docker.
- [Decisiones pendientes](docs/decisiones.md): elecciones para planificaciones posteriores.

Las instrucciones de colaboración están en [AGENTS.md](AGENTS.md).
