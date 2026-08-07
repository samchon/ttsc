import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertEvidenceBenchmarkCoverageCohort } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkReport";
import type {
  ITtscEvidenceBenchmarkReport,
  ITtscEvidenceBenchmarkReportCell,
} from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkReport";

/**
 * Verifies a publication refuses coverage counted for a different cohort.
 *
 * `report` replaces `summary.json` and rebuilds `cells/` from nothing, and
 * nothing writes `coverage.json` at all, so a second cohort published over a
 * first would leave the first's coverage beside the second's spend. The
 * renderer keeps every row whose model and subject appear in the report, which
 * for a repeated subject is all of them, and both artifacts stay internally
 * consistent while the combination is two cohorts. A cohort that has no
 * coverage yet is the ordinary state and must stay publishable.
 *
 * 1. With no coverage file, assert the check passes.
 * 2. With coverage counted from this cohort's own runs, assert it passes.
 * 3. With a foreign `source.origin`, a row naming no run, a row naming another
 *    run, and a row for a cell outside the cohort, assert each is refused and
 *    the message names what to do.
 */
export const test_benchmark_report_refuses_coverage_from_another_cohort =
  (): void => {
    const root: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "evidence-benchmark-coverage-"),
    );
    try {
      const report: ITtscEvidenceBenchmarkReport = {
        generatedAt: "2026-01-01T00:00:00.000Z",
        origin: "samchon/ttsc",
        cells: [cell("todo", "plain", "run-todo-plain")],
      };
      const write = (value: unknown): void =>
        fs.writeFileSync(
          path.join(root, "coverage.json"),
          `${JSON.stringify(value, null, 2)}\n`,
        );

      // Step 1: a cohort with no coverage at all still publishes.
      assertEvidenceBenchmarkCoverageCohort(root, report);

      // Step 2: coverage counted from this cohort's own run is accepted.
      write({
        source: { origin: "samchon/ttsc" },
        cells: [row("todo", "plain", "run-todo-plain")],
      });
      assertEvidenceBenchmarkCoverageCohort(root, report);

      // Step 3: every way a file can belong elsewhere is refused.
      const refused = (value: unknown, expected: string): void => {
        write(value);
        let message: string | undefined;
        try {
          assertEvidenceBenchmarkCoverageCohort(root, report);
        } catch (error) {
          message = error instanceof Error ? error.message : String(error);
        }
        if (message === undefined)
          throw new Error(
            `Publication accepted coverage it cannot attribute: expected a refusal naming ${expected}.`,
          );
        if (message.includes(expected) === false)
          throw new Error(
            `A refusal was raised but did not name ${expected}: ${message}`,
          );
        if (
          message.includes("delete it and publish without a coverage") === false
        )
          throw new Error(
            `The refusal does not say how to proceed: ${message}`,
          );
      };

      refused(
        {
          source: { origin: "samchon/lint-plugin-evidence" },
          cells: [row("todo", "plain", "run-todo-plain")],
        },
        "samchon/lint-plugin-evidence",
      );
      refused(
        { source: { origin: "samchon/ttsc" }, cells: [row("todo", "plain")] },
        "carries no `runId`",
      );
      refused(
        {
          source: { origin: "samchon/ttsc" },
          cells: [row("todo", "plain", "run-from-round-one")],
        },
        "was counted from run-from-round-one, not run-todo-plain",
      );
      refused(
        {
          source: { origin: "samchon/ttsc" },
          cells: [row("reddit", "plain", "run-reddit-plain")],
        },
        "is not in this cohort",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

const row = (
  subject: string,
  arm: "plain" | "evidence",
  runId?: string,
): Record<string, unknown> => ({
  model: "gpt-5.6-luna",
  subject,
  arm,
  ...(runId === undefined ? {} : { runId }),
  coverage: { score: 0.5, measured: true },
});

const cell = (
  subject: string,
  arm: "plain" | "evidence",
  runId: string,
): ITtscEvidenceBenchmarkReportCell => ({
  engine: "codex",
  subject,
  arm,
  runId,
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
