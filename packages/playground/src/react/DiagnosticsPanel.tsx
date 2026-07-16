"use client";

import { useState } from "react";

import type { ICompilerService } from "../structures/ICompilerService";

export function DiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: ICompilerService.IDiagnostic[];
}) {
  const [expanded, setExpanded] = useState(false);
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = diagnostics.filter((d) => d.severity === "warning").length;

  if (diagnostics.length === 0)
    return (
      <div className="flex shrink-0 items-center gap-3 border-t border-[#c7dff4] bg-[#eef6ff] px-4 py-2">
        <span className="text-emerald-400 text-xs">●</span>
        <span className="font-mono text-[12px] text-slate-600">
          0 errors · 0 warnings
        </span>
      </div>
    );

  return (
    <div className="shrink-0 border-t border-[#c7dff4] bg-[#eef6ff]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[#e1effc]"
      >
        <span
          className={`text-xs ${
            errorCount > 0 ? "text-red-400" : "text-yellow-400"
          }`}
        >
          ●
        </span>
        <span className="font-mono text-[12px] text-slate-700">
          {errorCount} error{errorCount === 1 ? "" : "s"} · {warnCount} warning
          {warnCount === 1 ? "" : "s"}
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-400">
          {expanded ? "▲ collapse" : "▼ expand"}
        </span>
      </button>
      {expanded && (
        <div className="max-h-48 overflow-auto border-t border-[#c7dff4]">
          {diagnostics.map((d, i) => (
            <div
              key={i}
              className="flex gap-3 border-b border-[#d8e7f4] px-4 py-2 font-mono text-[12px] last:border-b-0"
            >
              <span
                className={`shrink-0 ${
                  d.severity === "error" ? "text-red-400" : "text-yellow-400"
                }`}
              >
                {d.severity === "error" ? "✗" : "!"}
              </span>
              <span className="w-16 shrink-0 text-slate-500">
                {d.line}:{d.column}
              </span>
              <span className="w-16 shrink-0 text-slate-400">
                {d.code ?? ""}
              </span>
              <span className="text-slate-700">{d.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
