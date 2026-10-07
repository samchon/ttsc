package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitAllWriteCallbackSurvivesManyParallelEmitIterations Verifies repeated wide
// emission retains every source output and its independent rewrite.
//
// Each of two hundred iterations emits twenty-four sources into a fresh
// unguarded output map and exercises a real rewrite per source. The output
// assertions require the expected paths and rewritten source values. They
// do not count duplicate callbacks or certify race-detector coverage.
//
// 1. Load one wide multi-file project, each source owning a distinct call.
// 2. Re-run EmitAll many times with per-source rewrites and an unguarded map.
// 3. Assert every iteration patches every output with its expected rewrite, no losses.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual EmitAll two hundred times with twenty-four per-source rewrites and a fresh unguarded callback map; every iteration must contain every file and its own replacement.
// @evidence contracts/testing.md#independent-expectations Authored file names and literal rewritten-name strings independently establish output cardinality and per-source identity.
// @evidence contracts/testing.md#distinguishing-cases A wide source set and repeated fresh rewrite sets exercise the parallel-capable emitter's callback boundary under its selected threading policy; unique replacements detect wrong routing and missing output fails the cardinality guard. Actual worker overlap/count and race-detector coverage are not asserted.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit reuses one immutable in-process Program and private project across repeated emits, with fresh maps and rewrite sets and deferred Program close. No executable compiler runs.
func TestDriverEmitAllWriteCallbackSurvivesManyParallelEmitIterations(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: a wide source set for the emitter's selected threading
  // policy. Every file re-declares `plugin` locally (legal — the `export`
  // makes each file its own module) and calls it with a file-unique argument,
  // so a misrouted rewrite under a torn `cursors` map is observable.
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
    writeProjectFile(t, root, name+".ts", fmt.Sprintf(
      "declare const plugin: { make(input: string): string };\n"+
        "export const value = plugin.make(%q);\n", name))
  }

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Rewrite setup: one replacement per source, tagged with the file name so a
  // misrouted splice (the symptom of a torn `cursors` map) is caught. The set
  // is rebuilt fresh each iteration; production emit owns invocation-local
  // cursors rather than advancing state in the RewriteSet itself.
  makeRewrites := func() *driver.RewriteSet {
    rs := driver.NewRewriteSet()
    for _, name := range names {
      source := prog.SourceFile(filepath.Join(root, name+".ts"))
      if source == nil {
        t.Fatalf("SourceFile did not find %s.ts", name)
      }
      rs.Add(driver.Rewrite{
        File:          source,
        RootName:      "plugin",
        Method:        "make",
        Replacement:   fmt.Sprintf("%q", "rewritten-"+name),
        ConsumeParens: true,
      })
    }
    return rs
  }

  // Stress loop: re-emit many times. Each pass uses a fresh unguarded caller
  // map standing in for a caller's output object; callbacks also run the real
  // rewrite against that invocation's cursor map. This does not guarantee a
  // race frequency or that concurrent native callbacks occurred in a run.
  const iterations = 200
  for iter := 0; iter < iterations; iter++ {
    emitted := map[string]string{}
    _, emitDiags, err := prog.EmitAll(makeRewrites(), func(fileName, text string, _ *shimcompiler.WriteFileData) error {
      emitted[filepath.Base(fileName)] = text
      return nil
    })
    if err != nil {
      t.Fatalf("iteration %d: %v", iter, err)
    }
    if len(emitDiags) != 0 {
      t.Fatalf("iteration %d: unexpected emit diagnostics: %#v", iter, emitDiags)
    }
    if len(emitted) != len(names) {
      t.Fatalf("iteration %d: expected %d emitted outputs, got %d", iter, len(names), len(emitted))
    }
    for _, name := range names {
      js := emitted[name+".js"]
      if js == "" {
        t.Fatalf("iteration %d: %s.js was not emitted", iter, name)
      }
      if want := `"rewritten-` + name + `"`; !strings.Contains(js, want) {
        t.Fatalf("iteration %d: %s.js missing its own replacement %s (a misrouted splice means a torn cursors map):\n%s", iter, name, want, js)
      }
    }
  }
}
