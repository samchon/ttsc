"use client";

import { useEffect, useState } from "react";

import { deriveSpeedups, formatMultiplier, headlineSpeedup } from "./format";
import HostPanel from "./HostPanel";
import ProjectCard from "./ProjectCard";
import type { BenchmarkReport } from "./types";

/**
 * Loads `public/benchmark.json` and renders the full benchmark dashboard.
 *
 * Embedded from the benchmark MDX page. Data is fetched at runtime (not
 * bundled) so the benchmark runner can refresh the numbers without a website
 * rebuild. Renders graceful loading / error states and tolerates projects
 * that carry only a partial measurement set.
 */
export default function BenchmarkDashboard() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error)
    return (
      <p className="not-prose my-8 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 font-mono text-[12px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60">
        Could not load benchmark data ({error}).
      </p>
    );

  if (!report)
    return (
      <p className="not-prose my-8 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 font-mono text-[12px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60">
        Loading benchmark results…
      </p>
    );

  return (
    <div className="not-prose">
      <Headline report={report} />
      <HostPanel host={report.host} date={report.date} />
      <div className="my-8 grid gap-5 lg:grid-cols-2">
        {report.projects.map((project) => (
          <ProjectCard key={project.name} project={project} />
        ))}
      </div>
    </div>
  );
}

/**
 * Hero strip: the single biggest multiplier the whole dataset supports,
 * plus the fixture and project counts behind it.
 */
function Headline({ report }: { report: BenchmarkReport }) {
  const best = report.projects
    .map((project) => ({
      project,
      speedup: headlineSpeedup(deriveSpeedups(project.measurements)),
    }))
    .reduce<{ name: string; factor: number; label: string } | null>(
      (acc, entry) => {
        if (!entry.speedup) return acc;
        if (acc && entry.speedup.factor <= acc.factor) return acc;
        return {
          name: entry.project.name,
          factor: entry.speedup.factor,
          label: entry.speedup.label,
        };
      },
      null,
    );

  const totalMeasurements = report.projects.reduce(
    (sum, project) => sum + project.measurements.length,
    0,
  );

  return (
    <section className="my-8 overflow-hidden rounded-xl border border-cyan-300/40 bg-gradient-to-br from-cyan-50 to-white dark:border-cyan-300/25 dark:from-cyan-950/40 dark:to-neutral-950">
      <div className="grid gap-6 px-6 py-7 sm:grid-cols-[auto_1px_1fr] sm:items-center sm:gap-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            Peak speedup
          </p>
          <p className="mt-1 font-mono text-6xl font-black leading-none text-cyan-600 dark:text-cyan-300">
            {best ? formatMultiplier(best.factor) : "—"}
          </p>
          {best ? (
            <p className="mt-2 font-mono text-[11px] text-neutral-500">
              {best.label.toLowerCase()} · {best.name}
            </p>
          ) : null}
        </div>
        <div className="hidden bg-cyan-300/30 sm:block dark:bg-cyan-300/15" />
        <div>
          <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            ttsc replaces the whole TypeScript toolchain — and runs it faster.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Wall-clock medians across {report.projects.length} real
            open-source codebases — {totalMeasurements} measurements pairing{" "}
            <code className="font-mono text-neutral-700 dark:text-neutral-300">
              tsc
            </code>
            ,{" "}
            <code className="font-mono text-neutral-700 dark:text-neutral-300">
              eslint
            </code>
            , and{" "}
            <code className="font-mono text-neutral-700 dark:text-neutral-300">
              prettier
            </code>{" "}
            against{" "}
            <code className="font-mono text-neutral-700 dark:text-neutral-300">
              ttsc
            </code>{" "}
            and{" "}
            <code className="font-mono text-neutral-700 dark:text-neutral-300">
              @ttsc/lint
            </code>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
