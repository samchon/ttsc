"use client";

import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";
import TtscWebsiteLandingSectionEyebrow from "./TtscWebsiteLandingSectionEyebrow";

const STEPS = [
  "edit TypeScript",
  "run ttsc.wasm",
  "inspect diagnostics",
  "compare output",
] as const;

export default function TtscWebsiteLandingInTheBrowser() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Playground" />
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                Try the compiler path in the browser.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400">
                The playground boots the WebAssembly build of ttsc in a worker.
                Your source stays in the tab while you test diagnostics,
                transforms, and emitted output.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/playground"
                  className="group rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-all duration-300 hover:shadow-[0_0_44px_rgba(54,226,238,0.35)]"
                >
                  Open the Playground
                  <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-1">
                    -&gt;
                  </span>
                </a>
                <a
                  href="/docs/wasm"
                  className="rounded-full border border-neutral-700 px-7 py-3 text-sm font-semibold text-white transition-colors hover:border-cyan-300/50 hover:bg-neutral-900"
                >
                  Read wasm docs
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-black/45 p-5">
              <div className="grid gap-3">
                {STEPS.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
                  >
                    <span className="font-mono text-[11px] text-cyan-300">
                      0{index + 1}
                    </span>
                    <span className="text-sm font-medium text-neutral-300">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                <p className="font-mono text-[12px] text-neutral-500">
                  globalThis.ttsc.build()
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  Same engine shape as the CLI, packaged for in-tab demos and
                  plugin playgrounds.
                </p>
              </div>
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}
