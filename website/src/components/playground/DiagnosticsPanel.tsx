"use client";

import { useState } from "react";

import type { ICompilerService } from "../../compiler/ICompilerService";

export default function DiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: ICompilerService.IDiagnostic[];
}) {
  const [expanded, setExpanded] = useState(false);
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = diagnostics.filter((d) => d.severity === "warning").length;

  if (diagnostics.length === 0)
    return (
      <div className="shrink-0 px-4 py-2 border-t border-neutral-800/70 bg-neutral-950 flex items-center gap-3">
        <span className="text-emerald-400 text-xs">●</span>
        <span className="text-[12px] font-mono text-neutral-400">
          0 errors · 0 warnings
        </span>
      </div>
    );

  return (
    <div className="shrink-0 border-t border-neutral-800/70 bg-neutral-950">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-neutral-900/50 transition-colors text-left"
      >
        <span
          className={`text-xs ${
            errorCount > 0 ? "text-red-400" : "text-yellow-400"
          }`}
        >
          ●
        </span>
        <span className="text-[12px] font-mono text-neutral-300">
          {errorCount} error{errorCount === 1 ? "" : "s"} · {warnCount} warning
          {warnCount === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-[10px] font-mono text-neutral-600">
          {expanded ? "▲ collapse" : "▼ expand"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-neutral-800/70 max-h-48 overflow-auto">
          {diagnostics.map((d, i) => (
            <div
              key={i}
              className="px-4 py-2 flex gap-3 text-[12px] font-mono border-b border-neutral-900 last:border-b-0"
            >
              <span
                className={`shrink-0 ${
                  d.severity === "error"
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              >
                {d.severity === "error" ? "✗" : "!"}
              </span>
              <span className="shrink-0 text-neutral-500 w-16">
                {d.line}:{d.column}
              </span>
              <span className="shrink-0 text-neutral-600 w-16">
                {d.code ?? ""}
              </span>
              <span className="text-neutral-200">{d.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
