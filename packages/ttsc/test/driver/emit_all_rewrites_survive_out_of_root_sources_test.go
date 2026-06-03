package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitAllRewritesSurviveOutOfRootSources verifies a project file's
// rewrite is still applied when the rewrite set also carries sites from an
// imported source that sits outside the project's rootDir.
//
// A transform host collects call sites across the whole program, including
// dependency sources reached by import (e.g. a workspace package served as raw
// `.ts`). Those sources live outside rootDir and never emit, but they do land
// in the rewrite set. The output-to-source match must stay anchored on the
// program's common source directory (rootDir): anchoring on the directory
// shared by the rewrite set instead lets a far-away dependency path pull the
// shared root above rootDir, so every project file's tail grows longer than its
// outDir-relative output path carries and the rewrite is silently dropped —
// leaving the project's own emit untransformed even though its site was found.
//
// 1. A project whose `src/index.ts` and an imported `node_modules/dep/lib.ts`
//    both contain a plugin call.
// 2. Register a rewrite for each (the dependency one only to populate the set).
// 3. Emit the whole program and assert `bin/index.js` carries its rewrite.
func TestDriverEmitAllRewritesSurviveOutOfRootSources(t *testing.T) {
  root := t.TempDir()

  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "rootDir": "src",
    "strict": true
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", `import "dep";
declare const plugin: { make(): string };
export const value = plugin.make();
`)
  writeProjectFile(t, root, "node_modules/dep/package.json", `{
  "name": "dep",
  "version": "1.0.0",
  "main": "lib.ts"
}
`)
  writeProjectFile(t, root, "node_modules/dep/lib.ts", `declare const plugin: { make(): string };
export const fromDep = plugin.make();
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  index := prog.SourceFile(filepath.Join(root, "src", "index.ts"))
  if index == nil {
    t.Fatal("SourceFile did not find src/index.ts")
  }
  dep := prog.SourceFile(filepath.Join(root, "node_modules", "dep", "lib.ts"))
  if dep == nil {
    t.Fatal("SourceFile did not find node_modules/dep/lib.ts")
  }

  rewrites := driver.NewRewriteSet()
  // The dependency site populates the rewrite set with an out-of-root source,
  // reproducing the inflated-common-directory condition.
  rewrites.Add(driver.Rewrite{
    File:          dep,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"dep"`,
    ConsumeParens: true,
  })
  rewrites.Add(driver.Rewrite{
    File:          index,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"project"`,
    ConsumeParens: true,
  })

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

  js, ok := emitted["index.js"]
  if !ok {
    t.Fatalf("index.js was not emitted; emitted files: %v", keysOf(emitted))
  }
  if !strings.Contains(js, driver.RewriteSentinel) || !strings.Contains(js, `"project"`) {
    t.Fatalf("project file rewrite was dropped because of the out-of-root dependency source; got:\n%s", js)
  }
}

func keysOf(m map[string]string) []string {
  out := make([]string, 0, len(m))
  for k := range m {
    out = append(out, k)
  }
  return out
}
