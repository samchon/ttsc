"use client";

import { useMemo } from "react";

import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import TtscWebsiteBenchmarkGraphData from "./TtscWebsiteBenchmarkGraphData";
import TtscWebsiteBenchmarkGraphUi from "./TtscWebsiteBenchmarkGraphUi";
import useTtscWebsiteBenchmarkGraphData from "./useTtscWebsiteBenchmarkGraphData";

type IndexData = ITtscWebsiteBenchmarkGraph.IndexData;

const TOOLS = [
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

function fmtDuration(ms: number): string {
  return ms >= 60_000
    ? `${(ms / 60_000).toFixed(1)} min`
    : `${(ms / 1000).toFixed(1)} s`;
}

interface IndexRow {
  project: string;
  label: string;
  files: number;
  lines: number;
  builds: { tool: string; ms: number | null; failed?: boolean }[];
}

/**
 * Rows ordered by the size of the program each index was built from, so a build
 * time is read against the work it had to do: forty seconds on VS Code and one
 * second on a small backend are the same tool, not two.
 */
function buildRows(data: IndexData): IndexRow[] {
  const projects = [...new Set(data.cells.map((cell) => cell.project))];
  return projects
    .map((project) => {
      const scale = data.scale[project] ?? { files: 0, lines: 0 };
      return {
        project,
        label: TtscWebsiteBenchmarkGraphData.repoLabel(project),
        files: scale.files,
        lines: scale.lines,
        builds: TOOLS.map((tool) => {
          const cell = data.cells.find(
            (item) => item.project === project && item.tool === tool.id,
          );
          return {
            tool: tool.id,
            ms: cell?.buildMs ?? null,
            ...(cell?.failed === true ? { failed: true } : {}),
          };
        }),
      };
    })
    .sort((a, b) => a.lines - b.lines);
}

function Bars({ row, max }: { row: IndexRow; max: number }) {
  return (
    <div className="space-y-1">
      {row.builds.map((build) => {
        const tool = TOOLS.find((item) => item.id === build.tool)!;
        const width =
          build.ms === null ? 0 : Math.max(1.5, (build.ms / max) * 100);
        return (
          <div key={build.tool} className="flex items-center gap-2">
            <span
              className="w-28 shrink-0 truncate font-mono text-[10px]"
              style={{ color: tool.text }}
            >
              {tool.label}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-[#0c0e13]">
              {build.ms === null ? null : (
                <span
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${width}%`, background: tool.fill }}
                />
              )}
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-neutral-300">
              {build.ms === null
                ? build.failed === true
                  ? "failed"
                  : "—"
                : fmtDuration(build.ms)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TtscWebsiteBenchmarkGraphIndex() {
  const { report, error, loading } = useTtscWebsiteBenchmarkGraphData();
  const data = report?.index;
  const rows = useMemo(() => (data ? buildRows(data) : []), [data]);
  const max = useMemo(
    () =>
      Math.max(
        1,
        ...rows.flatMap((row) => row.builds.map((build) => build.ms ?? 0)),
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
        Loading index build times...
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );
  if (!data || rows.length === 0)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        No index build times published yet.
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  return (
    <section
      className={`${TtscWebsiteBenchmarkGraphUi.panelClass} overflow-visible`}
    >
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow="Index"
        title="Cold index build time"
        description="What readiness costs before a tool can answer its first question: the tool's index deleted, rebuilt once, wall clock. Repositories are ordered by program size."
        aside="Every tool is given the index its own documentation prescribes: codegraph init, codebase-memory in its default full mode, and serena project index — which the harness had never run until now."
      />
      <div className="space-y-4 px-5 py-4">
        {rows.map((row) => (
          <div key={row.project} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[12px] text-neutral-200">
                {row.label}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-neutral-500">
                {row.files.toLocaleString()} files ·{" "}
                {row.lines.toLocaleString()} lines
              </span>
            </div>
            <Bars row={row} max={max} />
          </div>
        ))}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-[#1a1f29] pt-3 font-mono text-[10px] text-neutral-500 sm:grid-cols-4">
          <div>
            <dt className="uppercase tracking-[0.16em]">CPU</dt>
            <dd className="text-neutral-300">{data.host.cpu}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.16em]">Cores</dt>
            <dd className="text-neutral-300">{data.host.cores}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.16em]">RAM</dt>
            <dd className="text-neutral-300">{data.host.ramGB} GB</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.16em]">OS</dt>
            <dd className="text-neutral-300">{data.host.os}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
