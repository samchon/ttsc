"use client";

const LEARN = [
  { name: "Introduction", href: "/docs" },
  { name: "Setup", href: "/docs/setup" },
  { name: "FAQ", href: "/docs/faq" },
];

const USE = [
  { name: "Compiler (ttsc)", href: "/docs/ttsc/compile" },
  { name: "Runner (ttsx)", href: "/docs/ttsc/execute" },
  { name: "Lint & Prettier", href: "/docs/lint" },
  { name: "Code Graph (MCP)", href: "/docs/graph" },
  { name: "Plugin Ecosystem", href: "/docs/plugins" },
  { name: "Playground", href: "/playground" },
];

const BUILD = [
  { name: "Plugin Development", href: "/docs/development" },
  { name: "Wasm Module", href: "/docs/wasm" },
  { name: "GitHub", href: "https://github.com/samchon/ttsc" },
  { name: "Discord", href: "https://discord.gg/E94XhzrUCZ" },
];

export default function TtscWebsiteLandingFooter() {
  return (
    <footer className="relative border-t border-neutral-900 bg-neutral-950 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <p className="font-mono text-base font-bold text-white mb-2">
              ttsc
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              TypeScript-Go compiler, runner, lint, code graph, and plugin host.
            </p>
            <p className="text-[11px] text-neutral-600 mt-4 font-mono tracking-wider">
              From the author of{" "}
              <a
                href="https://typia.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-500 hover:text-cyan-300 transition-colors"
              >
                typia
              </a>{" "}
              and{" "}
              <a
                href="https://nestia.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-500 hover:text-cyan-300 transition-colors"
              >
                nestia
              </a>
              .
            </p>
          </div>

          {/* Learn */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-600 mb-4">
              Learn
            </p>
            <ul className="space-y-2.5">
              {LEARN.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Use */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-600 mb-4">
              Use
            </p>
            <ul className="space-y-2.5">
              {USE.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Build */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-600 mb-4">
              Build
            </p>
            <ul className="space-y-2.5">
              {BUILD.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="pt-8 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[11px] text-neutral-600 font-mono tracking-wider">
            MIT 2026 ·{" "}
            <a
              href="https://github.com/samchon"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-300 transition-colors"
            >
              Jeongho Nam
            </a>
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/samchon/ttsc/blob/master/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors font-mono tracking-wider"
            >
              MIT
            </a>
            <span className="text-neutral-800">·</span>
            <a
              href="https://www.npmjs.com/package/ttsc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors font-mono tracking-wider"
            >
              npm
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
