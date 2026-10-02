package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverReportsInvalidProjectConfig Verifies tsconfig diagnostics stay
// observable through the public driver facade.
//
// The fixture stays at the tsconfig boundary because invalid project options
// should stop before a Program or checker lease is opened.
//
// 1. Create a project with an invalid compiler option.
// 2. Load the project through driver.LoadProgram.
// 3. Assert config diagnostics are returned without a partial program.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram returns nonempty diagnostics without a Program for invalid module options.
// @evidence contracts/testing.md#independent-expectations The authored not-a-module-kind value violates supported config parsing.
// @evidence contracts/testing.md#distinguishing-cases One invalid enum is covered; diagnostic code and text are not asserted.
// @evidence contracts/testing.md#execution-ownership Go unit TestDriverReportsInvalidProjectConfig is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestDriverReportsInvalidProjectConfig(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the invalid enum value is a tsconfig-level failure, so the
  // driver should return diagnostics before any Program is opened.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "not-a-module-kind"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  // Diagnostic assertion: config errors are returned as structured driver
  // diagnostics while the program value stays nil.
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if prog != nil {
    t.Fatalf("invalid config should not return a program: %#v", prog)
  }
  if len(diags) == 0 {
    t.Fatal("invalid config should return diagnostics")
  }
}
