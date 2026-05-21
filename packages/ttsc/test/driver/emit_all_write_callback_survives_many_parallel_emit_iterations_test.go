package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitAllWriteCallbackSurvivesManyParallelEmitIterations brute-forces
// EmitAll's WriteFile-callback serialization across many emit iterations.
//
// EmitAll's callback touches two pieces of shared mutable state: the internal
// `cursors` map (per-source rewrite offsets, see rewrite.go::emit) and the
// caller-supplied `writeFile`, which a caller may back with its own
// non-thread-safe state (api_compile.go funnels output into a bare map). Both
// rely on emit()'s `wfMu`. A reverted mutex races probabilistically — TypeScript-Go's
// parallel emitter only sometimes interleaves two callbacks tightly enough for
// `-race` to flag it. The single-pass test (emit_rewrites_every_source_under_parallel_emit)
// pins the rewrite routing; this case re-emits a wide program many times, each
// pass writing into a fresh unguarded caller map and resolving a real rewrite
// per source (so `cursors` is mutated too), so a removed mutex fails ~always.
//
// 1. Load one wide multi-file project, each source owning a distinct call.
// 2. Re-run EmitAll many times with per-source rewrites and an unguarded map.
// 3. Assert every iteration patches every output exactly once, no losses.
func TestDriverEmitAllWriteCallbackSurvivesManyParallelEmitIterations(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: a wide source set so each emit fans out many emitter
  // goroutines. Every file re-declares `plugin` locally (legal — the `export`
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
  // is rebuilt fresh each iteration because applyRewrites advances `cursors`.
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
  // map standing in for api_compile's output object; the callback also runs
  // applyRewrites against the shared `cursors` map. A removed `wfMu` races one
  // or the other on essentially every pass once the iteration count is high.
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
