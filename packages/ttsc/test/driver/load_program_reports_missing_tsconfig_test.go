package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramReportsMissingTSConfig Verifies that LoadProgram returns no Program or diagnostics and reports tsconfig not found for an absent config.
//
// The missing-file branch runs before JSON parsing; malformed existing config belongs elsewhere.
//
// 1. Create an empty temporary project directory.
// 2. Load a tsconfig path that does not exist.
// 3. Assert no program is returned and the error names the missing tsconfig.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram returns no Program or diagnostics and reports tsconfig not found for an absent config.
// @evidence contracts/testing.md#independent-expectations missing.json was never authored, so the configuration existence precondition requires rejection.
// @evidence contracts/testing.md#distinguishing-cases The missing-file branch runs before JSON parsing; malformed existing config belongs elsewhere.
// @evidence contracts/testing.md#execution-ownership The public loader reads a temporary directory directly in Go without a CLI. Go discovers TestDriverLoadProgramReportsMissingTSConfig under ./test/driver.
func TestDriverLoadProgramReportsMissingTSConfig(t *testing.T) {
  root := t.TempDir()
  prog, diags, err := driver.LoadProgram(root, "missing.json", driver.LoadProgramOptions{})
  if err == nil || !strings.Contains(err.Error(), "tsconfig not found") {
    t.Fatalf("missing tsconfig error mismatch: prog=%#v diagnostics=%#v err=%v", prog, diags, err)
  }
  if prog != nil || len(diags) != 0 {
    t.Fatalf("missing tsconfig should not return program or diagnostics: prog=%#v diagnostics=%#v", prog, diags)
  }
}
