package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckReportsLintDiagnostic verifies check renders native lint findings.
//
// Check is the no-emit project path used by ttsc before writing output. It must
// merge tsgo diagnostics with native lint findings and fail when an
// error-severity rule fires.
//
// This scenario uses a real tsconfig project so loadProgram, loadRules, engine
// dispatch, and diagnostic rendering are exercised together without touching
// the build emit branch.
//
// 1. Create a project with a no-var violation.
// 2. Run the check command with a discovered lint config enabling no-var.
// 3. Assert the command fails and stderr contains the rendered lint rule.
func TestCommandCheckReportsLintDiagnostic(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1;\nJSON.stringify(legacy);\n")
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[no-var]") {
    t.Fatalf("check diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
