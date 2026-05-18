"use client";

import FadeIn from "./FadeIn";
import InstallTabs from "./InstallTabs";

export default function Hero() {
  return (
    <section className="relative px-6 pt-28 md:pt-36 pb-20 md:pb-24 overflow-hidden">
      {/* Cyan glow */}
      <div className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-[radial-gradient(ellipse_at_center,_rgba(54,226,238,0.10)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        <FadeIn>
          <div className="mb-10 max-w-3xl mx-auto rounded-2xl overflow-hidden border border-neutral-800/60">
            <img
              src="/og.jpg"
              alt="ttsc — TypeScript toolchain"
              className="w-full block"
            />
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed mb-4">
            One tool to type-check, lint, format, and run your TypeScript.
          </p>
          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed mb-10">
            Faster than what you have. Same{" "}
            <code className="font-mono text-neutral-200">tsconfig.json</code>.
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mb-10">
            <InstallTabs />
          </div>
        </FadeIn>

        <FadeIn delay={280}>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/docs/setup"
              className="group px-8 py-3 bg-white text-black font-semibold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_60px_rgba(54,226,238,0.35)]"
            >
              Get started
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
            <a
              href="https://github.com/samchon/ttsc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 text-neutral-400 font-medium text-sm rounded-full transition-colors hover:text-white border border-neutral-800 hover:border-neutral-600"
            >
              Star on GitHub
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
