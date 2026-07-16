"use client";

import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import TtscWebsiteBenchmarkGraphData from "./TtscWebsiteBenchmarkGraphData";
import TtscWebsiteBenchmarkGraphUi from "./TtscWebsiteBenchmarkGraphUi";
import useTtscWebsiteBenchmarkGraphData from "./useTtscWebsiteBenchmarkGraphData";

type StructuralData = ITtscWebsiteBenchmarkGraph.StructuralData;

function StatCard({
  label,
  value,
  unit,
  note,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="group relative bg-white px-4 py-4 transition-colors hover:bg-[#f7fbff]">
      {accent ? (
        <span
          className="pointer-events-none absolute inset-y-3 left-0 w-px"
          style={{ background: TtscWebsiteBenchmarkGraphUi.ACCENT }}
        />
      ) : null}
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 flex items-baseline gap-1">
        <span
          className="font-mono text-[26px] font-bold leading-none tabular-nums tracking-tight"
          style={
            accent
              ? { color: TtscWebsiteBenchmarkGraphUi.ACCENT }
              : { color: "#102a43" }
          }
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-[12px] font-medium text-slate-500">
            {unit}
          </span>
        ) : null}
      </dd>
      {note ? (
        <dd
          className="mt-2 truncate font-mono text-[10px] text-slate-500"
          title={note}
        >
          {note}
        </dd>
      ) : null}
    </div>
  );
}

interface Stat {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: boolean;
}

function TtscWebsiteBenchmarkGraphStructuralPanel({
  data,
}: {
  data: StructuralData;
}) {
  const coverage =
    data.coverage !== undefined
      ? `${(data.coverage * 100).toFixed(data.coverage === 1 ? 0 : 1)}`
      : "n/a";
  const coverageDetail =
    data.coveredFiles !== undefined && data.symbolFiles !== undefined
      ? `${data.coveredFiles} of ${data.symbolFiles} symbol-bearing files`
      : undefined;

  const stats: Stat[] = [
    {
      label: "Source files",
      value:
        data.sourceFiles !== undefined
          ? TtscWebsiteBenchmarkGraphData.fmt(data.sourceFiles)
          : "n/a",
    },
    {
      label: "Nodes",
      value:
        data.nodes !== undefined
          ? TtscWebsiteBenchmarkGraphData.fmt(data.nodes)
          : "n/a",
      note:
        data.externalNodes !== undefined
          ? `${data.externalNodes} external`
          : undefined,
    },
    {
      label: "Total edges",
      value:
        data.totalEdges !== undefined
          ? TtscWebsiteBenchmarkGraphData.fmt(data.totalEdges)
          : "n/a",
      note: data.edges
        ? [
            data.edges.heritage !== undefined
              ? `heritage ${data.edges.heritage}`
              : null,
            data.edges["type-ref"] !== undefined
              ? `type-ref ${data.edges["type-ref"]}`
              : null,
            data.edges["value-call"] !== undefined
              ? `value-call ${data.edges["value-call"]}`
              : null,
          ]
            .filter(Boolean)
            .join(" / ")
        : undefined,
    },
    {
      label: "Fair coverage",
      value: coverage,
      unit: coverage === "n/a" ? undefined : "%",
      note: coverageDetail,
      accent: true,
    },
  ];

  const timingStats: Stat[] = [];
  if (data.loadMsMedian !== undefined)
    timingStats.push({
      label: "Load median",
      value: `${Math.round(data.loadMsMedian)}`,
      unit: "ms",
    });
  if (data.buildMsMedian !== undefined)
    timingStats.push({
      label: "Graph build median",
      value: `${Math.round(data.buildMsMedian)}`,
      unit: "ms",
    });

  return (
    <section className={TtscWebsiteBenchmarkGraphUi.panelClass}>
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow="Structural coverage"
        title="What the graph actually resolves"
        description="Node and edge counts plus the share of symbol-bearing source files with at least one resolved cross-file edge."
      />

      <dl className="grid grid-cols-2 gap-px bg-[#b9d5ee] xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </dl>

      {timingStats.length > 0 ? (
        <dl className="grid grid-cols-2 gap-px border-t border-[#b9d5ee] bg-[#b9d5ee] sm:grid-cols-4">
          {timingStats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </dl>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main export

export default function TtscWebsiteBenchmarkGraphStructural() {
  const { report, error, loading } = useTtscWebsiteBenchmarkGraphData();

  if (error)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Could not load graph benchmark data ({error}).
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  if (loading)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Loading graph benchmark results...
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  if (!report?.structural) return null;

  return (
    <div className="not-prose my-6 space-y-5">
      <TtscWebsiteBenchmarkGraphStructuralPanel data={report.structural} />
    </div>
  );
}
