package driver_test

import (
  "errors"
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitPluginWriteErrorsFailBuild verifies write failures for the configured
// JavaScript, declaration and source-map artifacts in both publication modes.
//
// The declaration emitter converts callback errors into diagnostics, whereas
// JS and buffered flushes return Go errors directly. All must reject success.
//
// 1. Configure JavaScript, declarations and both source maps.
// 2. Fail each artifact's callback with and without noEmitOnError buffering.
// 3. Assert a non-nil error preserving the write failure message.
//
// @evidence contracts/testing.md#behavioral-verification EmitWithPluginTransformers invokes each failing output callback and returns a non-nil error containing its message.
// @evidence contracts/testing.md#independent-expectations The injected output device unavailable error must prevent a successful build, regardless of which artifact fails.
// @evidence contracts/testing.md#distinguishing-cases JavaScript, JavaScript map, declaration and declaration map failures each run with immediate and noEmitOnError-buffered writes.
// @evidence contracts/testing.md#execution-ownership Go discovers this direct driver emit unit in test/driver; temporary projects and injected callbacks require no compiled host.
func TestEmitPluginWriteErrorsFailBuild(t *testing.T) {
  for _, buffered := range []bool{false, true} {
    for _, file := range []string{"index.js", "index.js.map", "index.d.ts", "index.d.ts.map"} {
      t.Run(fmt.Sprintf("%v/%s", buffered, file), func(t *testing.T) {
        root := t.TempDir()
        writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","declaration":true,"sourceMap":true,"declarationMap":true,"noEmitOnError":%v},"files":["index.ts"]}`, buffered))
        writeProjectFile(t, root, "index.ts", `export const value: number = 1;`)
        p, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
        if err != nil || len(diagnostics) != 0 {
          t.Fatalf("load: %v %v", err, diagnostics)
        }
        defer p.Close()
        failed := false
        _, err = p.EmitWithPluginTransformers(nil, func(name, _ string, _ *shimcompiler.WriteFileData) error {
          if filepath.Base(name) == file {
            failed = true
            return errors.New("output device unavailable")
          }
          return nil
        })
        if !failed || err == nil || !strings.Contains(err.Error(), "output device unavailable") {
          t.Fatalf("failed=%v error=%v", failed, err)
        }
      })
    }
  }
}
