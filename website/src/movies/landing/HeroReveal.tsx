"use client";

import { useEffect, useState } from "react";

const TOOLS = ["tsc", "eslint", "prettier", "tsx"];

export default function HeroReveal() {
  const [phase, setPhase] = useState<"split" | "collapse" | "merged">("split");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("collapse"), 900);
    const t2 = setTimeout(() => setPhase("merged"), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="relative w-full max-w-3xl mx-auto h-[140px] md:h-[160px] my-12">
      {/* Source panes */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 md:gap-4">
        {TOOLS.map((tool, i) => (
          <div
            key={tool}
            className="px-4 py-2.5 md:px-5 md:py-3 rounded-xl border border-neutral-800 bg-neutral-950/80 font-mono text-sm text-neutral-300"
            style={{
              opacity: phase === "merged" ? 0 : 1,
              transform:
                phase === "split"
                  ? "translateX(0) scale(1)"
                  : phase === "collapse"
                    ? `translateX(${(1.5 - i) * 60}px) scale(0.85)`
                    : `translateX(${(1.5 - i) * 0}px) scale(0.6)`,
              transition: "transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.5s ease",
              transitionDelay: `${i * 40}ms`,
            }}
          >
            {tool}
          </div>
        ))}
      </div>
      {/* Target pane */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: phase === "merged" ? 1 : 0,
          transform: phase === "merged" ? "scale(1)" : "scale(0.7)",
          transition: "opacity 0.5s ease 0.1s, transform 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) 0.05s",
        }}
      >
        <div
          className="px-8 py-4 md:px-12 md:py-5 rounded-2xl border bg-neutral-950 font-mono text-xl md:text-2xl font-bold"
          style={{
            borderColor: "#36E2EE",
            color: "#36E2EE",
            boxShadow: "0 0 60px rgba(54, 226, 238, 0.25), 0 0 30px rgba(54, 226, 238, 0.15) inset",
          }}
        >
          ttsc
        </div>
      </div>
      {/* Arrow */}
      <div
        className="absolute inset-0 flex items-center justify-center text-neutral-700 text-2xl font-mono"
        style={{
          opacity: phase === "collapse" ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        →
      </div>
    </div>
  );
}
