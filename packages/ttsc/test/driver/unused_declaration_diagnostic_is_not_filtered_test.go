package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverUnusedDeclarationDiagnosticIsNotFiltered verifies unused
// non-overload declarations are not filtered.
//
// The driver suppresses one tsgo diagnostic shape for ambient overload
// signatures. A regular unused declaration with the same diagnostic family
// must remain visible to callers.
//
// 1. Enable noUnusedLocals for an unused interface declaration.
// 2. Load and diagnose the project.
// 3. Assert the unused declaration diagnostic is still returned.
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
  semantic := prog.Diagnostics()
  if len(semantic) == 0 {
    t.Fatal("unused declaration diagnostic was filtered")
  }
}
