package driver_test

import (
  "fmt"
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteDerivesNamespaceImportBareBinding Verifies the namespace rewrite follows its emitter-owned bare binding.
//
// Namespace calls omit `.default`, so default-import coverage alone could hide
// a repair that derives the declaration but still constructs the wrong call
// head. The same declaration-derived identity must serve both import forms,
// including the unsuffixed namespace form TypeScript-Go deliberately retains.
//
// 1. Place fifteen generated-looking locals before the namespace import.
// 2. Emit its public driver rewrite and inspect the bare namespace binding.
// 3. Require the literal exported replacement; runtime loading belongs to TestDriverRewriteRuntimeBatch.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual LoadProgram and EmitAll, requiring the unsuffixed __importStar binding and literal rewritten export.
// @evidence contracts/testing.md#independent-expectations Authored namespace import and literal rewritten-namespace independently define binding shape and replacement.
// @evidence contracts/testing.md#distinguishing-cases Fifteen suffixed locals coexist with the intentionally bare namespace binding; default imports are covered by the suffix unit.
// @evidence contracts/testing.md#execution-ownership The Go driver unit directly emits and inspects its private Program output; Node consumption moved to the separately selected runtime batch.
func TestDriverRewriteDerivesNamespaceImportBareBinding(t *testing.T) {
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
  writeProjectFile(t, root, "plugin.ts", `export function make(input: string): string {
  return "plugin:" + input;
}
`)
  var source strings.Builder
  for i := 1; i < 16; i++ {
    fmt.Fprintf(&source, "const plugin_%d = %d;\n", i, i)
  }
  source.WriteString(`import * as plugin from "./plugin";
export const value = plugin.make("input");
`)
  writeProjectFile(t, root, "index.ts", source.String())

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  file := prog.SourceFile(filepath.Join(root, "index.ts"))
  if file == nil {
    t.Fatal("SourceFile did not find index.ts")
  }
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          file,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"rewritten-namespace"`,
    ConsumeParens: true,
  })
  _, emitDiags, err := prog.EmitAll(rewrites, nil)
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  jsPath := filepath.Join(root, "bin", "index.js")
  js := readFileForTest(t, jsPath)
  binding := regexp.MustCompile(`const (plugin(?:_\d+)?) = __importStar\(require\("\./plugin"\)\);`).FindStringSubmatch(js)
  if len(binding) != 2 || binding[1] != "plugin" {
    t.Fatalf("emitted namespace binding mismatch: %v\n%s", binding, js)
  }
  if !strings.Contains(js, `exports.value = "rewritten-namespace";`) {
    t.Fatalf("rewritten namespace export missing:\n%s", js)
  }
}
