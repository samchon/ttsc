package driver_test

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitPluginNoEmitPreservesBuildInformation Verifies analysis-only emission skips
// JavaScript transformation while retaining incremental build information.
//
// The manual JS emitter must respect analysis-only configuration just as the
// upstream declaration emitter does, including a configured incremental build.
//
// 1. Load a valid project with noEmit, declaration and incremental enabled.
// 2. Call the plugin emitter with observable transform and write callbacks.
// 3. Assert no transform runs and only the build-information artifact is written.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual plugin emitter for noEmit plus incremental and requires no transformer calls, clean result and exactly one build-info write.
// @evidence contracts/testing.md#independent-expectations Authored noEmit/declaration/incremental options independently owe analysis-only emission with upstream incremental metadata; literal count one and build-info suffix are expected.
// @evidence contracts/testing.md#distinguishing-cases Observable transform and writer callbacks distinguish skipping JS/declaration work from suppressing the required metadata too.
// @evidence contracts/testing.md#execution-ownership The owning Go unit runs the real compiler/emitter APIs with private fixture and deferred Program close, capturing writes in memory without a product executable.
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
  }, func(name shimtspath.RootedFilePath, _ string, _ *shimcompiler.WriteFileData) error {
    writes = append(writes, name.AsString())
    return nil
  })
  if called || err != nil || len(diagnostics) != 0 {
    t.Fatalf("called=%v diagnostics=%v error=%v", called, diagnostics, err)
  }
  if len(writes) != 1 || !strings.HasSuffix(writes[0], ".tsbuildinfo") {
    t.Fatalf("noEmit incremental artifacts: %v", writes)
  }
}
