import { EvidenceBenchmarkChart } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkChart";
import type {
  ITtscEvidenceBenchmarkReport,
  ITtscEvidenceBenchmarkReportCell,
} from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkReport";

/**
 * Verifies a stacked bar accounts for the whole total its own row prints.
 *
 * A cell's total includes what judging its Reviews cost, and that belongs to no
 * stage, so summing the five phases drew a bar visibly shorter than the number
 * beside it and the widest bar never filled its own scale. Stage records can
 * also sum above the total, because the total excludes idleness they keep, and
 * scaling by the total alone then ran a bar off the canvas. Both directions
 * appear in the published cohort, so both are pinned here rather than only the
 * one that motivated the fix.
 *
 * 1. Render a cell whose stages fall short of its total.
 * 2. Assert an unattributed segment closes the gap and no segment leaves the
 *    track.
 * 3. Render a cell whose stages overrun its total.
 * 4. Assert no unattributed segment is drawn and no segment leaves the track.
 */
export const test_benchmark_chart_closes_a_bar_against_the_total_its_row_prints =
  (): void => {
    const short: string = EvidenceBenchmarkChart.summary(
      report(cell({ tokens: 1_000, stageTokens: 600 })),
    );
    if (short.includes('data-phase="unattributed"') === false)
      throw new Error(
        "A cell whose stages fall short of its total drew no unattributed segment, so its bar stops short of the number its own row prints.",
      );
    assertInsideTrack(short);

    const over: string = EvidenceBenchmarkChart.summary(
      report(cell({ tokens: 600, stageTokens: 1_000 })),
    );
    if (over.includes('data-phase="unattributed"'))
      throw new Error(
        "A cell whose stages overrun its total drew an unattributed segment, which would be a negative quantity presented as spend.",
      );
    assertInsideTrack(over);
  };

/** Every drawn segment ends at or before the track it sits in. */
const assertInsideTrack = (svg: string): void => {
  const track =
    /<rect x="210" y="\d+" width="(\d+)" height="36" rx="7" class="track"\/>/u.exec(
      svg,
    );
  if (track === null) throw new Error("The chart drew no bar track.");
  const limit: number = 210 + Number(track[1]);
  for (const segment of svg.matchAll(
    /<rect x="([\d.]+)" y="\d+" width="([\d.]+)" height="36"[^>]*class="phase-segment"/gu,
  )) {
    const end: number = Number(segment[1]) + Number(segment[2]);
    // Half a pixel of rounding is the width formatting, not an overrun.
    if (end > limit + 0.5)
      throw new Error(
        `A segment ends at ${end}, past the track that ends at ${limit}, so the bar runs off its own scale.`,
      );
  }
};

const report = (
  ...cells: ITtscEvidenceBenchmarkReportCell[]
): EvidenceBenchmarkChart.IProps => ({
  report: { generatedAt: "2026-01-01T00:00:00.000Z", cells },
  coverage: [],
});

const cell = (props: {
  tokens: number;
  stageTokens: number;
}): ITtscEvidenceBenchmarkReportCell => ({
  engine: "codex",
  subject: "todo",
  arm: "plain",
  runId: "00000000-0000-0000-0000-000000000000",
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
      tokens: props.stageTokens,
      elapsedMs: 60_000,
      tokenPercent: 100,
      timePercent: 100,
    },
  ],
});
