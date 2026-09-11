package driver_test

import (
  "errors"
  "fmt"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Verifies declaration diagnostics also return a failing Go error.
//
// Legacy native hosts check err but only print the diagnostic slice. TS4094
// must fail those hosts while noEmitOnError still controls output publication.
//
// 1. Export an anonymous class whose private member prevents valid declarations.
// 2. Emit with noEmitOnError enabled and disabled.
// 3. Assert structured TS4094, declaration failure context and the write policy.
func TestEmitPluginDeclarationErrorsReturnGoError(t *testing.T) {
  for _, noEmitOnError := range []bool{false, true} {
    t.Run(fmt.Sprint(noEmitOnError), func(t *testing.T) {
      root := t.TempDir()
      writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","declaration":true,"noEmitOnError":%v},"files":["index.ts"]}`, noEmitOnError))
      writeProjectFile(t, root, "index.ts", `export const value = class { private hidden = 1; };`)
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
      if !errors.As(err, &failure) || len(diagnostics) != 1 || diagnostics[0].Code != 4094 {
        t.Fatalf("diagnostics=%v error=%v", diagnostics, err)
      }
      if (writes == 0) != noEmitOnError {
        t.Fatalf("noEmitOnError=%v writes=%d", noEmitOnError, writes)
      }
      if !strings.Contains(err.Error(), "declaration output is incomplete or skipped") || !strings.Contains(err.Error(), "TS4094") {
        t.Fatalf("missing declaration failure details: %v", err)
      }
    })
  }
}
