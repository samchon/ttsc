"use client";

import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";
import TtscWebsiteLandingSectionEyebrow from "./TtscWebsiteLandingSectionEyebrow";

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
    message: "[prefer-const] Use const instead of let.",
    tone: "text-amber-300",
  },
  {
    code: "TS11966",
    path: "src/index.ts:1:1",
    message: "[no-var] Unexpected var, use let or const instead.",
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

export default function TtscWebsiteLandingLintAsCompileError() {
  return (
    <section className="relative overflow-hidden bg-[#eef6ff] px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Diagnostics" />
          <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-[#102a43] md:text-5xl">
                Type errors and lint errors should look like one failure.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#526b82]">
                <code className="font-mono font-semibold text-[#235a97]">
                  ttsc
                </code>{" "}
                can print rule violations as TS diagnostics. Local runs, CI, and
                the editor all point at the same file, line, and rule.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-2">
                {NOTES.map((note) => (
                  <div
                    key={note}
                    className="rounded-xl border border-[#c7dff4] bg-white px-3 py-2"
                  >
                    <p className="text-sm font-medium text-[#405f7a]">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#235a97] bg-[#102a43] shadow-[0_24px_60px_rgba(35,90,151,0.22)]">
              <div className="flex items-center gap-2 border-b border-[#3f6f99] bg-[#173f66] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                <span className="ml-3 font-mono text-xs text-blue-200">
                  $ npx ttsc --noEmit
                </span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] text-blue-50 md:p-7 md:text-sm">
                {DIAGNOSTIC.map((d, i) => (
                  <div key={i} className="mb-3">
                    <span className="text-blue-300">{d.path}</span>
                    <span className="text-blue-500"> - </span>
                    <span className={d.tone}>error </span>
                    <span className="text-sky-300">{d.code}</span>
                    <span className="text-blue-50">: {d.message}</span>
                  </div>
                ))}
                {"\n"}
                {SOURCE_LINES.map((s, i) => (
                  <div key={i} className="text-blue-100">
                    <span className="select-none text-blue-400">
                      {s.line ? `${s.line}  ` : "   "}
                    </span>
                    {s.text}
                    {s.underline && (
                      <>
                        {"\n"}
                        <span className="select-none text-blue-400">
                          {"   "}
                        </span>
                        <span className="text-red-400">{s.underline}</span>
                      </>
                    )}
                  </div>
                ))}
                {"\n"}
                <span className="text-blue-300">
                  Found 3 errors in the same file.
                </span>
              </pre>
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}
