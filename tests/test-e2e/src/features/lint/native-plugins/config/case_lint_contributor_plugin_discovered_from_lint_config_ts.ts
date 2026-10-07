import assert from "node:assert/strict";
import path from "node:path";

import { contributorBoundaryResult } from "../../../../internal/lint/internal/contributor-boundary";

/**
 * Verifies lint contributor plugin discovered from lint config ts.
 *
 * @evidence contracts/testing.md#behavioral-verification A real ttsx-evaluated TS config imports the typed contributor package and selects its Go source before the native host reports the original FIXME input. Exact rule, severity and message records are asserted on the original source file.
 * @evidence contracts/testing.md#independent-expectations The demo contributor public contract defines TODO/FIXME and user-selected XXX findings. Literal expected messages and severities remain the original independently authored expectations.
 * @evidence contracts/testing.md#distinguishing-cases The original FIXME source is the positive typed-config discovery input; the same batch retains two-comment diagnostic transport and XXX-option positive/TODO-option negative in distinct files.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry consumes the single memoized native batch result; each original source and assertion retains its own file and failure identity.
 * @evidence contracts/e2e.md#necessary-boundary A real ttsx-evaluated TS config imports the typed contributor package and selects its Go source before the native host reports the original FIXME input. Direct rule calls cannot establish the config evaluator, contributor source linking and native diagnostic transport connection.
 * @evidence contracts/e2e.md#shared-execution contributorBoundaryResult builds one typed-config fixture, resolves the same demo source, and invokes the real launcher once for all three named consumers. Neither rule set nor immutable contributor bytes changes between consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The three original sources live in separate module files in one project; their common rule map is asserted per file and per rule. The helper attempts fixture cleanup in finally and caches completed output or a preparation/run/cleanup failure until releaseContributorBoundary. It supplies shared workspace tool/cache paths; this does not certify actual cache hits, loaded compiler/contributor identity, total child/Program counts or arbitrary descendant join from a sync return.
 * @evidence contracts/e2e.md#preserved-coverage The original file-specific exact rule/severity/message lists remain executable here. The option case still forbids default TODO findings; the typed-config case additionally verifies the entire combined stream so filtering cannot hide unrelated or duplicated diagnostics. packages/lint/linthost/contributor_panics_preserve_other_rules_in_process_test.go::TestContributorPanicsPreserveOtherRulesInProcess and contributor_bootstrap_is_single_owner_for_reusable_main_test.go::TestMain preserve the original metadata/Check panic callbacks, exact warning, absence of raw metadata stack and surviving healthy/builtin findings. Those untagged Go bodies directly observe callbacks and cold registration before m.Run, separately selected by root test:go; their current runtime survival is unverified. This native batch owns actual source linking and init registration, without claiming to execute those panic-specific callbacks.
 */
export function test_lint_contributor_plugin_discovered_from_lint_config_ts(): void {
  const result = contributorBoundaryResult();
  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics
      .filter(
        (diagnostic) =>
          path.basename(diagnostic.file) === "main.ts" &&
          diagnostic.rule === "demo/no-todo-comment",
      )
      .map(({ rule, severity, message }) => ({ rule, severity, message })),
    [
      {
        rule: "demo/no-todo-comment",
        severity: "error",
        message: "FIXME comment is not allowed.",
      },
    ],
    result.stderr,
  );
  assert.deepEqual(
    result.diagnostics
      .map(({ file, line, rule, severity, message }) => ({
        file: path.basename(file),
        line,
        rule,
        severity,
        message,
      }))
      .sort(
        (a, b) =>
          a.file.localeCompare(b.file) ||
          a.line - b.line ||
          a.rule.localeCompare(b.rule),
      ),
    [
      {
        file: "diagnostic-stream.ts",
        line: 1,
        rule: "demo/no-todo-comment",
        severity: "error",
        message: "TODO comment is not allowed.",
      },
      {
        file: "diagnostic-stream.ts",
        line: 3,
        rule: "demo/no-todo-comment",
        severity: "error",
        message: "FIXME comment is not allowed.",
      },
      {
        file: "main.ts",
        line: 1,
        rule: "demo/no-todo-comment",
        severity: "error",
        message: "FIXME comment is not allowed.",
      },
      {
        file: "options.ts",
        line: 1,
        rule: "demo/no-marker-comment",
        severity: "error",
        message: "XXX marker is not allowed.",
      },
      {
        file: "options.ts",
        line: 3,
        rule: "demo/no-todo-comment",
        severity: "error",
        message: "TODO comment is not allowed.",
      },
    ],
    result.stderr,
  );
}
