"use client";

import { useMemo, useState } from "react";
import type React from "react";

import TtscWebsiteBenchmarkGraphUi from "../graph/TtscWebsiteBenchmarkGraphUi";
import TtscWebsiteBenchmarkEvidenceData, {
  type Axis,
  type Row,
  type SubjectGroup,
} from "./TtscWebsiteBenchmarkEvidenceData";
import useTtscWebsiteBenchmarkEvidenceTooltip, {
  type TooltipContent,
} from "./TtscWebsiteBenchmarkEvidenceTooltip";
import useTtscWebsiteBenchmarkEvidenceData from "./useTtscWebsiteBenchmarkEvidenceData";

const {
  AXES,
  PHASES,
  PHASE_OPACITY,
  ARM_COLOR,
  UNATTRIBUTED_COLOR,
  formatCost,
  formatDuration,
  formatInteger,
  title,
} = TtscWebsiteBenchmarkEvidenceData;

/**
 * What both arms spent on each subject, split by phase.
 *
 * One axis at a time rather than three charts, because work time and price
 * track token spend closely enough that showing all three at once says one
 * thing three times.
 */
export default function TtscWebsiteBenchmarkEvidenceSpend() {
  const { report, loading, error } = useTtscWebsiteBenchmarkEvidenceData();
  const [axisId, setAxisId] = useState<Axis["id"]>("tokens");
  const axis: Axis = AXES.find((entry) => entry.id === axisId) ?? AXES[0]!;
  const subjects: SubjectGroup[] = useMemo(
    () => TtscWebsiteBenchmarkEvidenceData.buildSubjects(report, axis),
    [report, axis],
  );
  const tooltip = useTtscWebsiteBenchmarkEvidenceTooltip();

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
        description="One shared axis across every subject, lower is better. Hover a band for its phase, its own figure, and its share of the row. A bar longer than the figure beside it is a cell whose stage records sum above its own total, which excludes idleness they keep."
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
      </div>
      <div className="space-y-5 px-5 py-5">
        {subjects.map((group) => (
          <section key={group.id}>
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
                  key={`${group.id}-${row.arm}`}
                  row={row}
                  axis={axis}
                  maximum={maximum}
                  onHover={tooltip.show}
                  onLeave={tooltip.hide}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <Legend />
      {tooltip.node}
    </div>
  );
}

function SpendRow({
  row,
  axis,
  maximum,
  onHover,
  onLeave,
}: {
  row: Row;
  axis: Axis;
  maximum: number;
  onHover: (content: TooltipContent) => (event: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const stacked = row.segments.reduce((sum, segment) => sum + segment.value, 0);
  const share = (value: number): string =>
    stacked <= 0 ? "" : `${Math.round((value / stacked) * 100)}%`;
  const detail = (active?: string): TooltipContent => ({
    title: `${title(row.cell.subject)} ${title(row.arm)}`,
    subtitle: `${axis.label} · ${row.cell.status} · ${row.cell.effort} effort`,
    lines: [
      ...row.segments.map((segment) => ({
        label: segment.label,
        value: `${axis.format(segment.value)}${share(segment.value) ? ` · ${share(segment.value)}` : ""}`,
        color: segment.color,
        opacity: segment.opacity,
        active: segment.key === active,
      })),
      { label: "Total", value: row.label },
      ...(stacked > row.total
        ? [
            {
              label: "Stages over total",
              value: axis.format(stacked - row.total),
            },
          ]
        : []),
    ],
    footer: `${formatInteger(row.cell.tokenUsage.totalTokens)} tokens · ${formatDuration(row.cell.workElapsedMs)} · ${formatCost(row.cell)} · +${formatInteger(row.cell.worktree.additions)}/-${formatInteger(row.cell.worktree.deletions)} in ${formatInteger(row.cell.worktree.files)} files`,
  });

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-[74px] shrink-0 text-[13px] font-semibold"
        style={{ color: row.color }}
      >
        {title(row.arm)}
      </span>
      <div
        className="relative h-7 flex-1 overflow-hidden rounded-md bg-[#e7f0f8]"
        onMouseMove={onHover(detail())}
        onMouseLeave={onLeave}
      >
        <div className="flex h-full">
          {row.segments.map((segment) => (
            <div
              key={segment.key}
              // The band's own move handler has to stop here. The track behind
              // it carries one too, for the gap a bar leaves when it does not
              // fill its scale, and letting the event bubble replaced the
              // band's detail with the row's a frame later, so the highlight
              // this exists for never survived long enough to be seen.
              onMouseMove={(event) => {
                event.stopPropagation();
                onHover(detail(segment.key))(event);
              }}
              className="outline-2 -outline-offset-2 outline-white/85 transition-[filter,outline-color] hover:brightness-110 hover:outline"
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
        {row.label}
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
          style={{ background: UNATTRIBUTED_COLOR }}
        />
        Unattributed
      </span>
    </div>
  );
}
