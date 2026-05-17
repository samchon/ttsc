"use client";

import FadeIn from "./FadeIn";

interface Feature {
  num: string;
  title: string;
  subtitle: string;
  description: string;
  footer: string;
  span?: boolean;
}

const FEATURES: Feature[] = [
  {
    num: "01",
    title: "TypeScript-Go speed",
    subtitle: "Real native compiler, no V8 cold-start",
    description:
      "Built directly on @typescript/native-preview. Same emit, same diagnostics, far less time waiting on tsc.",
    footer: "Native binary · Type-check + emit in one pass",
    span: true,
  },
  {
    num: "02",
    title: "Plugins, the compiler way",
    subtitle: "JS descriptor + Go transform · cached binaries",
    description:
      "Plugins ship npm packages with a JS descriptor; the Go transform compiles once and is cached. The compiler, runtime, and LSP all see the same plugin.",
    footer: "tsgo AST · Checker · cached toolchain",
    span: true,
  },
  {
    num: "03",
    title: "ttsx — typed execution",
    subtitle: "Real type-check before run",
    description:
      "Replaces tsx / ts-node with native execution that actually fails on type errors. Preload modules with --require, same as Node.",
    footer: "tsx ergonomics · ts-node correctness",
  },
  {
    num: "04",
    title: "@ttsc/lint",
    subtitle: "Lint violations as compile errors",
    description:
      "140 rules including a Wadler-style format/print-width that reflows objects, arrays, and call sites. ttsc fix writes the corrections back.",
    footer: "ESLint feel · Prettier reflow · 1 pass",
  },
  {
    num: "05",
    title: "Editor-aware via ttscserver",
    subtitle: "Plugin diagnostics in your editor",
    description:
      "ttscserver embeds TypeScript-Go's LSP and proxies plugin diagnostics, code actions, and commands. Build the VSCode extension from packages/vscode-ttsc — Marketplace tracked for v1.",
    footer: "LSP host · Plugin code actions",
  },
  {
    num: "06",
    title: "Bundler-ready with unplugin",
    subtitle: "Vite · Webpack · Rollup · esbuild · 9 more",
    description:
      "When the bundler owns your build, @ttsc/unplugin runs the same plugin pass inside it. No custom integrations to maintain.",
    footer: "9 bundler adapters · unplugin protocol",
  },
];

export default function TtscLandingFeaturesMovie() {
  return (
    <section className="relative py-32 px-6 bg-neutral-950">
      <div className="absolute top-1/3 right-0 w-[500px] h-[800px] bg-[radial-gradient(ellipse_at_right,_rgba(96,165,250,0.04)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <FadeIn className="max-w-2xl mb-16">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-neutral-600 mb-5">
            What you get
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            One toolchain
            <br />
            <span className="text-neutral-500">across build, run, and edit.</span>
          </h2>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={`group rounded-2xl border border-neutral-800/50 transition-all duration-300 hover:border-neutral-700/60 p-7 ${
                  feature.span ? "lg:col-span-2" : ""
                }`}
              >
                <div className="text-[10px] font-mono text-neutral-700 mb-4">
                  {feature.num}
                </div>
                <h3 className="text-base font-semibold mb-2 text-white">
                  {feature.title}
                </h3>
                <p className="text-xs text-neutral-400 mb-3">{feature.subtitle}</p>
                <p className="text-xs text-neutral-500 leading-relaxed mb-5">
                  {feature.description}
                </p>
                <p className="text-[11px] text-neutral-700 font-mono">
                  {feature.footer}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
