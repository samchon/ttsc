package driver_test

import (
  "fmt"
  "os/exec"
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteDerivesNamespaceImportBareBinding verifies a namespace
// import uses the emitter-owned bare binding recovered from its declaration.
//
// Namespace calls omit `.default`, so default-import coverage alone could hide
// a repair that derives the declaration but still constructs the wrong call
// head. The same declaration-derived identity must serve both import forms,
// including the unsuffixed namespace form TypeScript-Go deliberately retains.
//
// 1. Place fifteen generated-looking locals before a namespace import.
// 2. Rewrite its call through public `EmitAll` and inspect the bare binding.
// 3. Execute the emitted CommonJS file and assert the replacement value.
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
  command := exec.Command("node", "-e", `process.stdout.write(String(require("./index.js").value))`)
  command.Dir = filepath.Dir(jsPath)
  output, err := command.CombinedOutput()
  if err != nil {
    t.Fatalf("rewritten JavaScript failed: %v\n%s", err, output)
  }
  if string(output) != "rewritten-namespace" {
    t.Fatalf("runtime value = %q\n%s", output, js)
  }
}
