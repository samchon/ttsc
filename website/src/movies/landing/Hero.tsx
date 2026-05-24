"use client";

const CLAIMS = [
  {
    value: "10x",
    label: "faster type checks",
    detail: "Up to 10x faster than JavaScript tsc through TypeScript-Go.",
  },
  {
    value: "1000x",
    label: "faster lint loop",
    detail: "@ttsc/lint uses the same program and checker, no second parse.",
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
    tone: "text-cyan-300",
  },
  {
    name: "ttsx",
    text: "checked script runner",
    tone: "text-emerald-300",
  },
  {
    name: "@ttsc/lint",
    text: "rules as compiler diagnostics",
    tone: "text-amber-300",
  },
  {
    name: "plugins",
    text: "AST + Checker before emit",
    tone: "text-rose-300",
  },
] as const;

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 pb-18 pt-28 md:pb-24 md:pt-36">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-neutral-900" />

      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center">
        <div>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">
            TypeScript-Go toolchain
          </p>
          <h1 className="text-[78px] font-black leading-[0.84] tracking-normal text-white sm:text-[112px] md:text-[150px]">
            ttsc
          </h1>

          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-neutral-300 md:text-2xl">
            Build with TypeScript-Go. Run scripts only after they type-check.
            Let plugins see the same types the compiler sees.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {CLAIMS.map((claim) => (
              <div
                key={claim.value}
                className="rounded-lg border border-neutral-800 bg-neutral-950/85 p-4"
              >
                <p className="whitespace-nowrap font-mono text-[26px] font-black leading-none text-cyan-300 md:text-[30px]">
                  {claim.value}
                </p>
                <p className="mt-3 text-sm font-semibold leading-tight text-white">
                  {claim.label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  {claim.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/docs"
              className="group rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-all duration-300 hover:shadow-[0_0_44px_rgba(54,226,238,0.35)]"
            >
              Read the guide
              <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-1">
                -&gt;
              </span>
            </a>
            <a
              href="/playground"
              className="rounded-full border border-neutral-700 px-7 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-cyan-300/50 hover:bg-neutral-900"
            >
              Try the Playground
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-black/55 shadow-[0_32px_120px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
            </div>
            <code className="font-mono text-[11px] text-neutral-500">
              compiler path
            </code>
          </div>

          <div className="space-y-3 p-4 md:p-5">
            {FLOW.map((item, index) => (
              <div key={item.name} className="grid grid-cols-[28px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 font-mono text-[11px] text-neutral-400">
                    {index + 1}
                  </span>
                  {index !== FLOW.length - 1 && (
                    <span className="h-full w-px bg-neutral-800" />
                  )}
                </div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-4">
                  <code className={`font-mono text-sm font-bold ${item.tone}`}>
                    {item.name}
                  </code>
                  <p className="mt-1 text-sm text-neutral-300">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-800 bg-neutral-950/70 p-4 font-mono text-[12px] leading-relaxed">
            <p>
              <span className="text-neutral-500">src/index.ts:3:7 - </span>
              <span className="text-red-300">error </span>
              <span className="text-cyan-300">TS2322</span>
            </p>
            <p className="text-neutral-400">
              Type errors and lint rules land in the same diagnostic stream.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
