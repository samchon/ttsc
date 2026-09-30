import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { collectEvidenceBenchmarkApiCost } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkApiCost";
import type { ITtscEvidenceBenchmarkApiCost } from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkApiCost";
import type { ITtscEvidenceBenchmarkTokenUsage } from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkTokenUsage";

/**
 * Verifies a stage log two drivers wrote is still priced, and only when it
 * reconciles.
 *
 * A resumed thread can end up with two native processes appending to one stage
 * log, each advancing its own cumulative counter. The interleaved lines report
 * totals the walk has already passed, or steps that do not match the request
 * they carry, and abandoning the run over one of them threw away the price of a
 * cohort's largest cell while its token count stayed published. Dropping such a
 * line loses no money, because pricing is per token rather than per request and
 * the reconciliation against the retained total still has to hold exactly.
 *
 * What a drop does cost is resolution: a request whose only record went is
 * priced inside the following step instead of on its own, so the request counts
 * are a lower bound and `replayedUpdates` says so.
 *
 * 1. Price a clean single-writer log and keep the amount.
 * 2. Price the same requests with a second writer's replays interleaved, and
 *    assert the amount is identical and the drops are counted.
 * 3. Drop a request from the log entirely and assert the run is refused, since a
 *    walk that no longer reconciles is not a measurement.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls collectEvidenceBenchmarkApiCost on clean, replayed and incomplete JSONL fixtures; checks request counts, equal price under replay, two replay drops and null for missing tokens.
 * @evidence contracts/testing.md#independent-expectations Replay invariance and retained-token reconciliation establish this case; the clean amount is a relational oracle and does not independently verify the pricing table itself.
 * @evidence contracts/testing.md#distinguishing-cases Three valid requests, two interleaved rewind/mismatched updates and a missing final request distinguish tolerated replay from an unreconciled gap.
 * @evidence contracts/testing.md#execution-ownership The exported entry owns its fixture and assertion callbacks in the source-unit TestExecutor; direct product calls use no installation, native producer or product host.
 */
export const test_benchmark_api_cost_survives_a_thread_two_drivers_wrote =
  (): void => {
    const root: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-evidence-cost-"),
    );
    try {
      const requests: ITtscEvidenceBenchmarkTokenUsage[] = [
        usage(120_000, 100_000, 900, 300),
        usage(140_000, 130_000, 700, 200),
        usage(160_000, 150_000, 500, 100),
      ];
      const expected: ITtscEvidenceBenchmarkTokenUsage = requests.reduce(
        (total, one) => addUsage(total, one),
        emptyUsage(),
      );

      const clean: ITtscEvidenceBenchmarkApiCost | null = price(
        write(root, "clean.log", lines(requests, [])),
        expected,
      );
      if (clean === null)
        throw new Error("A single-writer stage log was refused a price.");
      if (clean.requests !== requests.length)
        throw new Error(
          `A single-writer log priced ${clean.requests} requests instead of ${requests.length}.`,
        );
      if (clean.replayedUpdates !== 0)
        throw new Error(
          "A single-writer log reported a replayed update it never carried.",
        );

      // The second driver rewinds after the first request and re-emits its own
      // view of the second, which is the shape the interleaving takes on disk.
      const doubled: ITtscEvidenceBenchmarkApiCost | null = price(
        write(root, "doubled.log", lines(requests, [1])),
        expected,
      );
      if (doubled === null)
        throw new Error(
          "A stage log two drivers wrote was refused a price, so an interleaved counter still discards the run.",
        );
      if (doubled.amountUsd !== clean.amountUsd)
        throw new Error(
          `A replayed counter moved the price from ${clean.amountUsd} to ${doubled.amountUsd}, and a dropped line must not change what the tokens cost.`,
        );
      if (doubled.replayedUpdates !== 2)
        throw new Error(
          `Two replayed lines were dropped but ${doubled.replayedUpdates} were reported, so the request counts are a lower bound nobody can see.`,
        );

      const partial: ITtscEvidenceBenchmarkApiCost | null = price(
        write(root, "partial.log", lines(requests.slice(0, 2), [])),
        expected,
      );
      if (partial !== null)
        throw new Error(
          "A log missing a request was priced anyway, so tolerance for a replay became tolerance for a gap.",
        );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };

/** Emits the native stream, replaying the totals at the given request indices. */
const lines = (
  requests: readonly ITtscEvidenceBenchmarkTokenUsage[],
  replayAt: readonly number[],
): string[] => {
  const emitted: string[] = [];
  let total: ITtscEvidenceBenchmarkTokenUsage = emptyUsage();
  requests.forEach((one, index) => {
    const previous: ITtscEvidenceBenchmarkTokenUsage = total;
    total = addUsage(total, one);
    if (replayAt.includes(index))
      // A rewound total the walk has already passed, then a step that does not
      // match the request the same line carries.
      emitted.push(
        update(addUsage(previous, halfUsage(one)), one),
        update(total, halfUsage(one)),
      );
    emitted.push(update(total, one));
  });
  return emitted;
};

const update = (
  total: ITtscEvidenceBenchmarkTokenUsage,
  last: ITtscEvidenceBenchmarkTokenUsage,
): string =>
  JSON.stringify({
    method: "thread/tokenUsage/updated",
    params: { tokenUsage: { total, last } },
  });

const write = (root: string, name: string, emitted: string[]): string => {
  const file: string = path.join(root, name);
  fs.writeFileSync(file, `${emitted.join("\n")}\n`, "utf8");
  return file;
};

const price = (
  file: string,
  expected: ITtscEvidenceBenchmarkTokenUsage,
): ITtscEvidenceBenchmarkApiCost | null =>
  collectEvidenceBenchmarkApiCost({
    stageLogs: [file],
    model: "gpt-5.6-luna",
    expected,
    strict: false,
  });

const usage = (
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
  reasoningOutputTokens: number,
): ITtscEvidenceBenchmarkTokenUsage => ({
  totalTokens: inputTokens + outputTokens,
  inputTokens,
  cachedInputTokens,
  cacheWriteInputTokens: 0,
  outputTokens,
  reasoningOutputTokens,
});

const emptyUsage = (): ITtscEvidenceBenchmarkTokenUsage => usage(0, 0, 0, 0);

const addUsage = (
  left: ITtscEvidenceBenchmarkTokenUsage,
  right: ITtscEvidenceBenchmarkTokenUsage,
): ITtscEvidenceBenchmarkTokenUsage => ({
  totalTokens: left.totalTokens + right.totalTokens,
  inputTokens: left.inputTokens + right.inputTokens,
  cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
  cacheWriteInputTokens:
    left.cacheWriteInputTokens + right.cacheWriteInputTokens,
  outputTokens: left.outputTokens + right.outputTokens,
  reasoningOutputTokens:
    left.reasoningOutputTokens + right.reasoningOutputTokens,
});

const halfUsage = (
  one: ITtscEvidenceBenchmarkTokenUsage,
): ITtscEvidenceBenchmarkTokenUsage => ({
  totalTokens: Math.floor(one.totalTokens / 2),
  inputTokens: Math.floor(one.inputTokens / 2),
  cachedInputTokens: Math.floor(one.cachedInputTokens / 2),
  cacheWriteInputTokens: Math.floor(one.cacheWriteInputTokens / 2),
  outputTokens: Math.floor(one.outputTokens / 2),
  reasoningOutputTokens: Math.floor(one.reasoningOutputTokens / 2),
});
