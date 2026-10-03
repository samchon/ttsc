package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestLoaderModuleOptionFollowsTheConfigPackageType verifies the ephemeral
// loader tsconfig derives its `module` option from the nearest package manifest
// and preserves the generator's explicit-extension and malformed-manifest policy.
//
// A `lint.config.ts` is a Node module, and Node decides its format from the
// package scope it sits in. Hardcoding "ESNext" ran every ambiguous `.ts`
// config as ESM, so `__dirname` threw in an ordinary CommonJS package (#1068).
// The generator stops at the first readable manifest: a missing type or malformed
// JSON selects CommonJS instead of deferring to a module-typed ancestor. That
// malformed fallback is a synthesis policy, not Node runtime parity: Node's
// package loader rejects invalid package JSON. Explicit `.cts`/`.mts` inputs keep
// ESNext here; their extension-specific runtime behavior is not executed below.
//
//  1. Build a tree covering each step of the lookup: a manifest with no "type",
//     a "type": "module" package, nested manifests that override an ancestor in
//     both directions, a manifest that does not parse, and a directory with no
//     manifest of its own.
//  2. Synthesize the loader tsconfig for a config in each.
//  3. Assert every generated `module` matches the authored policy table.
//
// The wildcard `types` entry is pinned alongside as a generated-setting guard.
// This case does not compile ambient types; the separate `__dirname` consumer
// case owns its typed config and runtime contribution, not an exhaustive ambient
// type-package oracle supplied by this JSON comparison.
//
// @evidence contracts/testing.md#behavioral-verification typeScriptConfigLoaderTsconfig emits parseable JSON whose module option follows the nearest readable manifest, including the CommonJS malformed-JSON fallback; explicit mts/cts inputs emit ESNext without proving downstream runtime behavior.
// @evidence contracts/testing.md#independent-expectations Authored nearest manifests and literal CommonJS/ESNext options specify the loader synthesis policy; independent encoding/json decoding observes the generated result.
// @evidence contracts/testing.md#distinguishing-cases Nearest scopes override opposite ancestors, absent manifests inherit, malformed manifests bound scope, and explicit mts/cts contrast with ambiguous ts/js extensions.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Authored temporary package scopes reach typeScriptConfigLoaderTsconfig, followed by independent JSON decoding in-process; generated module and types options are inspected without compiling or evaluating the generated loader.
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
