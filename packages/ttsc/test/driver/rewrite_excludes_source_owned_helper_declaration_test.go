package driver_test

import (
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteExcludesSourceOwnedHelperDeclaration Verifies a source-owned helper-shaped decoy cannot own the imported rewrite.
//
// A user variable may use the same __importDefault helper shape as the emitted
// default import. Helper kind alone then leaves two preferred candidates and
// cannot establish which declaration owns the source import.
//
// The preserved esModuleInterop:false input is a removed compiler option in the
// pinned upstream; its checker and helper emission keep interop enabled.
// Parsing must still preserve the explicit raw false value. The separate
// direct compiler/Node-oracle batch owns the equivalent runtime value check;
// this case does not certify that batch's execution or producer sharing.
//
// 1. Load the original explicit-false fixture and assert its parsed raw option.
// 2. Emit the imported rewrite, find its separate binding and retain the decoy call.
// 3. Require the literal imported replacement in the exported assignment.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual LoadProgram and asserts the parsed ESModuleInterop value is explicit false, then EmitAll requires an emitter binding distinct from plugin_99, the retained decoy call and rewritten export.
// @evidence contracts/testing.md#independent-expectations Authored esModuleInterop:false independently requires the parsed raw false value; literal plugin_99 decoy and rewritten-import replacement independently distinguish source-owned and emitter-owned declarations.
// @evidence contracts/testing.md#distinguishing-cases Both declarations share __importDefault(require("./plugin")) shape; the original removed esModuleInterop:false input is preserved without claiming it disables pinned-upstream interop.
// @evidence contracts/testing.md#execution-ownership The Go driver unit inspects actual in-process emission only; its original runtime decoy/value oracle is a separate batch subcase.
func TestDriverRewriteExcludesSourceOwnedHelperDeclaration(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true,
    "esModuleInterop": false
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
  writeProjectFile(t, root, "index.ts", `declare function require(path: string): {
  default: { make(input: string): string };
};
function __importDefault<T>(value: T): T {
  return value;
}
const plugin_99 = __importDefault(require("./plugin"));
import plugin from "./plugin";
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
  if !prog.TSProgram.Options().ESModuleInterop.IsFalse() {
    t.Fatalf("parsed ESModuleInterop = %v, want explicit false", prog.TSProgram.Options().ESModuleInterop)
  }
  file := prog.SourceFile(filepath.Join(root, "index.ts"))
  if file == nil {
    t.Fatal("SourceFile did not find index.ts")
  }
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          file,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"rewritten-import"`,
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
  bindings := regexp.MustCompile(`const (plugin(?:_\d+)?) = __importDefault\(require\("\./plugin"\)\);`).FindAllStringSubmatch(js, -1)
  emitted := ""
  for _, binding := range bindings {
    if len(binding) == 2 && binding[1] != "plugin_99" {
      emitted = binding[1]
    }
  }
  if emitted == "" {
    t.Fatalf("emitter-owned default import binding was not found: %v\n%s", bindings, js)
  }
  if !strings.Contains(js, `plugin_99.default.make("kept")`) {
    t.Fatalf("source-owned helper declaration was rewritten:\n%s", js)
  }
  if !strings.Contains(js, `exports.value = "rewritten-import";`) {
    t.Fatalf("rewritten imported export missing:\n%s", js)
  }
}
