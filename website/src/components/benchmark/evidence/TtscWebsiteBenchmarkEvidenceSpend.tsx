"use client";

import { useMemo, useState } from "react";

import TtscWebsiteBenchmarkGraphUi from "../graph/TtscWebsiteBenchmarkGraphUi";
import TtscWebsiteBenchmarkEvidenceData, {
  type Axis,
  type Row,
  type SubjectGroup,
} from "./TtscWebsiteBenchmarkEvidenceData";
import useTtscWebsiteBenchmarkEvidenceData from "./useTtscWebsiteBenchmarkEvidenceData";

const { AXES, PHASES, PHASE_OPACITY, ARM_COLOR, INSPECTION_COLOR } =
  TtscWebsiteBenchmarkEvidenceData;

/**
 * What both arms spent on each subject, split by phase.
 *
 * One axis at a time rather than three charts, because work time and price
 * track token spend closely enough that showing all three at once says one
 * thing three times. The tabs keep the comparison and let a reader who wants
 * another axis have it in the same shape.
 */
export default function TtscWebsiteBenchmarkEvidenceSpend() {
  const { report, loading, error } = useTtscWebsiteBenchmarkEvidenceData();
  const [axisId, setAxisId] = useState<Axis["id"]>("tokens");
  const axis: Axis = AXES.find((entry) => entry.id === axisId) ?? AXES[0]!;
  const subjects: SubjectGroup[] = useMemo(
    () => TtscWebsiteBenchmarkEvidenceData.buildSubjects(report, axis),
    [report, axis],
  );

  if (error)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Could not load the evidence benchmark aggregate ({error}).
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );
  if (loading || subjects.length === 0)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        {loading ? "Loading the measurement." : "No published cells yet."}
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  const maximum: number = Math.max(
    1,
    ...subjects.flatMap((group) =>
      group.rows.map((row) =>
        Math.max(
          row.total,
          row.segments.reduce((sum, segment) => sum + segment.value, 0),
        ),
      ),
    ),
  );

  return (
    <div className={`not-prose my-6 ${TtscWebsiteBenchmarkGraphUi.panelClass}`}>
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow="plain against evidence"
        title="What each arm spent"
        description="One instruction sequence per subject, both arms, one shared axis across every subject. Lower is better. Shades separate the development and review phases; the grey tail is spend the stage records do not account for."
        aside={
          report ? `generated ${report.generatedAt.slice(0, 10)}` : undefined
        }
      />
      <div className="flex flex-wrap gap-1.5 border-b border-[#c7dff4] bg-[#f7fbff] px-5 py-3">
        {AXES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setAxisId(entry.id)}
            aria-pressed={entry.id === axisId}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
              entry.id === axisId
                ? "border-[#3178c6] bg-white text-[#102a43] shadow-sm"
                : "border-transparent text-slate-500 hover:border-[#c7dff4] hover:bg-white"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-slate-500">
          {axis.hint}
        </span>
      </div>
      <div className="space-y-5 px-5 py-5">
        {subjects.map((group) => (
          <section key={group.subject}>
            <header className="mb-2 flex items-baseline justify-between gap-3">
              <h4 className="text-[15px] font-semibold text-[#102a43]">
                {group.label}
              </h4>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {group.models}
              </span>
            </header>
            <div className="space-y-2">
              {group.rows.map((row) => (
                <SpendRow
                  key={`${group.subject}-${row.arm}`}
                  row={row}
                  axis={axis}
                  maximum={maximum}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <Legend />
    </div>
  );
}

function SpendRow({
  row,
  axis,
  maximum,
}: {
  row: Row;
  axis: Axis;
  maximum: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-[74px] shrink-0 text-[13px] font-semibold"
        style={{ color: row.color }}
      >
        {TtscWebsiteBenchmarkEvidenceData.title(row.arm)}
      </span>
      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-[#e7f0f8]">
        <div className="flex h-full">
          {row.segments.map((segment) => (
            <div
              key={segment.key}
              title={`${segment.label}: ${axis.format(segment.value)}`}
              style={{
                width: `${(segment.value / maximum) * 100}%`,
                background: segment.color,
                opacity: segment.opacity,
              }}
            />
          ))}
        </div>
      </div>
      <span className="w-[140px] shrink-0 text-right text-[13px] font-semibold text-[#102a43]">
        {axis.format(row.total)}
        {row.delta === null ? null : (
          <span
            className={`ml-1 font-mono text-[11px] ${
              row.delta > 0 ? "text-[#be123c]" : "text-[#15803d]"
            }`}
          >
            {row.delta > 0 ? "+" : ""}
            {row.delta}%
          </span>
        )}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[#c7dff4] bg-[#f7fbff] px-5 py-3">
      {PHASES.map((phase, index) => (
        <span
          key={phase.key}
          className="flex items-center gap-1.5 text-[11px] text-slate-500"
          title={phase.hint}
        >
          <span
            className="h-2.5 w-4 rounded-sm"
            style={{
              background: ARM_COLOR.plain,
              opacity: PHASE_OPACITY[index],
            }}
          />
          {phase.label}
        </span>
      ))}
      <span
        className="flex items-center gap-1.5 text-[11px] text-slate-500"
        title="The part of a cell's total that no stage record accounts for, judging a Review included"
      >
        <span
          className="h-2.5 w-4 rounded-sm"
          style={{ background: INSPECTION_COLOR }}
        />
        Unattributed
      </span>
    </div>
  );
}
