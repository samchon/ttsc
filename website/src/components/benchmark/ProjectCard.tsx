"use client";

import {
  deriveSpeedups,
  formatMultiplier,
  headlineSpeedup,
} from "./format";
import SpeedupBar from "./SpeedupBar";
import type { BenchmarkProject } from "./types";

/**
 * One OSS fixture: a big hero multiplier plus every supported comparison.
 *
 * The headline multiplier (largest speedup the project's measurements
 * support) is the visual anchor; the per-row bars underneath break it down.
 * A project that carries no comparable pair still renders its header.
 */
export default function ProjectCard({
  project,
}: {
  project: BenchmarkProject;
}) {
  const speedups = deriveSpeedups(project.measurements);
  const headline = headlineSpeedup(speedups);

  return (
    <article className="not-prose flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <div>
          <h3 className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">
            {project.name}
          </h3>
          <p className="mt-1 font-mono text-[11px] text-neutral-500">
            {project.files.toLocaleString()} files · {project.kind}
          </p>
        </div>
        {headline ? (
          <div className="shrink-0 text-right">
            <p className="font-mono text-3xl font-black leading-none text-cyan-600 dark:text-cyan-300">
              {formatMultiplier(headline.factor)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              {headline.label.toLowerCase()}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-5 px-5 py-5">
        {speedups.length > 0 ? (
          speedups.map((speedup) => (
            <SpeedupBar key={speedup.id} speedup={speedup} />
          ))
        ) : (
          <p className="font-mono text-[12px] text-neutral-500">
            No comparable measurements recorded yet.
          </p>
        )}
      </div>
    </article>
  );
}
