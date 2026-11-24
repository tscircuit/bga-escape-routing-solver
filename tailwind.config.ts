import type { Config } from "tailwindcss"

export default {
  content: [
    "./pages/**/*.tsx",
    "./cosmos.decorator.tsx",
    "./node_modules/@tscircuit/solver-utils/dist/react/**/*.js",
  ],
} satisfies Config
