package driver_test

import (
  "errors"
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitPluginDeclarationErrorsReturnGoError Verifies declaration errors return a failing Go
// error while noEmitOnError governs publication.
//
// Legacy native hosts check err but only print the diagnostic slice. TS4094
// must fail those hosts while noEmitOnError still controls output publication.
//
// 1. Export an anonymous class whose private member prevents valid declarations.
// 2. Emit with noEmitOnError enabled and disabled.
// 3. Assert structured TS4094, declaration failure context, buffered JavaScript
//    content and the write policy without publishing the callback's output.
//
// @evidence contracts/testing.md#behavioral-verification Calls EmitWithPluginTransformers on an actual declaration-invalid class for both noEmitOnError values, asserting PluginEmitError, exactly TS4094, declaration error context, unbuffered callback JavaScript with the exported class/private-member initializer, withheld buffered writes and unchanged source. Callback capture is not native host or manifest publication.
// @evidence contracts/testing.md#independent-expectations An exported anonymous class with private member independently owes TS4094; literal code and configured noEmitOnError define failure and write expectations. The pinned CommonJS transform preserves the named value declaration for a class initializer before assigning that same binding to exports; independent source names and initializer value define the three JavaScript assertions.
// @evidence contracts/testing.md#distinguishing-cases Both write-policy modes preserve the failing typed error while toggling callback delivery; the false lane retains JavaScript despite declaration failure, the true lane delivers nothing, and neither callback writes artifacts to disk. Native host publication and manifest suppression remain caller-owned.
// @evidence contracts/testing.md#execution-ownership Each named owning driver Go unit runs actual compiler and emitter APIs against private input with deferred Program close; no native executable or consumer install occurs.
func TestEmitPluginDeclarationErrorsReturnGoError(t *testing.T) {
  for _, noEmitOnError := range []bool{false, true} {
    t.Run(fmt.Sprint(noEmitOnError), func(t *testing.T) {
      root := t.TempDir()
      writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","declaration":true,"noEmitOnError":%v},"files":["index.ts"]}`, noEmitOnError))
      const source = `export const value = class { private hidden = 1; };`
      writeProjectFile(t, root, "index.ts", source)
      p, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
      if err != nil || len(diagnostics) != 0 {
        t.Fatalf("load: %v %v", err, diagnostics)
      }
      defer p.Close()
      pending := map[string]string{}
      diagnostics, err = p.EmitWithPluginTransformers(nil, func(name, text string, _ *shimcompiler.WriteFileData) error {
        pending[filepath.Clean(name)] = text
        return nil
      })
      var failure *driver.PluginEmitError
      if !errors.As(err, &failure) || len(diagnostics) != 1 || diagnostics[0].Code != 4094 {
        t.Fatalf("diagnostics=%v error=%v", diagnostics, err)
      }
      if (len(pending) == 0) != noEmitOnError {
        t.Fatalf("noEmitOnError=%v pending=%v", noEmitOnError, pending)
      }
      if !noEmitOnError {
        javascript, found := pending[filepath.Join(root, "lib", "index.js")]
        classStart := strings.Index(javascript, "const value = class")
        initializer := strings.Index(javascript, "this.hidden = 1;")
        exportedBinding := strings.Index(javascript, "exports.value = value;")
        if !found || classStart < 0 || initializer <= classStart || exportedBinding <= initializer {
          t.Fatalf("declaration failure lost the independently expected JavaScript: %q", javascript)
        }
      }
      if _, statErr := os.Stat(filepath.Join(root, "lib")); !os.IsNotExist(statErr) {
        t.Fatalf("capturing callback published an output directory: %v", statErr)
      }
      actualSource, readErr := os.ReadFile(filepath.Join(root, "index.ts"))
      if readErr != nil || string(actualSource) != source {
        t.Fatalf("emit changed its authored source: %q %v", actualSource, readErr)
      }
      if !strings.Contains(err.Error(), "declaration output is incomplete or skipped") || !strings.Contains(err.Error(), "TS4094") {
        t.Fatalf("missing declaration failure details: %v", err)
      }
    })
  }
}
