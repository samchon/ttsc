package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteReplacesCalleeOnly verifies rewrites can replace just the
// callee prefix while preserving the original argument list.
//
// This covers the non-consuming rewrite mode used when generated output should
// wrap or redirect the original runtime arguments.
//
// 1. Compile a plugin call with one runtime argument.
// 2. Register a rewrite with ConsumeParens disabled.
// 3. Assert the replacement function receives the original argument list.
func TestDriverRewriteReplacesCalleeOnly(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: ConsumeParens=false is used when generated code should wrap
  // or redirect the call without owning the original arguments.
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
  writeProjectFile(t, root, "index.ts", `declare const plugin: { make(input: string): string };
export const value = plugin.make("kept");
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
    File:        source,
    RootName:    "plugin",
    Method:      "make",
    Replacement: "replacement",
  })

  // Emit assertion: the argument list belongs to the original call and should
  // remain attached after the callee text is replaced.
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
  if !strings.Contains(js, `replacement("kept")`) {
    t.Fatalf("callee-only rewrite did not preserve arguments:\n%s", js)
  }
}
