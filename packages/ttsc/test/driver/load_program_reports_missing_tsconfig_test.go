package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramReportsMissingTSConfig verifies missing project files
// stay an error path instead of becoming diagnostics.
//
// The driver resolves project paths through the same VFS guard used by the
// command, so this covers the path-existence branch before tsgo parses JSON.
//
// 1. Create an empty temporary project directory.
// 2. Load a tsconfig path that does not exist.
// 3. Assert no program is returned and the error names the missing tsconfig.
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
