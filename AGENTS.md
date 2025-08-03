# AGENTS.md

## Build, Lint, and Run

- **Development:** `bun --watch src/main.ts`
- **Build:** `bun --bun esbuild ./src/**/*.ts --outdir=dist --platform=node`
- **Start:** `bun run build && bun --bun dist/main.js`
- **Format:** `biome format`
- **Lint:** Biome linter runs automatically; see `biome.json`.
- **Tests:** No test files or scripts found; add `.test.ts` files and a test runner if needed.

## Code Style Guidelines

- **Formatting:** Use Biome (`biome format`). Indent with tabs. Use single quotes, no trailing commas, semicolons as needed.
- **Imports:** Organize and sort imports and object keys (see `biome.json`).
- **Types:** Use TypeScript types and interfaces for all function signatures and objects.
- **Naming:** Use camelCase for variables/functions, PascalCase for types/classes.
- **Error Handling:** Use try/catch for async code; prefer explicit error messages.
- **File Structure:** Place commands in `src/commands/`, signals in `src/signals/`, etc.
- **Ignore:** Respect `.gitignore` for generated and environment files.
- **VCS:** Use Git for version control.
- **Other:** No Cursor or Copilot rules found.

> For more, see `biome.json` and Sunar/Discord.js docs.
