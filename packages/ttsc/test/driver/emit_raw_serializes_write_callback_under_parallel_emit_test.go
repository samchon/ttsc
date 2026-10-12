package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitRawSerializesWriteCallbackUnderParallelEmit verifies that
// a wide EmitAllRaw invocation retains every authored output in an unguarded
// caller map under the emitter's selected threading policy.
//
// Multiple sources exercise the parallel-capable callback boundary. Actual
// worker overlap/count and race-detector coverage are not measured. The boolean
// map does not count duplicate callbacks.
//
// 1. Load a multi-file project into one in-process Program.
// 2. EmitAllRaw with a callback that reads and writes a shared unguarded map.
// 3. Require every configured source output path as well as cardinality.
//
// @evidence contracts/testing.md#behavioral-verification Calls EmitAllRaw and requires all eight authored output paths through an unguarded callback map.
// @evidence contracts/testing.md#independent-expectations Authored source names and the literal configured bin directory independently establish expected output paths and count.
// @evidence contracts/testing.md#distinguishing-cases Wide input exercises the parallel-capable callback boundary under selected threading policy; missing or substituted output paths fail. Duplicate callbacks and actual overlap are not certified.
// @evidence contracts/testing.md#execution-ownership The owning driver unit loads/closes an in-process Program and records actual callbacks with private filesystem inputs, without an executable compiler or installed consumer.
func TestDriverEmitRawSerializesWriteCallbackUnderParallelEmit(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: eight sources for the selected emitter threading policy.
  names := []string{"index", "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta"}
  writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": [%s]
}
`, `"`+strings.Join(filesList(names), `", "`)+`"`))
  for _, name := range names {
    writeProjectFile(t, root, name+".ts", fmt.Sprintf("export const value = %q;\n", name))
  }

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Emit assertion: `emitted` is a deliberately unguarded map standing in for a
  // plugin's per-file rewrite state. Both the read (length probe) and the write
  // happen inside the callback; actual concurrent scheduling is not measured.
  emitted := map[string]bool{}
  _, emitDiags, err := prog.EmitAllRaw(func(fileName shimtspath.RootedFilePath, _ string, _ *shimcompiler.WriteFileData) error {
    _ = len(emitted)
    emitted[fileName.AsString()] = true
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  if len(emitted) != len(names) {
    t.Fatalf("expected %d emitted outputs, got %d: %#v", len(names), len(emitted), emitted)
  }
  normalizedPaths := map[string]bool{}
  for fileName := range emitted {
    normalizedPaths[filepath.ToSlash(fileName)] = true
  }
  for _, name := range names {
    want := filepath.ToSlash(filepath.Join(root, "bin", name+".js"))
    if !normalizedPaths[want] {
      t.Fatalf("missing authored output %s: %#v", want, emitted)
    }
  }
}
