package strip_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestTypeScriptLoaderTsconfigFollowsTheConfigPackageType verifies the ephemeral
// loader tsconfig derives `module` from the config file's nearest package.json
// "type" and asks for every installed `@types` package.
//
// A `strip.config.ts` is a Node module, and Node decides its format from the
// nearest package.json "type". Hardcoding "ESNext" ran every ambiguous `.ts`
// config as ESM, so `__dirname` threw in an ordinary CommonJS package, and
// without a wildcard `types` entry TypeScript 7 gave the loader Program no
// ambient type package at all (#1069). An explicit `.cts`/`.mts` extension
// already decides the format downstream, so those keep the ES-module setting.
//
//  1. Write a CommonJS package and a "type": "module" package.
//  2. Synthesize the loader tsconfig for a config in each.
//  3. Assert the ambiguous `.ts` config follows the package type, that a `.cts`
//     config is left to its extension, and that `types` is the wildcard.
func TestTypeScriptLoaderTsconfigFollowsTheConfigPackageType(t *testing.T) {
  root := t.TempDir()
  for name, manifest := range map[string]string{
    "cjs": `{"name":"cjs"}`,
    "esm": `{"name":"esm","type":"module"}`,
  } {
    dir := filepath.Join(root, name)
    if err := os.MkdirAll(dir, 0o755); err != nil {
      t.Fatalf("create %s: %v", dir, err)
    }
    if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(manifest), 0o644); err != nil {
      t.Fatalf("write manifest in %s: %v", dir, err)
    }
  }

  for _, testCase := range []struct {
    config string
    expect string
    label  string
  }{
    {filepath.Join(root, "cjs", "strip.config.ts"), "CommonJS", "ambiguous .ts in a CommonJS package"},
    {filepath.Join(root, "esm", "strip.config.ts"), "ESNext", "ambiguous .ts in a module package"},
    {filepath.Join(root, "esm", "strip.config.cts"), "ESNext", ".cts in a module package"},
  } {
    dir := t.TempDir()
    raw := stripTypeScriptLoaderTsconfig(
      filepath.Join(dir, "loader.mts"),
      testCase.config,
      dir,
    )
    var parsed struct {
      CompilerOptions struct {
        Module string   `json:"module"`
        Types  []string `json:"types"`
      } `json:"compilerOptions"`
    }
    if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
      t.Fatalf("parse generated tsconfig for %s: %v", testCase.label, err)
    }
    if parsed.CompilerOptions.Module != testCase.expect {
      t.Fatalf(
        "%s: module = %q, want %q",
        testCase.label,
        parsed.CompilerOptions.Module,
        testCase.expect,
      )
    }
    if len(parsed.CompilerOptions.Types) != 1 || parsed.CompilerOptions.Types[0] != "*" {
      t.Fatalf("%s: types = %#v, want [\"*\"]", testCase.label, parsed.CompilerOptions.Types)
    }
  }
}
