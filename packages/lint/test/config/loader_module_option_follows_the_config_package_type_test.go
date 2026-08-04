package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestLoaderModuleOptionFollowsTheConfigPackageType verifies the ephemeral
// loader tsconfig derives `module` from the config file's package scope the way
// Node resolves it.
//
// A `lint.config.ts` is a Node module, and Node decides its format from the
// package scope it sits in. Hardcoding "ESNext" ran every ambiguous `.ts`
// config as ESM, so `__dirname` threw in an ordinary CommonJS package (#1068).
// Matching Node means matching the whole lookup, and the part that is easy to
// get wrong is where it stops: the FIRST manifest found bounds the scope, so a
// manifest declaring no "type" answers CommonJS instead of deferring to a
// module-typed ancestor. An explicit `.cts`/`.mts` extension decides the format
// downstream on its own, so those keep the ES-module setting either way.
//
//  1. Build a tree covering each step of the lookup: a manifest with no "type",
//     a "type": "module" package, nested manifests that override an ancestor in
//     both directions, a manifest that does not parse, and a directory with no
//     manifest of its own.
//  2. Synthesize the loader tsconfig for a config in each.
//  3. Assert every `module` matches what Node would conclude.
//
// The wildcard `types` entry is pinned alongside, as a regression guard rather
// than a proof: deleting it costs the loader Program every ambient type package
// TypeScript 7 would otherwise withhold, and the behaviour that depends on it is
// proved end to end by the lint suite's `__dirname` case.
func TestLoaderModuleOptionFollowsTheConfigPackageType(t *testing.T) {
  root := t.TempDir()
  for name, manifest := range map[string]string{
    "cjs":                 `{"name":"cjs"}`,
    "cjs/declared-module": `{"name":"declared","type":"module"}`,
    "esm":                 `{"name":"esm","type":"module"}`,
    "esm/nested":          `{"name":"nested"}`,
    "esm/unparseable":     `{"name":`,
  } {
    dir := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(dir, 0o755); err != nil {
      t.Fatalf("create %s: %v", dir, err)
    }
    if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(manifest), 0o644); err != nil {
      t.Fatalf("write manifest in %s: %v", dir, err)
    }
  }
  deep := filepath.Join(root, "esm", "deep")
  if err := os.MkdirAll(deep, 0o755); err != nil {
    t.Fatalf("create %s: %v", deep, err)
  }

  for _, testCase := range []struct {
    config string
    expect string
    label  string
  }{
    {filepath.Join(root, "cjs", "lint.config.ts"), "CommonJS", `a manifest with no "type" means CommonJS`},
    {filepath.Join(root, "esm", "lint.config.ts"), "ESNext", `an explicit "type": "module"`},
    {filepath.Join(root, "esm", "nested", "lint.config.ts"), "CommonJS", "the nearest manifest outranks a module-typed ancestor"},
    {filepath.Join(root, "cjs", "declared-module", "lint.config.ts"), "ESNext", "the nearest manifest outranks a CommonJS ancestor"},
    {filepath.Join(root, "esm", "unparseable", "lint.config.ts"), "CommonJS", "a manifest that does not parse still bounds the scope"},
    {filepath.Join(deep, "lint.config.ts"), "ESNext", "a directory with no manifest defers to the enclosing package"},
    {filepath.Join(root, "esm", "lint.config.cts"), "ESNext", ".cts is left to its extension"},
    {filepath.Join(root, "cjs", "lint.config.mts"), "ESNext", ".mts is left to its extension"},
    {filepath.Join(root, "cjs", "lint.config.js"), "CommonJS", "an ambiguous .js follows the same scope"},
  } {
    dir := t.TempDir()
    raw := typeScriptConfigLoaderTsconfig(
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
