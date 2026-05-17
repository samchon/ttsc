"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const MIGRATION = [
  "Install ttsc, @ttsc/lint, @typescript/native-preview.",
  "Drop a lint.config.ts next to your tsconfig.json with the rules + format block you want.",
  "Run npx ttsc fix once to apply all autofixes.",
  "Commit, then delete .eslintrc.* and .prettierrc.* and remove their devDependencies.",
];

const LIMITS = [
  {
    title: "Some ESLint plugins not yet ported",
    body:
      "eslint-plugin-react-hooks, eslint-plugin-import, eslint-plugin-jsx-a11y, and other plugin-shipped rule packages aren't covered yet. Keep ESLint installed alongside ttsc if you depend on them.",
  },
  {
    title: "Prettier ecosystem plugins not supported",
    body:
      "prettier-plugin-svelte, prettier-plugin-tailwindcss, and other Prettier-specific plugins won't work with @ttsc/lint's formatter.",
  },
  {
    title: "VS Code extension is npm-only",
    body:
      "@ttsc/vscode ships as npm install -D @ttsc/vscode && npx ttsc-vscode. Marketplace release is tracked for v1.",
  },
  {
    title: "v1 is still moving",
    body:
      "If you publish a library, treat ttsc as a build-time devDependency. Do not list ttsc as a peer dependency yet.",
  },
];

const PKG_BEFORE = `{
  "devDependencies": {
    "tsc": "^5.6.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "prettier": "^3.0.0",
    "tsx": "^4.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}`;

const PKG_AFTER = `{
  "devDependencies": {
    "ttsc": "^0.11.0",
    "@ttsc/lint": "^0.11.0",
    "@ttsc/vscode": "^0.11.0",
    "@typescript/native-preview": "*"
  }
}`;

export default function Switching() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-neutral-950 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        <FadeIn>
          <SectionEyebrow num="07" label="Switching" />
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            Switching from{" "}
            <code className="font-mono text-neutral-500">tsc + eslint + prettier</code>
          </h2>
          <p className="text-base text-neutral-400 max-w-3xl leading-relaxed mb-3">
            What you keep, what you change, what we don't do yet.
          </p>
          <p className="text-sm text-neutral-500 max-w-3xl leading-relaxed mb-12">
            <code className="font-mono text-neutral-400">ttsc</code> is built on{" "}
            <code className="font-mono text-neutral-400">@typescript/native-preview</code>{" "}
            (the TypeScript team's Go port, sometimes called{" "}
            <code className="font-mono text-neutral-400">tsgo</code>). It is a
            separate binary that adds lint, format, and a plugin model
            around it.
          </p>
        </FadeIn>

        {/* 2-column: migration + limits */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <FadeIn delay={120}>
            <div className="rounded-2xl border border-neutral-800/80 p-7 bg-neutral-950 h-full">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-cyan-300/70 mb-5">
                The migration recipe
              </p>
              <ol className="space-y-4">
                {MIGRATION.map((m, i) => (
                  <li key={i} className="flex gap-3 text-sm text-neutral-300 leading-relaxed">
                    <span className="font-mono text-cyan-300/60 w-5 shrink-0">
                      {i + 1}.
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ol>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="rounded-2xl border border-neutral-800/80 p-7 bg-neutral-950 h-full">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-500 mb-5">
                What we don't do (yet)
              </p>
              <ul className="space-y-4">
                {LIMITS.map((l) => (
                  <li key={l.title} className="text-sm leading-relaxed">
                    <p className="text-neutral-200 font-medium mb-1">{l.title}</p>
                    <p className="text-xs text-neutral-500">{l.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>

        {/* package.json before / after */}
        <FadeIn delay={280}>
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950 overflow-hidden">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-500 px-6 pt-5">
              package.json — before / after
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-neutral-800/80 mt-4">
              <div className="bg-neutral-950 p-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 mb-3">
                  Before
                </p>
                <pre className="font-mono text-[11px] md:text-[12px] text-neutral-400 leading-[1.6] overflow-x-auto">
{PKG_BEFORE}
                </pre>
              </div>
              <div className="bg-neutral-950 p-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/70 mb-3">
                  After
                </p>
                <pre className="font-mono text-[11px] md:text-[12px] text-neutral-200 leading-[1.6] overflow-x-auto">
{PKG_AFTER}
                </pre>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
