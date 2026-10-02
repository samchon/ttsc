package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverUnusedDeclarationDiagnosticIsNotFiltered Verifies unused
// non-overload declarations are not filtered.
//
// The driver suppresses one tsgo diagnostic shape for ambient overload
// signatures. A regular unused declaration with the same diagnostic family
// must remain visible to callers.
//
// 1. Enable noUnusedLocals for an unused interface declaration.
// 2. Load and diagnose the project.
// 3. Assert the unused declaration diagnostic is still returned.
//
// @evidence contracts/testing.md#behavioral-verification Program.Diagnostics retains a message naming UnusedInterface under noUnusedLocals.
// @evidence contracts/testing.md#independent-expectations The authored unused non-overload interface is subject to TypeScript unused-declaration diagnostics, so overload filtering must not erase that finding.
// @evidence contracts/testing.md#distinguishing-cases A regular unused interface owns the negative filtering boundary; ambient overload signatures are covered separately, and this body does not assert diagnostic code or range.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly loads and diagnoses the temporary Program with ForceNoEmit, without starting a compiler CLI.
func TestDriverUnusedDeclarationDiagnosticIsNotFiltered(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "noUnusedLocals": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `interface UnusedInterface<T> {
  value: T;
}
export const value = 1;
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  // The diagnostic must be the one for this declaration, not any diagnostic.
  found := false
  for _, diagnostic := range prog.Diagnostics() {
    if strings.Contains(diagnostic.Message, "UnusedInterface") {
      found = true
    }
  }
  if !found {
    t.Fatalf("unused declaration diagnostic was filtered: %#v", prog.Diagnostics())
  }
}
