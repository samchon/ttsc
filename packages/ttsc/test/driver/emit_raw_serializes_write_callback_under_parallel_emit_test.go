package driver_test

import (
  "fmt"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitRawSerializesWriteCallbackUnderParallelEmit verifies that
// EmitAllRaw funnels its WriteFile callback through one mutex even though
// TypeScript-Go emits files in parallel.
//
// With SingleThreaded dropped (PR #112), TypeScript-Go runs one emitter
// goroutine per source file. EmitAll already serializes its callback, but
// EmitAllRaw — the seam a plugin's own output rewriter uses (e.g. @nestia/core,
// which carries per-file rewrite cursors and a runtime-alias cache) — used to
// hand the callback straight to the parallel emitter. A stateful callback then
// tripped `fatal error: concurrent map read and map write` (issue #115). This
// case mutates a bare, unguarded map from inside the callback across many
// sources, so `go test -race` flags the regression if the mutex is ever
// removed. A single-source fixture cannot surface it — only one emitter spawns.
//
// 1. Load a multi-file project so the parallel emitter actually fans out.
// 2. EmitAllRaw with a callback that reads and writes a shared unguarded map.
// 3. Assert every source produced exactly one output with no lost writes.
func TestDriverEmitRawSerializesWriteCallbackUnderParallelEmit(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: enough sources that TypeScript-Go's parallel emit spawns
  // many concurrent emitter goroutines, each invoking the WriteFile callback.
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
  // happen inside the callback; without EmitAllRaw's mutex the concurrent
  // emitter goroutines would race it.
  emitted := map[string]bool{}
  _, emitDiags, err := prog.EmitAllRaw(func(fileName, _ string, _ *shimcompiler.WriteFileData) error {
    _ = len(emitted)
    emitted[fileName] = true
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
}
