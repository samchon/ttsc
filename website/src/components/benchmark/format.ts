import type { BenchmarkMeasurement } from "./types";

/** Human-friendly wall-clock label: sub-second in `ms`, otherwise `s`. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
}

/** Speedup multiplier label, e.g. `2.5x`. */
export function formatMultiplier(factor: number): string {
  if (!Number.isFinite(factor)) return "∞x";
  return `${factor.toFixed(factor < 10 ? 1 : 0)}x`;
}

export interface Speedup {
  id: string;
  label: string;
  detail: string;
  baseline: { tool: string; ms: number };
  fast: { tool: string; ms: number };
  factor: number;
}

interface FindOptions {
  branch?: BenchmarkMeasurement["branch"];
  tool?: BenchmarkMeasurement["tool"];
  op?: BenchmarkMeasurement["op"];
  threading?: BenchmarkMeasurement["threading"];
}

export function findMeasurement(
  measurements: BenchmarkMeasurement[],
  options: FindOptions,
): BenchmarkMeasurement | undefined {
  return measurements.find(
    (m) =>
      (options.branch === undefined || m.branch === options.branch) &&
      (options.tool === undefined || m.tool === options.tool) &&
      (options.op === undefined || m.op === options.op) &&
      (options.threading === undefined || m.threading === options.threading),
  );
}

export function deriveSpeedups(
  measurements: BenchmarkMeasurement[],
): Speedup[] {
  const out: Speedup[] = [];
  const legacyBuild = findMeasurement(measurements, {
    branch: "legacy",
    op: "build",
    threading: "multi",
  });
  const legacyNoEmit = findMeasurement(measurements, {
    branch: "legacy",
    op: "noEmit",
    threading: "multi",
  });
  const eslint =
    findMeasurement(measurements, {
      branch: "legacy",
      tool: "eslint",
      op: "eslint",
      threading: "multi",
    }) ??
    findMeasurement(measurements, {
      branch: "legacy",
      tool: "eslint",
      threading: "multi",
    });

  const push = (
    id: string,
    label: string,
    detail: string,
    baseline: { tool: string; ms: number } | undefined,
    fast: { tool: string; ms: number } | undefined,
  ) => {
    if (!baseline || !fast) return;
    if (baseline.ms <= 0 || fast.ms <= 0) return;
    out.push({
      id,
      label,
      detail,
      baseline,
      fast,
      factor: baseline.ms / fast.ms,
    });
  };

  for (const threading of ["multi", "single"] as const) {
    const ttscBuild = findMeasurement(measurements, {
      branch: "ttsc",
      tool: "ttsc",
      op: "build",
      threading,
    });
    push(
      `build-${threading}`,
      `Build (${threading})`,
      "legacy tsc build vs ttsc build",
      legacyBuild && { tool: "tsc", ms: legacyBuild.medianMs },
      ttscBuild && { tool: `ttsc ${threading}`, ms: ttscBuild.medianMs },
    );

    const ttscNoEmit = findMeasurement(measurements, {
      branch: "ttsc",
      tool: "ttsc",
      op: "noEmit",
      threading,
    });
    push(
      `noEmit-${threading}`,
      `No emit (${threading})`,
      "legacy tsc --noEmit vs ttsc --noEmit",
      legacyNoEmit && { tool: "tsc --noEmit", ms: legacyNoEmit.medianMs },
      ttscNoEmit && {
        tool: `ttsc --noEmit ${threading}`,
        ms: ttscNoEmit.medianMs,
      },
    );

    const ttscLintNoEmit =
      findMeasurement(measurements, {
        branch: "ttsc-lint",
        tool: "ttsc+@ttsc/lint",
        op: "noEmit",
        threading,
      }) ??
      findMeasurement(measurements, {
        branch: "ttsc-lint",
        op: "noEmit",
        threading,
      });

    if (eslint && ttscNoEmit && ttscLintNoEmit) {
      const overhead = ttscLintNoEmit.medianMs - ttscNoEmit.medianMs;
      push(
        `lint-overhead-${threading}`,
        `Lint (${threading})`,
        "eslint alone vs ttsc-lint noEmit minus ttsc noEmit",
        { tool: "eslint", ms: eslint.medianMs },
        overhead > 0
          ? { tool: `@ttsc/lint ${threading}`, ms: overhead }
          : undefined,
      );
    }
  }

  return out;
}

export function headlineSpeedup(speedups: Speedup[]): Speedup | undefined {
  return speedups.reduce<Speedup | undefined>(
    (best, s) => (best === undefined || s.factor > best.factor ? s : best),
    undefined,
  );
}
