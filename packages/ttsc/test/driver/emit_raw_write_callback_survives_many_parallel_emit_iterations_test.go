package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitRawWriteCallbackSurvivesManyParallelEmitIterations Verifies that EmitAllRaw records 24 outputs exactly once across each of 200 emissions.
//
// Repeated wide emission exercises a parallel-capable callback boundary under
// the selected threading policy. Actual overlap and race coverage are unmeasured.
//
// 1. Load one wide multi-file project into an in-process Program.
// 2. Re-run EmitAllRaw many times, each with its own unguarded shared map.
// 3. Assert every iteration records exactly one write per source, no losses.
//
// @evidence contracts/testing.md#behavioral-verification EmitAllRaw records each of 24 authored output paths exactly once across each of 200 emissions.
// @evidence contracts/testing.md#independent-expectations The authored source names and configured bin output directory independently define expected paths; the one-output-per-source contract defines callback counts.
// @evidence contracts/testing.md#distinguishing-cases Repeated wide input and fresh maps distinguish missing, substituted and duplicate output callbacks; selected native scheduling and race-detector coverage are not certified.
// @evidence contracts/testing.md#execution-ownership One loaded Program serves all 200 raw emissions and is closed afterward. Go discovers TestDriverEmitRawWriteCallbackSurvivesManyParallelEmitIterations under ./test/driver.
func TestDriverEmitRawWriteCallbackSurvivesManyParallelEmitIterations(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: distinct source names owe distinct configured outputs.
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

  // Stress loop: reuse the same Program with a fresh callback map each pass.
  // This checks repeated emission outcomes, not timing or overlap frequency.
  const iterations = 200
  for iter := 0; iter < iterations; iter++ {
    emitted := map[string]int{}
    _, emitDiags, err := prog.EmitAllRaw(func(fileName, _ string, _ *shimcompiler.WriteFileData) error {
      // Read then write the unguarded map: both touch the bucket array,
      // without adding synchronization in the caller itself.
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
    normalizedPaths := map[string]bool{}
    for fileName := range emitted {
      normalizedPaths[filepath.ToSlash(fileName)] = true
    }
    for _, name := range names {
      want := filepath.ToSlash(filepath.Join(root, "bin", name+".js"))
      if !normalizedPaths[want] {
        t.Fatalf("iteration %d: missing authored output %s: %#v", iter, want, emitted)
      }
    }
  }
}
