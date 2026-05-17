"use client";

import { useEffect, useRef, useState } from "react";

import FadeIn from "./FadeIn";

const BEFORE = `import typia, { tags } from "typia";
import { v4 } from "uuid";

interface IMember {
  id: string & tags.Format<"uuid">;
  email: string & tags.Format<"email">;
  age: number &
    tags.Type<"uint32"> &
    tags.ExclusiveMinimum<19> &
    tags.Maximum<100>;
}

const matched: boolean = typia.is<IMember>({
  id: v4(),
  email: "samchon.github@gmail.com",
  age: 30,
});
console.log(matched); // true`;

const AFTER = `import * as __typia_transform__isFormatUuid from "typia/lib/internal/_isFormatUuid";
import * as __typia_transform__isFormatEmail from "typia/lib/internal/_isFormatEmail";
import * as __typia_transform__isTypeUint32 from "typia/lib/internal/_isTypeUint32";
import typia from "typia";
import { v4 } from "uuid";

const matched = (() => {
  const _io0 = (input) =>
    "string" === typeof input.id &&
    __typia_transform__isFormatUuid._isFormatUuid(input.id) &&
    "string" === typeof input.email &&
    __typia_transform__isFormatEmail._isFormatEmail(input.email) &&
    "number" === typeof input.age &&
    __typia_transform__isTypeUint32._isTypeUint32(input.age) &&
    19 < input.age &&
    input.age <= 100;
  return (input) =>
    "object" === typeof input && null !== input && _io0(input);
})()({
  id: v4(),
  email: "samchon.github@gmail.com",
  age: 30,
});
console.log(matched); // true`;

const TS_KEYWORDS = /\b(import|export|from|interface|const|let|function|return|typeof|null|true|false|undefined|number|string|boolean)\b/;
const TS_TYPES = /\b(tags|Format|Type|ExclusiveMinimum|Maximum|IMember)\b/;
const TS_STRING = /(["'`])(?:(?=(\\?))\2.)*?\1/;
const TS_NUMBER = /\b(\d+\.?\d*)\b/;
const TS_COMMENT = /\/\/.*$/;

function highlightLine(text: string) {
  const tokens: { value: string; cls: string }[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let earliest = { index: Infinity, length: 0, cls: "", match: "" };
    const rules: [RegExp, string][] = [
      [TS_COMMENT, "text-neutral-600"],
      [TS_STRING, "text-emerald-400"],
      [TS_KEYWORDS, "text-purple-400"],
      [TS_TYPES, "text-blue-400"],
      [TS_NUMBER, "text-orange-400"],
    ];
    for (const [regex, cls] of rules) {
      const m = remaining.match(regex);
      if (m && m.index !== undefined && m.index < earliest.index) {
        earliest = { index: m.index, length: m[0].length, cls, match: m[0] };
      }
    }
    if (earliest.index === Infinity) {
      tokens.push({ value: remaining, cls: "" });
      break;
    }
    if (earliest.index > 0)
      tokens.push({ value: remaining.slice(0, earliest.index), cls: "" });
    tokens.push({ value: earliest.match, cls: earliest.cls });
    remaining = remaining.slice(earliest.index + earliest.length);
  }
  return tokens;
}

function CodePane({
  title,
  badge,
  badgeColor,
  code,
  visible,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  code: string;
  visible: boolean;
}) {
  const lines = code.split("\n");
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-neutral-800/60 bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800/60 bg-[#0d0d0d]">
        <span className="font-mono text-[11px] text-neutral-400">{title}</span>
        <span className={`font-mono text-[10px] uppercase tracking-wider ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <pre
        className="p-5 font-mono text-[12px] leading-[1.7] text-neutral-300 overflow-auto"
        style={{
          minHeight: 380,
          opacity: visible ? 1 : 0.4,
          transition: "opacity 0.4s ease",
        }}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="text-neutral-700 select-none w-8 text-right mr-4 shrink-0">
              {i + 1}
            </span>
            <span>
              {highlightLine(line).map((tok, j) => (
                <span key={j} className={tok.cls}>
                  {tok.value}
                </span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export default function TtscLandingTransformMovie() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"before" | "transform" | "after">("before");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        setTimeout(() => setPhase("transform"), 600);
        setTimeout(() => setPhase("after"), 1600);
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative py-32 px-6 bg-neutral-950 overflow-hidden"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[600px] bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.05)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <FadeIn className="max-w-2xl mb-16">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-neutral-600 mb-5">
            Transform plugins
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-5">
            Your types,
            <br />
            <span className="text-neutral-500">turned into JavaScript.</span>
          </h2>
          <p className="text-base text-neutral-500 leading-relaxed">
            ttsc plugins rewrite your code at build time. Drop{" "}
            <code className="font-mono text-neutral-300">typia.is&lt;T&gt;()</code>{" "}
            into a TypeScript file — the compiler emits the actual runtime check
            for you. No reflection, no schema duplication, no extra build step.
          </p>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
            <CodePane
              title="src/index.ts"
              badge="Input"
              badgeColor="text-neutral-500"
              code={BEFORE}
              visible
            />
            <div className="flex lg:flex-col items-center justify-center text-neutral-500">
              <div className="flex flex-col items-center gap-3">
                <code className="font-mono text-[11px] px-3 py-1 rounded-full border border-neutral-800 bg-neutral-950">
                  ttsc
                </code>
                <span
                  className="text-2xl text-neutral-600"
                  style={{
                    transform:
                      phase === "before"
                        ? "translateY(0)"
                        : phase === "transform"
                          ? "scale(1.3)"
                          : "scale(1)",
                    transition: "transform 0.5s ease",
                  }}
                >
                  →
                </span>
                <code className="font-mono text-[10px] text-neutral-700 hidden lg:block">
                  + typia
                </code>
              </div>
            </div>
            <CodePane
              title="dist/index.js"
              badge="Emit"
              badgeColor="text-emerald-400"
              code={AFTER}
              visible={phase === "after"}
            />
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <p className="mt-10 text-center text-sm text-neutral-500">
            Open the{" "}
            <a
              href="/playground"
              className="text-neutral-200 underline decoration-neutral-700 hover:decoration-neutral-300 underline-offset-4"
            >
              playground
            </a>{" "}
            to try it on your own code · No bundler step required.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
