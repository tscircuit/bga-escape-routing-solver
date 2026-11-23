import type { ReactNode } from "react"
import "./styles.css"

export default function CosmosDecorator({
  children,
}: {
  children: ReactNode
}): ReactNode {
  return (
    <div className="flex h-screen flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200 px-4 py-3">
        <h1 className="text-base font-semibold">BGA escape routing</h1>
        <p className="text-sm text-slate-600">
          Step through via-site counting, escape reservations and completed
          routes.
        </p>
        <p className="mt-1 text-sm">
          <span className="text-slate-500">Gray: fixed copper.</span>{" "}
          <span className="text-amber-700">Amber: reserved escapes.</span>{" "}
          <span className="text-blue-700">Blue: completed routes.</span> Solid
          lines: top layer. Dashed lines: other layers. Rings: vias.
        </p>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}
