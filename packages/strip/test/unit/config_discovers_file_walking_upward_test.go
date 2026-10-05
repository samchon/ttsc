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
//  1. Load a nested project with no candidate and assert default call policy.
//  2. Add an ancestor warn-only JSON and assert that discovery selects it.
//  3. Load a sibling empty JSON and assert built-in call/debugger policy.
//  4. Add a nearer logger.trace JSON and assert discovery changes to its custom policy.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripLoadStripConfigMap from nested/src without configFile: initial missing candidates supply an empty default config, an added ancestor JSON supplies exactly console.warn, and a later nearer JSON supplies exactly logger.trace with an empty statements list. Actual parsed policy changes from matching console.log but not logger.trace to the opposite. A sibling entry discovers its own {} JSON instead of that ancestor; stripParseStrip must enable debugger and match console.log, console.debug and assert.equal while retaining console.info and console.warn.
// @evidence contracts/testing.md#independent-expectations Discovery selects the nearest supported config. Authored console.warn and {} files are distinct inputs; the README default contract names console.log/console.debug/assert.* and debugger, giving literal positive and adjacent negative expectations independently of parsing or matching results.
// @evidence contracts/testing.md#distinguishing-cases Owns missing-to-present candidate changes, multi-level upward discovery and a nearer empty-object JSON that preserves default methods rather than inheriting ancestor custom rules. The appearing logger.trace fixture reproduces the original persistent-strip custom policy with console.log as a negative control. Environment override and same-directory ambiguity are separate cases. Default/custom AST removal is owned by the linked-program cases; these assertions own fresh configuration selection and parsing, not persistent consumer invalidation or reporter proof.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigDiscoversFileWalkingUpward is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripLoadStripConfigMap, shared discovery, native JSON loading and existing stripParseStrip/stripMatchesCall adapters in the Go process over one fixture root; no tsconfig Program or subprocess is loaded.
func TestConfigDiscoversFileWalkingUpward(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  root := shared.SeedProject(t, map[string]string{
    "nested/src/tsconfig.json": `{"compilerOptions":{"target":"ES2022"}}`,
    "empty/tsconfig.json": `{"compilerOptions":{"target":"ES2022"}}`,
    "empty/strip.config.json": `{}`,
  })
  missing, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip"},
    filepath.Join(root, "nested", "src"),
    filepath.Join(root, "nested", "src", "tsconfig.json"),
  )
  if err != nil || missing == nil || len(missing) != 0 {
    t.Fatalf("missing candidate default config: config=%#v error=%v", missing, err)
  }
  initial, err := stripParseStrip(missing)
  if err != nil {
    t.Fatal(err)
  }
  if !initial.stripDebugger || !stripMatchesCall(initial, "console.log") || stripMatchesCall(initial, "logger.trace") {
    t.Fatalf("missing candidate must select default call policy: %#v", initial)
  }
  shared.WriteFile(t, filepath.Join(root, "strip.config.json"), `{"calls":["console.warn"],"statements":[]}`)
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
  shared.WriteFile(t, filepath.Join(root, "nested", "strip.config.json"), `{"calls":["logger.trace"],"statements":[]}`)
  appeared, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip"},
    filepath.Join(root, "nested", "src"),
    filepath.Join(root, "nested", "src", "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("load appearing nearer config: %v", err)
  }
  calls, ok = appeared["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "logger.trace" {
    t.Fatalf("appearing config calls: %#v", appeared["calls"])
  }
  statements, ok := appeared["statements"].([]any)
  if !ok || len(statements) != 0 {
    t.Fatalf("appearing config statements: %#v", appeared["statements"])
  }
  custom, err := stripParseStrip(appeared)
  if err != nil {
    t.Fatal(err)
  }
  if custom.stripDebugger || !stripMatchesCall(custom, "logger.trace") || stripMatchesCall(custom, "console.log") {
    t.Fatalf("appearing config must replace default call policy: %#v", custom)
  }
}
