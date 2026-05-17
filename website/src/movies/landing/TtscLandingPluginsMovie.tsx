"use client";

import FadeIn from "./FadeIn";

interface PluginCard {
  name: string;
  tagline: string;
  description: string;
  example: string;
  href: string;
  badge: string;
}

const FIRST_PARTY: PluginCard[] = [
  {
    name: "@ttsc/banner",
    tagline: "JSDoc banners in emit",
    description:
      "Adds @packageDocumentation banners to the top of emitted files. The smallest transform plugin — a great first read.",
    example: `npm install -D @ttsc/banner`,
    href: "/docs/plugins/banner",
    badge: "Transform",
  },
  {
    name: "@ttsc/lint",
    tagline: "Lint as compile errors",
    description:
      "ESLint-style engine with 140 rules, including a Wadler-style format/print-width line reflow. Diagnostics appear in the same stream as type errors.",
    example: `npm install -D @ttsc/lint`,
    href: "/docs/lint",
    badge: "Diagnostics",
  },
  {
    name: "@ttsc/paths",
    tagline: "Resolve tsconfig path aliases",
    description:
      "Rewrites path aliases in JS and declaration emit so consumers get real relative imports without a post-build step.",
    example: `npm install -D @ttsc/paths`,
    href: "/docs/plugins/paths",
    badge: "Transform",
  },
  {
    name: "@ttsc/strip",
    tagline: "Remove debug code from emit",
    description:
      "Strips configured function calls and debugger statements. Pair it with banner for a clean production build.",
    example: `npm install -D @ttsc/strip`,
    href: "/docs/plugins/strip",
    badge: "Transform",
  },
];

const ECOSYSTEM = [
  {
    name: "typia",
    tagline: "Validators · JSON · LLM tools · Protobuf",
    href: "https://typia.io",
  },
  {
    name: "nestia",
    tagline: "NestJS routes · OpenAPI · SDKs · E2E",
    href: "https://nestia.io",
  },
];

const BUNDLERS = [
  "Vite",
  "Rollup",
  "Rolldown",
  "esbuild",
  "Webpack",
  "Rspack",
  "Next.js",
  "Farm",
  "Bun",
];

export default function TtscLandingPluginsMovie() {
  return (
    <section className="relative py-32 px-6 bg-neutral-950">
      <div className="relative max-w-6xl mx-auto">
        <FadeIn className="max-w-2xl mb-16">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-neutral-600 mb-5">
            Plugin host
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            Plugins ship Go.
            <br />
            <span className="text-neutral-500">You ship TypeScript.</span>
          </h2>
          <p className="text-base text-neutral-500 leading-relaxed">
            Plugin descriptors live in JS so you{`’`}re using ttsc with{" "}
            <code className="font-mono text-neutral-300">npm install</code>. The
            transform logic itself is Go — sharing TypeScript-Go{`’`}s AST and
            Checker — so it stays fast.
          </p>
          <p className="text-sm text-neutral-400 mt-5">
            <a
              href="/docs/development"
              className="underline decoration-neutral-700 underline-offset-4 hover:text-white hover:decoration-white transition-colors"
            >
              Write your own plugin →
            </a>
          </p>
        </FadeIn>

        {/* First-party plugins */}
        <FadeIn delay={120}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
            {FIRST_PARTY.map((plugin) => (
              <a
                key={plugin.name}
                href={plugin.href}
                className="group flex flex-col rounded-2xl border border-neutral-800/60 p-7 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <code className="font-mono text-base font-semibold text-white">
                    {plugin.name}
                  </code>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 px-2 py-0.5 rounded-full border border-neutral-800/80">
                    {plugin.badge}
                  </span>
                </div>
                <p className="text-sm text-neutral-300 mb-3 font-medium">
                  {plugin.tagline}
                </p>
                <p className="text-xs text-neutral-500 leading-relaxed mb-5">
                  {plugin.description}
                </p>
                <code className="font-mono text-[11px] text-neutral-400 bg-black/40 border border-neutral-900 rounded-lg px-3 py-2 mt-auto">
                  {plugin.example}
                </code>
              </a>
            ))}
          </div>
        </FadeIn>

        {/* Ecosystem row */}
        <FadeIn delay={200}>
          <div className="rounded-2xl border border-neutral-800/60 p-7 mb-12 bg-gradient-to-br from-neutral-900/50 to-neutral-950">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-neutral-600 mb-2">
                  Ecosystem plugins
                </p>
                <p className="text-sm text-neutral-300 max-w-md">
                  Already shipping on ttsc. PRs welcome to extend the list.
                </p>
              </div>
              <div className="flex gap-6">
                {ECOSYSTEM.map((p) => (
                  <a
                    key={p.name}
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col"
                  >
                    <span className="font-mono text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      {p.name} →
                    </span>
                    <span className="text-xs text-neutral-500 mt-1">
                      {p.tagline}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Bundler row */}
        <FadeIn delay={280}>
          <div className="rounded-2xl border border-neutral-800/60 p-7">
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div className="max-w-sm">
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-neutral-600 mb-2">
                  @ttsc/unplugin
                </p>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Plugins run in your bundler too.
                </h3>
                <p className="text-sm text-neutral-500">
                  Same plugin contract, embedded inside the bundlers you{`’`}re
                  already using.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 max-w-md">
                {BUNDLERS.map((b) => (
                  <span
                    key={b}
                    className="px-3 py-1.5 text-xs font-mono text-neutral-400 rounded-full border border-neutral-800 bg-neutral-950"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
