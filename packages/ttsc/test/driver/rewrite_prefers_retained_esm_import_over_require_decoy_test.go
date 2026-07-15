package driver_test

import (
  "os/exec"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewritePrefersRetainedESMImportOverRequireDecoy verifies a
// CommonJS-shaped local cannot impersonate an import retained in ESM output.
//
// The emitted declaration parser sees both user code and emitter-owned code.
// When a real import remains in the output, its exact source-local identity
// must win over a same-module helper/require declaration that merely resembles
// the CommonJS emitter shape.
//
// 1. Emit ESM with a retained default import and a same-module require decoy.
// 2. Register one rewrite for the imported call through the public driver API.
// 3. Execute the module and assert only the imported call was replaced.
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
  command := exec.Command("node", "--input-type=module", "-e", `const v = await import("./index.js"); process.stdout.write(JSON.stringify(v))`)
  command.Dir = filepath.Dir(jsPath)
  output, err := command.CombinedOutput()
  if err != nil {
    t.Fatalf("rewritten JavaScript failed: %v\n%s", err, output)
  }
  got := string(output)
  for _, want := range []string{`"decoy":"decoy:kept"`, `"value":"rewritten-esm"`} {
    if !strings.Contains(got, want) {
      t.Fatalf("runtime output missing %s: %s\n%s", want, got, js)
    }
  }
}
