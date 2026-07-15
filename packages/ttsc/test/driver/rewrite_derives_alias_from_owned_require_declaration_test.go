package driver_test

import (
  "os/exec"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteDerivesAliasFromOwnedRequireDeclaration verifies decoy
// identifiers do not compete with the import declaration that owns a rewrite.
//
// An unbounded identifier regex would remove the suffix ceiling but could
// rewrite `plugin_99.make` merely because its name looks generated. Matching
// the source module to the emitted require declaration rejects that decoy and
// still supports multiple ordered rewrites for the real import.
//
// 1. Place a generated-looking decoy call before a colliding default import.
// 2. Register two rewrites for the imported plugin's two calls.
// 3. Execute the output and assert the decoy survives beside both replacements.
func TestDriverRewriteDerivesAliasFromOwnedRequireDeclaration(t *testing.T) {
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
    return "plugin:" + input;
  }
};
`)
  writeProjectFile(t, root, "index.ts", `declare function require(path: string): {
  default: { make(input: string): string };
};
const plugin_99 = require("./plugin");
import plugin from "./plugin";
export const decoy = plugin_99.default.make("kept");
export const first = plugin.make("first");
export const second = plugin.make("second");
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
    Replacement:   `"rewritten-first"`,
    ConsumeParens: true,
  })
  rewrites.Add(driver.Rewrite{
    File:          file,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"rewritten-second"`,
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
    t.Fatalf("decoy call was rewritten:\n%s", js)
  }
  command := exec.Command("node", "-e", `const v = require("./index.js"); process.stdout.write(JSON.stringify(v))`)
  command.Dir = filepath.Dir(jsPath)
  output, err := command.CombinedOutput()
  if err != nil {
    t.Fatalf("rewritten JavaScript failed: %v\n%s", err, output)
  }
  got := string(output)
  for _, want := range []string{`"decoy":"plugin:kept"`, `"first":"rewritten-first"`, `"second":"rewritten-second"`} {
    if !strings.Contains(got, want) {
      t.Fatalf("runtime output missing %s: %s\n%s", want, got, js)
    }
  }
}
