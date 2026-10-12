package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

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
// @evidence contracts/testing.md#behavioral-verification Calls EmitAll with source maps and an authored rewrite; JavaScript must carry the sentinel/replacement, a source map must exist and that map must carry neither.
// @evidence contracts/testing.md#independent-expectations Literal mapped replacement independently establishes patched JavaScript; the configured sourceMap option owes a nonempty map unaffected by executable call rewriting.
// @evidence contracts/testing.md#distinguishing-cases Paired JS/map outputs distinguish extension routing, and map existence prevents a vacuous negative if maps disappear.
// @evidence contracts/testing.md#execution-ownership This owning Go driver unit runs direct compiler/rewrite APIs and records local write callbacks with deferred Program close, without an executable host.
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
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
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
  if emitted["index.js.map"] == "" {
    t.Fatal("source-map-enabled emission produced no source map")
  }
  if strings.Contains(emitted["index.js.map"], driver.RewriteSentinel) || strings.Contains(emitted["index.js.map"], `"mapped"`) {
    t.Fatalf("source map should not be patched:\n%s", emitted["index.js.map"])
  }
}
