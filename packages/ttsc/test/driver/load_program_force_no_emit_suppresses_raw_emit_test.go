package driver_test

import (
  "path/filepath"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramForceNoEmitSuppressesRawEmit Verifies that ForceNoEmit allows project load but makes EmitAllRaw record no outputs.
//
// This case covers successful load and suppressed raw output, not a semantic type check.
//
// 1. Load a project with ForceNoEmit enabled.
// 2. Run raw emit through a recording WriteFile callback.
// 3. Assert no JavaScript output is written.
//
// @evidence contracts/testing.md#behavioral-verification ForceNoEmit allows project load but makes EmitAllRaw record no outputs.
// @evidence contracts/testing.md#independent-expectations Check-only configuration requires zero output writes independently of output text.
// @evidence contracts/testing.md#distinguishing-cases This case covers successful load and suppressed raw output, not a semantic type check.
// @evidence contracts/testing.md#execution-ownership The direct Go Program records raw callback writes and is closed after the assertion. Go discovers TestDriverLoadProgramForceNoEmitSuppressesRawEmit under ./test/driver.
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
  _, emitDiags, err := prog.EmitAllRaw(func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
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
