# BGA escape routing solver

Follow the tscircuit handbook's [code conventions](https://github.com/tscircuit/handbook/blob/main/guides/code.md)
and [solver repository layout](https://github.com/tscircuit/handbook/blob/main/guides/bootstrapping-repos.md).

## Development

```sh
bun install
bun test
bun run typecheck
bun run format:check
bun run build:site
```

Use `bun start` to inspect the Cosmos pages with `GenericSolverDebugger`.
The package uses `lib/index.ts` directly and installs only `lib`.
Do not commit a lockfile or generated `cosmos-export` build.

## Code and tests

- Keep `lib/index.ts` limited to exports and pages limited to debugger setup.
- Use named object arguments when a function would exceed two parameters.
- Put named helpers at module scope; keep control flow flat and readable.
- Use the exported connection, terminal and connectivity key types for maps.
- Give new functions explicit return types and declare coordinate frames at geometry boundaries.
- Preserve native wire/via traces, terminal IDs and the caller's signal layers.
- Fail explicitly on unsupported inputs or incomplete routes.
- Keep one test per file. Reuse the real STM32 fixture without changing its geometry or rules.
- Generate visuals from `visualize()`, then inspect the SVG or the debugger.
- For an intentional visual change, update only the affected snapshots with
  `BUN_UPDATE_SNAPSHOTS=1 bun test path/to/test.ts`.
