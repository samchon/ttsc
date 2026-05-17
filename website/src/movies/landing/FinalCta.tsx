"use client";

import FadeIn from "./FadeIn";

export default function FinalCta() {
  return (
    <section className="relative py-32 md:py-40 px-6 text-center bg-neutral-950 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] bg-[radial-gradient(ellipse_at_center,_rgba(54,226,238,0.08)_0%,_transparent_70%)] pointer-events-none" />

      <FadeIn>
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-5">
            <code className="font-mono text-cyan-300">$</code> npx ttsc
          </h2>
          <p className="text-base text-neutral-500 mb-12">
            One install. Five minutes. Same{" "}
            <code className="font-mono text-neutral-300">tsconfig.json</code>{" "}
            you already have.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/playground"
              className="group px-8 py-3 bg-white text-black font-semibold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_60px_rgba(54,226,238,0.35)]"
            >
              Try the Playground
              <span className="inline-block ml-1.5 transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </a>
            <a
              href="/docs"
              className="px-8 py-3 text-white font-semibold text-sm rounded-full transition-all duration-200 border border-neutral-700 hover:border-cyan-300/40 hover:bg-neutral-900"
            >
              Read the docs
            </a>
            <a
              href="https://github.com/samchon/ttsc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 text-neutral-400 font-medium text-sm rounded-full transition-colors hover:text-white border border-neutral-800 hover:border-neutral-600"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
