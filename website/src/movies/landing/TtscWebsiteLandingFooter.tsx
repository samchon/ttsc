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
    <footer className="relative border-t border-[#235a97] bg-[#235a97] px-6 py-16 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <p className="mb-2 font-mono text-base font-bold text-white">
              ttsc
            </p>
            <p className="text-xs leading-relaxed text-blue-100">
              TypeScript-Go compiler, runner, lint, code graph, and plugin host.
            </p>
            <p className="mt-4 font-mono text-[11px] tracking-wider text-blue-200">
              From the author of{" "}
              <a
                href="https://typia.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-colors hover:text-blue-100"
              >
                typia
              </a>{" "}
              and{" "}
              <a
                href="https://nestia.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-colors hover:text-blue-100"
              >
                nestia
              </a>
              .
            </p>
          </div>

          {/* Learn */}
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-blue-200">
              Learn
            </p>
            <ul className="space-y-2.5">
              {LEARN.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    className="text-sm text-blue-100 transition-colors hover:text-white"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Use */}
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-blue-200">
              Use
            </p>
            <ul className="space-y-2.5">
              {USE.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    className="text-sm text-blue-100 transition-colors hover:text-white"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Build */}
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-blue-200">
              Build
            </p>
            <ul className="space-y-2.5">
              {BUILD.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    className="text-sm text-blue-100 transition-colors hover:text-white"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-blue-300/40 pt-8">
          <p className="font-mono text-[11px] tracking-wider text-blue-200">
            MIT 2026 ·{" "}
            <a
              href="https://github.com/samchon"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Jeongho Nam
            </a>
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/samchon/ttsc/blob/master/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-wider text-blue-200 transition-colors hover:text-white"
            >
              MIT
            </a>
            <span className="text-blue-300">·</span>
            <a
              href="https://www.npmjs.com/package/ttsc"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-wider text-blue-200 transition-colors hover:text-white"
            >
              npm
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
