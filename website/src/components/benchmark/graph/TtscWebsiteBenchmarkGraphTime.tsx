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
  /** Median wall clock the agent spent answering, index already built. */
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
function buildRows(report: Report): TimeRow[] {
  const cells: AgentCell[] = report.agent?.cells ?? [];
  const index = report.index;
  const projects = [...new Set(cells.map((cell) => cell.repo))];
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
    .sort((a, b) => a.lines - b.lines);
}

function fmtDuration(ms: number): string {
  return ms >= 60_000
    ? `${(ms / 60_000).toFixed(1)} min`
    : `${Math.round(ms / 1000)} s`;
}

function Bars({ row, max }: { row: TimeRow; max: number }) {
  return (
    <div className="space-y-1">
      {row.bars.map((bar) => {
        const tool = TOOLS.find((item) => item.id === bar.tool)!;
        const build = bar.buildMs ?? 0;
        const total = build + bar.answerMs;
        return (
          <div key={bar.tool} className="flex items-center gap-2">
            <span
              className="w-28 shrink-0 truncate font-mono text-[10px]"
              style={{ color: tool.text }}
            >
              {tool.label}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-[#0c0e13]">
              <span
                className="absolute inset-y-0 left-0 flex"
                style={{ width: `${Math.max(1.5, (total / max) * 100)}%` }}
              >
                {build > 0 ? (
                  <span
                    className="h-full rounded-l-sm opacity-40"
                    style={{
                      width: `${(build / total) * 100}%`,
                      background: tool.fill,
                    }}
                  />
                ) : null}
                <span
                  className="h-full flex-1 rounded-r-sm"
                  style={{ background: tool.fill }}
                />
              </span>
            </div>
            <span className="w-28 shrink-0 text-right font-mono text-[11px] tabular-nums text-neutral-300">
              {fmtDuration(total)}
              {build > 0 ? (
                <span className="text-neutral-500">
                  {" "}
                  ({fmtDuration(build)} build)
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TtscWebsiteBenchmarkGraphTime() {
  const { report, error, loading } = useTtscWebsiteBenchmarkGraphData();
  const rows = useMemo(() => (report ? buildRows(report) : []), [report]);
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
        title="Cold time to a first answer"
        description="Build the tool's index once, then ask: the faded segment is the index build, the solid one the median wall clock the agent spent answering. Repositories are ordered by program size."
        aside="Answer time is the median across four models and both prompt families, so every tool faces the same mix."
      />
      <div className="space-y-4 px-5 py-4">
        {rows.map((row) => (
          <div key={row.project} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[12px] text-neutral-200">
                {row.label}
              </span>
              {row.lines > 0 ? (
                <span className="font-mono text-[10px] tabular-nums text-neutral-500">
                  {row.lines.toLocaleString()} lines
                </span>
              ) : null}
            </div>
            <Bars row={row} max={max} />
          </div>
        ))}
      </div>
    </section>
  );
}
