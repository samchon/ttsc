package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteDerivesAliasFromOwnedRequireDeclaration Verifies the owned import receives ordered rewrites while its require decoy stays intact.
//
// An unbounded identifier regex would remove the suffix ceiling but could
// rewrite `plugin_99.make` merely because its name looks generated. Matching
// the source module to the emitted require declaration rejects that decoy and
// still supports multiple ordered rewrites for the real import.
//
// 1. Emit a colliding default import beside a generated-looking require decoy.
// 2. Register both imported-call replacements in source order.
// 3. Require the untouched decoy call and both literal exported replacements.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual public driver emission, preserving the source decoy and requiring first/second replacements in emitted exports.
// @evidence contracts/testing.md#independent-expectations Literal first/second replacements and the authored plugin_99.default.make("kept") control independently identify changed and retained calls.
// @evidence contracts/testing.md#distinguishing-cases Two ordered imported calls contrast the preceding same-module, generated-looking source declaration.
// @evidence contracts/testing.md#execution-ownership The owning Go unit exercises LoadProgram and EmitAll without a runtime process; the named E2E batch case retains all three runtime values.
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
  for _, want := range []string{`exports.first = "rewritten-first";`, `exports.second = "rewritten-second";`} {
    if !strings.Contains(js, want) {
      t.Fatalf("rewritten export missing %s:\n%s", want, js)
    }
  }
}
