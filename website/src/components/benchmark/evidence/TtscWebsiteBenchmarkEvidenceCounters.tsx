"use client";

import type { ITtscWebsiteBenchmarkEvidence } from "../../../structures/ITtscWebsiteBenchmarkEvidence";
import TtscWebsiteBenchmarkGraphUi from "../graph/TtscWebsiteBenchmarkGraphUi";
import TtscWebsiteBenchmarkEvidenceData from "./TtscWebsiteBenchmarkEvidenceData";
import useTtscWebsiteBenchmarkEvidenceData from "./useTtscWebsiteBenchmarkEvidenceData";

type Cell = ITtscWebsiteBenchmarkEvidence.Cell;

const { ARM_COLOR, formatInteger, title } = TtscWebsiteBenchmarkEvidenceData;

/**
 * The native token counters behind every bar above, one row per cell.
 *
 * A bar shows a total, and this total is made of categories that bill
 * differently: cached input is inside input and reasoning is inside output, so
 * the categories do not sum to it. A reader checking a figure against the
 * aggregate needs the categories rather than the sum.
 */
export default function TtscWebsiteBenchmarkEvidenceCounters() {
  const { report, loading, error } = useTtscWebsiteBenchmarkEvidenceData();

  if (error)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Could not load the evidence benchmark aggregate ({error}).
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );
  if (loading || !report || report.cells.length === 0)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        {loading ? "Loading the measurement." : "No published cells yet."}
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  return (
    <div className={`not-prose my-6 ${TtscWebsiteBenchmarkGraphUi.panelClass}`}>
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow="token counters"
        title="Every cell, as the record holds it"
        description="Cached input is inside input and reasoning is inside output, so the categories do not sum to the total."
        aside={`${report.cells.length} cells`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[#dbe4ee] text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5">Subject</th>
              <th className="px-4 py-2.5">Arm</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5 text-right">Input</th>
              <th className="px-4 py-2.5 text-right">Cached</th>
              <th className="px-4 py-2.5 text-right">Output</th>
              <th className="px-4 py-2.5 text-right">Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {report.cells.map((cell: Cell) => (
              <tr
                key={cell.runId}
                className="border-b border-[#eef4fa] text-slate-600"
              >
                <td className="px-4 py-2 font-medium text-[#102a43]">
                  {title(cell.subject)}
                </td>
                <td
                  className="px-4 py-2 font-semibold"
                  style={{ color: ARM_COLOR[cell.arm] }}
                >
                  {title(cell.arm)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatInteger(cell.tokenUsage.totalTokens)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatInteger(cell.tokenUsage.inputTokens)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatInteger(cell.tokenUsage.cachedInputTokens)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatInteger(cell.tokenUsage.outputTokens)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatInteger(cell.tokenUsage.reasoningOutputTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
