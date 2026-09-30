package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckCorpusCleanProjectExitsZero keeps the native corpus clean
// source and all eight original rule policies at the owning check boundary.
// A violating-source control prevents a universally successful command from
// passing the original zero-exit assertion.
//
// @evidence contracts/testing.md#behavioral-verification The actual check command accepts the original clean string/value.length/void source under all eight lint-violations rule policies with no output, then reports a no-var error after only the source is changed.
// @evidence contracts/testing.md#independent-expectations Authored clean syntax violates none of the eight canonical rules, independently requiring status zero and empty stdout/stderr; the added var control independently requires status two and a no-var diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Original mixed error/warn/off policies and clean source retain the full positive case; the violating no-var control distinguishes actual rule execution from unconditional success.
// @evidence contracts/testing.md#execution-ownership Direct run(check) loads the original include-based temporary tsconfig and lint JSON in one Go process. This individual entry owns command/config/compiler/rule semantics; package resolution, native producer and ttsc child transport remain shared E2E boundaries.
func TestCommandCheckCorpusCleanProjectExitsZero(t *testing.T) {
  root := seedCommandLintCorpusProject(t, `{
    "rules": {
      "no-var": "error",
      "typescript/no-explicit-any": "warn",
      "typescript/no-non-null-assertion": "off",
      "no-debugger": "error",
      "eqeqeq": "error",
      "typescript/no-empty-interface": "warn",
      "prefer-for-of": "warn",
      "typescript/no-confusing-non-null-assertion": "error"
    }
  }`, "export const value: string = \"hi\";\nconst _value: number = value.length;\nvoid _value;\n")
  args := []string{"check", "--cwd", root, "--noEmit", "--plugins-json", lintManifest(t)}
  code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("original clean corpus failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  writeFile(t, filepath.Join(root, "src", "main.ts"), "export var value: string = \"hi\";\n")
  code, stdout, stderr = captureCommandOutput(t, func() int { return run(args) })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[no-var]") {
    t.Fatalf("violating control was not checked: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
