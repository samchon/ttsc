"use client";

import { useMemo } from "react";

import TtscWebsiteBenchmarkGraphUi from "../graph/TtscWebsiteBenchmarkGraphUi";
import TtscWebsiteBenchmarkEvidenceData, {
  type CoverageRow,
} from "./TtscWebsiteBenchmarkEvidenceData";
import useTtscWebsiteBenchmarkEvidenceData from "./useTtscWebsiteBenchmarkEvidenceData";

/**
 * How much of the provenance graph each arm's codebase actually satisfies.
 *
 * The block draws nothing at all when no cohort has been counted. Coverage is
 * read from a finished Plain workspace by hand, because a Plain codebase
 * carries no tags for the plugin to select on and an empty population reports
 * full coverage while checking nothing. A cohort can therefore be published
 * before its coverage exists, and zeroes would be a claim rather than a gap.
 */
export default function TtscWebsiteBenchmarkEvidenceCoverage() {
  const { report, coverage, error } = useTtscWebsiteBenchmarkEvidenceData();
  const rows: CoverageRow[] = useMemo(
    () => TtscWebsiteBenchmarkEvidenceData.buildCoverage(report, coverage),
    [report, coverage],
  );

  if (error || rows.length === 0) return null;

  return (
    <div className={`not-prose my-6 ${TtscWebsiteBenchmarkGraphUi.panelClass}`}>
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow="requirement coverage"
        title="How much of the graph each arm satisfied"
        description="Thirteen reference edges run from a requirement anchor down to tests, properties, and journeys. Serial hops multiply and branches average, so a healthy near end cannot average away a broken far end. Higher is better."
        aside="higher is better"
      />
      <div className="space-y-2 px-5 py-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span
              className="w-[150px] shrink-0 text-[13px] font-semibold"
              style={{ color: row.color }}
            >
              {row.label}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-[#e7f0f8]">
              <div
                className="h-full rounded-md"
                style={{
                  width: `${Math.max(0, Math.min(100, row.percent))}%`,
                  background: row.color,
                }}
              />
            </div>
            <span
              className="w-[60px] shrink-0 text-right text-[13px] font-semibold tabular-nums"
              style={{ color: row.color }}
            >
              {row.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <p className="border-t border-[#c7dff4] bg-[#f7fbff] px-5 py-3 text-[11px] leading-relaxed text-slate-500">
        The Evidence arm is complete by construction rather than counted: the
        plugin enforces every one of those edges as a build gate, so a cell that
        compiled satisfied the graph and there was nothing left to measure.
      </p>
    </div>
  );
}
