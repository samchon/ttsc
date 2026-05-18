"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

export default function InTheBrowser() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-neutral-950 overflow-hidden">
      <div className="absolute top-1/2 left-[-200px] -translate-y-1/2 w-[600px] h-[500px] bg-[radial-gradient(ellipse_at_center,_rgba(54,226,238,0.06)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
        <FadeIn>
          <SectionEyebrow label="Playground" />
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            Try it without installing.
          </h2>
          <p className="text-base text-neutral-400 max-w-2xl leading-relaxed mb-12">
            The real compiler runs in your browser. Same errors as the
            CLI. Nothing leaves the tab.
          </p>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950 p-8 md:p-12 text-center">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-500 mb-4">
              Playground
            </p>
            <p className="text-xl md:text-2xl text-neutral-300 mb-2 font-medium">
              The same <code className="font-mono text-cyan-300">ttsc</code>, in your browser.
            </p>
            <p className="text-sm text-neutral-500 mb-8">
              Powered by WebAssembly. Your source stays on your machine.
            </p>
            <a
              href="/playground"
              className="group inline-flex items-center gap-2 px-8 py-3 bg-white text-black font-semibold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_60px_rgba(54,226,238,0.35)]"
            >
              Open the Playground
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mt-8 text-xs text-neutral-600 text-center max-w-2xl mx-auto leading-relaxed">
            Plugin authors can ship their own playground via{" "}
            <a
              href="/docs/wasm"
              className="text-neutral-400 underline decoration-neutral-700 hover:decoration-cyan-300 underline-offset-2 transition-colors"
            >
              <code className="font-mono">@ttsc/wasm</code>
            </a>
            .
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
