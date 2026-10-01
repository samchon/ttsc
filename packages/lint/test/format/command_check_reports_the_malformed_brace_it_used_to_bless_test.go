package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckReportsTheMalformedBraceItUsedToBless pins the second
// invariant #856 states: `ttsc check` must not call a formatting state clean
// that `ttsc format` would not produce.
//
// While the stranded brace had no owner, the mangled form was `ttsc format`'s
// own fixed point, so `check` with `format.severity: "error"` exited 0 on it —
// a CI job that ran `format` then `check` stayed green on a malformed tree.
// Now that a rule owns the brace, the same input is a finding.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `check` command over a project whose source has two closing braces stranded after `return` statements, with format.severity set to error, and asserts a non-zero exit code and a stderr report that names format/indent.
// @evidence contracts/testing.md#independent-expectations The malformed source is an authored literal and the expectation (failure naming format/indent) comes from the stated contract that check must not call clean a tree format would repair; no output is derived from the implementation.
// @evidence contracts/testing.md#distinguishing-cases Covers only the positive case, a tree with stranded braces that must be reported; the exact diagnostic count and position are not asserted, and canonical else/catch/finally layouts that must stay clean are owned by the negative-twins test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the check subcommand against a temp-dir project and lint.config.json; no child process, built binary or installed consumer is involved.
func TestCommandCheckReportsTheMalformedBraceItUsedToBless(t *testing.T) {
  root := seedLintProject(t, "export function go(n: number) {\n  if (n > 0) {\n    return 1; } else {\n    return 2; }\n}\n")
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"severity": "error"},
  })
  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code == 0 || !strings.Contains(stderr, "format/indent") {
    t.Fatalf("check must report the stranded brace: code=%d stderr=%q", code, stderr)
  }
}
