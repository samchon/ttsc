import assert from "node:assert/strict";
import path from "node:path";

import { configLanguageBoundaryResult } from "../../../internal/lint/internal/config-language-boundary";

/**
 * Verifies esm javascript configs may default export the rules object in the shared configuration boundary.
 *
 * The .mjs config retains its ESM default-exported rules object through the real JavaScript module evaluator.
 *
 * @evidence contracts/testing.md#behavioral-verification The .mjs config retains its ESM default-exported rules object through the real JavaScript module evaluator. This original source's exact no-var/error record and error exit remain asserted.
 * @evidence contracts/testing.md#independent-expectations The original var/console source and independently authored configuration rule map define the literal one-finding expectation. The full batch owner compares nine independently literal file/line/rule/severity records.
 * @evidence contracts/testing.md#distinguishing-cases The ESM JavaScript extension differs from the TypeScript .mts route and the separate CJS warning-only exit owner.
 * @evidence contracts/testing.md#execution-ownership This named entry asserts its own source-file result from configLanguageBoundaryResult. The JSON pointer entry owns exact full-stream cardinality so filtering cannot conceal extra or missing findings.
 * @evidence contracts/e2e.md#necessary-boundary The real descriptor evaluator, config module loader, native config binding and CLI diagnostic transport must connect the supported input to its original finding; direct rule or syntax tests cannot establish that module/host connection.
 * @evidence contracts/e2e.md#shared-execution One explicit JSON root follows the supported string extends chain through nine independently scoped configs in one project. configLanguageBoundaryResult makes one TestLint.runProject launcher invocation and caches its returned diagnostics for these consumers; each executable config still requires evaluation. This shared returned result does not count native children or compiler Program constructions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each unchanged original source sits below its declaring config's BaseDir and matches only that config's literal files selector. Explicit tsconfig files exclude executable config/helper code from consumer diagnostics. The helper attempts owned project cleanup in finally and caches either the completed result or a preparation/run/cleanup failure until releaseConfigLanguageBoundary. TestLint.runProject uses the selected workspace launcher and shared cache/tool paths; the synchronous return is not arbitrary descendant join or loaded artifact identity certification.
 * @evidence contracts/e2e.md#preserved-coverage Original module syntax, import/manifest cues, rule map, exact per-source rule/severity finding and nonzero exit remain executable. The complete nine-record owner rejects cross-case leakage or omitted cases; tests/test-lint/src/features/config/test_plain_json_config_does_not_require_a_script_evaluator.ts owns direct factory object/array decisions using an independently absent evaluator; it does not own this executable MJS-loader connection. Its source body and static selection are separate from current runtime survival.
 */
export function test_lint_config_file_esm_javascript_configs_may_default_export_the_rules_object(): void {
  const result = configLanguageBoundaryResult();
  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => path.basename(diagnostic.file) === "mjs.ts").map(({ rule, severity }) => [rule, severity]),
    [["no-var", "error"]],
    result.stderr,
  );
}
