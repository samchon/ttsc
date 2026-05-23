"use client";

import { useEffect, useState } from "react";

import HostPanel from "./HostPanel";
import { findMeasurement, formatDuration, formatMultiplier } from "./format";
import type {
  BenchmarkMeasurement,
  BenchmarkProject,
  BenchmarkReport,
  BenchmarkThreading,
} from "./types";

type BenchmarkTab = "summary" | "build" | "check" | "lint" | "format";
type Operation = "build" | "noEmit";
type Threading = BenchmarkThreading;

const TABS: { id: BenchmarkTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "build", label: "Build" },
  { id: "check", label: "Type-check" },
  { id: "lint", label: "Lint" },
  { id: "format", label: "Format" },
];

const panelClass =
  "overflow-hidden rounded-md border border-[#262b36] bg-[#0f1115] shadow-[0_12px_30px_rgba(0,0,0,0.22)]";
const panelHeaderClass =
  "flex flex-wrap items-end justify-between gap-2 border-b border-[#262b36] bg-[#121620] px-4 py-3";

export default function BenchmarkDashboard() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BenchmarkTab>(() =>
    typeof window === "undefined"
      ? "summary"
      : tabFromHash(window.location.hash),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/benchmark.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<BenchmarkReport>;
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveTab(tabFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (error)
    return (
      <p className="not-prose my-6 rounded-md border border-[#262b36] bg-[#0f1115] px-4 py-3 font-mono text-[12px] text-neutral-400">
        Could not load benchmark data ({error}).
      </p>
    );

  if (!report)
    return (
      <p className="not-prose my-6 rounded-md border border-[#262b36] bg-[#0f1115] px-4 py-3 font-mono text-[12px] text-neutral-400">
        Loading benchmark results…
      </p>
    );

  return (
    <div className="not-prose my-6 space-y-5">
      <Snapshot report={report} />
      <nav
        aria-label="Benchmark views"
        className="flex gap-1 overflow-x-auto rounded-md border border-[#262b36] bg-[#0f1115] p-1"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`shrink-0 rounded px-3 py-1.5 text-[13px] font-medium ${
                active
                  ? "bg-[#202838] text-neutral-50 shadow-sm"
                  : "text-neutral-400 hover:bg-[#171d28] hover:text-neutral-100"
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                window.history.replaceState(null, "", `#${tab.id}`);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "summary" ? <SummaryTab report={report} /> : null}
      {activeTab === "build" ? (
        <OperationTab
          report={report}
          op="build"
          title="Build"
          description="Each project groups tsc (legacy), ttsc ST/MT, and optional tsgo ST/MT in one chart."
        />
      ) : null}
      {activeTab === "check" ? (
        <OperationTab
          report={report}
          op="noEmit"
          title="Type-check"
          description="Each project groups tsc (legacy), ttsc ST/MT, and optional tsgo ST/MT in one noEmit chart."
        />
      ) : null}
      {activeTab === "lint" ? <LintTab report={report} /> : null}
      {activeTab === "format" ? <FormatTab report={report} /> : null}
    </div>
  );
}

function tabFromHash(hash: string): BenchmarkTab {
  const id = hash.replace(/^#/, "");
  return TABS.some((tab) => tab.id === id) ? (id as BenchmarkTab) : "summary";
}

function Snapshot({ report }: { report: BenchmarkReport }) {
  const best = bestRatio(report);
  const totalMeasurements = report.projects.reduce(
    (sum, project) => sum + project.measurements.length,
    0,
  );
  const totalSamples = report.projects.reduce(
    (sum, project) =>
      sum +
      project.measurements.reduce(
        (inner, measurement) => inner + (measurement.samples?.length ?? 0),
        0,
      ),
    0,
  );
  const stats = [
    { label: "Projects", value: report.projects.length.toLocaleString() },
    { label: "Measurements", value: totalMeasurements.toLocaleString() },
    {
      label: "Samples",
      value: totalSamples > 0 ? totalSamples.toLocaleString() : "not recorded",
    },
    {
      label: "Runs per cell",
      value:
        report.runs === undefined
          ? "not recorded"
          : `${report.runs} measured` +
            (report.warmup ? ` + ${report.warmup} warmup` : ""),
    },
    {
      label: "Best ratio",
      value: best ? formatMultiplier(best.factor) : "-",
      note: best ? `${best.project.name}: ${best.label}` : undefined,
    },
    { label: "Measured", value: formatDate(report.date) },
  ];

  return (
    <section className={panelClass}>
      <div className="border-b border-[#262b36] bg-[#121620] px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-50">
          Benchmark Snapshot
        </h2>
        <p className="mt-1 text-[13px] text-neutral-400">
          Prepared-clone wall-clock timings. Ratios use median command times
          from the generated benchmark JSON.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-[#262b36] md:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#0f1115] px-4 py-3">
            <dt className="font-mono text-[11px] uppercase text-neutral-500">
              {stat.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-50">
              {stat.value}
            </dd>
            {stat.note ? (
              <dd
                className="mt-1 truncate text-[11px] text-neutral-500"
                title={stat.note}
              >
                {stat.note}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function SummaryTab({ report }: { report: BenchmarkReport }) {
  const build = bestOperationProject(report, "build");
  const check = bestOperationProject(report, "noEmit");
  const lint = bestLintProject(report, "noEmit");
  const format = bestFormatProject(report);

  return (
    <div className="space-y-4">
      <HostPanel host={report.host} date={report.date} />
      <section className={panelClass}>
        <TableHeader
          title="Summary Winners"
          description="Each field keeps only the fastest project, but still shows the full tool group."
          suffix={`${[build, check, lint, format].filter(Boolean).length} fields`}
        />
        <div className="divide-y divide-[#252b36]">
          {build ? (
            <ProjectOperationRows
              project={build.project}
              op="build"
              title="Build"
            />
          ) : null}
          {check ? (
            <ProjectOperationRows
              project={check.project}
              op="noEmit"
              title="Type-check"
            />
          ) : null}
          {lint ? (
            <ProjectLintRows
              project={lint.project}
              op="noEmit"
              title="Lint"
            />
          ) : null}
          {format ? (
            <ProjectFormatRows project={format.project} title="Format" />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function OperationTab({
  report,
  op,
  title,
  description,
}: {
  report: BenchmarkReport;
  op: Operation;
  title: string;
  description: string;
}) {
  const projects = report.projects.filter((project) =>
    hasComparableOperation(project, op),
  );
  const hero = bestOperationProject(report, op);

  return (
    <div className="space-y-4">
      <HeroRatio winner={hero} scope={title} />
      <section className={panelClass}>
        <TableHeader
          title={`${title} Tool Matrix`}
          description={description}
          suffix={`${projects.length.toLocaleString()} projects`}
        />
        <div className="divide-y divide-[#252b36]">
          {projects.length > 0 ? (
            projects.map((project) => (
              <ProjectOperationRows
                key={`${project.name}:${op}`}
                project={project}
                op={op}
              />
            ))
          ) : (
            <p className="px-4 py-4 text-[12px] text-neutral-500">
              No comparable measurements recorded for this view.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ProjectOperationRows({
  project,
  op,
  title,
}: {
  project: BenchmarkProject;
  op: Operation;
  title?: string;
}) {
  const rows = operationRows(project, op);
  const baseline = rows.find((row) => row.baseline);
  const maxMs = Math.max(
    1,
    ...rows.map((row) => row.measurement.medianMs).filter((ms) => ms > 0),
  );

  if (!baseline || rows.length <= 1) return null;

  const best = rows
    .filter((row) => !row.baseline && row.measurement.medianMs > 0)
    .reduce<{ factor: number; label: string } | undefined>((acc, row) => {
      const factor = baseline.measurement.medianMs / row.measurement.medianMs;
      return !acc || factor > acc.factor ? { factor, label: row.label } : acc;
    }, undefined);

  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]">
      <ProjectLabel
        project={project}
        title={title}
        baselineMs={baseline.measurement.medianMs}
        bestFactor={best?.factor}
        bestLabel={best?.label}
      />
      <div className="space-y-1.5">
        {rows.map((row) => (
          <DurationBar
            key={`${project.name}:${op}:${row.label}`}
            label={row.label}
            ms={row.measurement.medianMs}
            maxMs={maxMs}
            color={row.color}
            ratio={
              row.baseline
                ? "baseline"
                : formatMultiplier(
                    baseline.measurement.medianMs / row.measurement.medianMs,
                  )
            }
            baseline={row.baseline}
          />
        ))}
      </div>
    </div>
  );
}

function LintTab({ report }: { report: BenchmarkReport }) {
  const projects = report.projects.filter((project) =>
    hasComparableLint(project, "noEmit"),
  );
  const hero = bestLintProject(report, "noEmit");

  return (
    <div className="space-y-4">
      <HeroRatio winner={hero} scope="Lint" />
      <LintMatrix
        title="Lint Tool Matrix"
        description="Legacy stacks tsc --noEmit plus ESLint; ttsc-lint stacks ttsc --noEmit plus the @ttsc/lint overhead."
        projects={projects}
        op="noEmit"
      />
    </div>
  );
}

function LintMatrix({
  title,
  description,
  projects,
  op,
}: {
  title: string;
  description: string;
  projects: BenchmarkProject[];
  op: Operation;
}) {
  return (
    <section className={panelClass}>
      <TableHeader
        title={title}
        description={description}
        suffix={`${projects.length.toLocaleString()} projects`}
      />
      <div className="divide-y divide-[#252b36]">
        {projects.length > 0 ? (
          projects.map((project) => (
            <ProjectLintRows
              key={`${project.name}:${op}:lint`}
              project={project}
              op={op}
            />
          ))
        ) : (
          <p className="px-4 py-4 text-[12px] text-neutral-500">
            No comparable lint measurements recorded for this view.
          </p>
        )}
      </div>
    </section>
  );
}

function ProjectLintRows({
  project,
  op,
  title,
}: {
  project: BenchmarkProject;
  op: Operation;
  title?: string;
}) {
  const rows = lintRowsForProject(project, op);
  const baseline = rows.find((row) => row.baseline);
  const maxMs = Math.max(1, ...rows.map((row) => row.totalMs));

  if (!baseline || rows.length <= 1) return null;

  // Lint's "best" is the lint-pass-only ratio (ESLint time vs @ttsc/lint
  // overhead) — that's the multiplier the dashboard is actually selling.
  // Total-stack ratio (`tsc + eslint` vs `ttsc + @ttsc/lint`) lives in the
  // bars on the right and reads ~10–20x; the isolated lint factor reads
  // ~50x+ because eslint alone is the slow side.
  const best = rows
    .filter((row) => !row.baseline && (row.lintFactor ?? 0) > 0)
    .reduce<{ factor: number; label: string } | undefined>((acc, row) => {
      const factor = row.lintFactor!;
      return !acc || factor > acc.factor ? { factor, label: row.label } : acc;
    }, undefined);

  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]">
      <ProjectLabel
        project={project}
        title={title}
        baselineMs={baseline.totalMs}
        bestFactor={best?.factor}
        bestLabel={best?.label}
      />
      <div className="space-y-1.5">
        {rows.map((row) => (
          <StackedDurationBar
            key={`${project.name}:${op}:${row.label}`}
            label={row.label}
            totalMs={row.totalMs}
            maxMs={maxMs}
            ratio={row.baseline ? "baseline" : undefined}
            lintRatio={
              row.baseline ? undefined : lintRatioParts(baseline.totalMs, row)
            }
            baseline={row.baseline}
            estimated={row.estimated}
            segments={row.segments}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectLabel({
  project,
  title,
  baselineMs,
  bestFactor,
  bestLabel,
}: {
  project: BenchmarkProject;
  title?: string;
  baselineMs: number;
  bestFactor?: number;
  bestLabel?: string;
}) {
  return (
    <div>
      {title ? (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-300">
          {title}
        </p>
      ) : null}
      <p className="font-mono text-sm font-semibold text-neutral-100">
        {project.name}
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">
        {project.files.toLocaleString()} files
      </p>
      <p className="mt-2 font-mono text-[11px] text-neutral-400">
        baseline: {formatDuration(baselineMs)}
      </p>
      {bestFactor !== undefined ? (
        <div className="mt-3" title={bestLabel}>
          <div
            className={`font-mono text-3xl font-bold leading-none md:text-4xl ${
              bestFactor >= 1 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {formatMultiplier(bestFactor)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            best
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DurationBar({
  label,
  ms,
  maxMs,
  color,
  ratio,
  baseline,
}: {
  label: string;
  ms: number;
  maxMs: number;
  color: string;
  ratio: string;
  baseline?: boolean;
}) {
  const widthPct = Math.max(4, (ms / maxMs) * 100);

  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p
          className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-400"
          title={label}
        >
          {label}
        </p>
        <div className="flex shrink-0 items-baseline gap-2 font-mono text-[11px]">
          <span className="text-neutral-400">{formatDuration(ms)}</span>
          <span
            className={
              baseline ? "text-neutral-500" : "font-semibold text-emerald-300"
            }
          >
            {ratio}
          </span>
        </div>
      </div>
      <div className="h-5 w-full rounded bg-[#171d28]">
        <div
          className={`h-full rounded ${color}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function StackedDurationBar({
  label,
  totalMs,
  maxMs,
  ratio,
  lintRatio,
  baseline,
  estimated,
  segments,
}: {
  label: string;
  totalMs: number;
  maxMs: number;
  ratio?: string;
  lintRatio?: LintRatioParts;
  baseline?: boolean;
  estimated?: boolean;
  segments: { label: string; ms: number; color: string }[];
}) {
  const widthPct = Math.max(4, (totalMs / maxMs) * 100);
  const labelTooltip = estimated
    ? `${label} — estimated from MT ratio; ST lint overhead measured below the noise floor`
    : label;

  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p
          className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-400"
          title={labelTooltip}
        >
          {label}
        </p>
        <div className="flex shrink-0 items-baseline gap-2 font-mono text-[11px]">
          <span className="text-neutral-400">{formatDuration(totalMs)}</span>
          {lintRatio ? (
            <>
              <span className="font-semibold text-sky-300">
                {lintRatio.total}
              </span>
              <span className="font-semibold text-emerald-300">
                {lintRatio.lint}
              </span>
            </>
          ) : (
            <span className="text-neutral-500">{ratio}</span>
          )}
        </div>
      </div>
      <p className="mb-1.5 break-words font-mono text-[10px] text-neutral-500">
        (
        {segments
          .map((segment) => `${segment.label} ${formatDuration(segment.ms)}`)
          .join(" + ")}
        )
      </p>
      <div className="h-6 w-full rounded bg-[#171d28]">
        <div
          className="flex h-full overflow-hidden rounded"
          style={{ width: `${widthPct}%` }}
        >
          {segments.map((segment) => {
            const segmentPct =
              segment.ms > 0 && totalMs > 0
                ? Math.max(3, (segment.ms / totalMs) * 100)
                : 0;
            return (
              <div
                key={segment.label}
                className={`h-full ${segment.color}`}
                style={{ width: `${segmentPct}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TableHeader({
  title,
  description,
  suffix,
}: {
  title: string;
  description: string;
  suffix: string;
}) {
  return (
    <div className={panelHeaderClass}>
      <div>
        <h2 className="text-base font-semibold text-neutral-50">{title}</h2>
        <p className="mt-1 text-[13px] text-neutral-400">{description}</p>
      </div>
      <p className="font-mono text-[11px] uppercase text-neutral-500">
        {suffix}
      </p>
    </div>
  );
}

type MeasurementOptions = Partial<
  Pick<BenchmarkMeasurement, "branch" | "tool" | "op" | "threading">
>;

interface OperationRow {
  label: string;
  measurement: BenchmarkMeasurement;
  color: string;
  baseline?: boolean;
}

interface LintSegment {
  label: string;
  ms: number;
  color: string;
}

interface LintRow {
  project: BenchmarkProject;
  op: Operation;
  threading: Threading;
  label: string;
  totalMs: number;
  segments: LintSegment[];
  baseline?: boolean;
  eslintMs?: number;
  lintOverheadMs?: number;
  lintFactor?: number;
  estimated?: boolean;
}

interface LintRatioParts {
  total: string;
  lint: string;
}

interface Winner {
  project: BenchmarkProject;
  label: string;
  factor: number;
}

function operationRows(
  project: BenchmarkProject,
  op: Operation,
): OperationRow[] {
  const rows: OperationRow[] = [];
  const measurements = project.measurements;
  const baseline = findMeasured(measurements, {
    branch: "legacy",
    tool: "tsc",
    op,
    threading: "multi",
  });

  if (baseline)
    rows.push({
      label: compilerCliLabel("tsc", op, "multi"),
      measurement: baseline,
      color: "bg-neutral-500",
      baseline: true,
    });

  for (const threading of TTSC_THREADING_SPECTRUM) {
    const measurement = findMeasured(measurements, {
      branch: "ttsc",
      tool: "ttsc",
      op,
      threading,
    });
    if (measurement)
      rows.push({
        label: compilerCliLabel("ttsc", op, threading),
        measurement,
        color: ttscBarColor(threading),
      });
  }

  for (const threading of TTSC_THREADING_SPECTRUM) {
    const measurement = findMeasured(measurements, {
      branch: "ttsc",
      tool: "tsgo",
      op,
      threading,
    });
    if (measurement)
      rows.push({
        label: compilerCliLabel("tsgo", op, threading),
        measurement,
        color: tsgoBarColor(threading),
      });
  }

  return rows;
}

function lintRowsForProject(
  project: BenchmarkProject,
  op: Operation,
): LintRow[] {
  const measurements = project.measurements;
  const rows: LintRow[] = [];
  const tsc = findMeasured(measurements, {
    branch: "legacy",
    tool: "tsc",
    op,
    threading: "multi",
  });
  const eslint = findLegacyEslint(measurements, op);

  if (tsc && eslint)
    rows.push({
      project,
      op,
      threading: "multi",
      label: "tsc + eslint",
      totalMs: tsc.medianMs + eslint.medianMs,
      baseline: true,
      eslintMs: eslint.medianMs,
      segments: [
        { label: "tsc", ms: tsc.medianMs, color: "bg-neutral-500" },
        { label: "ESLint", ms: eslint.medianMs, color: "bg-amber-500" },
      ],
    });

  // Snapshot the raw per-threading numbers so we can back-fill the ST row's
  // lint overhead from the MT ratio when the ST measurement lands below the
  // noise floor (lint <= ttsc plain). Without the back-fill, the ST row
  // collapses to a 0 ms overhead and downstream factor math produces
  // `Infinity`/`NaN` in the chart.
  const ttscByThreading: Partial<
    Record<Threading, { plainMs: number; totalMs: number; rawOverhead: number }>
  > = {};
  for (const threading of TTSC_THREADING_SPECTRUM) {
    const total = findTtscLintTotal(measurements, op, threading);
    const plainTtsc = findMeasured(measurements, {
      branch: "ttsc",
      tool: "ttsc",
      op,
      threading,
    });
    if (!total || !plainTtsc) continue;
    ttscByThreading[threading] = {
      plainMs: plainTtsc.medianMs,
      totalMs: total.medianMs,
      rawOverhead: total.medianMs - plainTtsc.medianMs,
    };
  }

  for (const threading of TTSC_THREADING_SPECTRUM) {
    const current = ttscByThreading[threading];
    if (!current) continue;

    const { plainMs, totalMs, rawOverhead } = current;
    let lintOverheadMs = Math.max(0, rawOverhead);
    let estimated = false;

    // ST back-fill: when the single-threaded lint cost cannot be observed
    // (overhead <= 0 in raw timings) the checker spectrum is sweeping
    // around the noise floor on the ST end. Synthesize the ST overhead
    // from `checkers8`'s ratio — the fastest spectrum point and the
    // closest to the pre-spectrum "multi" baseline:
    //   ST_synthetic = round(ST_plain * (C8_overhead / C8_plain))
    // The synthetic row is tagged `estimated` so the renderer can mark
    // it as a derived figure rather than a measurement.
    if (threading === "single" && rawOverhead <= 0) {
      const fast = ttscByThreading.checkers8 ?? ttscByThreading.multi;
      if (fast && fast.plainMs > 0 && fast.rawOverhead > 0) {
        lintOverheadMs = Math.round(
          plainMs * (fast.rawOverhead / fast.plainMs),
        );
        estimated = lintOverheadMs > 0;
      }
    }

    const ttscMs = estimated ? plainMs : Math.min(plainMs, totalMs);
    const adjustedTotalMs = estimated ? ttscMs + lintOverheadMs : totalMs;
    const flagSuffix = formatFlagLabel(threading);
    const baseLabel = "ttsc + @ttsc/lint";
    const label = estimated
      ? `${baseLabel} (${flagSuffix}, est.)`
      : flagSuffix
        ? `${baseLabel} (${flagSuffix})`
        : baseLabel;

    rows.push({
      project,
      op,
      threading,
      label,
      totalMs: adjustedTotalMs,
      eslintMs: eslint?.medianMs,
      lintOverheadMs,
      lintFactor:
        eslint && lintOverheadMs > 0
          ? eslint.medianMs / lintOverheadMs
          : undefined,
      estimated,
      segments: [
        { label: "ttsc", ms: ttscMs, color: "bg-cyan-500" },
        {
          label: "@ttsc/lint",
          ms: lintOverheadMs,
          color: "bg-emerald-400",
        },
      ],
    });
  }

  return rows;
}

function hasComparableOperation(project: BenchmarkProject, op: Operation) {
  const rows = operationRows(project, op);
  return rows.some((row) => row.baseline) && rows.some((row) => !row.baseline);
}

function hasComparableLint(project: BenchmarkProject, op: Operation) {
  const rows = lintRowsForProject(project, op);
  return rows.some((row) => row.baseline) && rows.some((row) => !row.baseline);
}

/**
 * Hero panel: the biggest single speedup across the tab's scope rendered
 * at oversized point size on the left, with the project + cell label
 * underneath. Rendered above Build / Type-check / Lint / Format tabs
 * (NOT the Summary tab — that one's per-project label badges already
 * carry the per-project best).
 */
function HeroRatio({
  winner,
  scope,
}: {
  winner: Winner | undefined;
  scope: string;
}) {
  if (!winner) return null;
  return (
    <section
      className={`${panelClass} flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center`}
    >
      <div className="flex-shrink-0">
        <div
          className="font-mono text-5xl font-bold leading-none text-emerald-300 md:text-6xl"
          title={`${winner.project.name}: ${winner.label}`}
        >
          {formatMultiplier(winner.factor)}
        </div>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          {scope} winner
        </div>
      </div>
      <div className="text-[13px] text-neutral-300 md:ml-6">
        <div className="font-semibold text-neutral-50">
          {winner.project.name}
        </div>
        <div className="mt-0.5 text-neutral-400">{winner.label}</div>
      </div>
    </section>
  );
}

function bestRatio(report: BenchmarkReport): Winner | undefined {
  return [
    bestOperationProject(report, "build"),
    bestOperationProject(report, "noEmit"),
    bestLintProject(report, "noEmit"),
    bestFormatProject(report),
  ].reduce<Winner | undefined>(
    (best, current) =>
      current && (!best || current.factor > best.factor) ? current : best,
    undefined,
  );
}


function bestOperationProject(
  report: BenchmarkReport,
  op: Operation,
): Winner | undefined {
  return report.projects.reduce<Winner | undefined>((best, project) => {
    const rows = operationRows(project, op);
    const baseline = rows.find((row) => row.baseline);
    if (!baseline) return best;

    const winner = rows
      .filter((row) => !row.baseline)
      .reduce<Winner | undefined>((innerBest, row) => {
        const factor = baseline.measurement.medianMs / row.measurement.medianMs;
        const current = {
          project,
          label: `${op === "build" ? "Build" : "Type-check"} ${row.label}`,
          factor,
        };
        return !innerBest || current.factor > innerBest.factor
          ? current
          : innerBest;
      }, undefined);

    return winner && (!best || winner.factor > best.factor) ? winner : best;
  }, undefined);
}

function bestFormatProject(report: BenchmarkReport): Winner | undefined {
  return report.projects.reduce<Winner | undefined>((best, project) => {
    const rows = formatRowsForProject(project);
    const baseline = rows.find((row) => row.baseline);
    if (!baseline) return best;
    const winner = rows
      .filter((row) => !row.baseline)
      .reduce<Winner | undefined>((innerBest, row) => {
        const factor = baseline.measurement.medianMs / row.measurement.medianMs;
        const current = {
          project,
          label: `Format ${row.label}`,
          factor,
        };
        return !innerBest || current.factor > innerBest.factor
          ? current
          : innerBest;
      }, undefined);
    return winner && (!best || winner.factor > best.factor) ? winner : best;
  }, undefined);
}

function bestLintProject(
  report: BenchmarkReport,
  op: Operation,
): Winner | undefined {
  return report.projects.reduce<Winner | undefined>((best, project) => {
    const rows = lintRowsForProject(project, op);
    const baseline = rows.find((row) => row.baseline);
    if (!baseline) return best;

    // Use the isolated lint-pass ratio (`eslintMs / lintOverheadMs`) so the
    // headline number reflects how much faster the lint pass alone is —
    // not the total-stack ratio which is dragged down by the shared
    // type-check that both sides pay.
    const winner = rows
      .filter((row) => !row.baseline && (row.lintFactor ?? 0) > 0)
      .reduce<Winner | undefined>((innerBest, row) => {
        const factor = row.lintFactor!;
        const current = {
          project,
          label: `Lint ${row.label}`,
          factor,
        };
        return !innerBest || current.factor > innerBest.factor
          ? current
          : innerBest;
      }, undefined);

    return winner && (!best || winner.factor > best.factor) ? winner : best;
  }, undefined);
}

function lintRatioParts(baselineMs: number, row: LintRow): LintRatioParts {
  const total = formatMultiplier(baselineMs / row.totalMs);
  const lint = `${formatMultiplier(row.lintFactor ?? 0)} lint`;
  return { total: `${total} total`, lint };
}

function findMeasured(
  measurements: BenchmarkMeasurement[],
  options: MeasurementOptions,
): BenchmarkMeasurement | undefined {
  const measurement = findMeasurement(measurements, options);
  return measurement && measurement.medianMs > 0 ? measurement : undefined;
}

function findLegacyEslint(
  measurements: BenchmarkMeasurement[],
  op: Operation,
): BenchmarkMeasurement | undefined {
  return (
    findMeasured(measurements, {
      branch: "legacy",
      tool: "eslint",
      op,
      threading: "multi",
    }) ??
    findMeasured(measurements, {
      branch: "legacy",
      tool: "eslint",
      op: "eslint",
      threading: "multi",
    }) ??
    measurements.find(
      (measurement) =>
        measurement.branch === "legacy" &&
        measurement.tool === "eslint" &&
        measurement.medianMs > 0,
    )
  );
}

function FormatTab({ report }: { report: BenchmarkReport }) {
  const projects = report.projects.filter(hasComparableFormat);
  const hero = bestFormatProject(report);

  return (
    <div className="space-y-4">
      <HeroRatio winner={hero} scope="Format" />
      <section className={panelClass}>
        <TableHeader
          title="Format Tool Matrix"
          description="Prettier (legacy) vs ttsc format (ttsc-lint), across the threading spectrum."
          suffix={`${projects.length.toLocaleString()} projects`}
        />
        <div className="divide-y divide-[#252b36]">
          {projects.length > 0 ? (
            projects.map((project) => (
              <ProjectFormatRows
                key={`${project.name}:format`}
                project={project}
              />
            ))
          ) : (
            <p className="px-4 py-4 text-[12px] text-neutral-500">
              No comparable format measurements recorded for this view.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ProjectFormatRows({
  project,
  title,
}: {
  project: BenchmarkProject;
  title?: string;
}) {
  const rows = formatRowsForProject(project);
  const baseline = rows.find((row) => row.baseline);
  const maxMs = Math.max(
    1,
    ...rows.map((row) => row.measurement.medianMs).filter((ms) => ms > 0),
  );

  if (!baseline || rows.length <= 1) return null;

  const best = rows
    .filter((row) => !row.baseline && row.measurement.medianMs > 0)
    .reduce<{ factor: number; label: string } | undefined>((acc, row) => {
      const factor = baseline.measurement.medianMs / row.measurement.medianMs;
      return !acc || factor > acc.factor ? { factor, label: row.label } : acc;
    }, undefined);

  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]">
      <ProjectLabel
        project={project}
        title={title}
        baselineMs={baseline.measurement.medianMs}
        bestFactor={best?.factor}
        bestLabel={best?.label}
      />
      <div className="space-y-1.5">
        {rows.map((row) => (
          <DurationBar
            key={`${project.name}:format:${row.label}`}
            label={row.label}
            ms={row.measurement.medianMs}
            maxMs={maxMs}
            color={row.color}
            ratio={
              row.baseline
                ? "baseline"
                : formatMultiplier(
                    baseline.measurement.medianMs / row.measurement.medianMs,
                  )
            }
            baseline={row.baseline}
          />
        ))}
      </div>
    </div>
  );
}

function formatRowsForProject(project: BenchmarkProject): OperationRow[] {
  const rows: OperationRow[] = [];
  const measurements = project.measurements;
  const prettier = measurements.find(
    (m) =>
      m.branch === "legacy" &&
      m.op === "format" &&
      m.threading === "multi" &&
      m.medianMs > 0,
  );
  if (prettier)
    rows.push({
      label: "prettier --check",
      measurement: prettier,
      color: "bg-amber-500",
      baseline: true,
    });
  for (const threading of TTSC_THREADING_SPECTRUM) {
    const ttscFormat = measurements.find(
      (m) =>
        m.branch === "ttsc-lint" &&
        m.op === "format" &&
        m.threading === threading &&
        m.medianMs > 0,
    );
    if (ttscFormat)
      rows.push({
        label: `ttsc format ${formatFlagLabel(threading)}`.trim(),
        measurement: ttscFormat,
        color: ttscBarColor(threading),
      });
  }
  return rows;
}

/** CLI flag suffix for a threading variant, used by chart labels. */
function formatFlagLabel(threading: Threading): string {
  switch (threading) {
    case "single":
      return "--singleThreaded";
    case "checkers2":
      return "--checkers 2";
    case "checkers4":
      return "--checkers 4";
    case "checkers8":
      return "--checkers 8";
    case "multi":
      return "";
  }
}

function hasComparableFormat(project: BenchmarkProject): boolean {
  const rows = formatRowsForProject(project);
  return rows.some((row) => row.baseline) && rows.some((row) => !row.baseline);
}

function findTtscLintTotal(
  measurements: BenchmarkMeasurement[],
  op: Operation,
  threading: Threading,
): BenchmarkMeasurement | undefined {
  return (
    findMeasured(measurements, {
      branch: "ttsc-lint",
      tool: "ttsc+@ttsc/lint",
      op,
      threading,
    }) ??
    measurements.find(
      (measurement) =>
        measurement.branch === "ttsc-lint" &&
        measurement.op === op &&
        measurement.threading === threading &&
        measurement.tool !== "@ttsc/lint" &&
        measurement.tool !== "eslint" &&
        measurement.tool !== "prettier" &&
        measurement.medianMs > 0,
    )
  );
}

function compilerCliLabel(
  tool: "tsc" | "ttsc" | "tsgo",
  op: Operation,
  threading: Threading,
) {
  const parts: string[] = [tool];
  if (op === "noEmit") parts.push("--noEmit");
  if (tool === "tsc") return parts.join(" ");
  if (threading === "single") parts.push("--singleThreaded");
  else if (threading === "checkers2") parts.push("--checkers 2");
  else if (threading === "checkers4") parts.push("--checkers 4");
  else if (threading === "checkers8") parts.push("--checkers 8");
  // legacy "multi" had no extra flag — render bare so older snapshots
  // keep rendering without a stale flag in the chart label.
  return parts.join(" ");
}

/** Threading variants the ttsc/tsgo rows iterate, in display order. */
const TTSC_THREADING_SPECTRUM: readonly Threading[] = [
  "single",
  "checkers2",
  "checkers4",
  "checkers8",
];

/**
 * Tailwind class for the bar of a threading variant. The spectrum reads
 * dark→light from `single` (most-constrained, slowest) to `checkers8`
 * (most-parallel, fastest), so a glance at the chart shows the
 * diminishing-returns curve as a colour gradient.
 */
function ttscBarColor(threading: Threading): string {
  switch (threading) {
    case "single":
      return "bg-cyan-700";
    case "checkers2":
      return "bg-cyan-600";
    case "checkers4":
      return "bg-cyan-500";
    case "checkers8":
    case "multi":
      return "bg-cyan-400";
  }
}

function tsgoBarColor(threading: Threading): string {
  switch (threading) {
    case "single":
      return "bg-violet-700";
    case "checkers2":
      return "bg-violet-600";
    case "checkers4":
      return "bg-violet-500";
    case "checkers8":
    case "multi":
      return "bg-violet-400";
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
