import assert from "node:assert/strict";
import path from "node:path";

import { configLanguageBoundaryResult } from "../../../internal/lint/internal/config-language-boundary";

/**
 * Verifies typescript configs may default export the rules object in the shared configuration boundary.
 *
 * The ordinary .ts config retains its default-exported no-var error and no-console off rule map through ttsx.
 *
 * @evidence contracts/testing.md#behavioral-verification The ordinary .ts config retains its default-exported no-var error and no-console off rule map through ttsx. This original source's exact no-var/error record and error exit remain asserted.
 * @evidence contracts/testing.md#independent-expectations The original var/console source and independently authored configuration rule map define the literal one-finding expectation. The full batch owner compares nine independently literal file/line/rule/severity records.
 * @evidence contracts/testing.md#distinguishing-cases This simplest TypeScript default-export shape retains its enabled var and disabled console contrast beside the explicit-extension and manifest-sensitive cases.
 * @evidence contracts/testing.md#execution-ownership This named entry asserts its own source-file result from configLanguageBoundaryResult. The JSON pointer entry owns exact full-stream cardinality so filtering cannot conceal extra or missing findings.
 * @evidence contracts/e2e.md#necessary-boundary The real descriptor evaluator, config module loader, native config binding and CLI diagnostic transport must connect the supported input to its original finding; direct rule or syntax tests cannot establish that module/host connection.
 * @evidence contracts/e2e.md#shared-execution One explicit JSON root follows the supported string extends chain through nine independently scoped configs in one project. configLanguageBoundaryResult makes one TestLint.runProject launcher invocation and caches its returned diagnostics; each executable config still requires evaluation. This result does not count native children or compiler Program constructions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each unchanged original source sits below its declaring config's BaseDir and matches only that config's literal files selector. Explicit tsconfig files exclude executable config/helper code from consumer diagnostics. The helper attempts project cleanup in finally and caches its completed result or preparation/run/cleanup failure until releaseConfigLanguageBoundary. Shared workspace tool/cache paths are not loaded artifact identity or cache-hit certification; synchronous return is not arbitrary descendant join.
 * @evidence contracts/e2e.md#preserved-coverage Original module syntax, import/manifest cues, rule map, exact per-source rule/severity finding and nonzero exit remain executable. The complete nine-record owner rejects cross-case leakage or omitted cases; tests/test-lint/src/features/config/test_plain_json_config_does_not_require_a_script_evaluator.ts owns separate direct factory object/array decisions with an independently absent evaluator. Its body/static selection does not certify this typed-evaluator transport or current runtime survival.
 */
export function test_lint_config_file_typescript_configs_may_default_export_the_rules_object(): void {
  const result = configLanguageBoundaryResult();
  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => path.basename(diagnostic.file) === "plain-ts.ts").map(({ rule, severity }) => [rule, severity]),
    [["no-var", "error"]],
    result.stderr,
  );
}
