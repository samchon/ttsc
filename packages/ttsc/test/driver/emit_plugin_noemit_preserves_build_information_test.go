package driver_test

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Verifies noEmit skips JavaScript while preserving upstream build information.
//
// The manual JS emitter must respect analysis-only configuration just as the
// upstream declaration emitter does, including a configured incremental build.
//
// 1. Load a valid project with noEmit, declaration and incremental enabled.
// 2. Call the plugin emitter with observable transform and write callbacks.
// 3. Assert no transform runs and only the build-information artifact is written.
func TestEmitPluginNoEmitPreservesBuildInformation(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"target":"es2020","noEmit":true,"declaration":true,"incremental":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;`)
  p, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil || len(diagnostics) != 0 {
    t.Fatalf("load: %v %v", err, diagnostics)
  }
  defer p.Close()
  called := false
  writes := []string{}
  diagnostics, err = p.EmitWithPluginTransformer(func(_ *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    called = true
    return sf
  }, func(name, _ string, _ *shimcompiler.WriteFileData) error {
    writes = append(writes, name)
    return nil
  })
  if called || err != nil || len(diagnostics) != 0 {
    t.Fatalf("called=%v diagnostics=%v error=%v", called, diagnostics, err)
  }
  if len(writes) != 1 || !strings.HasSuffix(writes[0], ".tsbuildinfo") {
    t.Fatalf("noEmit incremental artifacts: %v", writes)
  }
}
