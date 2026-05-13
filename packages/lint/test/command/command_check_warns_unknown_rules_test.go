package main

import (
  "strings"
  "testing"
)

// TestCommandCheckWarnsUnknownRules verifies unknown rules are reported but ignored.
//
// Unknown rule names should not make a project fail by themselves. The lint
// engine records them so the command can warn users while still allowing the
// rest of the configured rules to run.
//
// This scenario covers the loadRules, Engine.UnknownRules, and warnUnknownRules
// path from the command front door with a clean TypeScript project.
//
// 1. Create a clean project with no TypeScript diagnostics.
// 2. Run check with a plugin JSON map containing an unknown rule.
// 3. Assert success plus the unknown-rule warning on stderr.
func TestCommandCheckWarnsUnknownRules(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t, map[string]string{"never-existed": "error"}),
    })
  })
  if code != 0 || stdout != "" || !strings.Contains(stderr, "ignoring unknown rule") {
    t.Fatalf("unknown-rule warning mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
