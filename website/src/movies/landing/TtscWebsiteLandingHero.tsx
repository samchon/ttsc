"use client";

const CLAIMS = [
  {
    value: "10x",
    label: "faster type checks",
    detail:
      "TypeScript-Go checks natively, in parallel. JavaScript tsc does neither.",
  },
  {
    value: "800x",
    label: "faster lint loop",
    detail:
      "Rules reuse the AST and types the compiler already built. ESLint parses it all again.",
  },
  {
    value: "90%",
    label: "fewer agent tokens",
    detail:
      "Agents read one compiler-resolved graph over MCP instead of crawling source files.",
  },
  {
    value: "type-safe",
    label: "script execution",
    detail:
      "ttsx type-checks the whole project before Node receives the entrypoint.",
  },
] as const;

const FLOW = [
  {
    name: "ttsc",
    text: "build / check / watch",
    tone: "text-sky-300",
  },
  {
    name: "ttsx",
    text: "checked script runner",
    tone: "text-blue-200",
  },
  {
    name: "@ttsc/lint",
    text: "rules as compiler diagnostics",
    tone: "text-cyan-300",
  },
  {
    name: "@ttsc/graph",
    text: "code map for coding agents, over MCP",
    tone: "text-blue-300",
  },
  {
    name: "plugins",
    text: "AST + Checker before emit",
    tone: "text-sky-200",
  },
] as const;

export default function TtscWebsiteLandingHero() {
  return (
    <section className="relative overflow-hidden bg-[#3178c6] px-6 pb-20 pt-28 md:pb-28 md:pt-36">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[size:64px_64px] opacity-60" />
      <div className="absolute -right-40 top-8 h-[34rem] w-[34rem] rounded-full bg-[#72afe6]/40 blur-3xl" />
      <div className="absolute -left-36 bottom-0 h-80 w-80 rounded-full bg-[#235a97]/45 blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-2 bg-[#235a97]" />

      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center">
        <div>
          <p className="mb-6 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
            TypeScript-Go toolchain
          </p>
          <h1 className="text-[78px] font-black leading-[0.84] tracking-normal text-white sm:text-[112px] md:text-[150px]">
            ttsc
          </h1>

          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-blue-50 md:text-2xl">
            Build with TypeScript-Go. Run scripts only after they type-check.
            Let plugins see the same types the compiler sees.
          </p>

          <div className="mt-8 grid border-y border-white/25 sm:grid-cols-2">
            {CLAIMS.map((claim, index) => (
              <div
                key={claim.value}
                className={`py-5 sm:px-5 ${
                  index % 2 === 0 ? "sm:pl-0" : "sm:border-l sm:border-white/20"
                } ${index >= 2 ? "sm:border-t sm:border-white/20" : ""}`}
              >
                <p className="whitespace-nowrap font-mono text-[26px] font-black leading-none text-white md:text-[30px]">
                  {claim.value}
                </p>
                <p className="mt-3 text-sm font-semibold leading-tight text-blue-50">
                  {claim.label}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-blue-100">
                  {claim.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/docs"
              className="group rounded-md bg-white px-7 py-3 text-sm font-semibold text-[#235a97] shadow-[0_12px_30px_rgba(16,42,67,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-[0_16px_36px_rgba(16,42,67,0.24)]"
            >
              Read the guide
              <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-1">
                -&gt;
              </span>
            </a>
            <a
              href="/playground"
              className="rounded-md border border-white/45 bg-white/10 px-7 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-white hover:bg-white/20"
            >
              Try the Playground
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/25 bg-[#102a43] shadow-[0_32px_90px_rgba(16,42,67,0.32)]">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#173f66] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
            </div>
            <code className="font-mono text-xs text-blue-200">
              compiler path
            </code>
          </div>

          <div className="space-y-3 p-4 md:p-5">
            {FLOW.map((item, index) => (
              <div key={item.name} className="grid grid-cols-[28px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-300/40 bg-blue-400/15 font-mono text-xs font-semibold text-blue-200">
                    {index + 1}
                  </span>
                  {index !== FLOW.length - 1 && (
                    <span className="h-full w-px bg-blue-300/20" />
                  )}
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <code className={`font-mono text-sm font-bold ${item.tone}`}>
                    {item.name}
                  </code>
                  <p className="mt-1 text-sm text-blue-100">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 bg-[#173f66] p-4 font-mono text-[13px] leading-relaxed">
            <p>
              <span className="text-blue-200">src/index.ts:3:7 - </span>
              <span className="text-red-300">error </span>
              <span className="text-sky-300">TS2322</span>
            </p>
            <p className="text-blue-100">
              Type errors and lint rules land in the same diagnostic stream.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
