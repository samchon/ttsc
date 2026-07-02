import type { ITtscWebsiteBenchmark } from "../../structures/ITtscWebsiteBenchmark";

type BenchmarkMeasurement = ITtscWebsiteBenchmark.Measurement;
type Speedup = ITtscWebsiteBenchmark.Speedup;

/**
 * Reduce a `samples` array to the wall-clock number the dashboard surfaces.
 * `min` is the convention: system noise pushes individual runs slower, never
 * faster, so the fastest run is the closest we can get to a noise-free
 * measurement of the workload itself. Empty samples → `0`, which lets
 * downstream code treat unmeasured cells as "skip the comparison".
 */
function sampleMin(samples: number[] | undefined): number {
  return samples && samples.length > 0 ? Math.min(...samples) : 0;
}

/** Wall-clock min for the cell's main samples. */
function measurementMs(measurement: BenchmarkMeasurement): number {
  return sampleMin(measurement.samples);
}

/** Wall-clock min for the `@ttsc/lint` sidecar timing, if recorded. */
function lintMs(measurement: BenchmarkMeasurement): number {
  return sampleMin(measurement.lintSamples);
}

/** Wall-clock min for the native `@ttsc/lint` plugin timing, if recorded. */
function lintPluginMs(measurement: BenchmarkMeasurement): number {
  return sampleMin(measurement.lintPluginSamples);
}

/** Wall-clock min for the third-party transform-host timing, if recorded. */
function transformHostMs(measurement: BenchmarkMeasurement): number {
  return sampleMin(measurement.transformHostSamples);
}

/** Human-friendly wall-clock label: sub-second in `ms`, otherwise `s`. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
}

/** Speedup multiplier label, e.g. `2.5x`. */
function formatMultiplier(factor: number): string {
  if (!Number.isFinite(factor)) return "∞x";
  return `${factor.toFixed(factor < 10 ? 1 : 0)}x`;
}

type FindOptions = ITtscWebsiteBenchmark.MeasurementOptions;

function findMeasurement(
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

function deriveSpeedups(measurements: BenchmarkMeasurement[]): Speedup[] {
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
    referenceOnly = false,
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
      referenceOnly,
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
      legacyBuild && { tool: "tsc", ms: measurementMs(legacyBuild) },
      ttscBuild && { tool: `ttsc ${threading}`, ms: measurementMs(ttscBuild) },
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
      legacyNoEmit && { tool: "tsc --noEmit", ms: measurementMs(legacyNoEmit) },
      ttscNoEmit && {
        tool: `ttsc --noEmit ${threading}`,
        ms: measurementMs(ttscNoEmit),
      },
    );

    const ttscLintBuild =
      findMeasurement(measurements, {
        branch: "ttsc-lint",
        tool: "ttsc+@ttsc/lint",
        op: "build",
        threading,
      }) ??
      findMeasurement(measurements, {
        branch: "ttsc-lint",
        op: "build",
        threading,
      });
    push(
      `build-eslint-${threading}`,
      `Build + lint (${threading})`,
      "legacy tsc build + eslint vs ttsc-lint build",
      legacyBuild &&
        eslint && {
          tool: "tsc + eslint",
          ms: measurementMs(legacyBuild) + measurementMs(eslint),
        },
      ttscLintBuild && {
        tool: `ttsc-lint ${threading}`,
        ms: measurementMs(ttscLintBuild),
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
    push(
      `noEmit-eslint-${threading}`,
      `No emit + lint (${threading})`,
      "legacy tsc --noEmit + eslint vs ttsc-lint --noEmit",
      legacyNoEmit &&
        eslint && {
          tool: "tsc --noEmit + eslint",
          ms: measurementMs(legacyNoEmit) + measurementMs(eslint),
        },
      ttscLintNoEmit && {
        tool: `ttsc-lint --noEmit ${threading}`,
        ms: measurementMs(ttscLintNoEmit),
      },
    );

    if (eslint && ttscBuild && ttscLintBuild) {
      const overhead = measurementMs(ttscLintBuild) - measurementMs(ttscBuild);
      push(
        `lint-overhead-${threading}`,
        `Lint overhead (${threading})`,
        "eslint alone vs ttsc-lint build minus ttsc build",
        { tool: "eslint", ms: measurementMs(eslint) },
        overhead > 0
          ? { tool: `ttsc-lint - ttsc ${threading}`, ms: overhead }
          : undefined,
      );
    }

    const tsgoBuild = findMeasurement(measurements, {
      branch: "ttsc",
      tool: "tsgo",
      op: "build",
      threading,
    });
    push(
      `ttsc-vs-tsgo-build-${threading}`,
      `TTSC vs TSGO build (${threading})`,
      "tsgo build vs ttsc build on the ttsc branch",
      tsgoBuild && { tool: `tsgo ${threading}`, ms: measurementMs(tsgoBuild) },
      ttscBuild && { tool: `ttsc ${threading}`, ms: measurementMs(ttscBuild) },
      true,
    );

    const tsgoNoEmit = findMeasurement(measurements, {
      branch: "ttsc",
      tool: "tsgo",
      op: "noEmit",
      threading,
    });
    push(
      `ttsc-vs-tsgo-noEmit-${threading}`,
      `TTSC vs TSGO no emit (${threading})`,
      "tsgo --noEmit vs ttsc --noEmit on the ttsc branch",
      tsgoNoEmit && {
        tool: `tsgo --noEmit ${threading}`,
        ms: measurementMs(tsgoNoEmit),
      },
      ttscNoEmit && {
        tool: `ttsc --noEmit ${threading}`,
        ms: measurementMs(ttscNoEmit),
      },
      true,
    );
  }

  return out;
}

function headlineSpeedup(speedups: Speedup[]): Speedup | undefined {
  return speedups
    .filter((speedup) => !speedup.referenceOnly)
    .reduce<Speedup | undefined>((best, s) => {
      return best === undefined || s.factor > best.factor ? s : best;
    }, undefined);
}

const TtscWebsiteBenchmarkFormat = {
  deriveSpeedups,
  findMeasurement,
  formatDuration,
  formatMultiplier,
  headlineSpeedup,
  lintMs,
  lintPluginMs,
  measurementMs,
  transformHostMs,
};

export default TtscWebsiteBenchmarkFormat;
