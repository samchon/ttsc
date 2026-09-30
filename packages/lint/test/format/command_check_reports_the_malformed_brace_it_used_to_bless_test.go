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
// @evidence contracts/testing.md#behavioral-verification The check command with format error severity must return a failure and name format/indent for stranded shared-line braces.
// @evidence contracts/testing.md#independent-expectations The literal malformed tree has two closing braces stranded after returns; check must report the same noncanonical state that format repairs.
// @evidence contracts/testing.md#distinguishing-cases A malformed nested if/else differs from canonical else/catch/finally fixtures in the negative-twins case. Exact diagnostic count and position are not asserted here.
// @evidence contracts/testing.md#execution-ownership TestCommandCheckReportsTheMalformedBraceItUsedToBless is a public format unit selected by TestSelectedLintUnits. The isolated fixture filesystem feeds the actual Go command entry in the shared process. This verifies command semantics without compiling or launching a native artifact or installing a consumer.
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
