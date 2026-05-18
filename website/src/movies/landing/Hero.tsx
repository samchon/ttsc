"use client";

const CLAIMS = [
  {
    value: "10x",
    label: "faster build/check",
    detail: "ttsc runs on the TypeScript-Go compiler path.",
  },
  {
    value: "type-safe",
    label: "execution",
    detail: "ttsx checks first; tsx-style runners do not.",
  },
  {
    value: "20x",
    label: "faster lint",
    detail: "@ttsc/lint shares the compiler pass.",
  },
] as const;

export default function Hero() {
  return (
    <section className="relative px-6 pt-28 md:pt-36 pb-16 md:pb-20 overflow-hidden">
      {/* Cyan glow */}
      <div className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-[radial-gradient(ellipse_at_center,_rgba(54,226,238,0.10)_0%,_transparent_70%)] pointer-events-none" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="mb-7 font-mono text-[11px] tracking-[0.28em] uppercase text-cyan-300">
          TypeScript-Go toolchain
        </div>
        <h1 className="text-[82px] leading-[0.82] md:text-[150px] lg:text-[190px] font-black tracking-normal text-white">
          ttsc
        </h1>

        <p className="text-xl md:text-2xl text-neutral-300 max-w-3xl mx-auto leading-relaxed mt-8 mb-8">
          A TypeScript-Go host for checked execution, compiler diagnostics, and
          type-aware plugins.
        </p>

        <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-4xl mx-auto mb-8 md:mb-9 text-left">
          {CLAIMS.map((claim) => (
            <div
              key={claim.value}
              className="rounded-2xl border border-neutral-800/80 bg-neutral-950/80 p-3 md:p-5 shadow-[0_0_60px_rgba(54,226,238,0.05)]"
            >
              <p className="font-mono text-2xl md:text-5xl font-black text-cyan-300 leading-none">
                {claim.value}
              </p>
              <p className="mt-2 text-[11px] md:text-sm font-semibold text-white leading-tight">
                {claim.label}
              </p>
              <p className="hidden md:block mt-3 text-xs leading-relaxed text-neutral-500">
                {claim.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="/docs"
            className="group px-8 py-3 bg-white text-black font-semibold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_60px_rgba(54,226,238,0.35)]"
          >
            Read the guide
            <span className="inline-block ml-1.5 transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </a>
          <a
            href="/playground"
            className="px-8 py-3 text-white font-semibold text-sm rounded-full transition-all duration-200 border border-neutral-700 hover:border-cyan-300/40 hover:bg-neutral-900"
          >
            Try the Playground
          </a>
        </div>
      </div>
    </section>
  );
}
