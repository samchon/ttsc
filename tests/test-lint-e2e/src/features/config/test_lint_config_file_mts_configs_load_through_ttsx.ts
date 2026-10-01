import assert from "node:assert/strict";
import path from "node:path";

import { configLanguageBoundaryResult } from "../../internal/config-language-boundary";

/**
 * Verifies mts configs load through ttsx in the shared configuration boundary.
 *
 * The .mts config retains its TypeScript ESM default export through real ttsx evaluation.
 *
 * @evidence contracts/testing.md#behavioral-verification The .mts config retains its TypeScript ESM default export through real ttsx evaluation. This original source's exact no-var/error record and error exit remain asserted.
 * @evidence contracts/testing.md#independent-expectations The original var/console source and independently authored configuration rule map define the literal one-finding expectation. The full batch owner compares nine independently literal file/line/rule/severity records.
 * @evidence contracts/testing.md#distinguishing-cases The explicit .mts extension contrasts with .cts export assignment and manifest-sensitive ambiguous .ts inputs in the same native batch.
 * @evidence contracts/testing.md#execution-ownership This named entry asserts its own source-file result from configLanguageBoundaryResult. The JSON pointer entry owns exact full-stream cardinality so filtering cannot conceal extra or missing findings.
 * @evidence contracts/e2e.md#necessary-boundary The real descriptor evaluator, config module loader, native config binding and CLI diagnostic transport must connect the supported input to its original finding; direct rule or syntax tests cannot establish that module/host connection.
 * @evidence contracts/e2e.md#shared-execution One explicit JSON root follows the supported string extends chain through nine independently scoped configs in one project and one launcher/native host load. All consumers reuse one completed result and unchanged builtin producer; module evaluation still executes each actual config.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each unchanged original source sits below its declaring config's BaseDir and matches only that config's literal files selector. Explicit tsconfig files exclude executable config/helper code from consumer diagnostics. The helper removes its owned project in finally, retains only output or initial preparation failure, and shares only immutable builtin artifact identity.
 * @evidence contracts/e2e.md#preserved-coverage Original module syntax, import/manifest cues, rule map, exact per-source rule/severity finding and nonzero exit remain executable. The complete nine-record owner rejects cross-case leakage or omitted cases; the source-only JSON unit preserves the separate evaluator-free decision.
 */
export function test_lint_config_file_mts_configs_load_through_ttsx(): void {
  const result = configLanguageBoundaryResult();
  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => path.basename(diagnostic.file) === "mts.ts").map(({ rule, severity }) => [rule, severity]),
    [["no-var", "error"]],
    result.stderr,
  );
}
