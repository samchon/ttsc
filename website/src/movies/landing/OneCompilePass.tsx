"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const SURFACES = [
  { name: "ttsc", role: "Build · check · watch · fix · format", hue: "cyan" },
  { name: "ttsx", role: "Run a TS entrypoint after a real type-check" },
  { name: "@ttsc/vscode", role: "Live diagnostics in your editor" },
  { name: "@ttsc/unplugin", role: "Same plugin pass inside any bundler" },
];

const STEPS = [
  { n: "1", text: "Read tsconfig.json." },
  { n: "2", text: "Type-check the project." },
  { n: "3", text: "Run every configured plugin, in order." },
  { n: "4", text: "Emit JS + .d.ts (or skip with --noEmit)." },
];

export default function OneCompilePass() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-neutral-950 overflow-hidden">
      <div className="absolute top-1/3 right-[-200px] w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,_rgba(54,226,238,0.05)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
        <FadeIn>
          <SectionEyebrow num="03" label="One compile pass" />
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            One pass over your project.{" "}
            <span className="text-neutral-500">Every surface sees it.</span>
          </h2>
          <p className="text-base text-neutral-400 max-w-2xl leading-relaxed mb-12">
            One <code className="font-mono text-neutral-200">tsconfig.json</code>, one
            type-check, one plugin pass. Four delivery surfaces read from
            the same source of truth, so what your build sees, your
            runtime sees, your editor sees, and your bundler sees.
          </p>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 md:gap-12 items-center">
            {/* Left: numbered steps */}
            <div className="rounded-2xl border border-neutral-800/80 p-7 bg-neutral-950">
              <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-neutral-500 mb-5">
                tsconfig.json
              </p>
              <ol className="space-y-3">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex gap-3 text-sm text-neutral-300">
                    <span className="font-mono text-cyan-300/70 w-5 shrink-0">
                      {s.n}.
                    </span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center text-3xl text-neutral-700 font-mono">
              →
            </div>

            {/* Right: surfaces */}
            <div className="space-y-3">
              {SURFACES.map((s) => (
                <div
                  key={s.name}
                  className="rounded-xl border border-neutral-800/80 px-4 py-3 bg-neutral-950 flex items-baseline gap-3"
                  style={
                    s.hue === "cyan"
                      ? { borderColor: "rgba(54, 226, 238, 0.35)" }
                      : undefined
                  }
                >
                  <code
                    className={`font-mono text-sm font-semibold ${
                      s.hue === "cyan" ? "text-cyan-300" : "text-neutral-200"
                    }`}
                  >
                    {s.name}
                  </code>
                  <span className="text-xs text-neutral-500 leading-snug">
                    {s.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
