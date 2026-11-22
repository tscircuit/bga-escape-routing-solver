import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { BgaEscapeRoutingSolver } from "lib"
import { twoPadEscape } from "tests/fixtures/two-pad-escape"

export default (
  <GenericSolverDebugger
    createSolver={() => new BgaEscapeRoutingSolver(twoPadEscape)}
  />
)
