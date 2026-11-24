import { createRoot } from "react-dom/client"
import CosmosDecorator from "./cosmos.decorator"
import twoPadEscapePage from "./pages/two-pad-escape.page"

createRoot(document.getElementById("root")!).render(
  <CosmosDecorator>{twoPadEscapePage}</CosmosDecorator>,
)
