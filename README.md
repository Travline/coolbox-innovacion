# Coolbox con asistente IA

Prototipo de una tienda que reproduce la experiencia visual de Coolbox y añade un asistente que recomienda productos y responde consultas de servicio con información verificable. El nombre es provisional.

## Estado actual

Existe `apps/scrapper/`, un scraper en JavaScript que consulta categorías de Coolbox y genera un JSON, y migraciones SQL en `database/`. El loader de productos y embeddings está implementado en `apps/loader/`. La tienda en `apps/store/` muestra un catálogo y chat en memoria; la API en `apps/api/` consulta productos reales y genera respuestas verificadas con Google. Una consulta real devolvió recomendaciones y otra confirmó eventos de streaming; las demás pruebas del modelo son simuladas; el catálogo incluye búsqueda, filtros y detalle, y el chat transmite eventos progresivos. El carrito persiste localmente y las respuestas de servicio muestran fragmentos oficiales con fuente y fecha; las comprobaciones desplegadas siguen pendientes. La muestra de recuperación se evaluó contra Turso, con las limitaciones documentadas en la API. Las migraciones deben aplicarse manualmente antes de cargar en una base nueva; la migración de fuentes de servicio se aplicó a la instancia del proyecto y se cargaron cinco fuentes oficiales.

## Ejecutar el scraper existente

Se necesita Node.js 20.19 o posterior y pnpm; el paquete declara pnpm 10.14.0. Desde `apps/scrapper/`:

```sh
pnpm install --frozen-lockfile
node list-categories.js
node main.js
```

El primer script consulta las categorías; el segundo requiere acceso de red y reemplaza `coolbox_productos.json` en el directorio actual solo si todas las categorías terminan correctamente. Una respuesta incompleta o un error conserva el archivo anterior. `pnpm test` es un marcador que falla: todavía no hay suite de pruebas.

La ejecución local de las bases parciales se explica en [tienda](apps/store/README.md) y [API](apps/api/README.md). Sus archivos `.env.example` indican la configuración; no incluyas credenciales en el repositorio.

## Documentación

- [Visión y alcance](docs/vision.md): producto y límites del prototipo.
- [Historias de usuario](docs/historias-usuario.md): necesidades, criterios de aceptación y orden sugerido.
- [Gestor de planes y agentes](docs/gestor-agentes.md): planes, dependencias y resultados de implementación.
- [Información y preparativos del responsable](docs/dependencias-responsable.md): decisiones, accesos y referencias que necesitamos para cada etapa.
- [Arquitectura](docs/arquitectura.md): componentes, límites y flujos.
- [Datos e ingesta](docs/datos-ingesta.md): scraper, loader, migraciones y búsqueda vectorial.
- [Loader](docs/loader.md): configuración, embeddings y carga repetible.
- [Tienda](docs/tienda.md): navegación, catálogo y carrito.
- [Asistente](docs/asistente.md): recuperación, respuestas y tarjetas.
- [Operación y despliegue](docs/operacion.md): configuración, Vercel y alternativa Docker.
- [Decisiones pendientes](docs/decisiones.md): elecciones para planificaciones posteriores.

Las instrucciones de colaboración están en [AGENTS.md](AGENTS.md).
