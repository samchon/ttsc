package driver_test

import (
  "fmt"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitRawWriteCallbackSurvivesManyParallelEmitIterations Verifies that EmitAllRaw records 24 outputs exactly once across each of 200 emissions.
//
// Repeated wide emission exposes callback overlap; detecting a data race still requires -race and suitable scheduling.
//
// 1. Load one wide multi-file project so each emit fans out many emitters.
// 2. Re-run EmitAllRaw many times, each with its own unguarded shared map.
// 3. Assert every iteration records exactly one write per source, no losses.
//
// @evidence contracts/testing.md#behavioral-verification EmitAllRaw records 24 outputs exactly once across each of 200 emissions.
// @evidence contracts/testing.md#independent-expectations The 24 authored source names and one-output-per-source contract define the counts.
// @evidence contracts/testing.md#distinguishing-cases Repeated wide emission exposes callback overlap; detecting a data race still requires -race and suitable scheduling.
// @evidence contracts/testing.md#execution-ownership One loaded Program serves all 200 raw emissions and is closed afterward. Go discovers TestDriverEmitRawWriteCallbackSurvivesManyParallelEmitIterations under ./test/driver.
func TestDriverEmitRawWriteCallbackSurvivesManyParallelEmitIterations(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: a wide source set. The more sources, the more emitter
  // goroutines TypeScript-Go spawns per pass, so the callback invocations are
  // likelier to overlap — exactly the window `-race` needs to flag a reverted
  // mutex. The names are arbitrary but distinct so each gets its own output.
  const sources = 24
  names := make([]string, sources)
  for i := range names {
    names[i] = fmt.Sprintf("mod%02d", i)
  }
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

  // Stress loop: re-emit the same program many times. Loading the program is
  // the costly step (~0.3s); a re-emit is cheap (~15ms), so a high iteration
  // count stays fast while multiplying the number of concurrent callback
  // windows the race detector observes. Each iteration owns a fresh map so a
  // torn write surfaces as a race on first overlap, not a slow corruption.
  const iterations = 200
  for iter := 0; iter < iterations; iter++ {
    emitted := map[string]int{}
    _, emitDiags, err := prog.EmitAllRaw(func(fileName, _ string, _ *shimcompiler.WriteFileData) error {
      // Read then write the unguarded map: both touch the bucket array,
      // so a removed mutex races on either access.
      _ = len(emitted)
      emitted[fileName]++
      return nil
    })
    if err != nil {
      t.Fatalf("iteration %d: %v", iter, err)
    }
    if len(emitDiags) != 0 {
      t.Fatalf("iteration %d: unexpected emit diagnostics: %#v", iter, emitDiags)
    }
    if len(emitted) != len(names) {
      t.Fatalf("iteration %d: expected %d emitted outputs, got %d: %#v", iter, len(names), len(emitted), emitted)
    }
    for fileName, count := range emitted {
      if count != 1 {
        t.Fatalf("iteration %d: %s written %d times (a lost or doubled write means a torn callback)", iter, fileName, count)
      }
    }
  }
}
