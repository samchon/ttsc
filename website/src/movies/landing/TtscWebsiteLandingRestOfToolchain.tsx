"use client";

import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";
import TtscWebsiteLandingSectionEyebrow from "./TtscWebsiteLandingSectionEyebrow";

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

export default function TtscWebsiteLandingRestOfToolchain() {
  return (
    <section className="relative overflow-hidden bg-white px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Toolchain" />
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-[#102a43] md:text-5xl">
                One compiler path, not a pile of wrappers.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#526b82]">
                Keep the existing{" "}
                <code className="font-mono font-semibold text-[#235a97]">
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
                  className="rounded-xl border border-[#c7dff4] bg-[#f7fbff] p-3"
                >
                  <p className="font-mono text-[11px] font-bold text-[#3178c6]">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[#405f7a]">
                    {stage}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>

        <TtscWebsiteLandingFadeIn delay={120}>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((card) => (
              <a
                key={card.name}
                href={card.href}
                className="group flex min-h-[230px] flex-col rounded-2xl border border-[#d2e4f4] bg-white p-5 shadow-[0_10px_34px_rgba(49,120,198,0.07)] transition-all hover:-translate-y-1 hover:border-[#72afe6] hover:shadow-[0_18px_44px_rgba(49,120,198,0.14)]"
                style={
                  card.accent
                    ? {
                        borderColor: "rgba(49, 120, 198, 0.55)",
                        background: "linear-gradient(145deg, #ffffff, #eef6ff)",
                      }
                    : undefined
                }
              >
                <code
                  className={`font-mono text-base font-bold ${
                    card.accent ? "text-[#3178c6]" : "text-[#235a97]"
                  }`}
                >
                  {card.name}
                </code>
                <p className="mt-3 text-sm font-semibold text-[#102a43]">
                  {card.tagline}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-[#60778e]">
                  {card.description}
                </p>
                <p className="mt-auto pt-6 font-mono text-[11px] text-[#6b8297] group-hover:text-[#3178c6]">
                  {card.meta}
                </p>
              </a>
            ))}
          </div>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}
