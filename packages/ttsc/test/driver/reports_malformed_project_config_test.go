package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverReportsMalformedProjectConfig verifies malformed tsconfig JSON
// returns parser diagnostics.
//
// Invalid option values and malformed JSON exit through different tsgo parser
// branches. The malformed-JSON branch must still return structured diagnostics
// instead of a raw Go error.
//
// 1. Create a tsconfig with invalid JSON syntax.
// 2. Load it through the driver facade.
// 3. Assert diagnostics are returned without a Program.
func TestDriverReportsMalformedProjectConfig(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions": {`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if prog != nil {
    t.Fatalf("malformed config should not return a program: %#v", prog)
  }
  if len(diags) == 0 {
    t.Fatal("malformed config should return diagnostics")
  }
}
