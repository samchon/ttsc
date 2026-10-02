"use client";

import type { ICompilerService } from "../structures/ICompilerService";

/**
 * Renders the lint plugin's findings in a list view. Shown by `PlaygroundShell`
 * when the active tab is "lint". Empty state is the green checkmark.
 *
 * @evidence contracts/common.md#principled-implementation Supplied normalized findings map to severity, code, location and message; producer failure interpretation remains outside the renderer.
 * @evidence contracts/common.md#clear-and-simple-design This view is stateless apart from its props and does not initiate lint work.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty-state presentation follows the supplied result and does not discard error diagnostics.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains placement and empty presentation, separated from tags under the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It keeps no state, handle or listener after returning.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Browser UI logic with no native filesystem, path-identity or process boundary.
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
      <div className="flex h-full flex-col items-center justify-center gap-2 font-mono text-sm text-slate-500">
        <span className="text-emerald-400 text-xl">✓</span>
        <span>No lint diagnostics.</span>
        <span className="max-w-xs text-center text-[10px] text-slate-400">
          {emptyHint}
        </span>
      </div>
    );
  return (
    <div className="overflow-auto h-full p-4 space-y-2">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-lg border border-[#d2e4f4] bg-[#f7fbff] p-3"
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
            <div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-slate-500">
              <span>{d.code}</span>
              <span>·</span>
              <span>
                {d.line}:{d.column}
              </span>
            </div>
            <div className="font-mono text-[13px] text-slate-700">
              {d.message}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
