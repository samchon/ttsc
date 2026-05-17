"use client";

import FadeIn from "./FadeIn";
import HeroReveal from "./HeroReveal";
import InstallTabs from "./InstallTabs";

export default function Hero() {
  return (
    <section className="relative px-6 pt-28 md:pt-36 pb-24 md:pb-28 overflow-hidden">
      {/* Cyan glow */}
      <div className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-[radial-gradient(ellipse_at_center,_rgba(54,226,238,0.10)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        <FadeIn>
          <h1 className="font-mono text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-6">
            ttsc
          </h1>
        </FadeIn>

        <FadeIn delay={120}>
          <p className="text-xl md:text-2xl text-neutral-300 font-mono mb-3 leading-tight">
            <code className="text-neutral-400">tsc</code>
            <span className="text-neutral-600"> + </span>
            <code className="text-neutral-400">eslint</code>
            <span className="text-neutral-600"> + </span>
            <code className="text-neutral-400">prettier</code>
            <span className="text-neutral-600"> + </span>
            <code className="text-neutral-400">tsx</code>
            <span className="text-neutral-600"> → </span>
            <code className="text-cyan-300">ttsc</code>
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="text-sm md:text-base text-neutral-500 max-w-2xl mx-auto leading-relaxed mb-6">
            <code className="font-mono text-neutral-300">ttsc</code> runs on{" "}
            <code className="font-mono text-neutral-300">@typescript/native-preview</code>,{" "}
            the TypeScript team's Go port, which is 5–10× faster than the
            legacy JS compiler.
          </p>
        </FadeIn>

        <FadeIn delay={280}>
          <p className="inline-block font-mono text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-cyan-300/80 border border-cyan-300/30 rounded-full px-3 py-1 mb-10">
            [ TYPESCRIPT-GO · 5–10× FASTER ]
          </p>
        </FadeIn>

        <FadeIn delay={360}>
          <HeroReveal />
        </FadeIn>

        <FadeIn delay={440}>
          <div className="mb-8">
            <InstallTabs />
          </div>
        </FadeIn>

        <FadeIn delay={520}>
          <div className="flex flex-wrap justify-center items-center gap-4">
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
              className="text-sm text-neutral-300 underline decoration-neutral-700 hover:decoration-cyan-300 underline-offset-4 transition-colors"
            >
              Try the Playground →
            </a>
            <a
              href="https://github.com/samchon/ttsc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 text-neutral-400 font-medium text-sm rounded-full transition-colors hover:text-white border border-neutral-800 hover:border-neutral-600"
            >
              GitHub
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={640}>
          <div className="mt-20 max-w-3xl mx-auto rounded-2xl overflow-hidden border border-neutral-800/60">
            <img
              src="/og.jpg"
              alt="ttsc — TypeScript-Go toolchain"
              className="w-full block"
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
