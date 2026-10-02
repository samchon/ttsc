import assert from "node:assert/strict";
import path from "node:path";

import { configLanguageBoundaryResult } from "../../../internal/lint/internal/config-language-boundary";

/**
 * Verifies tsconfig may reference a standalone json file in the shared configuration boundary.
 *
 * The plugin entry explicitly points at standalone ttsc-lint.config.json despite a competing empty lint.config.json; the JSON extends chain includes the original JSON rules map.
 *
 * @evidence contracts/testing.md#behavioral-verification The plugin entry explicitly points at standalone ttsc-lint.config.json despite a competing empty lint.config.json; the JSON extends chain includes the original JSON rules map. This original source's exact no-var/error record and error exit remain asserted.
 * @evidence contracts/testing.md#independent-expectations The original var/console source and independently authored configuration rule map define the literal one-finding expectation. The full batch owner compares nine independently literal file/line/rule/severity records.
 * @evidence contracts/testing.md#distinguishing-cases Ignoring the explicit pointer leaves competing discovery candidates and cannot produce the nine configured findings; the empty lint.config.json cannot supply them. test_plain_json_config_does_not_require_a_script_evaluator independently owns the evaluator-free plain-JSON decision.
 * @evidence contracts/testing.md#execution-ownership This named entry asserts its own source-file result from configLanguageBoundaryResult. The JSON pointer entry owns exact full-stream cardinality so filtering cannot conceal extra or missing findings.
 * @evidence contracts/e2e.md#necessary-boundary The real descriptor evaluator, config module loader, native config binding and CLI diagnostic transport must connect the supported input to its original finding; direct rule or syntax tests cannot establish that module/host connection.
 * @evidence contracts/e2e.md#shared-execution One explicit JSON root follows the supported string extends chain through nine independently scoped configs in one project and one launcher/native host load. All consumers reuse one completed result and unchanged builtin producer; module evaluation still executes each actual config.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each unchanged original source sits below its declaring config's BaseDir and matches only that config's literal files selector. Explicit tsconfig files exclude executable config/helper code from consumer diagnostics. The helper removes its owned project in finally, retains only output or initial preparation failure, and shares only immutable builtin artifact identity.
 * @evidence contracts/e2e.md#preserved-coverage Original module syntax, import/manifest cues, rule map, exact per-source rule/severity finding and nonzero exit remain executable. The complete nine-record owner rejects cross-case leakage or omitted cases; the source-only JSON unit preserves the separate evaluator-free decision.
 */
export function test_lint_config_file_tsconfig_may_reference_a_standalone_json_file(): void {
  const result = configLanguageBoundaryResult();
  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => path.basename(diagnostic.file) === "json.ts").map(({ rule, severity }) => [rule, severity]),
    [["no-var", "error"]],
    result.stderr,
  );
  assert.deepEqual(
    result.diagnostics.map(({ file, line, rule, severity }) => ({ file: path.basename(file), line, rule, severity })).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    [
      { file: "commonjs-globals.ts", line: 2, rule: "no-console", severity: "error" },
      { file: "cts.ts", line: 2, rule: "no-console", severity: "error" },
      { file: "exported-types.ts", line: 1, rule: "no-var", severity: "error" },
      { file: "js-sibling.ts", line: 2, rule: "no-console", severity: "error" },
      { file: "json.ts", line: 1, rule: "no-var", severity: "error" },
      { file: "mjs.ts", line: 1, rule: "no-var", severity: "error" },
      { file: "module-meta.ts", line: 2, rule: "no-console", severity: "error" },
      { file: "mts.ts", line: 1, rule: "no-var", severity: "error" },
      { file: "plain-ts.ts", line: 1, rule: "no-var", severity: "error" },
    ].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    result.stderr,
  );
}
