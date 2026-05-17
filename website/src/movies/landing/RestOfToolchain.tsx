"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const CARDS = [
  {
    name: "ttsx",
    tagline: "Typed TypeScript runner",
    description:
      "Like tsx, but it actually type-checks before it runs. Errors stop execution. Plugins apply. Drop-in for tsx / ts-node.",
    example: "npx ttsx src/index.ts",
    href: "/docs/ttsc/execute",
  },
  {
    name: "@ttsc/vscode",
    tagline: "Live diagnostics in your editor",
    description:
      "Lint underlines, format hints, and plugin code actions as you type. Same error TSxxxxx shape your build emits.",
    example: "npx ttsc-vscode",
    href: "/docs/setup#editor-vs-code",
  },
  {
    name: "@ttsc/unplugin",
    tagline: "Bundler-side plugin pass",
    description:
      "Same plugin pass inside Vite, Rollup, esbuild, Webpack, Rspack, Next.js, Farm, Bun, and more. One contract, nine adapters.",
    example: 'import ttsc from "@ttsc/unplugin/vite";',
    href: "/docs/ttsc/bundler",
  },
];

export default function RestOfToolchain() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-neutral-950 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        <FadeIn>
          <SectionEyebrow num="05" label="The rest of the toolchain" />
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            One contract.{" "}
            <span className="text-neutral-500">Every surface you build on.</span>
          </h2>
          <p className="text-base text-neutral-400 max-w-2xl leading-relaxed mb-12">
            Three more surfaces share the same plugin contract as{" "}
            <code className="font-mono text-neutral-200">ttsc</code>. Install,
            point at your <code className="font-mono text-neutral-200">tsconfig.json</code>,
            and they each see the same compile pass.
          </p>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CARDS.map((c) => (
              <a
                key={c.name}
                href={c.href}
                className="group flex flex-col rounded-2xl border border-neutral-800/80 p-6 hover:border-cyan-300/40 transition-colors bg-neutral-950"
              >
                <code className="font-mono text-lg font-bold text-white mb-2">
                  {c.name}
                </code>
                <p className="text-sm text-neutral-300 font-medium mb-3">
                  {c.tagline}
                </p>
                <p className="text-xs text-neutral-500 leading-relaxed mb-5">
                  {c.description}
                </p>
                <code className="block font-mono text-[11px] text-neutral-400 bg-black/40 border border-neutral-900 rounded-lg px-3 py-2 mt-auto overflow-x-auto whitespace-nowrap">
                  {c.example}
                </code>
                <span className="mt-4 text-[11px] text-neutral-500 group-hover:text-cyan-300 transition-colors">
                  Read more →
                </span>
              </a>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
