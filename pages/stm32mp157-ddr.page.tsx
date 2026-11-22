import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import capture from "tests/fixtures/stm32mp157-ddr.json"

export default (
  <GenericSolverDebugger
    createSolver={() =>
      new BgaEscapeRoutingSolver(capture as BgaEscapeRoutingSolverInput)
    }
  />
)
