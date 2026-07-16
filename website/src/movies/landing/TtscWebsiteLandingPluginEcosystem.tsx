"use client";

import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";
import TtscWebsiteLandingSectionEyebrow from "./TtscWebsiteLandingSectionEyebrow";

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

export default function TtscWebsiteLandingPluginEcosystem() {
  return (
    <section className="relative overflow-hidden bg-white px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Plugins" />
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-[#102a43] md:text-5xl">
                Plugins get the compiler's eyes.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#526b82]">
                A plugin is not a string replacement pass. It runs beside the
                TypeScript-Go AST and Checker, then reports diagnostics or
                rewrites source before JavaScript is emitted.
              </p>
              <a
                href="/docs/plugins"
                className="mt-8 inline-flex rounded-full border border-[#9fc7eb] bg-white px-6 py-3 text-sm font-semibold text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#eaf4ff]"
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
                  className="group rounded-2xl border border-[#c7dff4] bg-[#f7fbff] p-6 transition-all hover:-translate-y-1 hover:border-[#72afe6] hover:shadow-[0_16px_40px_rgba(49,120,198,0.12)]"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#6b8297]">
                    {plugin.tag}
                  </p>
                  <code className="mt-4 block font-mono text-3xl font-black text-[#235a97] transition-colors group-hover:text-[#3178c6]">
                    {plugin.name}
                  </code>
                  <p className="mt-4 text-sm leading-relaxed text-[#526b82]">
                    {plugin.text}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>

        <TtscWebsiteLandingFadeIn delay={120}>
          <div className="mt-12 border-t border-[#dceaf7] pt-8">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#6b8297]">
              First-party utility plugins
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {UTILITIES.map((utility) => (
                <a
                  key={utility.name}
                  href={utility.href}
                  className="group rounded-xl border border-[#d2e4f4] bg-white p-4 transition-colors hover:border-[#72afe6] hover:bg-[#f7fbff]"
                >
                  <code className="font-mono text-sm font-bold text-[#235a97] transition-colors group-hover:text-[#3178c6]">
                    {utility.name}
                  </code>
                  <p className="mt-2 text-sm leading-relaxed text-[#60778e]">
                    {utility.text}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}
