# Repository Guidelines

## Project Structure & Module Organization

The repository contains the scraper in `apps/scrapper/` and the product and embeddings loader in `apps/loader/`. `main.js` fetches and normalizes Coolbox products by category; `list-categories.js` prints the current top-level categories. `coolbox_productos.json` is the scraper's output, and `product_res.json` is a sample product response. Dependencies and the pnpm lockfile live alongside the scripts; `database/` contains the initial Turso/libSQL migration. There are currently no dedicated test or asset directories.

## Development Commands

Run commands from `apps/scrapper/` using Node.js 20.19 or later:

- `pnpm install --frozen-lockfile` installs the locked dependencies (the project specifies pnpm 10.14.0).
- `node list-categories.js` retrieves and prints category IDs and names.
- `node main.js` fetches products and replaces `coolbox_productos.json` in the current directory only after a complete extraction.
- `pnpm test` currently exits with an error because no test suite is configured.

Both scraper scripts require network access to the Coolbox API. Run the loader from `apps/loader/` with `pnpm install --frozen-lockfile` and `pnpm load` after configuring `.env` and manually applying migrations 001 and 002; see `docs/loader.md`. No build or lint command is configured.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: two-space indentation, semicolons, single-quoted strings, and ES module imports. Use `camelCase` for variables and functions, and `UPPER_SNAKE_CASE` for constants. Keep API parsing and request behavior readable; preserve the existing request delay when changing pagination. No formatter or linter is configured.

## Testing Guidelines

No testing framework or coverage threshold is configured. For changes, check the relevant script with Node and inspect its output; use representative API responses when validating parsing. If adding automated tests, document how to run them and avoid requiring live network access for routine tests.

## Commit & Pull Request Guidelines

The repository has no commit history from which to infer a message convention. Use concise, imperative commit subjects describing the change. Pull requests should explain the purpose and behavior change, list verification steps, and link any related issue. Mention regenerated JSON data explicitly in the description.

## Project Context & Agent Workflow

Read `README.md` and the relevant documents in `docs/` before planning changes; distinguish implemented behavior from future design. Use pnpm without workspaces or Turborepo. Keep TypeScript path aliases and emitted JavaScript imports working in the actual runtime and deployment target. Propose and consult the user before selecting significant additional libraries.

Run builds at the end of an implementation plan or goal, rather than repeatedly during intermediate edits, unless an earlier build is necessary to resolve a concrete issue. If tests exist, ask the user whether to run them before execution; report what was and was not verified. Preserve the scraper's request delay and avoid treating incomplete extraction as a complete catalog. Keep the loader model, revision, precision, pooling, normalization, and preprocessing compatible with future query embeddings. When completing a module, plan, or substantial change, create or update the relevant documentation so its behavior, configuration, and important decisions remain accurate.
