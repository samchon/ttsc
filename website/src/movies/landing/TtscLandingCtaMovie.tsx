"use client";

import FadeIn from "./FadeIn";

export default function TtscLandingCtaMovie() {
  return (
    <section className="relative py-40 px-6 text-center bg-neutral-950 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-[radial-gradient(ellipse_at_center,_rgba(96,165,250,0.06)_0%,_transparent_70%)] pointer-events-none" />
      <FadeIn>
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-5">
            Build it today.
          </h2>
          <p className="text-base text-neutral-500 mb-12">
            <code className="font-mono text-neutral-300">npm install -D ttsc @ttsc/lint @typescript/native-preview</code>
            <br />
            That{`’`}s it. Setup is one page.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/docs/setup"
              className="group px-8 py-3 bg-white text-black font-semibold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.18)]"
            >
              Get started
              <span className="inline-block ml-1.5 transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </a>
            <a
              href="/docs"
              className="px-8 py-3 text-white font-semibold text-sm rounded-full transition-all duration-200 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900"
            >
              Read the guide
            </a>
            <a
              href="https://github.com/samchon/ttsc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 text-neutral-400 font-medium text-sm rounded-full transition-all duration-200 hover:text-white border border-neutral-800 hover:border-neutral-600"
            >
              GitHub
            </a>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
