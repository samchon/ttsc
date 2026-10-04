package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitRewritesEverySourceUnderParallelEmit Verifies whole-program
// emit patches every authored source file's output under the selected threading policy.
//
// Four distinct sources exercise per-output rewrite routing through the
// parallel-capable emitter. Each output owes its own replacement. Actual worker
// overlap/count and race-detector coverage are not observed by this case.
//
// 1. Load a four-file project, each file owning a distinct plugin call.
// 2. Register one rewrite per source with a file-unique replacement.
// 3. Emit the whole program and assert every output carries its own rewrite.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll puts the correct replacement and marker in each of four outputs.
// @evidence contracts/testing.md#independent-expectations Four authored source names determine distinct replacement literals.
// @evidence contracts/testing.md#distinguishing-cases Four distinct sources must retain their own rewrites rather than another file's replacement; missing outputs fail, while actual concurrency and duplicate callbacks are not certified.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit loads/closes an in-process Program and captures actual write callbacks with private filesystem inputs, without installing a consumer or running an executable compiler.
func TestDriverEmitRewritesEverySourceUnderParallelEmit(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: four module-scoped sources. Each re-declares `plugin`
  // locally (legal because the `export` makes every file its own module) and
  // calls it with a file-unique argument so a misrouted rewrite is visible.
  names := []string{"index", "alpha", "beta", "gamma"}
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

  // Rewrite setup: one replacement per source, each tagged with the file name
  // so the assertion can prove every output received its own splice.
  rewrites := driver.NewRewriteSet()
  for _, name := range names {
    source := prog.SourceFile(filepath.Join(root, name+".ts"))
    if source == nil {
      t.Fatalf("SourceFile did not find %s.ts", name)
    }
    rewrites.Add(driver.Rewrite{
      File:          source,
      RootName:      "plugin",
      Method:        "make",
      Replacement:   fmt.Sprintf("%q", "rewritten-"+name),
      ConsumeParens: true,
    })
  }

  // Emit assertion: the callback runs under emit()'s mutex, so writing this
  // map is safe; the assertions observe routing rather than worker overlap.
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  for _, name := range names {
    js := emitted[name+".js"]
    if js == "" {
      t.Fatalf("%s.js was not emitted: %#v", name, emitted)
    }
    if !strings.Contains(js, driver.RewriteSentinel) {
      t.Fatalf("%s.js missing rewrite sentinel:\n%s", name, js)
    }
    if want := `"rewritten-` + name + `"`; !strings.Contains(js, want) {
      t.Fatalf("%s.js missing its own replacement %s:\n%s", name, want, js)
    }
  }
}

// filesList appends the `.ts` extension to every entry in `names`, keeping the
// tsconfig `files` array in step with the fixture written to disk.
func filesList(names []string) []string {
  out := make([]string, len(names))
  for i, name := range names {
    out[i] = name + ".ts"
  }
  return out
}
