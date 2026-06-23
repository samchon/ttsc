"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const CARDS = [
  {
    name: "ttsc",
    tagline: "Compiler",
    description:
      "Build, check, watch, emit, and run source transforms on top of TypeScript-Go.",
    meta: "build / check / watch",
    href: "/docs/ttsc/compile",
    accent: true,
  },
  {
    name: "ttsx",
    tagline: "Runner",
    description:
      "Execute a TypeScript entrypoint only after the owning project passes type-check.",
    meta: "typed tsx-style scripts",
    href: "/docs/ttsc/execute",
    accent: false,
  },
  {
    name: "@ttsc/lint",
    tagline: "Lint and format",
    description:
      "Report rules as TS diagnostics, apply autofixes, and format through the same compiler pass.",
    meta: "fix / format / TSxxxxx",
    href: "/docs/lint",
    accent: false,
  },
  {
    name: "@ttsc/graph",
    tagline: "Coding agents",
    description:
      "Hand a coding agent a checker-resolved map of your codebase over MCP, so it stops grepping and re-reading files.",
    meta: "MCP code graph",
    href: "/docs/graph",
    accent: false,
  },
] as const;

const STAGES = [
  "read tsconfig",
  "type-check",
  "run plugins",
  "emit, execute, or report",
] as const;

export default function RestOfToolchain() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <FadeIn>
          <SectionEyebrow label="Toolchain" />
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                One compiler path, not a pile of wrappers.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400">
                Keep the existing{" "}
                <code className="font-mono text-neutral-200">
                  tsconfig.json
                </code>
                . The same project graph feeds the CLI, runner, linter, editor,
                bundlers, and plugins.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAGES.map((stage, index) => (
                <div
                  key={stage}
                  className="rounded-lg border border-neutral-800 bg-black/35 p-3"
                >
                  <p className="font-mono text-[11px] text-cyan-300">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-xs font-medium text-neutral-300">
                    {stage}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((card) => (
              <a
                key={card.name}
                href={card.href}
                className="group flex min-h-[230px] flex-col rounded-lg border border-neutral-800 bg-neutral-950 p-5 transition-colors hover:border-cyan-300/45"
                style={
                  card.accent
                    ? { borderColor: "rgba(54, 226, 238, 0.38)" }
                    : undefined
                }
              >
                <code
                  className={`font-mono text-base font-bold ${
                    card.accent ? "text-cyan-300" : "text-white"
                  }`}
                >
                  {card.name}
                </code>
                <p className="mt-3 text-sm font-semibold text-neutral-300">
                  {card.tagline}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  {card.description}
                </p>
                <p className="mt-auto pt-6 font-mono text-[11px] text-neutral-500 group-hover:text-cyan-300">
                  {card.meta}
                </p>
              </a>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
