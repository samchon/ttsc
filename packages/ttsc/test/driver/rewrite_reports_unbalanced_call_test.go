package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestRewriteReportsUnbalancedCall Verifies rewrite errors include scanner
// failures.
//
// When generated JavaScript contains a candidate call with unbalanced
// parentheses, the rewrite scanner should return the underlying parse error
// instead of reporting a generic missing-call message.
//
// 1. Load a valid source and register its consuming rewrite.
// 2. Pass a literal output missing the call close to the linked applyRewrites helper.
// 3. Assert the private scanner reports unbalanced parens.
//
// @evidence contracts/testing.md#behavioral-verification Linked applyRewrites returns unbalanced parens for an authored malformed output.
// @evidence contracts/testing.md#independent-expectations The literal missing close parenthesis independently establishes scanner failure.
// @evidence contracts/testing.md#distinguishing-cases Registered candidate with malformed output is covered; the compiler is not asked to emit invalid JavaScript.
// @evidence contracts/testing.md#execution-ownership Go unit TestRewriteReportsUnbalancedCall is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestRewriteReportsUnbalancedCall(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const plugin: { make(input: string): string };
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
  source := prog.SourceFile(root + "/index.ts")
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          source,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"replacement"`,
    ConsumeParens: true,
  })
  _, err = driverApplyRewrites(filepath.Join(root, "bin", "index.js"), `const value = plugin.make("input";`, rewrites, map[string]int{})
  if err == nil || !strings.Contains(err.Error(), "unbalanced parens") {
    t.Fatalf("expected scanner error, got %v", err)
  }
}
