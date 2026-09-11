package driver_test

import (
  "errors"
  "fmt"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Verifies noEmitOnError blocks every plugin output on source errors.
//
// The handwritten JavaScript lane must obey the same pre-emit gate as the
// declaration lane, even when no declaration pass is configured.
//
// 1. Load an invalid source with JS-only, declaration and declaration-only output.
// 2. Emit without a prior host diagnostic call and capture writes.
// 3. Assert TS2322, a Go error, truthful context and zero writes.
func TestEmitPluginSourceErrorsWithholdOutputs(t *testing.T) {
  for _, options := range []string{"", `,"declaration":true`, `,"declaration":true,"emitDeclarationOnly":true`, `,"incremental":true`} {
    t.Run(options, func(t *testing.T) {
      root := t.TempDir()
      writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","noEmitOnError":true%s},"files":["index.ts"]}`, options))
      writeProjectFile(t, root, "index.ts", `export const value: number = "bad";`)
      p, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
      if err != nil || len(diagnostics) != 0 {
        t.Fatalf("load: %v %v", err, diagnostics)
      }
      defer p.Close()
      writes := 0
      diagnostics, err = p.EmitWithPluginTransformers(nil, func(_, _ string, _ *shimcompiler.WriteFileData) error {
        writes++
        return nil
      })
      var failure *driver.PluginEmitError
      if !errors.As(err, &failure) || writes != 0 || len(diagnostics) != 1 || diagnostics[0].Code != 2322 {
        t.Fatalf("writes=%d diagnostics=%v error=%v", writes, diagnostics, err)
      }
      for _, text := range []string{"native plugin pre-emit checking failed", "error", "TS2322", "index.ts", "build output is incomplete"} {
        if !strings.Contains(err.Error(), text) {
          t.Fatalf("missing %q: %v", text, err)
        }
      }
    })
  }
}
