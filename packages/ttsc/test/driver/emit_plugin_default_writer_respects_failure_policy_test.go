package driver_test

import (
  "fmt"
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitPluginDefaultWriterRespectsFailurePolicy Verifies the default filesystem writer
// publishes artifacts or reports an obstructed write.
//
// Buffering must retain the default filesystem writer when no callback is
// supplied, and a failed final flush must never report successful compilation.
//
// 1. Load declaration projects with and without noEmitOnError buffering.
// 2. Emit normally, then repeat with a file obstructing the output directory.
// 3. Assert both complete disk output and failing filesystem writes.
//
// @evidence contracts/testing.md#behavioral-verification Calls EmitWithPluginTransformers with a nil writer in four actual filesystem layouts; clean cases must materialize nonempty JS/declaration files, obstructed cases must return errors.
// @evidence contracts/testing.md#independent-expectations Authored lib directory, index.js/index.d.ts and a regular-file obstruction independently define disk success and failure.
// @evidence contracts/testing.md#distinguishing-cases Buffered/noEmitOnError and unbuffered lanes each contrast clean publication with obstructed parent failure.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit runs direct compiler/emitter APIs with private t.TempDir projects and deferred Program close; the default filesystem writer is exercised without a host executable.
func TestEmitPluginDefaultWriterRespectsFailurePolicy(t *testing.T) {
  for _, buffered := range []bool{false, true} {
    for _, obstructed := range []bool{false, true} {
      t.Run(fmt.Sprintf("buffered=%v/obstructed=%v", buffered, obstructed), func(t *testing.T) {
        root := t.TempDir()
        writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","declaration":true,"noEmitOnError":%v},"files":["index.ts"]}`, buffered))
        writeProjectFile(t, root, "index.ts", `export const value: number = 1;`)
        if obstructed {
          writeProjectFile(t, root, "lib", "occupied")
        }
        p, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
        if err != nil || len(diagnostics) != 0 {
          t.Fatalf("load: %v %v", err, diagnostics)
        }
        defer p.Close()
        diagnostics, err = p.EmitWithPluginTransformers(nil, nil)
        if obstructed {
          if err == nil {
            t.Fatal("obstructed output directory reported success")
          }
          return
        }
        if err != nil || len(diagnostics) != 0 {
          t.Fatalf("emit: %v %v", err, diagnostics)
        }
        for _, file := range []string{"index.js", "index.d.ts"} {
          if data, err := os.ReadFile(filepath.Join(root, "lib", file)); err != nil || len(data) == 0 {
            t.Fatalf("missing %s: %v", file, err)
          }
        }
      })
    }
  }
}
