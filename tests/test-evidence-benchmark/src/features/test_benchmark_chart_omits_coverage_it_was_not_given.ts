import { EvidenceBenchmarkChart } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkChart";
import type { ITtscEvidenceBenchmarkReportCell } from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkReport";

/**
 * Verifies the coverage block is drawn from data and omitted without it.
 *
 * Coverage is counted by hand from a finished Plain workspace, because a Plain
 * codebase carries no tags for the plugin to select on and an empty population
 * reports full coverage while checking nothing. A cohort can therefore be
 * published before its coverage exists, and a bar drawn at zero would be a
 * claim about a codebase nobody read. The block is also where an arm complete
 * by construction collapses into one row, which is a property of the data
 * rather than of the arm's name, so an unmeasured arm that disagreed with
 * itself must stay one row per subject.
 *
 * 1. Render without coverage and assert no coverage row exists.
 * 2. Render with a measured Plain row and an asserted Evidence row per subject,
 *    and assert the measured rows survive while the asserted ones collapse.
 * 3. Render with asserted rows that disagree and assert they do not collapse.
 */
export const test_benchmark_chart_omits_coverage_it_was_not_given =
  (): void => {
    const cells: ITtscEvidenceBenchmarkReportCell[] = [
      cell("todo", "plain"),
      cell("todo", "evidence"),
      cell("reddit", "plain"),
      cell("reddit", "evidence"),
    ];
    const render = (
      coverage: readonly EvidenceBenchmarkChart.ICoverage[],
    ): string =>
      EvidenceBenchmarkChart.summary({
        report: { generatedAt: "2026-01-01T00:00:00.000Z", cells },
        coverage,
      });

    const bare: string = render([]);
    if (bare.includes("data-coverage"))
      throw new Error(
        "A report with no coverage drew a coverage row, so an uncounted codebase is being reported as measured.",
      );
    if (bare.includes("Requirement Coverage"))
      throw new Error("The coverage block was drawn with nothing in it.");

    const full: string = render([
      coverage("todo", "plain", 0.8, true),
      coverage("reddit", "plain", 0.6, true),
      coverage("todo", "evidence", 1, false),
      coverage("reddit", "evidence", 1, false),
    ]);
    const drawn: string[] = [...full.matchAll(/data-coverage="([^"]+)"/gu)].map(
      (match) => match[1]!,
    );
    if (drawn.join(",") !== "80,60,100")
      throw new Error(
        `Expected the two measured rows and one collapsed asserted row, drew ${drawn.join(",")}.`,
      );
    if (full.includes("Evidence (every)") === false)
      throw new Error(
        "Two identical unmeasured rows did not collapse into one naming the arm.",
      );

    const disagreeing: string = render([
      coverage("todo", "evidence", 1, false),
      coverage("reddit", "evidence", 0.5, false),
    ]);
    if (disagreeing.includes("Evidence (every)"))
      throw new Error(
        "Unmeasured rows that disagree collapsed into one, which reports a figure neither subject carries.",
      );
    if ([...disagreeing.matchAll(/data-coverage="([^"]+)"/gu)].length !== 2)
      throw new Error(
        "Disagreeing unmeasured rows did not stay one per subject.",
      );
  };

const coverage = (
  subject: string,
  arm: "plain" | "evidence",
  score: number,
  measured: boolean,
): EvidenceBenchmarkChart.ICoverage => ({
  model: "gpt-5.6-luna",
  subject,
  arm,
  score,
  measured,
});

const cell = (
  subject: string,
  arm: "plain" | "evidence",
): ITtscEvidenceBenchmarkReportCell => ({
  engine: "codex",
  subject,
  arm,
  runId: `${subject}-${arm}`,
  benchmarkRevision: "0000000000000000000000000000000000000000",
  model: "gpt-5.6-luna",
  effort: "high",
  status: "completed",
  stage: "overall-final",
  launchedAt: "2026-01-01T00:00:00.000Z",
  tokens: 1_000,
  tokenUsage: {
    totalTokens: 1_000,
    inputTokens: 1_000,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  },
  inspection: {
    attempts: 0,
    failures: 0,
    tokenUsage: {
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
    },
    elapsedMs: 0,
  },
  apiCost: null,
  suspendedMs: 0,
  suspensions: [],
  workElapsedMs: 60_000,
  worktree: { files: 1, additions: 1, deletions: 0 },
  reviewVerdicts: [],
  stages: [
    {
      name: "backend-start",
      tokens: 1_000,
      elapsedMs: 60_000,
      tokenPercent: 100,
      timePercent: 100,
    },
  ],
});
