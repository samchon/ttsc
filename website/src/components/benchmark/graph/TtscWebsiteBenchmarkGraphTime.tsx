"use client";

import { useMemo } from "react";

import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import TtscWebsiteBenchmarkGraphData from "./TtscWebsiteBenchmarkGraphData";
import TtscWebsiteBenchmarkGraphUi from "./TtscWebsiteBenchmarkGraphUi";
import useTtscWebsiteBenchmarkGraphData from "./useTtscWebsiteBenchmarkGraphData";

type AgentCell = ITtscWebsiteBenchmarkGraph.AgentCell;
type Report = ITtscWebsiteBenchmarkGraph.Report;

const BASELINE_FILL = "linear-gradient(90deg, #6b7280, #4b5563)";
const BASELINE_TEXT = "#9ca3af";

const TOOLS = [
  {
    id: "baseline",
    label: "no MCP",
    fill: BASELINE_FILL,
    text: BASELINE_TEXT,
  },
  {
    id: "ttsc-graph",
    label: "@ttsc/graph",
    fill: TtscWebsiteBenchmarkGraphUi.TTSC_FILL,
    text: TtscWebsiteBenchmarkGraphUi.ACCENT,
  },
  {
    id: "codegraph",
    label: "codegraph",
    fill: TtscWebsiteBenchmarkGraphUi.CODEGRAPH_FILL,
    text: TtscWebsiteBenchmarkGraphUi.CODEGRAPH_TEXT,
  },
  {
    id: "codebase-memory",
    label: "codebase-memory",
    fill: TtscWebsiteBenchmarkGraphUi.CODEBASE_MEMORY_FILL,
    text: TtscWebsiteBenchmarkGraphUi.CODEBASE_MEMORY_TEXT,
  },
  {
    id: "serena",
    label: "serena",
    fill: TtscWebsiteBenchmarkGraphUi.SERENA_FILL,
    text: TtscWebsiteBenchmarkGraphUi.SERENA_TEXT,
  },
] as const;

interface TimeBar {
  tool: string;
  /** Cold index build, once per checkout; null for a tool that has none. */
  buildMs: number | null;
  /** Median wall clock the LLM spent answering, index already built. */
  answerMs: number;
}

interface TimeRow {
  project: string;
  label: string;
  lines: number;
  bars: TimeBar[];
}

/**
 * The wall clock a first answer costs from a cold checkout: build the tool's
 * index once, then ask.
 *
 * The answer time is the median over every measured cell for that repository —
 * four models, both prompt families — so the mix of fast and slow models is the
 * same for every tool, and the bars compare the tools rather than the models.
 */
function buildRows(report: Report, only?: string): TimeRow[] {
  const cells: AgentCell[] = report.agent?.cells ?? [];
  const index = report.index;
  const projects = [...new Set(cells.map((cell) => cell.repo))].filter(
    (project) => !only || project === only,
  );
  return projects
    .map((project) => {
      const scale = index?.scale[project];
      return {
        project,
        label: TtscWebsiteBenchmarkGraphData.repoLabel(project),
        lines: scale?.lines ?? 0,
        bars: TOOLS.map((tool) => {
          const durations = cells
            .filter(
              (cell) =>
                cell.repo === project &&
                TtscWebsiteBenchmarkGraphData.cellTool(cell) === tool.id,
            )
            .flatMap((cell) => [
              ...(cell.samples.baseline ?? []),
              ...(cell.samples.graph ?? []),
            ])
            .filter((sample) => sample.tokens > 0 && (sample.durMs ?? 0) > 0)
            .map((sample) => sample.durMs as number);
          const build = index?.cells.find(
            (cell) => cell.project === project && cell.tool === tool.id,
          );
          return {
            tool: tool.id,
            buildMs: build?.buildMs ?? null,
            answerMs:
              durations.length === 0
                ? 0
                : TtscWebsiteBenchmarkGraphData.median(durations),
          };
        }).filter((bar) => bar.answerMs > 0),
      };
    })
    .filter((row) => row.bars.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Compact seconds, one unit throughout: "29s", "0.8s", "731s".
 *
 * The label carries two of these side by side, and minutes beside seconds make
 * the reader convert units before the shape appears — and the shape is the
 * finding.
 */
function fmtCompact(ms: number): string {
  const seconds = ms / 1000;
  if (seconds === 0) return "0s";
  if (seconds >= 10) return `${Math.round(seconds).toLocaleString("en-US")}s`;
  return `${seconds.toFixed(1)}s`;
}

/**
 * On hover, the two waits spelled out: which tool, how long its index build
 * took, and the median wall clock the LLM spent answering with it.
 */
function TimeTooltip({
  row,
  bar,
  tool,
}: {
  row: TimeRow;
  bar: TimeBar;
  tool: (typeof TOOLS)[number];
}) {
  const build = bar.buildMs ?? 0;
  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-md border border-[#2a313e] bg-[#090b10] p-3 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] group-hover:block">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${tool.text}99, transparent)`,
        }}
      />
      <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
        {row.label}
      </p>
      <p className="mt-1 text-[12px] font-semibold" style={{ color: tool.text }}>
        {tool.label}
      </p>
      <div className="mt-2 space-y-1 font-mono text-[11px] tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">index build</span>
          <span className="text-neutral-300">
            {build > 0 ? fmtCompact(build) : "none"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">LLM answering</span>
          <span className="text-neutral-300">{fmtCompact(bar.answerMs)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-[#1c2230] pt-1">
          <span className="text-neutral-500">first answer</span>
          <span className="text-neutral-100">
            {fmtCompact(build + bar.answerMs)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Same crown the token chart draws, marking the fastest first answer. */
function CrownMark({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-3 w-3 shrink-0 items-center justify-center ${
        active ? "text-[#36e2ee]" : "text-transparent"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
        <path
          d="M2.5 5.5 5.4 8l2.6-4 2.6 4 2.9-2.5-.8 6H3.3l-.8-6Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.35"
        />
        <path
          d="M3.5 12.5h9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.35"
        />
      </svg>
    </span>
  );
}

function Bars({
  row,
  max,
  thick,
}: {
  row: TimeRow;
  max: number;
  thick: boolean;
}) {
  // Winner is the fastest first answer: the smallest index-build + LLM total.
  const bestTotal = Math.min(
    ...row.bars.map((bar) => (bar.buildMs ?? 0) + bar.answerMs),
  );
  return (
    <div className={thick ? "space-y-2" : "space-y-1"}>
      {row.bars.map((bar) => {
        const tool = TOOLS.find((item) => item.id === bar.tool)!;
        const build = bar.buildMs ?? 0;
        const total = build + bar.answerMs;
        const best = total === bestTotal;
        return (
          <div key={bar.tool} className="group relative flex items-center gap-2">
            <span
              className={`inline-flex w-32 shrink-0 items-center gap-1 truncate font-mono text-[12px] ${
                best ? "font-semibold" : ""
              }`}
              style={{ color: tool.text }}
            >
              <CrownMark active={best} />
              <span className="truncate">{tool.label}</span>
            </span>
            <div
              className={`relative flex-1 overflow-hidden rounded-sm bg-[#0c0e13] ring-1 ring-inset ${
                thick ? "h-7" : "h-4"
              } ${
                best
                  ? "shadow-[0_0_14px_rgba(54,226,238,0.16)] ring-[#d7f9ff]/70"
                  : "ring-white/[0.04]"
              }`}
            >
              {/* Rectangular two-tone: the faded index / solid LLM split must
                  read as a clean vertical seam, so no pill rounding here. */}
              <span
                className="absolute inset-y-0 left-0 flex"
                style={{ width: `${Math.max(1.5, (total / max) * 100)}%` }}
              >
                {build > 0 ? (
                  <span
                    className="h-full opacity-[0.55]"
                    style={{
                      width: `${(build / total) * 100}%`,
                      background: tool.fill,
                    }}
                  />
                ) : null}
                <span
                  className="h-full flex-1"
                  style={{ background: tool.fill }}
                />
              </span>
            </div>
            <span
              className={`w-28 shrink-0 text-right font-mono text-[13px] tabular-nums ${
                best ? "text-neutral-50" : "text-neutral-200"
              }`}
            >
              {fmtCompact(build)} / {fmtCompact(bar.answerMs)}
            </span>
            <TimeTooltip row={row} bar={bar} tool={tool} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * The legend is a worked example: the same two-tone bar the chart draws, with
 * the two waits named on their own segments.
 */
function ShadeLegend() {
  return (
    <div className="flex items-center gap-3 border-b border-[#1c212b] px-5 py-2.5">
      <span className="flex h-5 overflow-hidden rounded-sm font-mono text-[10px] font-bold leading-5">
        <span className="relative flex items-center px-2 text-neutral-100">
          <span
            className="absolute inset-0 opacity-40"
            style={{ background: TtscWebsiteBenchmarkGraphUi.TTSC_FILL as string }}
          />
          <span className="relative">index</span>
        </span>
        <span
          className="flex items-center px-2 text-[#0b0f14]"
          style={{ background: TtscWebsiteBenchmarkGraphUi.TTSC_FILL as string }}
        >
          LLM
        </span>
      </span>
      <span className="text-[12px] text-neutral-300">
        faded = index build, solid = LLM answering — each bar is labelled index
        / LLM
      </span>
    </div>
  );
}

export default function TtscWebsiteBenchmarkGraphTime({
  project,
}: {
  /** Render a single repository with thick bars, e.g. `"vscode"`. */
  project?: string;
}) {
  const { report, error, loading } = useTtscWebsiteBenchmarkGraphData();
  const rows = useMemo(
    () => (report ? buildRows(report, project) : []),
    [report, project],
  );
  const max = useMemo(
    () =>
      Math.max(
        1,
        ...rows.flatMap((row) =>
          row.bars.map((bar) => (bar.buildMs ?? 0) + bar.answerMs),
        ),
      ),
    [rows],
  );

  if (error)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Could not load graph benchmark data ({error}).
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );
  if (loading)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Loading answer times...
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );
  if (rows.length === 0)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        No answer times published yet.
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  return (
    <section
      className={`${TtscWebsiteBenchmarkGraphUi.panelClass} overflow-visible`}
    >
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow="Time"
        title={
          project
            ? `Cold time to a first answer — ${rows[0]?.label ?? project}`
            : "Cold time to a first answer"
        }
        description="Build the tool's index once, then ask. The faded segment is the index build, the solid one the median wall clock the LLM spent answering."
      />
      <ShadeLegend />
      <div className="space-y-1.5 px-3 py-3">
        {rows.map((row, index) => (
          <div
            key={row.project}
            className="space-y-1.5 rounded-lg px-3.5 py-2.5"
            style={{
              // Alternating bands, like the SVG chart, so each project reads as
              // a block before the eye starts picking tools out of it.
              backgroundColor:
                index % 2 === 0 ? "rgba(17,26,36,0.6)" : "rgba(17,26,36,0.25)",
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[13px] font-semibold text-neutral-100">
                {row.label}
              </span>
              {row.lines > 0 ? (
                <span className="font-mono text-[12px] tabular-nums text-neutral-400">
                  {row.lines.toLocaleString()} lines
                </span>
              ) : null}
            </div>
            <Bars row={row} max={max} thick={Boolean(project)} />
          </div>
        ))}
      </div>
    </section>
  );
}
