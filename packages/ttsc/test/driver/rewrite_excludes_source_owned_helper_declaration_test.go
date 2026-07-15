package driver_test

import (
  "os/exec"
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteExcludesSourceOwnedHelperDeclaration verifies helper shape
// cannot make a source variable impersonate an emitter-owned import binding.
//
// A user variable may use the same __importDefault helper shape as the emitted
// default import. Helper kind alone then leaves two preferred candidates and
// cannot establish which declaration owns the source import.
//
// 1. Emit a default import beside a same-module, helper-shaped user decoy.
// 2. Register one rewrite for the imported call through the public driver API.
// 3. Execute the output and assert the decoy survives beside the replacement.
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
  command := exec.Command("node", "-e", `const v = require("./index.js"); process.stdout.write(JSON.stringify(v))`)
  command.Dir = filepath.Dir(jsPath)
  output, err := command.CombinedOutput()
  if err != nil {
    t.Fatalf("rewritten JavaScript failed: %v\n%s", err, output)
  }
  got := string(output)
  for _, want := range []string{`"decoy":"plugin:kept"`, `"value":"rewritten-import"`} {
    if !strings.Contains(got, want) {
      t.Fatalf("runtime output missing %s: %s\n%s", want, got, js)
    }
  }
}
