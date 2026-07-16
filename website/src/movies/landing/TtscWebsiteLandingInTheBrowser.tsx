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
    <section className="relative overflow-hidden bg-[#eaf4ff] px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Playground" />
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-[#102a43] md:text-5xl">
                Try the compiler path in the browser.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#526b82]">
                The playground boots the WebAssembly build of ttsc in a worker.
                Your source stays in the tab while you test diagnostics,
                transforms, and emitted output.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/playground"
                  className="group rounded-full bg-[#3178c6] px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(49,120,198,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#235a97]"
                >
                  Open the Playground
                  <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-1">
                    -&gt;
                  </span>
                </a>
                <a
                  href="/docs/wasm"
                  className="rounded-full border border-[#9fc7eb] bg-white px-7 py-3 text-sm font-semibold text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#f7fbff]"
                >
                  Read wasm docs
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-[#a9cdec] bg-white p-5 shadow-[0_22px_58px_rgba(49,120,198,0.14)]">
              <div className="grid gap-3">
                {STEPS.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center justify-between rounded-xl border border-[#d2e4f4] bg-[#f7fbff] px-4 py-3"
                  >
                    <span className="font-mono text-xs font-bold text-[#3178c6]">
                      0{index + 1}
                    </span>
                    <span className="text-sm font-medium text-[#405f7a]">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-[#235a97] bg-[#102a43] p-4">
                <p className="font-mono text-[13px] text-sky-300">
                  globalThis.ttsc.build()
                </p>
                <p className="mt-2 text-sm text-blue-50">
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
