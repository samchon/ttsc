package driver_test

import (
  "path/filepath"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramForceNoEmitSuppressesRawEmit verifies ForceNoEmit updates
// compiler options before program creation.
//
// The command path uses this option for check-only flows, where the driver must
// still load and typecheck the project without writing JavaScript.
//
// 1. Load a project with ForceNoEmit enabled.
// 2. Run raw emit through a recording WriteFile callback.
// 3. Assert no JavaScript output is written.
func TestDriverLoadProgramForceNoEmitSuppressesRawEmit(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  if len(emitted) != 0 {
    t.Fatalf("ForceNoEmit should suppress raw emit output: %#v", emitted)
  }
}
