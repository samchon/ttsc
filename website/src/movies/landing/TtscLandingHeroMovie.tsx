"use client";

import { useEffect, useState } from "react";

import FadeIn from "./FadeIn";

const TERMINAL_LINES: Array<{
  prompt?: string;
  text: string;
  color?: string;
}> = [
  { prompt: "$", text: "npm install -D ttsc @typescript/native-preview" },
  { text: "  added 4 packages in 1.4s", color: "text-neutral-500" },
  { prompt: "$", text: "npx ttsx src/index.ts" },
  { text: "  ✓ type-checked  src/index.ts", color: "text-emerald-400" },
  { text: "  hello from typescript-go", color: "text-neutral-300" },
  { prompt: "$", text: "npx ttsc --watch" },
  {
    text: "  ✓ build succeeded · 0 errors · 12 files",
    color: "text-emerald-400",
  },
  {
    text: "  ✓ @ttsc/lint: 0 violations across 12 files",
    color: "text-emerald-400",
  },
  { text: "  watching for changes…", color: "text-neutral-500" },
];

export default function TtscLandingHeroMovie() {
  return (
    <section className="relative px-6 pt-36 pb-32 overflow-hidden">
      {/* Radial glow */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1400px] h-[800px] bg-[radial-gradient(ellipse_at_center,_rgba(96,165,250,0.10)_0%,_transparent_70%)] pointer-events-none" />
      <div className="absolute top-[200px] right-[-200px] w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.06)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-neutral-500 mb-8">
            TypeScript-Go · Compiler · Plugin Host
          </p>
        </FadeIn>

        <FadeIn delay={80}>
          <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-[-0.04em] leading-[1] mb-8 text-white">
            Compile-powered{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-neutral-400">
              TypeScript
            </span>
            <br />
            without the wait.
          </h1>
        </FadeIn>

        <FadeIn delay={180}>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed mb-12">
            <code className="font-mono text-neutral-200">ttsc</code> is a standalone toolchain on{" "}
            <a
              href="https://github.com/microsoft/typescript-go"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-200 underline decoration-neutral-700 hover:decoration-neutral-300 underline-offset-4"
            >
              TypeScript-Go
            </a>{" "}
            with first-class plugins, type-safe execution, and a lint engine that
            speaks <em>compile error</em>.
          </p>
        </FadeIn>

        <FadeIn delay={260}>
          <div className="flex flex-wrap justify-center items-center gap-4 mb-20">
            <a
              href="/docs/setup"
              className="group px-8 py-3 bg-white text-black font-semibold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.18)]"
            >
              Get started
              <span className="inline-block ml-1.5 transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </a>
            <a
              href="/playground"
              className="px-8 py-3 text-white font-semibold text-sm rounded-full transition-all duration-200 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900"
            >
              Open the playground
            </a>
            <a
              href="https://github.com/samchon/ttsc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 text-neutral-400 font-medium text-sm rounded-full transition-all duration-200 hover:text-white border border-neutral-800 hover:border-neutral-600"
            >
              GitHub
            </a>
          </div>
        </FadeIn>

        {/* Terminal showcase */}
        <FadeIn delay={360}>
          <TerminalShowcase />
        </FadeIn>

        {/* Stats strip */}
        <FadeIn delay={460}>
          <div className="mt-20 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 border border-neutral-800/60 rounded-2xl overflow-hidden bg-neutral-950/70">
            {[
              { value: "2", label: "CLIs (ttsc · ttsx)" },
              { value: "4", label: "First-party plugins" },
              { value: "140", label: "Lint rules" },
              { value: "9", label: "Bundlers supported" },
            ].map((stat, i, arr) => (
              <div
                key={stat.label}
                className={`py-8 px-4 text-center ${
                  i < arr.length - 1 ? "border-r border-neutral-800/60" : ""
                }`}
              >
                <div className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                  {stat.value}
                </div>
                <div className="text-[10px] md:text-xs text-neutral-500 leading-relaxed">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function TerminalShowcase() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const total = TERMINAL_LINES.length;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= total) clearInterval(interval);
    }, 320);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden border border-neutral-800/60 shadow-[0_30px_80px_rgba(0,0,0,0.5)] bg-[#0a0a0a]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-800/60 bg-[#0d0d0d]">
        <span className="w-3 h-3 rounded-full bg-red-500/60" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
        <span className="ml-3 text-[11px] text-neutral-500 font-mono">
          ~/your-project
        </span>
      </div>
      <pre className="p-5 text-left font-mono text-[13px] leading-[1.8] text-neutral-300 overflow-x-auto">
        {TERMINAL_LINES.slice(0, visible).map((line, i) => (
          <div
            key={i}
            className="flex animate-[ttscFadeSlideUp_0.25s_ease]"
          >
            {line.prompt ? (
              <span className="text-emerald-400 select-none w-4 shrink-0">
                {line.prompt}
              </span>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className={line.color ?? "text-neutral-200"}>
              {line.text}
            </span>
          </div>
        ))}
        {visible < TERMINAL_LINES.length && (
          <span className="inline-block w-2 h-4 bg-emerald-400 align-middle animate-[ttscBlinkCursor_1s_steps(2)_infinite]" />
        )}
      </pre>
    </div>
  );
}
