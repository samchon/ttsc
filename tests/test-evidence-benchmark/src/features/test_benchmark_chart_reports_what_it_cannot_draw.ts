import { EvidenceBenchmarkChart } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkChart";
import type { ITtscEvidenceBenchmarkReportCell } from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkReport";

/**
 * Verifies the three states a chart must report rather than invent.
 *
 * Each of them has a plausible wrong answer that still produces a picture. An
 * absent price is not a price of zero, and drawing it as one also reports the
 * other arm as saving everything. A report with no cell is not a subject
 * directory full of empty charts. And a stage the classifier does not know is
 * not the review it happens to sit next to: a publication step that cannot
 * place a stage has to stop, because the alternative is a bar that silently
 * credits the wrong phase.
 *
 * 1. Render a subject whose cells carry no reconciled price.
 * 2. Assert the price axis reads unavailable, draws no band, and compares nothing,
 *    while the token axis is unaffected.
 * 3. Render a report with no cell and assert the empty state.
 * 4. Render a cell carrying an unknown stage and assert it throws.
 */
export const test_benchmark_chart_reports_what_it_cannot_draw = (): void => {
  const priceless: string = EvidenceBenchmarkChart.arms({
    report: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      cells: [
        cell({ arm: "plain", tokens: 1_000 }),
        cell({ arm: "evidence", tokens: 1_200 }),
      ],
    },
    coverage: [],
    model: "gpt-5.6-luna",
    subject: "todo",
  });
  // From the axis block's own title, not from the description above it, which
  // names every axis the chart carries.
  const costBlock: string = priceless.slice(
    priceless.indexOf(">API cost</text>"),
  );
  if (costBlock.includes("$0.00"))
    throw new Error(
      "A cell with no reconciled price drew $0.00, which reports a cell that cost nothing.",
    );
  if (costBlock.includes("unavailable") === false)
    throw new Error("The price axis did not say the price is unavailable.");
  if (/\(-100%\)/u.test(priceless))
    throw new Error(
      "An arm was compared against an unpriced baseline, which reports a saving of everything.",
    );
  for (const figure of ["1k tokens", "1.2k tokens"])
    if (priceless.includes(figure) === false)
      throw new Error(
        `The token axis lost ${figure} because another axis was unmeasured.`,
      );
  // Every change the chart prints carries its direction, because a bare `(20%)`
  // reads as twenty percent of Plain as readily as twenty percent above it.
  if (priceless.includes("(+20%)") === false)
    throw new Error("The token axis did not print the Evidence change.");
  for (const match of priceless.matchAll(/\((-?\d+)%\)/gu))
    // Zero has no direction and needs no sign; anything else does.
    if (Number(match[1]) !== 0)
      throw new Error(
        `The chart printed an unsigned change ${match[0]}, which does not say which direction it moved.`,
      );

  const empty: string = EvidenceBenchmarkChart.summary({
    report: { generatedAt: "2026-01-01T00:00:00.000Z", cells: [] },
    coverage: [],
  });
  if (empty.includes("No launched cells") === false)
    throw new Error("A report with no cell did not render the empty state.");
  if (empty.includes('class="phase-segment"'))
    throw new Error("A report with no cell drew a bar.");

  try {
    EvidenceBenchmarkChart.summary({
      report: {
        generatedAt: "2026-01-01T00:00:00.000Z",
        cells: [
          {
            ...cell({ arm: "plain", tokens: 1_000 }),
            stages: [
              {
                name: "backend-remind-9",
                tokens: 1,
                elapsedMs: 1,
                tokenPercent: 100,
                timePercent: 100,
              },
            ],
          },
        ],
      },
      coverage: [],
    });
  } catch (error) {
    if (String(error).includes("backend-remind-9")) return;
    throw new Error(`An unknown stage threw the wrong error: ${String(error)}`);
  }
  throw new Error(
    "A stage past the supplementation bound was charted instead of throwing, so its spend was credited to a phase it never ran in.",
  );
};

const cell = (props: {
  arm: "plain" | "evidence";
  tokens: number;
}): ITtscEvidenceBenchmarkReportCell => ({
  engine: "codex",
  subject: "todo",
  arm: props.arm,
  runId: `todo-${props.arm}`,
  benchmarkRevision: "0000000000000000000000000000000000000000",
  model: "gpt-5.6-luna",
  effort: "high",
  status: "completed",
  stage: "overall-final",
  launchedAt: "2026-01-01T00:00:00.000Z",
  tokens: props.tokens,
  tokenUsage: {
    totalTokens: props.tokens,
    inputTokens: props.tokens,
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
      tokens: props.tokens,
      elapsedMs: 60_000,
      tokenPercent: 100,
      timePercent: 100,
    },
  ],
});
