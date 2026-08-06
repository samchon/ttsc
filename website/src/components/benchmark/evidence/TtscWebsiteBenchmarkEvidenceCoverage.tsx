"use client";

import { useMemo, useState } from "react";

import TtscWebsiteBenchmarkGraphUi from "../graph/TtscWebsiteBenchmarkGraphUi";
import TtscWebsiteBenchmarkEvidenceData, {
  type CoverageRow,
} from "./TtscWebsiteBenchmarkEvidenceData";
import useTtscWebsiteBenchmarkEvidenceTooltip, {
  type TooltipContent,
} from "./TtscWebsiteBenchmarkEvidenceTooltip";
import useTtscWebsiteBenchmarkEvidenceData from "./useTtscWebsiteBenchmarkEvidenceData";

/**
 * How much of the provenance graph each arm's codebase satisfies.
 *
 * The composite is folded from thirteen edges, and on its own it says a subject
 * is 31.7% whole without saying where it broke. Each row opens onto the edges
 * behind it, which is where the reading is: that subject published almost every
 * operation its requirements name and tested a seventh of its accessors.
 *
 * The block draws nothing when no cohort has been counted, rather than zeroes,
 * which would be a claim about a codebase nobody read.
 */
export default function TtscWebsiteBenchmarkEvidenceCoverage() {
  const { report, coverage, error } = useTtscWebsiteBenchmarkEvidenceData();
  const rows: CoverageRow[] = useMemo(
    () => TtscWebsiteBenchmarkEvidenceData.buildCoverage(report, coverage),
    [report, coverage],
  );
  const [open, setOpen] = useState<string | null>(null);
  const tooltip = useTtscWebsiteBenchmarkEvidenceTooltip();

  if (error || rows.length === 0) return null;

  return (
    <div className={`not-prose my-6 ${TtscWebsiteBenchmarkGraphUi.panelClass}`}>
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow="requirement coverage"
        title="How much of the graph each arm satisfied"
        description="Thirteen reference edges, folded so serial hops multiply and branches average. Higher is better. Open a row for the edges behind its score."
        aside="higher is better"
      />
      <div className="divide-y divide-[#eef4fa] px-5 py-2">
        {rows.map((row) => {
          const expandable = row.edges.length > 0;
          const expanded = open === row.label;
          return (
            <div key={row.label} className="py-2">
              <button
                type="button"
                disabled={expandable === false}
                aria-expanded={expandable ? expanded : undefined}
                onClick={() => setOpen(expanded ? null : row.label)}
                className={`flex w-full items-center gap-3 rounded-md text-left ${
                  expandable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span
                  className="flex w-[160px] shrink-0 items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: row.color }}
                >
                  {expandable ? (
                    <Chevron open={expanded} />
                  ) : (
                    <span className="w-3" />
                  )}
                  {row.label}
                </span>
                <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-[#e7f0f8]">
                  <span
                    className="block h-full rounded-md"
                    style={{
                      width: `${Math.max(0, Math.min(100, row.percent))}%`,
                      background: row.color,
                    }}
                  />
                </span>
                <span
                  className="w-[60px] shrink-0 text-right text-[13px] font-semibold tabular-nums"
                  style={{ color: row.color }}
                >
                  {row.percent.toFixed(1)}%
                </span>
              </button>
              {expanded && row.wholeness.length > 0 ? (
                <div className="mt-2 ml-[160px] flex flex-wrap gap-x-4 gap-y-1 border-l border-[#dbe4ee] pl-3 font-mono text-[11px] text-slate-500">
                  {row.wholeness.map((entry) => (
                    <span key={entry.key}>
                      {entry.label}{" "}
                      <span className="font-semibold text-[#102a43]">
                        {entry.percent === null
                          ? "n/a"
                          : `${entry.percent.toFixed(1)}%`}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
              {expanded ? (
                <ul className="mt-2 ml-[160px] space-y-1 border-l border-[#dbe4ee] pl-3">
                  {row.edges.map((edge) => (
                    <li
                      key={edge.name}
                      className="flex items-center gap-3"
                      onMouseMove={tooltip.show(edgeDetail(row, edge))}
                      onMouseLeave={tooltip.hide}
                    >
                      <span className="w-[250px] shrink-0 truncate text-[12px] text-slate-500">
                        {edge.label}
                      </span>
                      <span className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-[#e7f0f8]">
                        <span
                          className="block h-full rounded-sm"
                          style={{
                            width: `${Math.max(0, Math.min(100, edge.percent ?? 0))}%`,
                            background: row.color,
                            opacity: 0.7,
                          }}
                        />
                      </span>
                      <span className="w-[110px] shrink-0 text-right font-mono text-[11px] text-slate-500">
                        {edge.population ?? "population not retained"}
                      </span>
                      <span className="w-[52px] shrink-0 text-right text-[12px] font-semibold tabular-nums text-[#102a43]">
                        {edge.percent === null
                          ? "n/a"
                          : `${edge.percent.toFixed(1)}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      {tooltip.node}
    </div>
  );
}

const edgeDetail = (
  row: CoverageRow,
  edge: CoverageRow["edges"][number],
): TooltipContent => ({
  title: edge.label,
  subtitle: `${row.label} · ${edge.name}`,
  lines: [
    {
      label: "Reached",
      value: edge.percent === null ? "n/a" : `${edge.percent.toFixed(1)}%`,
      color: row.color,
      active: true,
    },
    { label: "Population", value: edge.population ?? "not retained" },
    { label: "Composite", value: `${row.percent.toFixed(1)}%` },
  ],
});

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
