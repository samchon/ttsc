"use client";

import type { ICompilerService } from "../structures/ICompilerService";

/**
 * Renders the lint plugin's findings in a list view. Shown by `PlaygroundShell`
 * when the active tab is "lint". Empty state is the green checkmark.
 */
export function LintPane({
  diagnostics,
  emptyHint = "Powered by @ttsc/lint inside playground.wasm.",
}: {
  diagnostics: ICompilerService.IDiagnostic[];
  emptyHint?: string;
}) {
  if (diagnostics.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 font-mono text-sm gap-2">
        <span className="text-emerald-400 text-xl">✓</span>
        <span>No lint diagnostics.</span>
        <span className="text-[10px] text-neutral-600 max-w-xs text-center">
          {emptyHint}
        </span>
      </div>
    );
  return (
    <div className="overflow-auto h-full p-4 space-y-2">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className="flex gap-3 p-3 rounded-md bg-neutral-900/60 border border-neutral-800/80"
        >
          <span
            className={`mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
              d.severity === "error"
                ? "text-red-300 bg-red-500/10"
                : "text-yellow-300 bg-yellow-500/10"
            }`}
          >
            {d.severity}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 mb-1">
              <span>{d.code}</span>
              <span>·</span>
              <span>
                {d.line}:{d.column}
              </span>
            </div>
            <div className="text-[13px] text-neutral-200 font-mono">
              {d.message}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
