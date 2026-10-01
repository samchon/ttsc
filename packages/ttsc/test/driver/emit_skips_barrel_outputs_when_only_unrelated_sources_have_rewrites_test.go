package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitSkipsBarrelOutputsWhenOnlyUnrelatedSourcesHaveRewrites
// verifies a sibling barrel output whose source has no registered rewrite is
// emitted unchanged while the rewritten source in the same directory is patched.
//
// The motivating report (nestia-generated barrel `index.ts` files next to
// modules holding `typia.random` calls) involved a basename-only suffix match
// between a barrel output and a rewriting source's output. This fixture has one
// `index.ts` and one rewritten `target.ts` in the same directory, so it covers
// the barrel-beside-rewritten-source layout but does not build a second source
// sharing the barrel's basename; the cross-directory collision is not
// exercised here.
//
//  1. Compile a project with `target.ts` (has the plugin call) and a sibling
//     barrel `index.ts` that re-exports it.
//  2. Register a single rewrite on `target.ts`.
//  3. Assert the emit succeeds, `target.js` gets the replacement, and the
//     barrel `index.js` is emitted without the replacement or the sentinel.
func TestDriverEmitSkipsBarrelOutputsWhenOnlyUnrelatedSourcesHaveRewrites(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["src/feature/target.ts", "src/feature/index.ts"]
}
`)
  writeProjectFile(t, root, "src/feature/target.ts", `import plugin from "./plugin";
export const value = plugin.make("input");
`)
  writeProjectFile(t, root, "src/feature/index.ts", `export * from "./target";
`)
  writeProjectFile(t, root, "src/feature/plugin.ts", `export default {
  make(input: string): string {
    return input;
  }
};
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  target := prog.SourceFile(filepath.Join(root, "src", "feature", "target.ts"))
  if target == nil {
    t.Fatal("SourceFile did not find target.ts")
  }

  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          target,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"replaced"`,
    ConsumeParens: true,
  })
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  })
  if err != nil {
    t.Fatalf("emit returned an error (regression: barrel mis-mapped to rewriting source): %v", err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  if !strings.Contains(emitted["target.js"], `"replaced"`) {
    t.Fatalf("target rewrite not applied:\n%s", emitted["target.js"])
  }
  indexJs, ok := emitted["index.js"]
  if !ok {
    t.Fatal("barrel index.js was not emitted")
  }
  if strings.Contains(indexJs, `"replaced"`) {
    t.Fatalf("barrel index.js was unexpectedly rewritten:\n%s", indexJs)
  }
  if strings.Contains(indexJs, driver.RewriteSentinel) {
    t.Fatalf("barrel index.js was marked rewritten without any rewrites:\n%s", indexJs)
  }
}
