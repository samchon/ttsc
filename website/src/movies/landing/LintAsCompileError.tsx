"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const DIAGNOSTIC = [
  {
    type: "error",
    code: "TS2322",
    path: "src/index.ts:3:7",
    message: "Type 'number' is not assignable to type 'string'.",
  },
  {
    type: "error",
    code: "TS17397",
    path: "src/index.ts:2:5",
    message: "[prefer-const] Use const instead of let.",
  },
  {
    type: "error",
    code: "TS11966",
    path: "src/index.ts:1:1",
    message: "[no-var] Unexpected var, use let or const instead.",
  },
];

const SOURCE_LINES = [
  { line: 1, text: "var x: number = 3;", underline: "~~~~~~~~~~~~~~~~~~" },
  { line: 2, text: "let y: number = 4;", underline: "    ~~~~~~~~~~~~~" },
  { line: 3, text: "const z: string = 5;", underline: "      ~" },
  { line: 4, text: "", underline: "" },
  { line: 5, text: "console.log(x + y + z);", underline: "" },
];

export default function LintAsCompileError() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-neutral-950 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        <FadeIn>
          <SectionEyebrow label="Diagnostics" />
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            Types and rules in{" "}
            <span className="text-neutral-500">one error stream.</span>
          </h2>
          <p className="text-base text-neutral-400 max-w-2xl leading-relaxed mb-12">
            <code className="font-mono text-neutral-200">ttsc</code> can report
            lint and format problems as compiler diagnostics, so the terminal,
            CI, and editor agree on what is broken.
          </p>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="rounded-2xl overflow-hidden border border-neutral-800/80 bg-[#0a0a0a]">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-800/80 bg-[#0d0d0d]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
              <span className="ml-3 text-[11px] text-neutral-500 font-mono">
                $ npx ttsc --noEmit
              </span>
            </div>
            <pre className="p-5 md:p-7 text-[12px] md:text-[13px] font-mono leading-[1.7] overflow-x-auto text-neutral-300">
              {DIAGNOSTIC.map((d, i) => (
                <div key={i} className="mb-3">
                  <div>
                    <span className="text-neutral-500">{d.path}</span>
                    <span className="text-neutral-700"> - </span>
                    <span className="text-red-400">{d.type}</span>
                    <span className="text-neutral-300"> </span>
                    <span className="text-cyan-300">{d.code}</span>
                    <span className="text-neutral-300">: {d.message}</span>
                  </div>
                </div>
              ))}
              {"\n"}
              {SOURCE_LINES.map((s, i) => (
                <div key={i} className="text-neutral-400">
                  <span className="text-neutral-600 select-none">
                    {s.line ? `${s.line}  ` : "   "}
                  </span>
                  {s.text}
                  {s.underline && (
                    <>
                      {"\n"}
                      <span className="text-neutral-600 select-none">
                        {"   "}
                      </span>
                      <span className="text-red-400">{s.underline}</span>
                    </>
                  )}
                </div>
              ))}
              {"\n"}
              <span className="text-neutral-500">
                Found 3 errors in the same file.
              </span>
            </pre>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
