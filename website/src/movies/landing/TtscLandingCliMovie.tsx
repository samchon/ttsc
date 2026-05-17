"use client";

import FadeIn from "./FadeIn";

interface CliCard {
  command: string;
  tagline: string;
  description: string;
  example: string;
  bullets: string[];
  href: string;
}

const CLIS: CliCard[] = [
  {
    command: "ttsc",
    tagline: "Build · Check · Transform",
    description:
      "Built on @typescript/native-preview, with a plugin host that runs typia, lint, and friends in the same pass. Same tsconfig.json you already have.",
    example: "npx ttsc --watch",
    bullets: [
      "Native TypeScript-Go speed",
      "Plugin-powered emit",
      "fix / format subcommands",
    ],
    href: "/docs/ttsc/compile",
  },
  {
    command: "ttsx",
    tagline: "Run TypeScript, typed.",
    description:
      "Like tsx, but it actually type-checks before it runs. Real diagnostics, real failures, no transpile-only surprises.",
    example: "npx ttsx src/index.ts",
    bullets: [
      "Real type-check on every run",
      "Plugin transforms applied first",
      "Preload modules with --require",
    ],
    href: "/docs/ttsc/execute",
  },
];

export default function TtscLandingCliMovie() {
  return (
    <section className="relative py-32 px-6 bg-neutral-950">
      <div className="relative max-w-6xl mx-auto">
        <FadeIn className="max-w-2xl mb-16">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-neutral-600 mb-5">
            Two CLIs · one toolchain
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            Build it
            <br />
            <span className="text-neutral-500">and run it.</span>
          </h2>
          <p className="text-base text-neutral-500 leading-relaxed">
            Same plugin contract across the entire toolchain — what your build
            sees, your runtime sees.
          </p>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CLIS.map((cli) => (
              <a
                key={cli.command}
                href={cli.href}
                className="group flex flex-col rounded-2xl border border-neutral-800/60 p-7 hover:border-neutral-700 transition-colors bg-neutral-950"
              >
                <div className="flex items-center gap-3 mb-4">
                  <code className="font-mono text-xl font-bold text-white">
                    {cli.command}
                  </code>
                  <span className="text-[10px] font-mono text-neutral-600 tracking-wider uppercase">
                    cli
                  </span>
                </div>
                <p className="text-sm text-neutral-300 font-medium mb-3">
                  {cli.tagline}
                </p>
                <p className="text-sm text-neutral-500 leading-relaxed mb-5">
                  {cli.description}
                </p>
                <div className="rounded-lg bg-black/60 border border-neutral-900 px-4 py-2.5 mb-5">
                  <code className="font-mono text-[12px] text-neutral-300">
                    {cli.example}
                  </code>
                </div>
                <ul className="text-[12px] text-neutral-500 space-y-1.5 mb-5">
                  {cli.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <span className="mt-auto text-[12px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                  Read the guide →
                </span>
              </a>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
