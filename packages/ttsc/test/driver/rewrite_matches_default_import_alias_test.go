package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteMatchesDefaultImportAlias Verifies CommonJS default-import
// aliases are considered rewrite candidates.
//
// TypeScript-Go emits default imports as generated variables such as
// plugin_1.default, and the driver must still match the source root name.
//
// 1. Compile a project with a default import named plugin.
// 2. Register a rewrite using the source-level root name.
// 3. Assert the generated default-import call is replaced.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll replaces a CommonJS default-import call using its source root.
// @evidence contracts/testing.md#independent-expectations The authored alias replacement grounds the complete expected assignment.
// @evidence contracts/testing.md#distinguishing-cases Default alias differs from namespace and plain-root matching cases.
// @evidence contracts/testing.md#execution-ownership Go unit TestDriverRewriteMatchesDefaultImportAlias is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestDriverRewriteMatchesDefaultImportAlias(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts", "plugin.ts"]
}
`)
  writeProjectFile(t, root, "plugin.ts", `export default {
  make(input: string): string {
    return input;
  }
};
`)
  writeProjectFile(t, root, "index.ts", `import plugin from "./plugin";
export const value = plugin.make("input");
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
    Replacement:   `"alias"`,
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
  if !strings.Contains(js, `exports.value = "alias";`) {
    t.Fatalf("default import alias rewrite mismatch:\n%s", js)
  }
}
