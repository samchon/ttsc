package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestLoaderModuleOptionFollowsTheConfigPackageType verifies the ephemeral
// loader tsconfig derives `module` from the config file's nearest package.json
// "type" instead of hardcoding one answer.
//
// A `lint.config.ts` is a Node module, and Node decides its format from the
// nearest package.json "type". Hardcoding "ESNext" ran every ambiguous `.ts`
// config as ESM, so `__dirname` threw in an ordinary CommonJS package (#1068).
// An explicit `.cts`/`.mts` extension already decides the format downstream, so
// those keep the ES-module setting and let the extension win.
//
//  1. Write a CommonJS package, a "type": "module" package, and a tree with no
//     manifest at all.
//  2. Synthesize the loader tsconfig for a config in each.
//  3. Assert the ambiguous `.ts` config follows the package type, that a
//     manifest-less tree falls back to CommonJS the way Node does, and that a
//     `.cts` config in a module package is left to its extension.
func TestLoaderModuleOptionFollowsTheConfigPackageType(t *testing.T) {
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
  bare := filepath.Join(root, "bare")
  if err := os.MkdirAll(bare, 0o755); err != nil {
    t.Fatalf("create %s: %v", bare, err)
  }

  for _, testCase := range []struct {
    config string
    expect string
    label  string
  }{
    {filepath.Join(root, "cjs", "lint.config.ts"), "CommonJS", "ambiguous .ts in a CommonJS package"},
    {filepath.Join(root, "esm", "lint.config.ts"), "ESNext", "ambiguous .ts in a module package"},
    {filepath.Join(bare, "lint.config.ts"), "CommonJS", "ambiguous .ts with no manifest above it"},
    {filepath.Join(root, "esm", "lint.config.cts"), "ESNext", ".cts in a module package"},
    {filepath.Join(root, "cjs", "lint.config.mts"), "ESNext", ".mts in a CommonJS package"},
  } {
    dir := t.TempDir()
    raw := typeScriptConfigLoaderTsconfig(
      filepath.Join(dir, "loader.mts"),
      testCase.config,
      dir,
    )
    var parsed struct {
      CompilerOptions struct {
        Module string `json:"module"`
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
  }
}
