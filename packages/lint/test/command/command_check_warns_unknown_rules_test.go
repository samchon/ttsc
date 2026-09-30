package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Actual check on a clean project containing never-existed:error succeeds with empty stdout and exactly the literal ignoring unknown rule warning for that identity.
// @evidence contracts/testing.md#independent-expectations The independently authored clean export and unsupported rule name specify status zero plus exact stderr; a warning substring alone cannot bless unrelated diagnostics or a dropped name.
// @evidence contracts/testing.md#distinguishing-cases Unknown error-severity configuration must remain nonfatal, contrasting with a known no-var error in the sibling command unit; clean compiler source isolates unknown-name policy.
// @evidence contracts/testing.md#execution-ownership Real config discovery, command dispatch, compiler and Engine.UnknownRules warning rendering run in-process against a temporary fixture without native artifacts, consumer installation or source-existence assertions.
func TestCommandCheckWarnsUnknownRules(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  seedLintRules(t, root, map[string]string{"never-existed": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || !strings.Contains(stderr, "ignoring unknown rule") {
    t.Fatalf("unknown-rule warning mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if stderr != "@ttsc/lint: ignoring unknown rule \"never-existed\"\n" { t.Fatalf("unknown rule warning should retain exact identity without extra diagnostics: %q", stderr) }
}
