package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestConfigLoadsFromJSONFile verifies that the strip driver reads configuration
// from an explicit JSON config file referenced via the configFile key.
//
// Locks the explicit-configFile path in loadStripConfigMap: when the plugin
// entry carries a "configFile" key, the driver must resolve the path relative
// to the tsconfig directory and parse the JSON file, not fall back to defaults
// or walk upward to discover a file.
//
//  1. Write two custom JSON files and a contrary discovered strip.config.json into
//     one fixture directory that also holds a tsconfig.json.
//  2. Call loadStripConfigMap with a plugin entry specifying "configFile".
//  3. Assert the returned config map contains the expected calls and statements.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripLoadStripConfigMap with relative config/selected.json and config/my-strip.json beside a discovered console.log/console.debug/debugger decoy. The explicit files supply exact trace/debugger and console.warn/empty-statements arrays respectively.
// @evidence contracts/testing.md#independent-expectations Explicit configFile wins over discovery and resolves against its tsconfig directory. The authored files have distinct literal arrays, including the original E2E warn-only configuration, so either fallback or accidental discovery fails the explicit expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns explicit relative JSON loading, both option arrays and precedence over a present automatic-discovery candidate; automatic discovery, ambiguity and unsupported entry keys have separate cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigLoadsFromJSONFile is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripLoadStripConfigMap, native path resolution and JSON loading in the Go process; no native plugin executable or Node child is used.
func TestConfigLoadsFromJSONFile(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":        `{"compilerOptions":{"target":"ES2022"}}`,
    "strip.config.json":    `{"calls":["console.log","console.debug"],"statements":["debugger"]}`,
    "config/selected.json": `{"calls":["trace"],"statements":["debugger"]}`,
    "config/my-strip.json": `{"calls":["console.warn"],"statements":[]}`,
  })
  config, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip", "configFile": "config/selected.json"},
    root,
    filepath.Join(root, "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("loadStripConfigMap error: %v", err)
  }
  calls, ok := config["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "trace" {
    t.Fatalf("unexpected calls: %#v", config["calls"])
  }
  statements, ok := config["statements"].([]any)
  if !ok || len(statements) != 1 || statements[0] != "debugger" {
    t.Fatalf("unexpected statements: %#v", config["statements"])
  }
  warnOnly, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip", "configFile": "config/my-strip.json"},
    root,
    filepath.Join(root, "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("load explicit warn-only JSON: %v", err)
  }
  calls, ok = warnOnly["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "console.warn" {
    t.Fatalf("explicit warn-only calls: %#v", warnOnly["calls"])
  }
  statements, ok = warnOnly["statements"].([]any)
  if !ok || len(statements) != 0 {
    t.Fatalf("explicit empty statements: %#v", warnOnly["statements"])
  }
}
