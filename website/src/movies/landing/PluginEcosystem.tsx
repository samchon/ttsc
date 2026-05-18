"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const ECOSYSTEM = [
  {
    name: "typia",
    tag: "runtime code from types",
    text: "Validators, JSON serializers, LLM tools, and Protobuf codecs generated before runtime.",
    href: "https://typia.io",
  },
  {
    name: "nestia",
    tag: "backend contracts",
    text: "NestJS routes, OpenAPI documents, SDKs, and E2E scaffolding backed by typia.",
    href: "https://nestia.io",
  },
] as const;

const UTILITIES = [
  {
    name: "@ttsc/banner",
    text: "Attach a package JSDoc banner to emitted files.",
    href: "/docs/plugins/banner",
  },
  {
    name: "@ttsc/paths",
    text: "Rewrite path aliases into relative JS and declaration imports.",
    href: "/docs/plugins/paths",
  },
  {
    name: "@ttsc/strip",
    text: "Remove debug calls and debugger statements before emit.",
    href: "/docs/plugins/strip",
  },
] as const;

export default function PluginEcosystem() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <FadeIn>
          <SectionEyebrow label="Plugins" />
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                Plugins get the compiler's eyes.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400">
                A plugin is not a string replacement pass. It runs beside the
                TypeScript-Go AST and Checker, then reports diagnostics or
                rewrites source before JavaScript is emitted.
              </p>
              <a
                href="/docs/plugins"
                className="mt-8 inline-flex rounded-full border border-neutral-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-cyan-300/50 hover:bg-neutral-900"
              >
                Explore plugins
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {ECOSYSTEM.map((plugin) => (
                <a
                  key={plugin.name}
                  href={plugin.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg border border-neutral-800 bg-neutral-950 p-6 transition-colors hover:border-cyan-300/45"
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                    {plugin.tag}
                  </p>
                  <code className="mt-4 block font-mono text-3xl font-black text-white transition-colors group-hover:text-cyan-300">
                    {plugin.name}
                  </code>
                  <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                    {plugin.text}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mt-12 border-t border-neutral-900 pt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-600">
              First-party utility plugins
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {UTILITIES.map((utility) => (
                <a
                  key={utility.name}
                  href={utility.href}
                  className="group rounded-lg border border-neutral-800 bg-black/30 p-4 transition-colors hover:border-cyan-300/45"
                >
                  <code className="font-mono text-sm font-bold text-neutral-200 transition-colors group-hover:text-cyan-300">
                    {utility.name}
                  </code>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                    {utility.text}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
