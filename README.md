# high-density-phase-solver

Pipeline9 high-density routing algorithms and their visual regressions.

## BGA escape routing

`BgaEscapeRoutingSolver` routes point pairs on a multilayer board with narrow channels between BGA pads. Its grid is aligned to the ball pitch. It counts legal through-via sites for each terminal, reserves exits for the most constrained terminals first, and then connects the supplied point pairs on the permitted signal layers.

Pass the board bounds, physical pads, resolved copper rules, fixed traces, BGA anchor, signal layer indices and original point pairs to the constructor. Coordinates and clearances are in millimetres. After a successful solve, `getOutput()` returns the new wire/via traces with branch names and port IDs. A failed attempt exposes its reason through `error` and `failure`. [Input and output types](lib/bga-escape-routing/types.ts)

```ts
import { BgaEscapeRoutingSolver } from "@tscircuit/high-density-phase-solver"

const solver = new BgaEscapeRoutingSolver(input)
solver.solve()
if (solver.failed) throw new Error(solver.error ?? "BGA routing failed")
const traces = solver.getOutput()
```

## Debugging and tests

Run `bun install`, then `bun start`. The **two-pad-escape** fixture starts with two pads and an existing gray trace. Step through the amber via reservations and the blue completed route. The **stm32mp157-ddr** fixture replays all 137 terminals and 97 branches from the native DDR board. Run `bun run test` for the routing regressions and SVG snapshots, or `bun run build:site` to export the debugger.

The STM32MP157 fixture is adapted from the OLIMEX STMP157-OLinuXino-LIME2 rev B1 design by OLIMEX Ltd. under CC BY-SA 3.0 US. It contains the remaining routing phase captured from tscircuit 0.0.3278, with the board rules resolved and the original point pairs supplied by Pipeline9. [KiCad source](https://github.com/OLIMEX/OLINUXINO/tree/85eee9c17ee13af65617d73bdd94de7ec49cfb42/HARDWARE/STMP157-OLinuXino-LIME2) · [Native TSX source](https://github.com/ShiboSoftwareDev/core-ddr-benchmark/tree/24dc44c166d4258c3538f8b1f66953f1b6f58690/circuits) · [Fixture license](https://creativecommons.org/licenses/by-sa/3.0/us/)
