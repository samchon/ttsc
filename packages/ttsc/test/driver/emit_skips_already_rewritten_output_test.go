package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitSkipsAlreadyRewrittenOutput Verifies that EmitAll preserves the rewrite sentinel and plugin.make call and excludes the registered replacement.
//
// This source owns the sentinel bypass; ordinary rewrite inputs execute elsewhere.
//
// 1. Compile a source file that emits the rewrite sentinel comment.
// 2. Register a rewrite that would otherwise replace the plugin call.
// 3. Assert the emitted JavaScript keeps the original call.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll preserves the rewrite sentinel and plugin.make call and excludes the registered replacement.
// @evidence contracts/testing.md#independent-expectations The authored sentinel establishes already-rewritten output, so the supplied replacement must not occur.
// @evidence contracts/testing.md#distinguishing-cases This source owns the sentinel bypass; ordinary rewrite inputs execute elsewhere.
// @evidence contracts/testing.md#execution-ownership A direct Program and recording writer exercise Go emission without a CLI. Go discovers TestDriverEmitSkipsAlreadyRewrittenOutput under ./test/driver.
func TestDriverEmitSkipsAlreadyRewrittenOutput(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const plugin: { make(): string };
/* @ttsc-rewritten */
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
    Replacement:   `"should-not-appear"`,
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
  js := emitted["index.js"]
  if !strings.Contains(js, driver.RewriteSentinel) || !strings.Contains(js, "plugin.make") || strings.Contains(js, "should-not-appear") {
    t.Fatalf("already-rewritten output should pass through unchanged:\n%s", js)
  }
}
