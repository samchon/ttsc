package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestConfigDiscoversFileWalkingUpward verifies that the strip driver discovers
// strip.config.json by walking upward from the tsconfig directory.
//
// Locks the auto-discovery walk in findStripConfigFile: when no configFile key
// is present, the driver must search the tsconfig directory and each ancestor in
// order, stopping at the first directory with exactly one strip.config.* file.
//
//  1. Place a strip.config.json in a parent directory and a tsconfig.json in a
//     nested subdirectory (no strip.config.* in the subdirectory itself).
//  2. Call loadStripConfigMap with a plugin entry that has no configFile key,
//     pointing at the nested tsconfig.
//  3. Assert the parent-level custom config, then load a nearer empty JSON file
//     and assert its parsed built-in call/debugger policy.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripLoadStripConfigMap from nested/src without configFile and asserts the ancestor JSON supplies exactly console.warn. A sibling entry discovers its own {} JSON instead of that ancestor; stripParseStrip must enable debugger and match console.log, console.debug and assert.equal while retaining console.info and console.warn.
// @evidence contracts/testing.md#independent-expectations Discovery selects the nearest supported config. Authored console.warn and {} files are distinct inputs; the README default contract names console.log/console.debug/assert.* and debugger, giving literal positive and adjacent negative expectations independently of parsing or matching results.
// @evidence contracts/testing.md#distinguishing-cases Owns multi-level upward discovery and a nearer empty-object JSON that preserves default methods rather than inheriting ancestor custom rules. Environment override and same-directory ambiguity are separate cases. Default AST removal is owned by TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations; these assertions own configuration selection and parsing only.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigDiscoversFileWalkingUpward is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripLoadStripConfigMap, shared discovery, native JSON loading and existing stripParseStrip/stripMatchesCall adapters in the Go process over one fixture root; no tsconfig Program or subprocess is loaded.
func TestConfigDiscoversFileWalkingUpward(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  root := shared.SeedProject(t, map[string]string{
    "strip.config.json":        `{"calls":["console.warn"],"statements":[]}`,
    "nested/src/tsconfig.json": `{"compilerOptions":{"target":"ES2022"}}`,
    "empty/tsconfig.json": `{"compilerOptions":{"target":"ES2022"}}`,
    "empty/strip.config.json": `{}`,
  })
  config, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip"},
    filepath.Join(root, "nested", "src"),
    filepath.Join(root, "nested", "src", "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("loadStripConfigMap error: %v", err)
  }
  calls, ok := config["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "console.warn" {
    t.Fatalf("unexpected calls from ancestor config: %#v", config["calls"])
  }
  empty, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip"},
    filepath.Join(root, "empty"),
    filepath.Join(root, "empty", "tsconfig.json"),
  )
  if err != nil || empty == nil || len(empty) != 0 {
    t.Fatalf("nearest empty JSON: config=%#v error=%v", empty, err)
  }
  defaults, err := stripParseStrip(empty)
  if err != nil {
    t.Fatal(err)
  }
  if !defaults.stripDebugger || !stripMatchesCall(defaults, "console.log") || !stripMatchesCall(defaults, "console.debug") || !stripMatchesCall(defaults, "assert.equal") || stripMatchesCall(defaults, "console.info") || stripMatchesCall(defaults, "console.warn") {
    t.Fatalf("empty JSON must retain built-in strip policy: %#v", defaults)
  }
}
