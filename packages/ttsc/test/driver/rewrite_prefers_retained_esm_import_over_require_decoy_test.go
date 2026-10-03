package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewritePrefersRetainedESMImportOverRequireDecoy Verifies the retained ES module import wins over its helper-shaped require decoy.
//
// The emitted declaration parser sees both user code and emitter-owned code.
// When a real import remains in the output, its exact source-local identity
// must win over a same-module helper/require declaration that merely resembles
// the CommonJS emitter shape.
//
// 1. Emit the original nodenext module fixture and register the imported-call rewrite.
// 2. Require the unchanged require-shaped decoy and retained default import.
// 3. Require the literal exported replacement in the ES module output.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual driver emission, requiring unchanged plugin_99 call, retained ./plugin.js default import and literal export value.
// @evidence contracts/testing.md#independent-expectations Authored retained plugin import, decoy call and rewritten-esm literal independently distinguish the target and protected expression.
// @evidence contracts/testing.md#distinguishing-cases A retained ESM import coexists with a same-module CommonJS-shaped helper/require declaration; CommonJS ownership is covered by sibling units.
// @evidence contracts/testing.md#execution-ownership The Go unit directly emits and inspects its Program; the E2E batch independently imports this ESM artifact and preserves decoy/value runtime assertions.
func TestDriverRewritePrefersRetainedESMImportOverRequireDecoy(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "package.json", `{"type":"module"}
`)
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts", "plugin.ts"]
}
`)
  writeProjectFile(t, root, "plugin.ts", `export default {
  make(input: string): string {
    return "plugin:" + input;
  }
};
`)
  writeProjectFile(t, root, "index.ts", `function require(_path: string) {
  return { default: { make: (input: string) => "decoy:" + input } };
}
function __importDefault<T>(value: T): T {
  return value;
}
const plugin_99 = __importDefault(require("./plugin.js"));
import plugin from "./plugin.js";
export const decoy = plugin_99.default.make("kept");
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
  file := prog.SourceFile(filepath.Join(root, "index.ts"))
  if file == nil {
    t.Fatal("SourceFile did not find index.ts")
  }
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          file,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"rewritten-esm"`,
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
  if !strings.Contains(js, `plugin_99.default.make("kept")`) {
    t.Fatalf("require-shaped decoy was rewritten:\n%s", js)
  }
  for _, want := range []string{`import plugin from "./plugin.js";`, `export const value = "rewritten-esm";`} {
    if !strings.Contains(js, want) {
      t.Fatalf("retained ESM structure missing %s:\n%s", want, js)
    }
  }
}
