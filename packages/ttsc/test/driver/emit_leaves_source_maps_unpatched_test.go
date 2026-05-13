package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitLeavesSourceMapsUnpatched verifies rewrite matching does not
// treat emitted source maps as JavaScript outputs.
//
// The output-to-source matcher trims only the final extension, so a .js.map
// file must not accidentally inherit the source file rewrite.
//
// 1. Compile a source-map-enabled project with one plugin call.
// 2. Register a rewrite against the TypeScript source.
// 3. Assert JavaScript is patched while the source map has no sentinel.
func TestDriverEmitLeavesSourceMapsUnpatched(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "sourceMap": true,
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const plugin: { make(): string };
export const value = plugin.make();
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  source := prog.SourceFile(filepath.Join(root, "index.ts"))
  if source == nil {
    t.Fatal("SourceFile did not find index.ts")
  }
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          source,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"mapped"`,
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
  if !strings.Contains(emitted["index.js"], driver.RewriteSentinel) || !strings.Contains(emitted["index.js"], `"mapped"`) {
    t.Fatalf("JavaScript output was not patched:\n%s", emitted["index.js"])
  }
  if strings.Contains(emitted["index.js.map"], driver.RewriteSentinel) || strings.Contains(emitted["index.js.map"], `"mapped"`) {
    t.Fatalf("source map should not be patched:\n%s", emitted["index.js.map"])
  }
}
