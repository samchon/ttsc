"use client";

import FadeIn from "./FadeIn";
import SectionEyebrow from "./SectionEyebrow";

const DIAGNOSTIC = [
  {
    code: "TS2322",
    path: "src/index.ts:3:7",
    message: "Type 'number' is not assignable to type 'string'.",
    tone: "text-red-300",
  },
  {
    code: "TS17397",
    path: "src/index.ts:2:5",
    message: "[preferConst] Use const instead of let.",
    tone: "text-amber-300",
  },
  {
    code: "TS11966",
    path: "src/index.ts:1:1",
    message: "[noVar] Unexpected var, use let or const instead.",
    tone: "text-amber-300",
  },
] as const;

const SOURCE_LINES = [
  { line: 1, text: "var x: number = 3;", underline: "~~~~~~~~~~~~~~~~~~" },
  { line: 2, text: "let y: number = 4;", underline: "    ~~~~~~~~~~~~~" },
  { line: 3, text: "const z: string = 5;", underline: "      ~" },
  { line: 4, text: "", underline: "" },
  { line: 5, text: "console.log(x + y + z);", underline: "" },
] as const;

const NOTES = [
  "type errors",
  "lint violations",
  "format fixes",
  "editor underlines",
] as const;

export default function LintAsCompileError() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <FadeIn>
          <SectionEyebrow label="Diagnostics" />
          <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                Type errors and lint errors should look like one failure.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400">
                <code className="font-mono text-neutral-200">ttsc</code> can
                print rule violations as TS diagnostics. Local runs, CI, and the
                editor all point at the same file, line, and rule.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-2">
                {NOTES.map((note) => (
                  <div
                    key={note}
                    className="rounded-lg border border-neutral-800 bg-black/35 px-3 py-2"
                  >
                    <p className="text-xs font-medium text-neutral-300">
                      {note}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-[#090909]">
              <div className="flex items-center gap-2 border-b border-neutral-800 bg-[#0d0d0d] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                <span className="ml-3 font-mono text-[11px] text-neutral-500">
                  $ npx ttsc --noEmit
                </span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-[1.7] text-neutral-300 md:p-7 md:text-[13px]">
                {DIAGNOSTIC.map((d, i) => (
                  <div key={i} className="mb-3">
                    <span className="text-neutral-500">{d.path}</span>
                    <span className="text-neutral-700"> - </span>
                    <span className={d.tone}>error </span>
                    <span className="text-cyan-300">{d.code}</span>
                    <span className="text-neutral-300">: {d.message}</span>
                  </div>
                ))}
                {"\n"}
                {SOURCE_LINES.map((s, i) => (
                  <div key={i} className="text-neutral-400">
                    <span className="select-none text-neutral-600">
                      {s.line ? `${s.line}  ` : "   "}
                    </span>
                    {s.text}
                    {s.underline && (
                      <>
                        {"\n"}
                        <span className="select-none text-neutral-600">
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
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
