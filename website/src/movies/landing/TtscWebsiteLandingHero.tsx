"use client";

const CLAIMS = [
  {
    value: "10x",
    label: "faster type checks",
    detail: "Up to 10x faster than JavaScript tsc through TypeScript-Go.",
  },
  {
    value: "800x",
    label: "faster lint loop",
    detail: "Measured on the VS Code fixture against ESLint.",
  },
  {
    value: "type-safe",
    label: "script execution",
    detail: "ttsx checks the project before Node receives the entrypoint.",
  },
] as const;

const FLOW = [
  {
    name: "ttsc",
    text: "build / check / watch",
    tone: "text-[#3178c6]",
  },
  {
    name: "ttsx",
    text: "checked script runner",
    tone: "text-[#286aa9]",
  },
  {
    name: "@ttsc/lint",
    text: "rules as compiler diagnostics",
    tone: "text-[#468fd3]",
  },
  {
    name: "@ttsc/graph",
    text: "code map for coding agents, over MCP",
    tone: "text-[#1f5b91]",
  },
  {
    name: "plugins",
    text: "AST + Checker before emit",
    tone: "text-[#609fd8]",
  },
] as const;

export default function TtscWebsiteLandingHero() {
  return (
    <section className="relative overflow-hidden bg-[#f7fbff] px-6 pb-20 pt-28 md:pb-28 md:pt-36">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(49,120,198,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(49,120,198,0.10)_1px,transparent_1px)] bg-[size:64px_64px] opacity-70" />
      <div className="absolute -right-40 top-8 h-[34rem] w-[34rem] rounded-full bg-[#84baf0]/30 blur-3xl" />
      <div className="absolute -left-36 bottom-0 h-80 w-80 rounded-full bg-[#cfe8ff]/80 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#235a97] via-[#3178c6] to-[#8fc5f4]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-[#c7dff4]" />

      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center">
        <div>
          <p className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[#3178c6]">
            TypeScript-Go toolchain
          </p>
          <h1 className="bg-gradient-to-br from-[#1f568e] via-[#3178c6] to-[#72afe6] bg-clip-text text-[78px] font-black leading-[0.84] tracking-normal text-transparent sm:text-[112px] md:text-[150px]">
            ttsc
          </h1>

          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-[#405f7a] md:text-2xl">
            Build with TypeScript-Go. Run scripts only after they type-check.
            Let plugins see the same types the compiler sees.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {CLAIMS.map((claim) => (
              <div
                key={claim.value}
                className="rounded-2xl border border-[#c7dff4] bg-white/90 p-5 shadow-[0_14px_40px_rgba(49,120,198,0.10)] backdrop-blur"
              >
                <p className="whitespace-nowrap font-mono text-[26px] font-black leading-none text-[#3178c6] md:text-[30px]">
                  {claim.value}
                </p>
                <p className="mt-3 text-sm font-semibold leading-tight text-[#102a43]">
                  {claim.label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#60778e]">
                  {claim.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/docs"
              className="group rounded-full bg-[#3178c6] px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(49,120,198,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#235a97] hover:shadow-[0_16px_36px_rgba(49,120,198,0.30)]"
            >
              Read the guide
              <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-1">
                -&gt;
              </span>
            </a>
            <a
              href="/playground"
              className="rounded-full border border-[#9fc7eb] bg-white/80 px-7 py-3 text-sm font-semibold text-[#235a97] transition-colors duration-200 hover:border-[#3178c6] hover:bg-[#eaf4ff]"
            >
              Try the Playground
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#b7d4ef] bg-white/95 shadow-[0_32px_90px_rgba(35,90,151,0.20)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-[#d6e8f8] bg-[#f2f8fe] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
            </div>
            <code className="font-mono text-[11px] text-[#6b8297]">
              compiler path
            </code>
          </div>

          <div className="space-y-3 p-4 md:p-5">
            {FLOW.map((item, index) => (
              <div key={item.name} className="grid grid-cols-[28px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#bcd8f0] bg-[#eaf4ff] font-mono text-[11px] font-semibold text-[#3178c6]">
                    {index + 1}
                  </span>
                  {index !== FLOW.length - 1 && (
                    <span className="h-full w-px bg-[#c7dff4]" />
                  )}
                </div>
                <div className="rounded-xl border border-[#d5e6f5] bg-white p-4 shadow-[0_6px_20px_rgba(49,120,198,0.06)]">
                  <code className={`font-mono text-sm font-bold ${item.tone}`}>
                    {item.name}
                  </code>
                  <p className="mt-1 text-sm text-[#526b82]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#c7dff4] bg-[#eaf4ff] p-4 font-mono text-[12px] leading-relaxed">
            <p>
              <span className="text-[#60778e]">src/index.ts:3:7 - </span>
              <span className="text-red-600">error </span>
              <span className="text-[#3178c6]">TS2322</span>
            </p>
            <p className="text-[#526b82]">
              Type errors and lint rules land in the same diagnostic stream.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
