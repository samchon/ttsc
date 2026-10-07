import assert from "node:assert/strict";
import path from "node:path";

import { contributorBoundaryResult } from "../../../../internal/lint/internal/contributor-boundary";

/**
 * Verifies lint contributor plugin rule fires through single diagnostic stream.
 *
 * @evidence contracts/testing.md#behavioral-verification The linked contributor registers into the native host and both original TODO and FIXME diagnostics arrive through the standard rule stream. Exact rule, severity and message records are asserted on the original source file.
 * @evidence contracts/testing.md#independent-expectations The demo contributor public contract defines TODO/FIXME and user-selected XXX findings. Literal expected messages and severities remain the original independently authored expectations.
 * @evidence contracts/testing.md#distinguishing-cases The original TODO and FIXME sources both report in source order; the same batch contains the marker-option negative and typed-config package-discovery owner.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry consumes the single memoized native batch result; each original source and assertion retains its own file and failure identity.
 * @evidence contracts/e2e.md#necessary-boundary The linked contributor registers into the native host and both original TODO and FIXME diagnostics arrive through the standard rule stream. Direct rule calls cannot establish the config evaluator, contributor source linking and native diagnostic transport connection.
 * @evidence contracts/e2e.md#shared-execution contributorBoundaryResult builds one typed-config fixture, resolves the same demo source, and invokes the real launcher once for all three named consumers. Neither rule set nor immutable contributor bytes changes between consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The three original sources live in separate module files in one project; their common rule map is asserted per file and per rule. The helper attempts fixture cleanup in finally and caches completed output or a preparation/run/cleanup failure until releaseContributorBoundary. It supplies shared workspace tool/cache paths; this does not certify actual cache hits, loaded compiler/contributor identity, total child/Program counts or arbitrary descendant join from a sync return.
 * @evidence contracts/e2e.md#preserved-coverage The original file-specific exact rule/severity/message lists remain executable here. The option case still forbids default TODO findings; the typed-config case additionally verifies the entire combined stream so filtering cannot hide unrelated or duplicated diagnostics.
 */
export function test_lint_contributor_plugin_rule_fires_through_single_diagnostic_stream(): void {
  const result = contributorBoundaryResult();
  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics
      .filter(
        (diagnostic) =>
          path.basename(diagnostic.file) === "diagnostic-stream.ts" &&
          diagnostic.rule === "demo/no-todo-comment",
      )
      .map(({ rule, severity, message }) => ({ rule, severity, message })),
    [
      {
        rule: "demo/no-todo-comment",
        severity: "error",
        message: "TODO comment is not allowed.",
      },
      {
        rule: "demo/no-todo-comment",
        severity: "error",
        message: "FIXME comment is not allowed.",
      },
    ],
    result.stderr,
  );
}
