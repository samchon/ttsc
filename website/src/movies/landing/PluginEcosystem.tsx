"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const ECOSYSTEM = [
  {
    name: "typia",
    tagline: "Runtime validators · JSON tools · LLM tooling · Protobuf — generated from your TypeScript types.",
    href: "https://typia.io",
  },
  {
    name: "nestia",
    tagline: "NestJS routes · OpenAPI documents · SDK generation · E2E test scaffolding, backed by typia.",
    href: "https://nestia.io",
  },
];

const UTILITY = [
  { name: "@ttsc/banner", what: "JSDoc `@packageDocumentation` banner on every emit." },
  { name: "@ttsc/paths", what: "Rewrites `compilerOptions.paths` aliases into relative imports." },
  { name: "@ttsc/strip", what: "Strips `console.log`, `debugger`, configured calls from emit." },
];

export default function PluginEcosystem() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-neutral-950 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        <FadeIn>
          <SectionEyebrow num="04" label="Plugin ecosystem" />
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            npm-installed plugins.{" "}
            <span className="text-neutral-500">Same compile pass.</span>
          </h2>
          <p className="text-base text-neutral-400 max-w-2xl leading-relaxed mb-12">
            Plugins are npm packages that run inside every{" "}
            <code className="font-mono text-neutral-200">ttsc</code>{" "}
            build, every <code className="font-mono text-neutral-200">ttsx</code>{" "}
            run, and the VS Code extension. Diagnostics flow through the
            same stream as type errors.
          </p>
        </FadeIn>

        {/* Ecosystem (third-party) */}
        <FadeIn delay={120}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {ECOSYSTEM.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-neutral-800/80 p-7 hover:border-cyan-300/40 transition-colors bg-neutral-950"
              >
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-600 mb-3">
                  Third-party
                </p>
                <code className="block font-mono text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors mb-3">
                  {p.name} →
                </code>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {p.tagline}
                </p>
              </a>
            ))}
          </div>
        </FadeIn>

        {/* First-party utility plugins */}
        <FadeIn delay={200}>
          <div className="rounded-2xl border border-neutral-800/80 p-7 bg-neutral-950/70">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-500 mb-5">
              First-party utility plugins
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {UTILITY.map((u) => (
                <a
                  key={u.name}
                  href={`/docs/plugins/${u.name.replace("@ttsc/", "")}`}
                  className="group flex flex-col gap-1.5 rounded-xl px-3 py-2 hover:bg-neutral-900/60 transition-colors"
                >
                  <code className="font-mono text-sm text-neutral-200 group-hover:text-cyan-300 transition-colors">
                    {u.name}
                  </code>
                  <span className="text-xs text-neutral-500 leading-snug">
                    {u.what}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
