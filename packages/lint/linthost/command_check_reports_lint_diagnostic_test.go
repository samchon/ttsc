package linthost

import (
  "path/filepath"
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
//
// @evidence contracts/testing.md#behavioral-verification Actual check dispatch enables no-var:error, renders exactly one no-var diagnostic with status two and empty stdout, and retains the original var source without applying fixes.
// @evidence contracts/testing.md#independent-expectations The authored var legacy source and error policy independently define one failing lint diagnostic; exact original source bytes distinguish check from an accidental fix command.
// @evidence contracts/testing.md#distinguishing-cases Real config discovery and violation exercise enabled rule dispatch rather than fabricated stderr; clean check and unknown-rule compatibility controls exist separately in the corpus command units.
// @evidence contracts/testing.md#execution-ownership Actual command, config loader, in-process compiler, Engine and renderer run on a temporary project in the shared Go process; no installed CLI or native plugin producer is invoked.
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
  if strings.Count(stderr, "[no-var]") != 1 {
    t.Fatalf("check should render exactly one authored no-var finding: %q", stderr)
  }
  assertFileText(t, filepath.Join(root, "src", "main.ts"), "var legacy = 1;\nJSON.stringify(legacy);\n")
}
