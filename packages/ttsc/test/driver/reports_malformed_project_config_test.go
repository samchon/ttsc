package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverReportsMalformedProjectConfig Verifies malformed tsconfig JSON
// returns parser diagnostics.
//
// Invalid option values and malformed JSON exit through different tsgo parser
// branches. The malformed-JSON branch must still return structured diagnostics
// instead of a raw Go error.
//
// 1. Create a tsconfig with invalid JSON syntax.
// 2. Load it through the driver facade.
// 3. Assert diagnostics are returned without a Program.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram returns config diagnostics, no Program and no raw Go error for incomplete tsconfig JSON.
// @evidence contracts/testing.md#independent-expectations The authored unclosed compilerOptions object is invalid JSON, so parser diagnostics must prevent a usable Program.
// @evidence contracts/testing.md#distinguishing-cases Malformed syntax owns this branch; invalid option values and missing-file errors are separate loader cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the source loader against a temporary config directly; no compiler CLI or native producer is started.
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
